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
import { createHash } from 'node:crypto';
import { parse } from 'rss-to-json';
import { bold, join } from 'telegraf/format';
import { Nestable } from 'telegraf/typings/core/helpers/formatting';
import { redis, redisQueue } from '../lib/cache';
import { logger } from '../lib/logger';
import {
    TELEGRAM_CHAT_ID,
    TELEGRAM_NAMESPACE,
    TELEGRAM_THREAD_IDS,
    bot as telegramBot,
} from '../lib/telegraf';
import { LocalWorker } from '../lib/worker';

const QUEUE_NAME = 'slickdeal';

export type SLICKDEAL_MESSAGE = {
    id?: string;
    title?: string;
    link?: string;
    description?: string;
    content_encoded?: string;
    author?: string;
    published?: number;
    created?: number;
    category?: string;
    feeds?: SLICKDEAL_CATEGORY[];
};

type SLICKDEAL_CATEGORY = {
    name: string;
    url: string;
};

async function containsWords(
    message: SLICKDEAL_MESSAGE,
): Promise<{ matched: string[]; hasMatch: boolean }> {
    const cachedFilters = await redis.get(`${TELEGRAM_NAMESPACE}:filters`);
    const filters: string[] = JSON.parse(cachedFilters || '[]');

    const { title, description, content_encoded } = message;
    const search = (text?: string) => {
        const matchedWords = filters.filter((word) => text?.includes(word));
        return { matched: matchedWords, hasMatch: matchedWords.length > 0 };
    };

    const titleSearch = search(title?.toLowerCase());
    const descriptionSearch = search(description?.toLowerCase());
    const contentSearch = search(content_encoded?.toLowerCase());

    return {
        matched: [
            ...titleSearch.matched,
            ...descriptionSearch.matched,
            ...contentSearch.matched,
        ],
        hasMatch:
            titleSearch.hasMatch ||
            descriptionSearch.hasMatch ||
            contentSearch.hasMatch,
    };
}

export const worker = new LocalWorker<SLICKDEAL_MESSAGE>(
    QUEUE_NAME,
    {
        connection: redisQueue,
    },
    async (job: Job<SLICKDEAL_MESSAGE>): Promise<string> => {
        const slickdealData = job.data;

        let telegramResponse;

        if (slickdealData.link && slickdealData.category) {
            let message: Nestable<string>[] = [];

            if (slickdealData.description) {
                message = [bold(slickdealData.description), '\n\n'];
            }

            message.push(slickdealData.link);

            telegramResponse = await telegramBot.telegram
                .sendMessage(TELEGRAM_CHAT_ID, join(message), {
                    reply_parameters: {
                        message_id: TELEGRAM_THREAD_IDS[slickdealData.category],
                    },
                })
                .catch(async (err: Error) => {
                    if (worker.rateLimiter) {
                        await worker.rateLimiter(err, job);
                    }
                });

            const { matched, hasMatch } = await containsWords(slickdealData);

            if (hasMatch) {
                message.push(`\n\nFiltered: ${matched.join(', ')}`);

                await telegramBot.telegram
                    .sendMessage(TELEGRAM_CHAT_ID, join(message))
                    .catch(async (err: Error) => {
                        if (worker.rateLimiter) {
                            await worker.rateLimiter(err, job);
                        }
                    });
            }

            return `telegram:${telegramResponse?.message_id}`;
        } else {
            if (slickdealData.feeds) {
                logger.info(
                    `Fetching Slickdeals: ${slickdealData.feeds.map((cat) => cat.name)}`,
                );

                for await (const category of slickdealData.feeds) {
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
                                    .then(async (job: Job) => {
                                        if (job.id) {
                                            await redis.set(
                                                `slickdeals:${newItem.id}`,
                                                JSON.stringify(newItem),
                                                'EX',
                                                60 * 60 * 24 * 7,
                                            );
                                        }
                                    });
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
                feeds: [
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
