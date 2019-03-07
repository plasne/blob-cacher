// includes
import agentkeepalive = require('agentkeepalive');
import cluster = require('cluster');
import cmd = require('commander');
import dotenv = require('dotenv');
import * as fs from 'fs';
import { lookup } from 'lookup-dns-cache';
import * as path from 'path';
import * as url from 'url';
import * as winston from 'winston';
import * as request from 'request';
import { EventEmitter } from 'events';
import * as xpath from 'xpath';
import * as dom from 'xmldom';
import { performance } from 'perf_hooks';

// set env
dotenv.config();

// define options
cmd.option(
    '-l, --log-level <s>',
    'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".',
    /^(error|warn|info|verbose|debug|silly)$/i
)
    .option(
        '-a, --account <s>',
        '[REQUIRED] STORAGE_ACCOUNT. The name of the storage account.'
    )
    .option(
        '-c, --container <s>',
        '[REQUIRED] STORAGE_CONTAINER. The name of the storage container.'
    )
    .option(
        '-s, --sas <s>',
        '[REQUIRED] STORAGE_SAS. The SAS token for accessing an Azure Storage Account.'
    )
    .option(
        '-t, --target <s>',
        '[REQUIRED] TARGET. The path to download the files to.'
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
    .option(
        '--top <i>',
        'TOP. Once this count is reached, no more blobs are fetched. Default is unlimited.',
        parseInt
    )
    .parse(process.argv);

// variables
const LOG_LEVEL = cmd.logLevel || process.env.LOG_LEVEL || 'info';
const STORAGE_ACCOUNT = cmd.account || process.env.STORAGE_ACCOUNT;
const STORAGE_CONTAINER = cmd.container || process.env.STORAGE_CONTAINER;
const STORAGE_SAS = cmd.sas || process.env.STORAGE_SAS;
const TARGET = cmd.target || process.env.TARGET;
const MAX_SOCKETS = cmd.maxSockets || process.env.MAX_SOCKETS || 1000;
const PROCESSES = cmd.processes || process.env.PROCESSES || 1;
const TOP = cmd.top || process.env.TOP || Number.MAX_SAFE_INTEGER;
let topCounter = 0;

// counters
interface counters {
    bytes: number;
    count: number;
    wait: number;
    dns: number;
    tcp: number;
    firstByte: number;
    download: number;
    total: number;
}

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

async function readBlob(urlpath: string) {
    return new Promise<counters>((resolve, reject) => {
        try {
            // specify the request options, including the headers
            const options = {
                agent: httpsagent,
                headers: {
                    'x-ms-date': new Date().toUTCString(),
                    'x-ms-version': '2017-07-29'
                },
                lookup,
                time: true,
                url: `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${STORAGE_CONTAINER}/${urlpath}${STORAGE_SAS}`
            };

            // get the filename
            const filename = (() => {
                const pathname = url.parse(urlpath).pathname;
                if (pathname) {
                    const pathparts = pathname.split('/');
                    return pathparts[pathparts.length - 1];
                } else {
                    return 'output.file';
                }
            })();

            // open the file for writing
            const filepath = path.join(TARGET, filename);
            const file = fs.createWriteStream(filepath);
            logger.verbose(
                `[${process.pid}] downloading ${options.url} to ${filepath}...`
            );

            // record the counters
            const counters: counters = {
                bytes: 0,
                count: 0,
                wait: 0,
                dns: 0,
                tcp: 0,
                firstByte: 0,
                download: 0,
                total: 0
            };

            // execute
            request
                .get(options, (error, response) => {
                    if (
                        !error &&
                        response.statusCode >= 200 &&
                        response.statusCode < 300
                    ) {
                        if (response.timingPhases) {
                            counters.wait = response.timingPhases.wait;
                            counters.dns = response.timingPhases.dns;
                            counters.tcp = response.timingPhases.tcp;
                            counters.firstByte =
                                response.timingPhases.firstByte;
                            counters.download = response.timingPhases.download;
                            counters.total = response.timingPhases.total;
                        }
                        logger.verbose(
                            `[${process.pid}] first byte for ${options.url}...`
                        );
                    } else if (error) {
                        logger.verbose(`error downloading ${options.url}...`);
                        logger.error(error.message);
                        reject(error);
                    } else {
                        const error = new Error(
                            `${response.statusCode}: ${response.statusMessage}`
                        );
                        logger.verbose(`error downloading ${options.url}...`);
                        logger.error(error.message);
                        reject(error);
                    }
                })
                .pipe(file)
                .on('finish', () => {
                    fs.stat(filepath, (error, stats) => {
                        if (!error) {
                            logger.verbose(
                                `[${process.pid}] completed download for ${
                                    options.url
                                } with ${stats.size} bytes...`
                            );
                            counters.bytes = stats.size;
                        } else {
                            logger.verbose(
                                `[${process.pid}] completed download for ${
                                    options.url
                                } with unknown bytes...`
                            );
                        }
                        counters.count = 1;
                        resolve(counters);
                    });
                });
        } catch (error) {
            logger.error(`error during readBlob...`);
            logger.error(error.message);
            reject(error);
        }
    });
}

function listBlobs(blobs: EventEmitter, marker?: string) {
    try {
        // specify the request options, including the headers
        const options = {
            agent: httpsagent,
            headers: {
                'x-ms-date': new Date().toUTCString(),
                'x-ms-version': '2017-07-29'
            },
            lookup,
            time: true,
            url: `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${STORAGE_CONTAINER}${STORAGE_SAS}&restype=container&comp=list${
                marker ? '&marker=' + marker : ''
            }`
        };

        // execute
        request.get(options, (error, response, body) => {
            if (
                !error &&
                response.statusCode >= 200 &&
                response.statusCode < 300
            ) {
                const doc = new dom.DOMParser().parseFromString(body);

                // extract the filenames
                for (let blob of xpath.select(
                    '/EnumerationResults/Blobs/Blob',
                    doc
                )) {
                    if (topCounter < TOP) {
                        const filename = xpath.select1(
                            'string(Name)',
                            blob as any
                        );
                        blobs.emit('blob', filename);
                        topCounter++;
                    }
                }

                // get the next marker
                const next = xpath.select1(
                    'string(/EnumerationResults/NextMarker)',
                    doc
                );
                if (next && topCounter < TOP) {
                    listBlobs(blobs, next.toString());
                    blobs.emit('next');
                } else {
                    blobs.emit('end');
                }
            } else if (error) {
                logger.verbose(`error listing ${options.url}...`);
                logger.error(error.message);
            } else {
                const error = new Error(
                    `${response.statusCode}: ${response.statusMessage}`
                );
                logger.verbose(`error listing ${options.url}...`);
                logger.error(error.message);
            }
        });
    } catch (error) {
        logger.error(`error during listBlobs...`);
        logger.error(error.message);
    }
}

async function spawn() {
    try {
        logger.verbose(`worker pid "${process.pid}" started...`);
        let open = 0;
        let shouldShutdown = false;
        const shutdown = () => {
            logger.info(`worker pid "${process.pid}" stopped.`);
            if (process.send) process.send('shutdown');
            // do this instead of process.exit() so we are sure all counters are dispatched
        };
        process.on('message', async (message: string) => {
            try {
                switch (message) {
                    case 'shutdown': {
                        shouldShutdown = true;
                        if (open < 1) shutdown();
                        return;
                    }
                    default: {
                        open++;
                        const counters = await readBlob(message);
                        if (process.send) process.send(counters);
                        break;
                    }
                }
            } catch (error) {
                // already logged
            }
            open--;
            if (shouldShutdown && open < 1) shutdown();
        });
    } catch (error) {
        logger.error(`Error during spawn...`);
        logger.error(error.message);
    }
}

function display(counters: counters) {
    logger.info(`count: ${counters.count}`);
    logger.info(`bytes: ${counters.bytes}`);
    logger.info(
        `wait: ${Math.round(counters.wait)} (${Math.round(
            (counters.wait / counters.total) * 100
        )}%)`
    );
    logger.info(
        `dns: ${Math.round(counters.dns)} (${Math.round(
            (counters.dns / counters.total) * 100
        )}%)`
    );
    logger.info(
        `tcp: ${Math.round(counters.tcp)} (${Math.round(
            (counters.tcp / counters.total) * 100
        )}%)`
    );
    logger.info(
        `firstByte: ${Math.round(counters.firstByte)} (${Math.round(
            (counters.firstByte / counters.total) * 100
        )}%)`
    );
    logger.info(
        `download: ${Math.round(counters.download)} (${Math.round(
            (counters.download / counters.total) * 100
        )}%)`
    );
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
            logger.info(
                `STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`
            );
            logger.info(`TARGET is "${TARGET}".`);
            logger.info(`MAX_SOCKETS is "${MAX_SOCKETS}".`);
            logger.info(`PROCESSES is "${PROCESSES}".`);
            logger.info(`TOP is "${TOP}".`);

            // validate
            if (STORAGE_ACCOUNT && STORAGE_CONTAINER && TARGET) {
                // ok
            } else {
                logger.error(
                    'You must specify both STORAGE_ACCOUNT, STORAGE_CONTAINER, and TARGET.'
                );
                process.exit(1);
            }

            // spawn workers
            const workers: cluster.Worker[] = [];
            for (let i = 0; i < PROCESSES; i++) {
                const worker = cluster.fork();
                workers.push(worker);
            }

            // look for a counters message from the worker
            const counters: counters = {
                bytes: 0,
                count: 0,
                wait: 0,
                dns: 0,
                tcp: 0,
                firstByte: 0,
                download: 0,
                total: 0
            };
            cluster.on('message', (worker, message) => {
                if (message === 'shutdown') {
                    worker.kill();
                } else {
                    counters.bytes += message.bytes;
                    counters.count += message.count;
                    counters.wait += message.wait;
                    counters.dns += message.dns;
                    counters.tcp += message.tcp;
                    counters.firstByte += message.firstByte;
                    counters.download += message.download;
                    counters.total += message.total;
                }
            });

            // retrieve all blob filenames, distributing to workers
            await new Promise(resolve => {
                try {
                    let index = 0;
                    const blobs = new EventEmitter();
                    listBlobs(blobs);
                    blobs.on('blob', (filename: string) => {
                        console.log(filename);
                        workers[index].send(filename);
                        index++;
                        if (index >= workers.length) index = 0;
                    });
                    blobs.on('next', () => {
                        logger.verbose('there are more blobs to be listed...');
                    });
                    blobs.on('end', () => {
                        resolve();
                    });
                } catch (error) {
                    logger.error('error waiting for all filenames...');
                    logger.error(error.message);
                    process.exit(1);
                }
            });

            // initiate shutdown
            for (const worker of workers) {
                worker.send('shutdown');
            }

            // wait for all workers to complete
            await new Promise(resolve => {
                cluster.on('exit', worker => {
                    const wi = workers.indexOf(worker);
                    if (wi > -1) workers.splice(wi, 1);
                    if (workers.length < 1) resolve();
                });
            });

            // display final stats
            display(counters);
            const duration = performance.now() / 1000 / 60;
            logger.info(`${duration} minutes total`);
            const mbpsec =
                counters.bytes / 1024 / 1024 / (performance.now() / 1000);
            logger.info(`${mbpsec} MB per second`);
        } else {
            spawn();
        }

        // calculate duration
    } catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
