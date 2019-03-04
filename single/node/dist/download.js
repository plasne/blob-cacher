"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// includes
const agentkeepalive = require("agentkeepalive");
const cmd = require("commander");
const dotenv = require("dotenv");
const lookup_dns_cache_1 = require("lookup-dns-cache");
const winston = __importStar(require("winston"));
const request = __importStar(require("request"));
// set env
dotenv.config();
// define options
cmd.option('-l, --log-level <s>', 'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".', /^(error|warn|info|verbose|debug|silly)$/i)
    .option('-u, --url <s>', '[REQUIRED*] URL. Specify the URL of the file to retrieve.')
    .option('-s, --sas <s>', '[REQUIRED*] STORAGE_SAS. The SAS token for accessing an Azure Storage Account. You must specify either the STORAGE_KEY or STORAGE_SAS unless using URL.')
    .parse(process.argv);
// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const URL = cmd.url || process.env.URL;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
// agents
const httpsagent = new agentkeepalive.HttpsAgent({
    keepAlive: true,
    maxSockets: 10
});
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
// function to read a single blob
function readBlob() {
    return new Promise((resolve, reject) => {
        // determine the url
        const url = `${URL}${STORAGE_SAS}`;
        // specify the request options, including the headers
        const options = {
            agent: httpsagent,
            headers: {
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2017-07-29'
            },
            lookup: lookup_dns_cache_1.lookup,
            time: true,
            url
        };
        // execute
        request.get(options, (error, response) => {
            if (!error &&
                response.statusCode >= 200 &&
                response.statusCode < 300) {
                if (response.timingPhases) {
                    logger.info(`wait: ${response.timingPhases.wait}`);
                    logger.info(`dns: ${response.timingPhases.dns}`);
                    logger.info(`tcp: ${response.timingPhases.tcp}`);
                    logger.info(`firstByte: ${response.timingPhases.firstByte}`);
                    logger.info(`download: ${response.timingPhases.download}`);
                    logger.info(`total: ${response.timingPhases.total}`);
                }
                resolve();
            }
            else if (error) {
                reject(error);
            }
            else {
                reject(new Error(`${response.statusCode}: ${response.statusMessage}`));
            }
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
        // validate
        if (URL && STORAGE_SAS) {
            // ok
        }
        else {
            logger.error('You must specify both URL and STORAGE_SAS.');
            process.exit(1);
        }
        // read the blob
        const startTime = new Date().valueOf();
        await readBlob();
        const duration = new Date().valueOf() - startTime;
        logger.info(`downloaded in ${duration} ms.`);
    }
    catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
