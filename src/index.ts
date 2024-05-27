import dotenv = require('dotenv');
dotenv.config();

import './lib/audio';
import { redis } from './lib/cache';
import { logger } from './lib/logger';
import './lib/server';
import {
    generateDynamicActions,
    setTelegramDetails,
    bot as telegramBot,
} from './lib/telegraf';
import { runWorkers, workers } from './lib/workers';

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
            generateDynamicActions(workers);
            setTelegramDetails();
        })
        .catch(async (error) => {
            logger.error(`Telegram Bot Error: ${error}`);
            process.exit(1);
        });
}

main().then(() => {
    logger.info('App has launched.');
});
