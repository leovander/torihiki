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

import { worker as slickdealWorker } from '../workers/slickdeal.worker';
import { logger } from './logger';
import { LocalWorker, LocalWorkerDataTypes } from './worker';

export interface Workers {
    [index: string]: LocalWorker<LocalWorkerDataTypes>;
}

export const workers: Workers = {
    // 'discord': discordWorker,
    slickdeal: slickdealWorker,
};

export async function runWorkers() {
    Object.values(workers).forEach(
        (worker: LocalWorker<LocalWorkerDataTypes>) => {
            logger.info(`Worker (${worker.queueName}) started`);
            worker.worker.run();
        },
    );
}
