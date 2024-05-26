import { client as discordBot } from './discord';
import { logger } from './logger';
import { server } from './server';
import { bot as telegramBot } from './telegraf';
import { LocalWorker, TelegramThreadIds } from './worker';
import { workers } from './workers';

const THREAD_DELIMITER = ';';
const OBJECT_DELIMITER = ':';

function isEmpty(input: string): boolean {
    return !input || input === '';
}

function parseTelegramThreadIds(input: string): TelegramThreadIds {
    if (input.length === 0) {
        return {};
    }

    let threadIds: TelegramThreadIds = {};

    input.split(THREAD_DELIMITER).forEach((thread) => {
        const [name, id] = thread.split(OBJECT_DELIMITER);
        if (name && id) {
            threadIds[name] = parseInt(id);
        }
    });

    return threadIds;
}

// Enable graceful stop
async function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}, closing HTTP Server`);
    server.close();

    logger.info(`Received ${signal}, destroying Discord Bot`);
    discordBot.destroy();

    logger.info(`Received ${signal}, closing Telegram Bot`);
    await telegramBot.stop(signal);

    await Promise.all(
        Object.values(workers).map((worker: LocalWorker<any>) => {
            logger.info(
                `Received ${signal}, closing Worker (${worker.queueName})`,
            );
            return worker.worker.close();
        }),
    );
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { gracefulShutdown, isEmpty, parseTelegramThreadIds };
