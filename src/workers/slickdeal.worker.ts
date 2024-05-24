import { redisQueue } from '../cache';
import { LocalWorker } from '../worker';
import { Job } from 'bullmq';
import {
    bot as telegramBot,
    TELEGRAM_CHAT,
    TELEGRAM_THREAD_IDS,
} from '../telegraf';

const QUEUE_NAME = 'slickdeal';

export type SLICKDEAL_MESSAGE = {
    id: string;
    title: string;
    link: string;
    description: string;
    content_encoded: string;
    author: string;
    published: number;
    created: number;
    category: string;
};

type SLICKDEAL_CATEGORY = {
    name: string;
    url: string;
};

type SLICKDEAL_REPEATABLE = {
    categories: SLICKDEAL_CATEGORY[];
};

export const worker: LocalWorker<any> = new LocalWorker<
    SLICKDEAL_MESSAGE | SLICKDEAL_REPEATABLE
>(
    QUEUE_NAME,
    {
        connection: redisQueue,
    },
    async (
        job: Job<SLICKDEAL_MESSAGE | SLICKDEAL_REPEATABLE>,
    ): Promise<number | undefined> => {
        const slickdealData = job.data;

        let telegramResponse;

        if ('link' in slickdealData) {
            telegramResponse = await telegramBot.telegram
                .sendMessage(TELEGRAM_CHAT, slickdealData.link, {
                    reply_parameters: {
                        message_id: TELEGRAM_THREAD_IDS[slickdealData.category],
                    },
                })
                .catch(async (err: Error) => {
                    if (worker.rateLimiter) {
                        await worker.rateLimiter(err, job);
                    }
                });
        } else {
            //TODO: Fecth RSS Feeds and Parse them
        }

        return telegramResponse?.message_id;
    },
);
