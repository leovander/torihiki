import dotenv = require('dotenv');
dotenv.config();

import './audio';
import { redis } from './cache';
import { logger } from './logger';
import './server';
import { bot as telegramBot } from './telegraf';
import { runWorkers } from './workers';

async function main() {
    telegramBot.launch();

    await Promise.all([
        telegramBot.telegram.getMe(),
        // discordBot.login(DISCORD_TOKEN),
        redis.ping(),
    ])
        .then((values) => {
            const [user] = values;
            logger.info(`Telegram bot (${user.first_name})`);
            runWorkers();
        })
        .catch((error) => {
            logger.error(`Could not connect to Telegram: ${error}`);
            process.exit(1);
        });
}

main().then(() => {
    logger.info('App has launched.');
});
