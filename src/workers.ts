import { logger } from './logger';
import { LocalWorker } from './worker';
import { worker as discordWorker } from './workers/discord.worker';
import { worker as slickdealWorker } from './workers/slickdeal.worker';

export const workers = {
    // 'discord': discordWorker,
    'slickdeal': slickdealWorker
};

export async function runWorkers () {
    await Promise.all(
        Object.values(workers).map((worker: LocalWorker<any>) => {
            return worker.worker.run();
        })
    );
}

async function gracefulShutdown (signal: string) {
    await Promise.all(
        Object.values(workers).map((worker: LocalWorker<any>) => {
            logger.info(`Received ${signal}, closing ${worker.queueName} Worker`);
            return worker.worker.close();
        })
    );
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
