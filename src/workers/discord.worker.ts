import { redisQueue } from '../cache';
import { LocalWorker } from '../worker';
import { Job } from 'bullmq';
import { bot as telegramBot, TELEGRAM_CHAT } from '../telegraf';

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
    {
        connection: redisQueue,
    },
    async (job: Job<DISCORD_MESSAGE>): Promise<number | undefined> => {
        const discordData = job.data;

        let telegramResponse;

        telegramResponse = await telegramBot.telegram
            .sendMessage(TELEGRAM_CHAT, discordData.content)
            .catch(async (err: Error) => {
                if (worker.rateLimiter) {
                    await worker.rateLimiter(err, job);
                }
            });

        return telegramResponse?.message_id;
    },
);
