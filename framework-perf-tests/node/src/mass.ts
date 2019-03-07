// includes
import cluster = require('cluster');
import cmd = require('commander');
import dotenv = require('dotenv');
import loremIpsum = require('lorem-ipsum');
import { v4 as uuid } from 'uuid';
import * as winston from 'winston';

// set env
dotenv.config();

// define options
cmd.option(
    '-l, --log-level <s>',
    'LOG_LEVEL. The minimum level to log (error, warn, info, verbose, debug, silly). Defaults to "info".',
    /^(error|warn|info|verbose|debug|silly)$/i
)
    .option(
        '-z, --file-size <i>',
        'FILE_SIZE. The file to be used for testing will be roughly this size in kilobytes. Default is "100" kb.',
        parseInt
    )
    .option(
        '-n, --file-count <i>',
        'FILE_COUNT. The number of files to create (simultaneous). Default is "100".',
        parseInt
    )
    .option(
        '-c, --concurrency <i>',
        'CONCURRENCY. The number of files being written at the same time in a process. Default is "10".',
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
const FILE_SIZE = cmd.fileSize || process.env.FILE_SIZE || 100;
const FILE_COUNT = cmd.fileCount || process.env.FILE_COUNT || 100;
const CONCURRENCY = cmd.concurrency || process.env.CONCURRENCY || 10;
const PROCESSES = cmd.processes || process.env.PROCESSES || 1;

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

// function to generate a file of roughly a given size
function generate() {
    return loremIpsum({
        count: 153 * FILE_SIZE,
        format: 'plain',
        units: 'words'
    });
}

async function spawn(count: number) {
    try {
        logger.verbose(`worker pid "${process.pid}" started...`);

        // create random data
        logger.verbose(`worker pid "${process.pid}" generating data...`);
        const files: { id: string; data: string }[] = [];
        for (let i = 0; i < count; i++) {
            const id = uuid();
            const data = generate();
            files.push({ id, data });
        }
        logger.verbose(`worker pid "${process.pid}" finished generating data.`);

        // start the clock
        const startTime = new Date().valueOf();

        // post the data all at the same time
        const promises: Array<Promise<any>> = [];
        for (let i = 0; i < count; i++) {
            const o = files[i];
            const promise = createBlob(o.id, o.data).catch(error => {
                logger.error(`Error during createBlob...`);
                logger.error(error.message);
            });
            promises.push(promise);
        }

        // wait for completion
        logger.verbose(
            `worker pid "${process.pid}" sending ${files.length} files...`
        );
        await Promise.all(promises);
        logger.verbose(
            `worker pid "${process.pid}" sent ${files.length} files.`
        );

        // record the time
        const duration = new Date().valueOf() - startTime;
        logger.verbose(
            `worker pid "${process.pid}" completed after ${duration} ms.`
        );
        counters.duration += duration;
        if (process.send) process.send(JSON.stringify(counters));
    } catch (error) {
        logger.error(`Error during spawn...`);
        logger.error(error.message);
    }
}

function display() {
    logger.info(`duration: ${counters.duration} ms`);
    logger.info(`count: ${counters.count}`);
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
            logger.info(`URL is "${URL}".`);
            logger.info(
                `STORAGE_KEY is "${STORAGE_KEY ? 'defined' : 'undefined'}"`
            );
            logger.info(
                `STORAGE_SAS is "${STORAGE_SAS ? 'defined' : 'undefined'}"`
            );
            logger.info(`FILE_SIZE is "${FILE_SIZE}" kb.`);
            logger.info(`FILE_COUNT is "${FILE_COUNT}".`);
            logger.info(`MAX_SOCKETS is "${MAX_SOCKETS}".`);
            logger.info(`PROCESSES is "${PROCESSES}".`);

            // validate
            if ((STORAGE_ACCOUNT && STORAGE_CONTAINER) || URL) {
                // ok
            } else {
                logger.error(
                    'You must specify both STORAGE_ACCOUNT and STORAGE_CONTAINER unless using URL.'
                );
                process.exit(1);
            }
            if (STORAGE_KEY || STORAGE_SAS || URL) {
                // ok
            } else {
                logger.error(
                    'You must specify either STORAGE_KEY or STORAGE_SAS unless using URL.'
                );
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
                    if (exits >= PROCESSES) resolve();
                });
            });

            // display final stats
            display();
        } else {
            spawn(FILE_COUNT / PROCESSES);
        }

        // calculate duration
    } catch (error) {
        logger.error(`Error during startup...`);
        logger.error(error.message);
    }
}
startup();
