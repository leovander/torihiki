import { logger } from './logger';
import { workers } from './workers';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { shutdownHandler } from './shutdown';

import express = require('express');

const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000;

const app = express();

app.use(
    (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        logger.info(`Request on ${req.path}`);
        next();
    },
);

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/queues');

const queues = Object.values(workers).map((worker) => {
    return new BullMQAdapter(worker.queue, {
        readOnlyMode: false,
    });
});

createBullBoard({
    queues: queues,
    serverAdapter: serverAdapter,
});

app.use('/queues', serverAdapter.getRouter());

export const server = app.listen(PORT, () => {
    logger.info(`Server Listening on (${PORT})`);
});

shutdownHandler.addStopCallback();

process.on('SIGINT', () => {
    logger.info('Received SIGINT, closing HTTP Server');
    server.close(() => {
        shutdownHandler.gracefulShutdown('SIGINT');
    });
});
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, closing HTTP Server');
    server.close(() => {
        shutdownHandler.gracefulShutdown('SIGTERM');
    });
});
