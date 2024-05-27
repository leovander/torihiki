import { worker as slickdealWorker } from '../workers/slickdeal.worker';
import { logger } from './logger';
import { LocalWorker, LocalWorkerDataTypes } from './worker';

export interface Workers {
    [index: string]: LocalWorker<LocalWorkerDataTypes>;
}

export const workers: Workers = {
    // 'discord': discordWorker,
    slickdeal: slickdealWorker,
};

export async function runWorkers() {
    Object.values(workers).forEach(
        (worker: LocalWorker<LocalWorkerDataTypes>) => {
            logger.info(`Worker (${worker.queueName}) started`);
            worker.worker.run();
        },
    );
}
