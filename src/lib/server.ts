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

import { logger } from './logger';
import { workers } from './workers';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

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
        readOnlyMode: true,
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
