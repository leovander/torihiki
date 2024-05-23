import { redisQueue } from '../cache';
import { logger } from '../logger';
import { LocalWorker } from '../worker';
import { Job, Worker } from 'bullmq';
import { bot as telegramBot, TELEGRAM_CHAT } from '../telegraf';
import { TelegramError } from 'telegraf';

const QUEUE_NAME = 'discord';

type DISCORD_MESSAGE = {
    author: string;
    guildName: string;
    guildId: string;
    channelName: string;
    channelId: string;
    content: string;
};

export const worker = new LocalWorker<DISCORD_MESSAGE>(
    QUEUE_NAME,
    [],
    {
        connection: redisQueue,
    },
    async (job: Job<DISCORD_MESSAGE>) => {
        const discordData = job.data;

        let telegramResponse;

        telegramResponse = await telegramBot.telegram
            .sendMessage(TELEGRAM_CHAT, discordData.content)
            .catch(async (err) => {
                const error = err as TelegramError;
                if (error.code === 429) {
                    const regex = new RegExp(/retry after (\d*)$/);
                    const match = error.message.match(regex);

                    if (match) {
                        const duration = parseInt(match[1]);
                        logger.error(
                            `Rate Limited for ${duration} while processing message - ${job.queueName}:${job.name}:${job.id}`,
                        );

                        await worker.worker.rateLimit(duration);

                        throw Worker.RateLimitError();
                    }
                } else {
                    throw err;
                }
            });

        return telegramResponse?.message_id;
    },
);
