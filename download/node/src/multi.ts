// includes
import cmd = require('commander');
import dotenv = require('dotenv');
import * as winston from 'winston';
import * as fs from 'fs';
import { performance, PerformanceObserver } from 'perf_hooks';
import axios from 'axios';

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
    .parse(process.argv);

// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const URL = cmd.url || process.env.URL;
const URL2 = 'https://pelasnehtbb.blob.core.windows.net/sized/large.copy';
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const CONCURRENCY = cmd.concurrency || process.env.CONCURRENCY || 1;

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

// function to read a single blob
async function readBlob(url: string, filename: string) {
    logger.info(`reading ${url}...`);
    return axios({
        method: 'get',
        url: `${url}${STORAGE_SAS}`,
        responseType: 'stream',
        headers: {
            'x-ms-date': new Date().toUTCString(),
            'x-ms-version': '2017-07-29'
        },
        maxContentLength: 90886080
    }).then(response => {
        return new Promise(resolve => {
            logger.info(`writing ${url}...`);
            const file = fs.createWriteStream(filename);
            response.data.pipe(file);
            file.on('close', () => {
                logger.info(`written ${url}.`);
                resolve();
            });
        });
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

        // validate
        if (URL && STORAGE_SAS) {
            // ok
        } else {
            logger.error('You must specify both URL and STORAGE_SAS.');
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
        performance.mark('start-transfer');
        const f1 = readBlob(URL, 'primary.file');
        const f2 = readBlob(URL2, 'secondary.file');
        await Promise.all([f1, f2]);
        performance.mark('complete-transfer');
        performance.measure(
            'total time',
            'start-transfer',
            'complete-transfer'
        );
    } catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
