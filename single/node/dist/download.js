"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// includes
const cmd = require("commander");
const dotenv = require("dotenv");
const winston = __importStar(require("winston"));
const fs = __importStar(require("fs"));
const MultiStream = require("multistream");
const perf_hooks_1 = require("perf_hooks");
const axios_1 = __importDefault(require("axios"));
// set env
dotenv.config();
// define options
cmd.option('-l, --log-level <s>', 'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".', /^(error|warn|info|verbose|debug|silly)$/i)
    .option('-u, --url <s>', '[REQUIRED*] URL. Specify the URL of the file to retrieve.')
    .option('-s, --sas <s>', '[REQUIRED*] STORAGE_SAS. The SAS token for accessing an Azure Storage Account. You must specify either the STORAGE_KEY or STORAGE_SAS unless using URL.')
    .option('-n, --concurrency <i>', 'CONCURRENCY. The number of simultaneous reads. Default is "1".', parseInt)
    .parse(process.argv);
// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const URL = cmd.url || process.env.URL;
const URL2 = 'https://pelasnehtbb.blob.core.windows.net/sized/large.copy';
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const CONCURRENCY = cmd.concurrency || process.env.CONCURRENCY || 1;
// start logging
const logColors = {
    debug: '\x1b[32m',
    error: '\x1b[31m',
    info: '',
    silly: '\x1b[32m',
    verbose: '\x1b[32m',
    warn: '\x1b[33m' // yellow
};
const transport = new winston.transports.Console({
    format: winston.format.combine(winston.format.timestamp(), winston.format.printf(event => {
        const color = logColors[event.level] || '';
        const level = event.level.padStart(7);
        return `${event.timestamp} ${color}${level}\x1b[0m: ${event.message}`;
    }))
});
const logger = winston.createLogger({
    level: LOG_LEVEL,
    transports: [transport]
});
// read a chunk of data
async function readChunk(index, size) {
    const chunkStart = index * size;
    const chunkStop = (index + 1) * size - 1;
    const url = chunkStart === 0 ? `${URL}${STORAGE_SAS}` : `${URL2}${STORAGE_SAS}`;
    logger.verbose(`getting ${chunkStart} to ${chunkStop} from ${url}...`);
    perf_hooks_1.performance.mark('start-request');
    return axios_1.default({
        method: 'get',
        url,
        responseType: 'stream',
        headers: {
            'x-ms-date': new Date().toUTCString(),
            'x-ms-version': '2017-07-29',
            'x-ms-range': `bytes=${chunkStart}-${chunkStop}`
        },
        maxContentLength: 90886080
    }).then(response => {
        perf_hooks_1.performance.mark('complete-request');
        console.log(`req ${perf_hooks_1.performance.now()}`);
        perf_hooks_1.performance.measure('1. request time', 'start-request', 'complete-request');
        return response.data;
    });
}
// function to read a single blob
async function readBlob() {
    const max = 83886080;
    const segment = Math.ceil(max / CONCURRENCY);
    const promises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        const promise = readChunk(i, segment);
        promises.push(promise);
    }
    await Promise.all(promises).then(async (values) => {
        return new Promise(resolve => {
            values[0].on('end', () => {
                console.log(`end ${perf_hooks_1.performance.now()}`);
            });
            values[0].on('close', () => {
                console.log('close');
            });
            values[0].on('finish', () => {
                console.log('finish');
            });
            perf_hooks_1.performance.mark('start-write');
            const file = fs.createWriteStream('./output.file');
            MultiStream(values).pipe(file);
            file.on('close', () => {
                perf_hooks_1.performance.mark('complete-write');
                perf_hooks_1.performance.measure('2. write time', 'start-write', 'complete-write');
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
        logger.info(`STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`);
        logger.info(`CONCURRENCY is "${CONCURRENCY}".`);
        // validate
        if (URL && STORAGE_SAS) {
            // ok
        }
        else {
            logger.error('You must specify both URL and STORAGE_SAS.');
            process.exit(1);
        }
        // observe measures
        const obs = new perf_hooks_1.PerformanceObserver(list => {
            const entries = list.getEntries();
            entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
            for (const entry of entries) {
                logger.verbose(`measure "${entry.name}": ${entry.duration}`);
            }
        });
        obs.observe({ entryTypes: ['measure'], buffered: true });
        // read the blob
        perf_hooks_1.performance.mark('start-transfer');
        await readBlob();
        perf_hooks_1.performance.mark('complete-transfer');
        perf_hooks_1.performance.measure('3. total time', 'start-transfer', 'complete-transfer');
    }
    catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
