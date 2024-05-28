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
