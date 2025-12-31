import { worker as outlookWorker } from '../workers/outlook.worker';
import { worker as slickdealWorker } from '../workers/slickdeal.worker';
import { logger } from './logger';
import { shutdownHandler } from './shutdown';
import { LocalWorker, LocalWorkerDataTypes } from './worker';

export interface Workers {
    [index: string]: LocalWorker<LocalWorkerDataTypes>;
}

export const workers: Workers = {
    // discord: discordWorker,
    outlook: outlookWorker as LocalWorker<LocalWorkerDataTypes>,
    slickdeal: slickdealWorker as LocalWorker<LocalWorkerDataTypes>,
};

export async function runWorkers() {
    Object.values(workers).forEach(
        (worker: LocalWorker<LocalWorkerDataTypes>) => {
            logger.info(`Worker (${worker.queueName}) started`);
            worker.worker.run();

            shutdownHandler.addStopCallback();

            process.on('SIGINT', async () => {
                logger.info(
                    `Received SIGINT, closing Worker (${worker.queueName})`,
                );
                await worker.worker.close();
                shutdownHandler.gracefulShutdown('SIGINT');
            });
            process.on('SIGTERM', async () => {
                logger.info(
                    `Received SIGTERM, closing Worker (${worker.queueName})`,
                );
                await worker.worker.close();
                shutdownHandler.gracefulShutdown('SIGTERM');
            });
        },
    );
}
