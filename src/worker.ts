import { Job, MetricsTime, Worker } from 'bullmq';
import { redisQueue } from './cache';
import { bot as telegramBot, TELEGRAM_CHAT } from './telegraf'; 
import { logger } from './logger';
import { discordQueue } from './queues';
import { DISCORD_MESSAGE } from './discord';
import { pre } from 'telegraf/format';

const DISCORD_QUEUE = 'Discord';
const QUEUE_LIMIT_MAX = process.env.QUEUE_LIMIT_MAX ? parseInt(process.env.QUEUE_LIMIT_MAX) : 10;
const QUEUE_LIMIT_DURATION = process.env.QUEUE_LIMIT_DURATION ? parseInt(process.env.QUEUE_LIMIT_DURATION) : 1000;

export const discordWorker = new Worker(DISCORD_QUEUE, async (job: Job<DISCORD_MESSAGE>) => {
  logger.info(`Processing new ${DISCORD_QUEUE} Job(${job.id})`);
  const discordData = job.data;
  
  // TODO: Customize Formatting
  // TODO: Middleware or new function to fetch all user session filters
  //        - IORedis - keys telegraf:
  //        - get filters for each
  //        - check if user isSubscribed before adding to global filters
  //        - may want to store an inverse map of filters to users (update via Scenes or commands)
  const tResponse = await telegramBot.telegram.sendMessage(
    TELEGRAM_CHAT,
    discordData.content
  );
  return tResponse.message_id;
}, {
  connection: redisQueue,
  limiter: {
    max: QUEUE_LIMIT_MAX,
    duration: QUEUE_LIMIT_DURATION,
  },
  metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2,
  },
  autorun: false
});

discordWorker.on('error', (err) => {
  logger.error(`Discord Worker - Could not process job: ${err}`);
});

discordWorker.on('failed', (job: Job, error: Error) => {
  logger.error(`${DISCORD_QUEUE} Job Failed: ${job.id} - ${error}`);
  // TODO: Send message to Admin, via telegram or pushover:
});

discordWorker.on('completed', (job: Job, returnvalue: number) => {
  logger.info(`${DISCORD_QUEUE} Job Completed(${job.id}): Telegram Message Id(${returnvalue})`);

  Promise.all([
    discordQueue.getPrioritizedCount(),
    discordQueue.getActiveCount(),
    discordQueue.getWaitingCount(),
    discordQueue.getCompletedCount(),
    discordQueue.getDelayedCount(),
    discordQueue.getFailedCount()
  ]).then((values) => {
    const [ prioritized, active, waiting, completed, delayed, failed ] = values;
    logger.info(JSON.stringify({
      prioritized,
      active,
      waiting,
      completed,
      delayed,
      failed
    }));
  });
});

const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, closing Discord Worker`);
  await discordWorker.close();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
