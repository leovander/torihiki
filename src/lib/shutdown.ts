import { logger } from './logger';

class ShutDown {
    callbacks: number;

    constructor() {
        this.callbacks = 0;
    }

    addStopCallback() {
        this.callbacks += 1;
    }

    gracefulShutdown(signal: string) {
        this.callbacks -= 1;

        if (this.callbacks === 0) {
            logger.info(`Received ${signal}, exiting process`);
            process.exit(0);
        }
    }
}

export const shutdownHandler = new ShutDown();
