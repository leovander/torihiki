import { Redis } from 'ioredis';
import { logger } from './logger';

const REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT
    ? parseInt(process.env.REDIS_PORT)
    : 6379;
export const REDIS_CONNECTION = `redis://${REDIS_HOST}:${REDIS_PORT}`;
const REDIS_QUEUE_DB = process.env.REDIS_QUEUE_DB
    ? parseInt(process.env.REDIS_QUEUE_DB)
    : 1;
const REDIS_DEFAULT_DB = process.env.REDIS_DEFAULT_DB
    ? parseInt(process.env.REDIS_DEFAULT_DB)
    : 0;

export const redisQueue = new Redis({
    port: REDIS_PORT,
    host: REDIS_HOST,
    db: REDIS_QUEUE_DB,
    maxRetriesPerRequest: null,
});

redisQueue.on('ready', () => {
    logger.info(`Redis Connection (Queue)`);
});

redisQueue.on('error', (error) => {
    logger.error(`Redis Client Error: ${error}`);
});

export const redis = new Redis({
    port: REDIS_PORT,
    host: REDIS_HOST,
    db: REDIS_DEFAULT_DB,
});

redis.on('ready', () => {
    logger.info(`Redis Connection (Redis)`);
});

redis.on('error', (error) => {
    logger.error(`Redis Client Error: ${error}`);
});
