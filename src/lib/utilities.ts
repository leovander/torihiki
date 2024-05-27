import { Axios } from 'axios';
import { client as discordBot } from './discord';
import { logger } from './logger';
import { server } from './server';
import { bot as telegramBot } from './telegraf';
import { LocalWorker, TelegramThreadIds } from './worker';
import { workers } from './workers';

const THREAD_DELIMITER = ';';
const OBJECT_DELIMITER = ':';

const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN;
const PUSHOVER_USER_TOKEN = process.env.PUSHOVER_USER_TOKEN;

const axios: Axios = require('axios');

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

function parseTelegramAdminIds(input: string): number[] {
    if (input.length === 0) {
        return [];
    }

    let threadIds: number[] = input.split(OBJECT_DELIMITER).map((admin) => {
        return parseInt(admin);
    });

    return threadIds;
}

async function sendAdminError(title: string, message: string): Promise<void> {
    if (PUSHOVER_APP_TOKEN && PUSHOVER_USER_TOKEN) {
        axios
            .post('https://api.pushover.net/1/messages.json', {
                token: PUSHOVER_APP_TOKEN,
                user: PUSHOVER_USER_TOKEN,
                message: message,
                title: title,
            })
            .catch((error) => {
                if (error.response) {
                    logger.error(JSON.stringify(error.response.data));
                } else if (error.request) {
                    logger.error(JSON.stringify(error.request));
                } else {
                    logger.error('Error', error.message);
                }
            });
    }
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

export {
    gracefulShutdown,
    isEmpty,
    parseTelegramAdminIds,
    parseTelegramThreadIds,
};
