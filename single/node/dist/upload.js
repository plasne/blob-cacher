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
const axios_1 = __importDefault(require("axios"));
const util = require("util");
// set env
dotenv.config();
// fs promises
const fsstat = util.promisify(fs.stat);
const fsopen = util.promisify(fs.open);
const fsread = util.promisify(fs.read);
// define options
cmd.option('-l, --log-level <s>', 'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".', /^(error|warn|info|verbose|debug|silly)$/i)
    .option('-f, --file <s>', '[REQUIRED] FILE. The path to the file to be uploaded.')
    .option('-a, --account <s>', '[REQUIRED] STORAGE_ACCOUNT. The name of the storage account.')
    .option('-c, --container <s>', '[REQUIRED] CONTAINER. The name of the storage account container.')
    .option('-s, --sas <s>', '[REQUIRED] STORAGE_SAS. The SAS token for accessing an Azure Storage Account.')
    .option('-p, --chunks <i>', 'CHUNKS. Upload the blob in segments so it can potentially be downloaded faster. Defaults to "1".', parseInt)
    .parse(process.argv);
// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const FILE = cmd.file || process.env.FILE;
const STORAGE_ACCOUNT = cmd.account || process.env.STORAGE_ACCOUNT;
const CONTAINER = cmd.container || process.env.CONTAINER;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const CHUNKS = cmd.chunks || process.env.CHUNKS || 1;
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
async function writeChunk(url, buffer) {
    return axios_1.default({
        method: 'put',
        url: `${url}${STORAGE_SAS}`,
        headers: {
            'x-ms-blob-type': 'BlockBlob',
            'x-ms-date': new Date().toUTCString(),
            'x-ms-version': '2017-07-29'
        },
        data: buffer,
        maxContentLength: 90886080
    });
}
// startup function
async function startup() {
    try {
        // log
        console.log(`LOG_LEVEL is "${LOG_LEVEL}".`);
        logger.info(`FILE is "${FILE}".`);
        logger.info(`STORAGE_ACCOUNT is "${STORAGE_ACCOUNT}".`);
        logger.info(`CONTAINER is "${CONTAINER}".`);
        logger.info(`STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`);
        logger.info(`CHUNKS is "${CHUNKS}".`);
        // validate
        if (FILE && STORAGE_ACCOUNT && CONTAINER && STORAGE_SAS) {
            // ok
        }
        else {
            logger.error('You must specify FILE, STORAGE_ACCOUNT, CONTAINER and STORAGE_SAS.');
            process.exit(1);
        }
        // read the file
        const stat = await fsstat(FILE);
        const chunk = Math.ceil(stat.size / CHUNKS);
        const fd = await fsopen(FILE, 'r');
        for (let i = 0; i < CHUNKS; i++) {
            const chunkStart = i * chunk;
            const buffer = Buffer.alloc(chunk);
            await fsread(fd, buffer, 0, chunk, chunkStart);
            await writeChunk(`https://${STORAGE_ACCOUNT}.blob.core.windows.net/sized/part.${i}`, buffer);
        }
    }
    catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
