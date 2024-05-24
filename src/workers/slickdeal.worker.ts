import { redis, redisQueue } from '../cache';
import { LocalWorker } from '../worker';
import { Job } from 'bullmq';
import {
    bot as telegramBot,
    TELEGRAM_CHAT,
    TELEGRAM_THREAD_IDS,
} from '../telegraf';
import { parse } from 'rss-to-json';
import { createHash } from 'node:crypto';
import { logger } from '../logger';

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
    ): Promise<string> => {
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

            return `telegram:${telegramResponse?.message_id}`;
        } else {
            if ('categories' in job.data) {
                logger.info(
                    `Fetching Slickdeals: ${job.data.categories.map((cat) => cat.name)}`,
                );

                for await (const category of job.data.categories) {
                    const feed = await parse(category.url);
                    if (feed && feed.items.length > 0) {
                        for await (const item of feed.items) {
                            const newItem: SLICKDEAL_MESSAGE = {
                                id: '',
                                title: item.title,
                                link: item.link,
                                description: item.description ?? '',
                                content_encoded: item.content_encoded ?? '',
                                author: item.author ?? '',
                                published: item.published,
                                created: item.created,
                                category: category.name,
                            };

                            const url = new URL(item.link);
                            let pathname = url.pathname;

                            const regex = new RegExp(/(\/f\/\d*)-/);

                            const match = pathname.match(regex);
                            if (match) {
                                pathname = match[1];
                            }
                            newItem.link = `${url.origin}${pathname}`;

                            newItem.id = createHash('sha256')
                                .update(Buffer.from(newItem.link))
                                .digest('hex');

                            const isCached = await redis.get(
                                `slickdeals:${newItem.id}`,
                            );
                            if (isCached === null) {
                                await worker
                                    .addJob(newItem)
                                    .then(
                                        async (job: Job<SLICKDEAL_MESSAGE>) => {
                                            if (job.id) {
                                                await redis.set(
                                                    `slickdeals:${newItem.id}`,
                                                    JSON.stringify(newItem),
                                                    'EX',
                                                    60 * 60 * 24 * 7,
                                                );
                                            }
                                        },
                                    );
                            }
                        }
                    }
                }
            }

            return 'repeatableJob';
        }
    },
    [
        {
            data: {
                categories: [
                    {
                        name: 'slickdeals-frontpage',
                        url: 'https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1',
                    },
                    {
                        name: 'slickdeals-popular',
                        url: 'https://slickdeals.net/newsearch.php?mode=popdeals&searcharea=deals&searchin=first&rss=1',
                    },
                    {
                        name: 'slickdeals-trending',
                        url: 'https://feeds.feedburner.com/SlickdealsnetUP',
                    },
                ],
            },
            name: 'slickdeals',
            options: {
                repeat: {
                    pattern: '0 */15 * * * *',
                },
            },
        },
    ],
);
