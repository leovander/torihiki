import { Job } from 'bullmq';
import { bold, join } from 'telegraf/format';
import { Nestable } from 'telegraf/typings/core/helpers/formatting';
import { redisQueue } from '../lib/cache';
import {
    TELEGRAM_CHAT_ID,
    TELEGRAM_THREAD_IDS,
    bot as telegramBot,
} from '../lib/telegraf';
import { LocalWorker } from '../lib/worker';
import { DISCORD_MESSAGE } from '../types/message';

const QUEUE_NAME = 'discord';

export const worker = new LocalWorker<DISCORD_MESSAGE>(
    QUEUE_NAME,
    {
        connection: redisQueue,
    },
    async (job: Job<DISCORD_MESSAGE>): Promise<string> => {
        const discordData = job.data;
        if (
            discordData.content &&
            discordData.channelName &&
            discordData.author
        ) {
            let message: Nestable<string>[] = [];

            message = [
                discordData.content,
                '\n\n',
                'Author: ',
                bold(discordData.author),
            ];

            const telegramResponse = await telegramBot.telegram
                .sendMessage(TELEGRAM_CHAT_ID, join(message), {
                    reply_parameters: {
                        message_id:
                            TELEGRAM_THREAD_IDS[discordData.channelName],
                    },
                })
                .catch(async (err: Error) => {
                    if (worker.rateLimiter) {
                        await worker.rateLimiter(err, job);
                    }
                });

            return telegramResponse?.message_id.toString() ?? '';
        }

        return 'missing-data';
    },
);
