import {
    Job,
    JobsOptions,
    MetricsTime,
    Queue,
    QueueOptions,
    Worker,
} from 'bullmq';
import { logger } from './logger';

const DEFAULT_QUEUE_REMOVE_ON_COMPLETE_AGE = process.env.REMOVE_ON_COMPLETE_AGE
    ? parseInt(process.env.REMOVE_ON_COMPLETE_AGE)
    : 3600;
const DEFAULT_QUEUE_REMOVE_ON_COMPLETE_COUNT = process.env
    .REMOVE_ON_COMPLETE_COUNT
    ? parseInt(process.env.REMOVE_ON_COMPLETE_COUNT)
    : 1000;
const DEFAULT_QUEUE_REMOVE_ON_FAIL_COUNT = process.env.REMOVE_ON_FAIL_COUNT
    ? parseInt(process.env.REMOVE_ON_FAIL_COUNT)
    : 5000;
const DEFAULT_ATTEMPTS = process.env.ATTEMPTS
    ? parseInt(process.env.ATTEMPTS)
    : 3;
const DEFAULT_BACKOFF_DELAY = process.env.BACKOFF_DELAY
    ? parseInt(process.env.BACKOFF_DELAY)
    : 1000;
const QUEUE_LIMIT_MAX = process.env.QUEUE_LIMIT_MAX
    ? parseInt(process.env.QUEUE_LIMIT_MAX)
    : 10;
const QUEUE_LIMIT_DURATION = process.env.QUEUE_LIMIT_DURATION
    ? parseInt(process.env.QUEUE_LIMIT_DURATION)
    : 1000;

export type TelegramThread = {
    name: string;
    messageThreadId: number;
};

export class LocalWorker<DataType> {
    queueName: string;
    telegramThreadIds: any;
    jobName: string;
    queueOptions: QueueOptions;
    jobOptions: JobsOptions;
    queue: Queue;
    worker: Worker;
    process: (job: Job<DataType>) => Promise<number | undefined>;
    //   rateLimiter: () => Promise<Error>;

    constructor(
        queueName: string,
        telegramThreadIds: TelegramThread[],
        queueOptions: QueueOptions,
        process: (job: Job<DataType>) => Promise<number | undefined>,
        jobOptions?: JobsOptions,
    ) {
        this.queueName = queueName;
        this.telegramThreadIds = [];

        if (telegramThreadIds.length > 0) {
            telegramThreadIds.forEach((thread) => {
                this.telegramThreadIds[thread.name] = thread.messageThreadId;
            });
        }

        this.jobName = `${queueName}Message`;
        this.queueOptions = queueOptions;

        if (jobOptions) {
            this.jobOptions = jobOptions;
        } else {
            this.jobOptions = {
                removeOnComplete: {
                    age: DEFAULT_QUEUE_REMOVE_ON_COMPLETE_AGE,
                    count: DEFAULT_QUEUE_REMOVE_ON_COMPLETE_COUNT,
                },
                removeOnFail: DEFAULT_QUEUE_REMOVE_ON_FAIL_COUNT,
                attempts: DEFAULT_ATTEMPTS,
                backoff: {
                    type: 'exponential',
                    delay: DEFAULT_BACKOFF_DELAY,
                },
            };
        }

        this.queue = new Queue<DataType>(this.queueName, this.queueOptions);

        this.queue.on('error', (err) => {
            logger.error(`${this.queueName} Queue Error: ${err}`);
        });

        this.queue.on('waiting', (job: Job<DataType>) => {
            logger.info(`Queued Message - ${this.queueName}:${job.id}`);
        });

        this.process = process;

        this.worker = new Worker<DataType>(this.queueName, this.process, {
            ...this.queueOptions,
            limiter: {
                max: QUEUE_LIMIT_MAX,
                duration: QUEUE_LIMIT_DURATION,
            },
            metrics: {
                maxDataPoints: MetricsTime.ONE_WEEK * 2,
            },
            autorun: false,
        });

        this.worker.on('ready', () => {
            logger.info(`Worker ${this.queueName} is ready!`);
        });

        this.worker.on('error', (err) => {
            logger.error(`${this.queueName} - Could not process job: ${err}`);
        });

        this.worker.on(
            'failed',
            (job: Job<DataType> | undefined, error: Error) => {
                if (job) {
                    logger.error(
                        `Message Failed - ${job.queueName}:${job.id} - ${error}`,
                    );
                    //TODO: Send message to Admin, via telegram or pushover:
                }
            },
        );

        this.worker.on(
            'completed',
            (job: Job<DataType>, returnvalue: number) => {
                logger.info(
                    `Message Completed - ${job.queueName}:${job.id}:telegram:${returnvalue}`,
                );

                Promise.all([
                    this.queue.getPrioritizedCount(),
                    this.queue.getActiveCount(),
                    this.queue.getWaitingCount(),
                    this.queue.getCompletedCount(),
                    this.queue.getDelayedCount(),
                    this.queue.getFailedCount(),
                ]).then((values) => {
                    const [
                        prioritized,
                        active,
                        waiting,
                        completed,
                        delayed,
                        failed,
                    ] = values;
                    logger.info(
                        JSON.stringify({
                            queue: job.queueName,
                            prioritized,
                            active,
                            waiting,
                            completed,
                            delayed,
                            failed,
                        }),
                    );
                });
            },
        );
    }

    async addJob(data: DataType): Promise<Job<DataType>> {
        return await this.queue.add(this.jobName, data, this.jobOptions);
    }
}
