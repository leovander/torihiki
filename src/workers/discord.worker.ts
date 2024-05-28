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

import { Job } from 'bullmq';
import { redisQueue } from '../lib/cache';
import { TELEGRAM_CHAT_ID, bot as telegramBot } from '../lib/telegraf';
import { LocalWorker } from '../lib/worker';

const QUEUE_NAME = 'discord';

export type DISCORD_MESSAGE = {
    author: string;
    guildName: string;
    guildId: string;
    channelName: string;
    channelId: string;
    content: string;
};

export const worker = new LocalWorker<DISCORD_MESSAGE>(
    QUEUE_NAME,
    {
        connection: redisQueue,
    },
    async (job: Job<DISCORD_MESSAGE>): Promise<string> => {
        const discordData = job.data;

        const telegramResponse = await telegramBot.telegram
            .sendMessage(TELEGRAM_CHAT_ID, discordData.content)
            .catch(async (err: Error) => {
                if (worker.rateLimiter) {
                    await worker.rateLimiter(err, job);
                }
            });

        return telegramResponse?.message_id.toString() ?? '';
    },
);
