import dotenv = require('dotenv');
dotenv.config();

import { logger } from './logger';
import { bot as telegramBot } from './telegraf';
import { client as discordBot, DISCORD_TOKEN } from './discord';
import { redis } from './cache';
import { discordWorker } from './worker';
import { discordQueue } from './queues';
import './audio';

async function main () {
  telegramBot.launch();

  await Promise.all([
    telegramBot.telegram.getMe(),
    discordBot.login(DISCORD_TOKEN),
    redis.ping()
  ]).then(async (values) => {
    const [ user ] = values;
    logger.info(`Telegram bot (${user.first_name}) is ready!`);
    discordWorker.run();
  }).catch((error) => {
    logger.error(`Could not connect to Telegram: ${error}`);
    process.exit(1);
  });

  // await discordQueue.obliterate();
  // await discordQueue.drain();
}

main().then(()=> { logger.info('App has launched.'); });