"use strict";
// NOTES:
// * I tested axios responseType="arraybuffer" but it was tragically slow
// * I tested waiting until all streams were available and then used multistream but it was the same speed as concurrency=1
// * I tested multiple fs.write() threads in a sparse file instead of streams, this was a bit faster but isn't supported on Windows
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// includes
const axios_1 = __importDefault(require("axios"));
const bytes_1 = __importDefault(require("bytes"));
const cmd = require("commander");
const dotenv = require("dotenv");
const https = require("https");
const winston = __importStar(require("winston"));
const fs = __importStar(require("fs"));
const perf_hooks_1 = require("perf_hooks");
// set env
dotenv.config();
// define options
cmd.option('-l, --log-level <s>', 'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".', /^(error|warn|info|verbose|debug|silly)$/i)
    .option('-u, --url <s>', '[REQUIRED*] URL. Specify the URL of the file to retrieve.')
    .option('-s, --sas <s>', '[REQUIRED*] STORAGE_SAS. The SAS token for accessing an Azure Storage Account. You must specify either the STORAGE_KEY or STORAGE_SAS unless using URL.')
    .option('-z, --file-size <s>', '[REQUIRED] FILE_SIZE. The size of the file to download. You can use 80MB, 1TB, 100KB, etc. Set this to a bit bigger than the file.')
    .option('-n, --concurrency <i>', 'CONCURRENCY. The number of simultaneous reads. Default is "1".', parseInt)
    .option('--source-method <s>', 'SOURCE_METHOD. If "url" then only the URL is used. If "round-robin" then URL plus any URL_# environment variables are used. If "assemble" then URL plus .# per concurrency are assembled. If "native" then only the URL is used and no concurrency is available. Defaults to "url".')
    .parse(process.argv);
// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const URL = cmd.url || process.env.URL;
const listOfUrls = [];
if (URL)
    listOfUrls.push(URL);
for (let i = 0; i < 99; i++) {
    const alt = process.env[`URL_${i}`];
    if (alt)
        listOfUrls.push(alt);
}
let urlIndex = 0;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const CONCURRENCY = cmd.concurrency || process.env.CONCURRENCY || 1;
const FILE_SIZE = cmd.fileSize || process.env.FILE_SIZE;
let SOURCE_METHOD = cmd.sourceMethod || process.env.SOURCE_METHOD;
if (!['url', 'round-robin', 'assemble', 'native'].includes(SOURCE_METHOD))
    SOURCE_METHOD = 'url';
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
    // determine the appropriate URL
    const url = (() => {
        switch (SOURCE_METHOD) {
            case 'url':
                return URL;
            case 'round-robin':
                if (urlIndex > listOfUrls.length - 1)
                    urlIndex = 0;
                const use = listOfUrls[urlIndex];
                urlIndex++;
                return use;
            case 'assemble':
                return `${URL}.${index}`;
        }
    })() + STORAGE_SAS;
    logger.info(`getting [${index}] ${chunkStart} to ${chunkStop} from ${url} @ ${perf_hooks_1.performance.now()}...`);
    perf_hooks_1.performance.mark(`read-${index}:started`);
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
    return axios_1.default({
        method: 'get',
        url,
        responseType: 'stream',
        headers,
        maxContentLength: 90886080
    }).then(response => {
        perf_hooks_1.performance.mark(`read-${index}:firstByte`);
        logger.verbose(`first byte received [${index}] @ ${perf_hooks_1.performance.now()}...`);
        return response.data;
    });
}
async function writeChunk(file, stream) {
    return new Promise(resolve => {
        stream.pipe(file, { end: false });
        stream.on('end', () => {
            resolve();
        });
    });
}
async function readBlob() {
    const segment = Math.ceil(bytes_1.default(FILE_SIZE) / CONCURRENCY);
    const promises = [];
    for (let i = 0; i < CONCURRENCY; i++) {
        const promise = readChunk(i, segment);
        promises.push(promise);
    }
    return Promise.all(promises).then(async (streams) => {
        const file = fs.createWriteStream('./output.file');
        for (const stream of streams) {
            await writeChunk(file, stream);
        }
    });
}
async function readBlobNative() {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream('output.file');
        logger.info(`getting from ${URL} @ ${perf_hooks_1.performance.now()}...`);
        https
            .request(`${URL}${STORAGE_SAS}`, {
            method: 'get',
            headers: {
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2017-07-29'
            }
        }, res => {
            logger.verbose(`first byte received @ ${perf_hooks_1.performance.now()}...`);
            if (res.statusCode &&
                res.statusCode >= 200 &&
                res.statusCode <= 299) {
                res.pipe(file);
                file.on('close', () => {
                    logger.verbose(`download completed @ ${perf_hooks_1.performance.now()}...`);
                    resolve();
                });
            }
            else {
                reject(new Error(`${res.statusCode}: ${res.statusMessage}`));
            }
        })
            .end();
    });
}
// startup function
async function startup() {
    try {
        // log
        console.log(`LOG_LEVEL is "${LOG_LEVEL}".`);
        logger.info(`URL is "${URL}".`);
        logger.info(`STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`);
        logger.info(`FILE_SIZE is "${FILE_SIZE}".`);
        logger.info(`CONCURRENCY is "${CONCURRENCY}".`);
        logger.info(`SOURCE_METHOD is "${SOURCE_METHOD}".`);
        // validate
        if (URL && STORAGE_SAS && (FILE_SIZE || SOURCE_METHOD === 'native')) {
            // ok
        }
        else {
            logger.error('You must specify URL, STORAGE_SAS, and FILE_SIZE.');
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
        logger.verbose(`starting @ ${perf_hooks_1.performance.now()}`);
        perf_hooks_1.performance.mark('start-transfer');
        if (SOURCE_METHOD === 'native') {
            await readBlobNative();
        }
        else {
            await readBlob();
        }
        perf_hooks_1.performance.mark('complete-transfer');
        perf_hooks_1.performance.measure('3. total time', 'start-transfer', 'complete-transfer');
    }
    catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
