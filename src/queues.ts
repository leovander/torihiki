import { Queue } from 'bullmq';
import { redisQueue } from './cache'; 
import { logger } from './logger';
import { DISCORD_MESSAGE } from './discord';

const DISCORD_QUEUE = process.env.DISCORD_QUEUE;
const SUBSCRIPTION_QUEUE = process.env.SUBSCRIPTION_QUEUE;

export const DISCORD_QUEUE_REMOVE_ON_COMPLETE_AGE = process.env.REMOVE_ON_COMPLETE_AGE ? parseInt(process.env.REMOVE_ON_COMPLETE_AGE) : 3600;
export const DISCORD_QUEUE_REMOVE_ON_COMPLETE_COUNT = process.env.REMOVE_ON_COMPLETE_COUNT ? parseInt(process.env.REMOVE_ON_COMPLETE_COUNT) : 1000;
export const DISCORD_QUEUE_REMOVE_ON_FAIL_COUNT = process.env.REMOVE_ON_FAIL_COUNT ? parseInt(process.env.REMOVE_ON_FAIL_COUNT) : 5000;
export const ATTEMPTS = process.env.ATTEMPTS ? parseInt(process.env.ATTEMPTS) : 3;
export const BACKOFF_DELAY = process.env.BACKOFF_DELAY ? parseInt(process.env.BACKOFF_DELAY) : 1000;

export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    age: DISCORD_QUEUE_REMOVE_ON_COMPLETE_AGE,
    count: DISCORD_QUEUE_REMOVE_ON_COMPLETE_COUNT,
  },
  removeOnFail: DISCORD_QUEUE_REMOVE_ON_FAIL_COUNT,
  attempts: ATTEMPTS,
  backoff: {
    type: 'exponential',
    delay: BACKOFF_DELAY,
  },
};

export const discordQueue = new Queue<DISCORD_MESSAGE>(DISCORD_QUEUE, {
  connection: redisQueue
});

discordQueue.on('error', (err) => {
  logger.error(`${DISCORD_QUEUE} Queue Error: ${err}`);
});

export const subscriptionQueue = new Queue(SUBSCRIPTION_QUEUE, {
  connection: redisQueue
});

subscriptionQueue.on('error', (err) => {
  logger.error(`${SUBSCRIPTION_QUEUE} Queue Error: ${err}`);
});