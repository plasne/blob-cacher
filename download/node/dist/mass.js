"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const agentkeepalive = require("agentkeepalive");
const cluster = require("cluster");
const cmd = require("commander");
const dotenv = require("dotenv");
const lookup_dns_cache_1 = require("lookup-dns-cache");
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
    .option('-s, --sas <s>', '[REQUIRED] STORAGE_SAS. The SAS token for accessing an Azure Storage Account.')
    .option('-t, --target <s>', '[REQUIRED] TARGET. The path to download the files to.')
    .option('-m, --max-sockets <i>', 'MAX_SOCKETS. The total number of simultaneous outbound connections (per process). Default is "1000".', parseInt)
    .option('-p, --processes <i>', 'PROCESSES. The number of processes that the work should be divided between. Default is "1".', parseInt)
    .parse(process.argv);
// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const STORAGE_ACCOUNT = cmd.account || process.env.STORAGE_ACCOUNT;
const STORAGE_CONTAINER = cmd.container || process.env.STORAGE_CONTAINER;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const TARGET = cmd.target || process.env.TARGET;
const MAX_SOCKETS = cmd.maxSockets || process.env.MAX_SOCKETS || 1000;
const PROCESSES = cmd.processes || process.env.PROCESSES || 1;
// agents
const httpagent = new agentkeepalive({
    keepAlive: true,
    maxSockets: MAX_SOCKETS
});
const httpsagent = new agentkeepalive.HttpsAgent.HttpsAgent({
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
        // determine the url
        const url = URL ||
            `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${STORAGE_CONTAINER}/${filename}${STORAGE_SAS ? STORAGE_SAS + '&' : '?'}`;
        // specify the request options, including the headers
        const options = {
            agent: url.toLowerCase().startsWith('https://')
                ? httpsagent
                : httpagent,
            body: content,
            headers: {
                'x-ms-blob-type': 'BlockBlob',
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2017-07-29'
            },
            lookup: lookup_dns_cache_1.lookup,
            time: true,
            url
        };
        // generate and apply the signature
        if (!URL && !STORAGE_SAS && STORAGE_KEY) {
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
        count: 153 * FILE_SIZE,
        format: 'plain',
        units: 'words'
    });
}
async function spawn(count) {
    try {
        logger.verbose(`worker pid "${process.pid}" started...`);
        // create random data
        logger.verbose(`worker pid "${process.pid}" generating data...`);
        const files = [];
        for (let i = 0; i < count; i++) {
            const id = uuid_1.v4();
            const data = generate();
            files.push({ id, data });
        }
        logger.verbose(`worker pid "${process.pid}" finished generating data.`);
        // start the clock
        const startTime = new Date().valueOf();
        // post the data all at the same time
        const promises = [];
        for (let i = 0; i < count; i++) {
            const o = files[i];
            const promise = createBlob(o.id, o.data).catch(error => {
                logger.error(`Error during createBlob...`);
                logger.error(error.message);
            });
            promises.push(promise);
        }
        // wait for completion
        logger.verbose(`worker pid "${process.pid}" sending ${files.length} files...`);
        await Promise.all(promises);
        logger.verbose(`worker pid "${process.pid}" sent ${files.length} files.`);
        // record the time
        const duration = new Date().valueOf() - startTime;
        logger.verbose(`worker pid "${process.pid}" completed after ${duration} ms.`);
        counters.duration += duration;
        if (process.send)
            process.send(JSON.stringify(counters));
    }
    catch (error) {
        logger.error(`Error during spawn...`);
        logger.error(error.message);
    }
}
function display() {
    logger.info(`duration: ${counters.duration} ms`);
    logger.info(`count: ${counters.count}`);
    logger.info(`wait: ${Math.round(counters.wait)} (${Math.round((counters.wait / counters.total) * 100)}%)`);
    logger.info(`dns: ${Math.round(counters.dns)} (${Math.round((counters.dns / counters.total) * 100)}%)`);
    logger.info(`tcp: ${Math.round(counters.tcp)} (${Math.round((counters.tcp / counters.total) * 100)}%)`);
    logger.info(`firstByte: ${Math.round(counters.firstByte)} (${Math.round((counters.firstByte / counters.total) * 100)}%)`);
    logger.info(`download: ${Math.round(counters.download)} (${Math.round((counters.download / counters.total) * 100)}%)`);
}
// startup function
async function startup() {
    try {
        // spawn the appropriate number of processes
        if (cluster.isMaster) {
            // log
            console.log(`LOG_LEVEL is "${LOG_LEVEL}".`);
            logger.info(`STORAGE_ACCOUNT is "${STORAGE_ACCOUNT}".`);
            logger.info(`STORAGE_CONTAINER is "${STORAGE_CONTAINER}".`);
            logger.info(`URL is "${URL}".`);
            logger.info(`STORAGE_KEY is "${STORAGE_KEY ? 'defined' : 'undefined'}"`);
            logger.info(`STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`);
            logger.info(`FILE_SIZE is "${FILE_SIZE}" kb.`);
            logger.info(`FILE_COUNT is "${FILE_COUNT}".`);
            logger.info(`MAX_SOCKETS is "${MAX_SOCKETS}".`);
            logger.info(`PROCESSES is "${PROCESSES}".`);
            // validate
            if ((STORAGE_ACCOUNT && STORAGE_CONTAINER) || URL) {
                // ok
            }
            else {
                logger.error('You must specify both STORAGE_ACCOUNT and STORAGE_CONTAINER unless using URL.');
                process.exit(1);
            }
            if (STORAGE_KEY || STORAGE_SAS || URL) {
                // ok
            }
            else {
                logger.error('You must specify either STORAGE_KEY or STORAGE_SAS unless using URL.');
                process.exit(1);
            }
            // spawn workers
            for (let i = 0; i < PROCESSES; i++) {
                cluster.fork();
            }
            // look for a counters message from the worker; then merge and terminate it
            cluster.on('message', (worker, message) => {
                const remote = JSON.parse(message);
                if (remote.duration > counters.duration) {
                    counters.duration = remote.duration;
                }
                counters.count += remote.count;
                counters.wait += remote.wait;
                counters.dns += remote.dns;
                counters.tcp += remote.tcp;
                counters.firstByte += remote.firstByte;
                counters.download += remote.download;
                counters.total += remote.total;
                worker.kill();
            });
            // wait for all workers to complete
            await new Promise(resolve => {
                let exits = 0;
                cluster.on('exit', () => {
                    exits++;
                    if (exits >= PROCESSES)
                        resolve();
                });
            });
            // display final stats
            display();
        }
        else {
            spawn(FILE_COUNT / PROCESSES);
        }
        // calculate duration
    }
    catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
