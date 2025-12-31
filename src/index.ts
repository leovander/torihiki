import dotenv = require('dotenv');
dotenv.config();

import { redis } from './lib/cache';
// import { DISCORD_TOKEN, client as discordBot } from './lib/discord';
import { logger } from './lib/logger';
import { authenticateWithDeviceCode } from './lib/outlook-auth';
import './lib/server';
import {
    generateDynamicActions,
    setTelegramDetails,
    bot as telegramBot,
} from './lib/telegraf';
import { runWorkers, workers } from './lib/workers';

// Handle --outlook-auth flag for OAuth2 authentication
if (process.argv.includes('--outlook-auth')) {
    redis.ping().then(() => {
        authenticateWithDeviceCode()
            .then(() => {
                process.exit(0);
            })
            .catch((error) => {
                logger.error(`OAuth authentication failed: ${error}`);
                process.exit(1);
            });
    });
} else {
    main().then(() => {
        logger.info('App has launched.');
    });
}

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
