// includes
import agentkeepalive = require('agentkeepalive');
import cmd = require('commander');
import dotenv = require('dotenv');
import { lookup } from 'lookup-dns-cache';
import * as winston from 'winston';
import * as request from 'request';
import * as fs from 'fs';
import MultiStream = require('multistream');
import MemoryStream = require('memorystream');

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
        '-n, --concurrency <i>',
        'CONCURRENCY. The number of simultaneous reads. Default is "1".',
        parseInt
    )
    .option(
        '-m, --max-sockets <i>',
        'MAX_SOCKETS. The total number of simultaneous outbound connections (per process). Default is "1000".',
        parseInt
    )
    .option(
        '-p, --processes <i>',
        'PROCESSES. The number of processes that the work should be divided between. Default is "1".',
        parseInt
    )
    .parse(process.argv);

// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const URL = cmd.url || process.env.URL;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const CONCURRENCY = cmd.concurrency || process.env.CONCURRENCY || 1;
const MAX_SOCKETS = cmd.maxSockets || process.env.MAX_SOCKETS || 1000;
const PROCESSES = cmd.processes || process.env.PROCESSES || 1;

// agents
const httpsagent = new agentkeepalive.HttpsAgent({
    keepAlive: true,
    maxSockets: MAX_SOCKETS
});

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

interface chunk {
    index: number;
    stream: MemoryStream;
}

function readChunk(index: number, size: number) {
    return new Promise<chunk>((resolve, reject) => {
        const chunkStart = index * size;
        const chunkStop = (index + 1) * size - 1;
        logger.verbose(`getting ${chunkStart} to ${chunkStop}...`);

        // determine the url
        const url: string = `${URL}${STORAGE_SAS}`;

        // specify the request options, including the headers
        const options = {
            agent: httpsagent,
            headers: {
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2017-07-29',
                'x-ms-range': `bytes=${chunkStart}-${chunkStop}`
            } as any,
            lookup,
            time: true,
            url
        };

        // execute
        const stream = new MemoryStream();
        request
            .get(options, (error, response) => {
                if (
                    !error &&
                    response.statusCode >= 200 &&
                    response.statusCode < 300
                ) {
                    logger.info(`response: ${response.statusCode}`);
                    if (response.timingPhases) {
                        logger.info(`wait: ${response.timingPhases.wait}`);
                        logger.info(`dns: ${response.timingPhases.dns}`);
                        logger.info(`tcp: ${response.timingPhases.tcp}`);
                        logger.info(
                            `firstByte: ${response.timingPhases.firstByte}`
                        );
                        logger.info(
                            `download: ${response.timingPhases.download}`
                        );
                        logger.info(`total: ${response.timingPhases.total}`);
                    }
                    resolve({ index, stream });
                } else if (error) {
                    reject(error);
                } else {
                    reject(
                        new Error(
                            `${response.statusCode}: ${response.statusMessage}`
                        )
                    );
                }
            })
            .pipe(stream);
    });
}

// function to read a single blob
async function readBlob() {
    const max = 83886080;
    const segment = Math.ceil(max / CONCURRENCY);

    const promises: Promise<chunk>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        const promise = readChunk(i, segment);
        promises.push(promise);
    }

    await Promise.all(promises).then(async values => {
        const file = fs.createWriteStream('./output.file');
        values.sort((a, b) => a.index - b.index);
        const streams: request.Request[] = [];
        for (const value of values) {
            streams.push(value.stream);
        }
        MultiStream(streams).pipe(file);
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
        logger.info(`CONCURRENCY is "${CONCURRENCY}".`);
        logger.info(`MAX_SOCKETS is "${MAX_SOCKETS}".`);
        logger.info(`PROCESSES is "${PROCESSES}".`);

        // validate
        if (URL && STORAGE_SAS) {
            // ok
        } else {
            logger.error('You must specify both URL and STORAGE_SAS.');
            process.exit(1);
        }

        // read the blob
        const startTime = new Date().valueOf();
        await readBlob();
        const duration = new Date().valueOf() - startTime;
        logger.info(`downloaded in ${duration} ms.`);
    } catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
