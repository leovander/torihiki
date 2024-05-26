import { Job } from 'bullmq';
import { redisQueue } from '../cache';
import { TELEGRAM_CHAT, bot as telegramBot } from '../telegraf';
import { LocalWorker } from '../worker';

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
    async (job: Job<DISCORD_MESSAGE>): Promise<string> => {
        const discordData = job.data;

        let telegramResponse;

        telegramResponse = await telegramBot.telegram
            .sendMessage(TELEGRAM_CHAT, discordData.content)
            .catch(async (err: Error) => {
                if (worker.rateLimiter) {
                    await worker.rateLimiter(err, job);
                }
            });

        return telegramResponse?.message_id.toString() ?? '';
    },
);
