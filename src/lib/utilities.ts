/*
*	Torihiki - Message Forwarder and Notifier
*	Copyright (C) 2024 Israel Torres (https://github.com/leovander)

*	This program is free software: you can redistribute it and/or modify
*	it under the terms of the GNU Affero General Public License as published
*	by the Free Software Foundation, either version 3 of the License, or
*	(at your option) any later version.
*
*	This program is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
*	GNU Affero General Public License for more details.
*
*	You should have received a copy of the GNU Affero General Public License
*	along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

import { client as discordBot } from './discord';
import { logger } from './logger';
import { server } from './server';
import { bot as telegramBot } from './telegraf';
import { LocalWorker, LocalWorkerDataTypes, TelegramThreadIds } from './worker';
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

    const threadIds: TelegramThreadIds = {};

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

    const threadIds: number[] = input.split(OBJECT_DELIMITER).map((admin) => {
        return parseInt(admin);
    });

    return threadIds;
}

/*
const PUSHOVER_APP_TOKEN = process.env.PUSHOVER_APP_TOKEN;
const PUSHOVER_USER_TOKEN = process.env.PUSHOVER_USER_TOKEN;

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
} */

async function gracefulShutdown(signal: string) {
    server.close();
    logger.info(`Received ${signal}, closed HTTP Server`);

    discordBot.destroy();
    logger.info(`Received ${signal}, destroyed Discord Bot`);

    telegramBot.stop(signal);
    logger.info(`Received ${signal}, stopped Telegram Bot`);

    await Promise.all(
        Object.values(workers).map(
            (worker: LocalWorker<LocalWorkerDataTypes>) => {
                logger.info(
                    `Received ${signal}, closing Worker (${worker.queueName})`,
                );
                return worker.worker.close();
            },
        ),
    );

    process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export {
    gracefulShutdown,
    isEmpty,
    parseTelegramAdminIds,
    parseTelegramThreadIds,
};
