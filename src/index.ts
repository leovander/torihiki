import dotenv = require('dotenv');
dotenv.config();

import { logger } from './logger';
import { TELEGRAM_CHAT, bot as telegramBot } from './telegraf';
import { client as discordBot, DISCORD_TOKEN } from './discord';
import { redis } from './cache';
import './audio';
import { workers, runWorkers } from './workers';
import { parse } from 'rss-to-json';
import { createHash } from 'node:crypto';
import { SLICKDEAL_MESSAGE } from './workers/slickdeal.worker';

async function main () {
    telegramBot.launch();

    await Promise.all([
        telegramBot.telegram.getMe(),
        // discordBot.login(DISCORD_TOKEN),
        redis.ping()
    ]).then((values) => {
        const [ user ] = values;
        logger.info(`Telegram bot (${user.first_name}) is ready!`);
        // runWorkers();
    }).catch((error) => {
        logger.error(`Could not connect to Telegram: ${error}`);
        process.exit(1);
    });

    const hash = createHash('sha256');

    parse('https://slickdeals.net/newsearch.php?mode=frontpage&searcharea=deals&searchin=first&rss=1').then(async (rss) => {
        if (rss && rss.items.length > 0) {
            for await (const item of rss.items) {
                const newItem: SLICKDEAL_MESSAGE = {
                    id: '',
                    title: item.title,
                    link: item.link,
                    description: item.description,
                    content_encoded: item.content_encoded,
                    author: item.author,
                    published: item.published,
                    created: item.created,
                    category: 'slickdeals-frontpage'
                }

                const url = new URL(item.link);
                newItem.link = `${url.origin}${url.pathname}`;
                hash.update(newItem.link);

                newItem.id = hash.copy().digest('hex');

                const isCached = await redis.get(`slickdeals:${newItem.id}`);
                if (isCached === null) {
                    await redis.set(`slickdeals:${newItem.id}`, JSON.stringify(newItem), 'EX', 60 * 60 * 24 * 7);
                    workers.slickdeal.addJob(newItem);
                } else {
                    logger.info(`Existing slickdeals-frontpage:${newItem.id}`);
                }
            }
        }
    });
}

main().then(()=> { logger.info('App has launched.'); });
