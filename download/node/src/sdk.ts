// includes
import * as Azure from '@azure/storage-blob';
import cmd = require('commander');
import dotenv = require('dotenv');
import * as winston from 'winston';
import * as fs from 'fs';

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
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;

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

// startup function
async function startup() {
    try {
        // log
        console.log(`LOG_LEVEL is "${LOG_LEVEL}".`);
        logger.info(`URL is "${URL}".`);
        logger.info(
            `STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`
        );

        // validate
        if (URL && STORAGE_SAS) {
            // ok
        } else {
            logger.error('You must specify both URL and STORAGE_SAS.');
            process.exit(1);
        }

        // read the blob
        const startTime = new Date().valueOf();
        const credential = new Azure.AnonymousCredential();
        const pipeline = Azure.StorageURL.newPipeline(credential);
        const url = new Azure.BlobURL(`${URL}${STORAGE_SAS}`, pipeline);
        const response = await url.download(Azure.Aborter.none, 0);
        const file = fs.createWriteStream('./output.file');
        if (response.readableStreamBody) {
            response.readableStreamBody.pipe(file).on('close', () => {
                const duration = new Date().valueOf() - startTime;
                logger.info(`downloaded in ${duration} ms.`);
            });
        }
    } catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
