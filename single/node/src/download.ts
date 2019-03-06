// NOTES:
// * I tested axios responseType="arraybuffer" but it was tragically slow
// * I tested waiting until all streams were available and then used multistream but it was the same speed as concurrency=1
// * I tested multiple fs.write() threads in a sparse file instead of streams, this was a bit faster but isn't supported on Windows

// includes
import axios from 'axios';
import bytes from 'bytes';
import cmd = require('commander');
import dotenv = require('dotenv');
import * as winston from 'winston';
import * as fs from 'fs';
import { performance, PerformanceObserver } from 'perf_hooks';

// set env
dotenv.config();

// define options
cmd.option(
    '-l, --log-level <s>',
    'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".',
    /^(error|warn|info|verbose|debug|silly)$/i
)
    .option(
        '-u, --url <s>',
        '[REQUIRED*] URL. Specify the URL of the file to retrieve.'
    )
    .option(
        '-s, --sas <s>',
        '[REQUIRED*] STORAGE_SAS. The SAS token for accessing an Azure Storage Account. You must specify either the STORAGE_KEY or STORAGE_SAS unless using URL.'
    )
    .option(
        '-z, --file-size <s>',
        '[REQUIRED] FILE_SIZE. The size of the file to download. You can use 80MB, 1TB, 100KB, etc. Set this to a bit bigger than the file.'
    )
    .option(
        '-n, --concurrency <i>',
        'CONCURRENCY. The number of simultaneous reads. Default is "1".',
        parseInt
    )
    .option(
        '--source-method <s>',
        'SOURCE_METHOD. If "url" then only the URL is used. If "round-robin" then URL plus any URL_# environment variables are used. If "assemble" then URL plus .# per concurrency are assembled. Defaults to "url".'
    )
    .parse(process.argv);

// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const URL = cmd.url || process.env.URL;
const listOfUrls: string[] = [];
if (URL) listOfUrls.push(URL);
for (let i = 0; i < 99; i++) {
    const alt = process.env[`URL_${i}`];
    if (alt) listOfUrls.push(alt);
}
let urlIndex = 0;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const CONCURRENCY = cmd.concurrency || process.env.CONCURRENCY || 1;
const FILE_SIZE = cmd.fileSize || process.env.FILE_SIZE;
let SOURCE_METHOD = cmd.sourceMethod || process.env.SOURCE_METHOD;
if (!['url', 'round-robin', 'assemble'].includes(SOURCE_METHOD))
    SOURCE_METHOD = 'url';

// start logging
const logColors: {
    [index: string]: string;
} = {
    debug: '\x1b[32m', // green
    error: '\x1b[31m', // red
    info: '', // white
    silly: '\x1b[32m', // green
    verbose: '\x1b[32m', // green
    warn: '\x1b[33m' // yellow
};
const transport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(event => {
            const color = logColors[event.level] || '';
            const level = event.level.padStart(7);
            return `${event.timestamp} ${color}${level}\x1b[0m: ${
                event.message
            }`;
        })
    )
});
const logger = winston.createLogger({
    level: LOG_LEVEL,
    transports: [transport]
});

// read a chunk of data
async function readChunk(index: number, size: number) {
    const chunkStart = index * size;
    const chunkStop = (index + 1) * size - 1;

    // determine the appropriate URL
    const url: string =
        (() => {
            switch (SOURCE_METHOD) {
                case 'url':
                    return URL;
                case 'round-robin':
                    if (urlIndex > listOfUrls.length - 1) urlIndex = 0;
                    const use = listOfUrls[urlIndex];
                    urlIndex++;
                    return use;
                case 'assemble':
                    return `${URL}.${index}`;
            }
        })() + STORAGE_SAS;
    logger.info(
        `getting [${index}] ${chunkStart} to ${chunkStop} from ${url} @ ${performance.now()}...`
    );
    performance.mark(`read-${index}:started`);

    // define headers
    const headers = {
        'x-ms-date': new Date().toUTCString(),
        'x-ms-version': '2017-07-29'
    };
    switch (SOURCE_METHOD) {
        case 'url':
        case 'round-robin':
            headers['x-ms-range'] = `bytes=${chunkStart}-${chunkStop}`;
            break;
    }

    // get the chunk
    return axios({
        method: 'get',
        url,
        responseType: 'stream',
        headers,
        maxContentLength: 90886080
    }).then(response => {
        performance.mark(`read-${index}:firstByte`);
        logger.verbose(
            `first byte received [${index}] @ ${performance.now()}...`
        );
        return response.data;
    });
}

async function writeChunk(file: fs.WriteStream, stream: any) {
    return new Promise(resolve => {
        stream.pipe(
            file,
            { end: false }
        );
        stream.on('end', () => {
            resolve();
        });
    });
}

async function readBlob() {
    const segment = Math.ceil(bytes(FILE_SIZE) / CONCURRENCY);

    const promises: any[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        const promise = readChunk(i, segment);
        promises.push(promise);
    }

    return Promise.all(promises).then(async streams => {
        const file = fs.createWriteStream('./output.file');
        for (const stream of streams) {
            await writeChunk(file, stream);
        }
    });
}

// startup function
async function startup() {
    try {
        // log
        console.log(`LOG_LEVEL is "${LOG_LEVEL}".`);
        logger.info(`URL is "${URL}".`);
        logger.info(
            `STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`
        );
        logger.info(`FILE_SIZE is "${FILE_SIZE}".`);
        logger.info(`CONCURRENCY is "${CONCURRENCY}".`);
        logger.info(`SOURCE_METHOD is "${SOURCE_METHOD}".`);

        // validate
        if (URL && STORAGE_SAS && FILE_SIZE) {
            // ok
        } else {
            logger.error('You must specify URL, STORAGE_SAS, and FILE_SIZE.');
            process.exit(1);
        }

        // observe measures
        const obs = new PerformanceObserver(list => {
            const entries = list.getEntries();
            entries.sort((a, b) =>
                a.name < b.name ? -1 : a.name > b.name ? 1 : 0
            );
            for (const entry of entries) {
                logger.verbose(`measure "${entry.name}": ${entry.duration}`);
            }
        });
        obs.observe({ entryTypes: ['measure'], buffered: true });

        // read the blob
        logger.verbose(`starting @ ${performance.now()}`);
        performance.mark('start-transfer');
        await readBlob();
        performance.mark('complete-transfer');
        performance.measure(
            '3. total time',
            'start-transfer',
            'complete-transfer'
        );
    } catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
