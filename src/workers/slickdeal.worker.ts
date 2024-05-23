import { redisQueue } from '../cache';
import { logger } from '../logger';
import { LocalWorker } from '../worker';
import { Job, Worker } from 'bullmq';
import { bot as telegramBot, TELEGRAM_CHAT } from '../telegraf';
import { TelegramError } from 'telegraf';
import { parseTelegramThreadIds } from '../utilities';

const QUEUE_NAME = 'slickdeal';
const MESSAGE_THREAD_IDS = process.env.TELEGRAM_SLICKDEAL_MESSAGE_THREAD_IDS
    ? parseTelegramThreadIds(process.env.TELEGRAM_SLICKDEAL_MESSAGE_THREAD_IDS)
    : [];

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
    MESSAGE_THREAD_IDS,
    {
        connection: redisQueue,
    },
    async (job: Job<SLICKDEAL_MESSAGE | SLICKDEAL_REPEATABLE>) => {
        const slickdealData = job.data;

        let telegramResponse;

        if ('link' in slickdealData) {
            telegramResponse = await telegramBot.telegram
                .sendMessage(TELEGRAM_CHAT, slickdealData.link, {
                    reply_parameters: {
                        message_id:
                            worker.telegramThreadIds[slickdealData.category],
                    },
                })
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
        } else {
            //TODO: Fecth RSS Feeds and Parse them
        }

        return telegramResponse?.message_id;
    },
);
