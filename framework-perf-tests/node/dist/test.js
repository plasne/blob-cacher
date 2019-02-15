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
const agentkeepalive = require('agentkeepalive').HttpsAgent;
const cmd = require("commander");
const crypto = require("crypto");
const dotenv = require("dotenv");
const lookup_dns_cache_1 = require("lookup-dns-cache");
const loremIpsum = require("lorem-ipsum");
const uuid_1 = require("uuid");
const winston = __importStar(require("winston"));
const querystring = require("query-string");
const request = __importStar(require("request"));
// set env
dotenv.config();
// define options
cmd.option('-l, --log-level <s>', 'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".', /^(error|warn|info|verbose|debug|silly)$/i)
    .option('-a, --account <s>', '[REQUIRED] STORAGE_ACCOUNT. The name of the storage account.')
    .option('-c, --container <s>', '[REQUIRED] STORAGE_CONTAINER. The name of the storage container.')
    .option('-k, --key <s>', '[REQUIRED*] STORAGE_KEY. The key for accessing an Azure Storage Account. You must specify either the STORAGE_KEY or STORAGE_SAS.')
    .option('-s, --sas <s>', '[REQUIRED*] STORAGE_SAS. The SAS token for accessing an Azure Storage Account. You must specify either the STORAGE_KEY or STORAGE_SAS.')
    .option('-z, --file-size <i>', 'FILE_SIZE. The file to be used for testing will be roughly this size in kilobytes. Default is "100" kb.', parseInt)
    .option('-n, --file-count <i>', 'FILE_COUNT. The number of files to create (simultaneous). Default is "100".', parseInt)
    .option('-m, --max-sockets <i>', 'MAX_SOCKETS. The total number of simultaneous outbound connections. Default is "1000".', parseInt)
    .parse(process.argv);
// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const STORAGE_ACCOUNT = cmd.account || process.env.STORAGE_ACCOUNT;
const STORAGE_CONTAINER = cmd.container || process.env.STORAGE_CONTAINER;
const STORAGE_KEY = cmd.key || process.env.STORAGE_KEY;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const FILE_SIZE = cmd.fileSize || process.env.FILE_SIZE || 100;
const FILE_COUNT = cmd.fileCount || process.env.FILE_COUNT || 100;
const MAX_SOCKETS = cmd.maxSockets || process.env.MAX_SOCKETS || 1000;
// counters
const counters = {
    count: 0,
    wait: 0,
    dns: 0,
    tcp: 0,
    firstByte: 0,
    download: 0,
    total: 0
};
// agent
const agent = new agentkeepalive({
    keepAlive: true,
    maxSockets: MAX_SOCKETS
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
// function to generate a signature using a storage key
function generateSignature(method, path, options) {
    // pull out all querystring parameters so they can be sorted and used in the signature
    const parameters = [];
    const parsed = querystring.parseUrl(options.url);
    for (const key in parsed.query) {
        if (Object.prototype.hasOwnProperty.call(parsed.query, key)) {
            parameters.push(`${key}:${parsed.query[key]}`);
        }
    }
    parameters.sort((a, b) => a.localeCompare(b));
    // pull out all x-ms- headers so they can be sorted and used in the signature
    const xheaders = [];
    for (const key in options.headers) {
        if (key.substring(0, 5) === 'x-ms-') {
            xheaders.push(`${key}:${options.headers[key]}`);
        }
    }
    xheaders.sort((a, b) => a.localeCompare(b));
    // zero length for the body is an empty string, not 0
    const len = options.body ? Buffer.byteLength(options.body) : '';
    // potential content-type, if-none-match
    const ct = options.headers['Content-Type'] || '';
    const none = options.headers['If-None-Match'] || '';
    // generate the signature line
    let raw = `${method}\n\n\n${len}\n\n${ct}\n\n\n\n${none}\n\n\n${xheaders.join('\n')}\n/${STORAGE_ACCOUNT}/${STORAGE_CONTAINER}`;
    if (path)
        raw += `/${path}`;
    raw += parameters.length > 0 ? `\n${parameters.join('\n')}` : '';
    // sign it
    const hmac = crypto.createHmac('sha256', Buffer.from(STORAGE_KEY, 'base64'));
    const signature = hmac.update(raw, 'utf8').digest('base64');
    // return the Authorization header
    return `SharedKey ${STORAGE_ACCOUNT}:${signature}`;
}
// function to create a blob with a single blob
function createBlob(filename, content) {
    return new Promise((resolve, reject) => {
        // specify the request options, including the headers
        const options = {
            agent,
            body: content,
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2017-07-29'
            },
            lookup: lookup_dns_cache_1.lookup,
            time: true,
            url: `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${STORAGE_CONTAINER}/${filename}${STORAGE_SAS ? STORAGE_SAS + '&' : '?'}`
        };
        // generate and apply the signature
        if (!STORAGE_SAS && STORAGE_KEY) {
            const signature = generateSignature('PUT', filename, options);
            options.headers.Authorization = signature;
        }
        // execute
        request.put(options, (error, response) => {
            if (!error &&
                response.statusCode >= 200 &&
                response.statusCode < 300) {
                if (response.timingPhases) {
                    counters.count++;
                    counters.wait += response.timingPhases.wait;
                    counters.dns += response.timingPhases.dns;
                    counters.tcp += response.timingPhases.tcp;
                    counters.firstByte += response.timingPhases.firstByte;
                    counters.download += response.timingPhases.download;
                    counters.total += response.timingPhases.total;
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
// function to generate a file of roughly a given size
function generate() {
    return loremIpsum({
        count: 150 * FILE_SIZE,
        format: 'plain',
        units: 'words'
    });
}
// startup function
async function startup() {
    try {
        const startTime = new Date().valueOf();
        // log
        console.log(`LOG_LEVEL is "${LOG_LEVEL}".`);
        logger.info(`STORAGE_ACCOUNT is "${STORAGE_ACCOUNT}".`);
        logger.info(`STORAGE_CONTAINER is "${STORAGE_CONTAINER}".`);
        logger.info(`STORAGE_KEY is "${STORAGE_KEY ? 'defined' : 'undefined'}"`);
        logger.info(`STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`);
        logger.info(`FILE_SIZE is "${FILE_SIZE}" kb.`);
        logger.info(`FILE_COUNT is "${FILE_COUNT}".`);
        logger.info(`MAX_SOCKETS is "${MAX_SOCKETS}".`);
        // validate
        if (!STORAGE_KEY && !STORAGE_SAS) {
            logger.error('You must specify either STORAGE_KEY or STORAGE_SAS.');
            process.exit(1);
        }
        // create
        const promises = [];
        for (let i = 0; i < FILE_COUNT; i++) {
            const id = uuid_1.v4();
            const data = generate();
            const promise = createBlob(id, data).catch(error => {
                logger.error(error);
            });
            promises.push(promise);
        }
        // wait for completion
        const prepTime = new Date().valueOf() - startTime;
        await Promise.all(promises);
        // calculate duration
        const fullTime = new Date().valueOf() - startTime;
        logger.info(`duration: ${fullTime - prepTime} ms (prep: ${prepTime} ms)`);
        logger.info(`count: ${counters.count}`);
        logger.info(`wait: ${Math.round(counters.wait)} (${Math.round((counters.wait / counters.total) * 100)}%)`);
        logger.info(`dns: ${Math.round(counters.dns)} (${Math.round((counters.dns / counters.total) * 100)}%)`);
        logger.info(`tcp: ${Math.round(counters.tcp)} (${Math.round((counters.tcp / counters.total) * 100)}%)`);
        logger.info(`firstByte: ${Math.round(counters.firstByte)} (${Math.round((counters.firstByte / counters.total) * 100)}%)`);
        logger.info(`download: ${Math.round(counters.download)} (${Math.round((counters.download / counters.total) * 100)}%)`);
    }
    catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
