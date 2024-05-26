import { logger } from './logger';
import { LocalWorker } from './worker';
import { worker as slickdealWorker } from './workers/slickdeal.worker';

export const workers = {
    // 'discord': discordWorker,
    slickdeal: slickdealWorker,
};

export async function runWorkers() {
    Object.values(workers).forEach((worker: LocalWorker<any>) => {
        logger.info(`Worker (${worker.queueName}) started`);
        worker.worker.run();
    });
}
