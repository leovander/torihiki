import {
    Job,
    JobsOptions,
    MetricsTime,
    Queue,
    QueueOptions,
    Worker,
} from 'bullmq';
import { logger } from './logger';
import { TelegramError } from 'telegraf';

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
    : 60000;
const BACKOFF_TYPE = process.env.BACKOFF_TYPE
    ? process.env.BACKOFF_TYPE
    : 'exponential';

export interface TelegramThreadIds {
    [index: string]: number;
}

export interface RepeatableJob<DataType> {
    name: string;
    data: DataType;
    options: JobsOptions;
}

export class LocalWorker<DataType> {
    queueName: string;
    jobName: string;
    queueOptions: QueueOptions;
    jobOptions: JobsOptions;
    queue: Queue;
    worker: Worker;
    repeatableJobs: Job<DataType>[];
    process: (job: Job<DataType>) => Promise<string>;
    rateLimiter: (error: Error, job: Job<DataType>) => Promise<void>;

    constructor(
        queueName: string,
        queueOptions: QueueOptions,
        process: (job: Job<DataType>) => Promise<string>,
        repeatableJobs?: RepeatableJob<DataType>[],
        rateLimiter?: (error: Error, job: Job<DataType>) => Promise<void>,
        jobOptions?: JobsOptions,
    ) {
        this.queueName = queueName;

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
                    type: BACKOFF_TYPE,
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

        this.repeatableJobs = [];

        if (repeatableJobs) {
            this.setRepeatableJobs(repeatableJobs);
        }

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

        if (rateLimiter) {
            this.rateLimiter = rateLimiter;
        } else {
            this.rateLimiter = async (
                error: Error,
                job: Job<DataType>,
            ): Promise<void> => {
                const tError = error as TelegramError;
                if (tError.code === 429) {
                    const regex = new RegExp(/retry after (\d*)$/);
                    const match = error.message.match(regex);

                    if (match) {
                        const duration = parseInt(match[1]);
                        logger.error(
                            `Rate Limited for ${duration} while processing message - ${job.queueName}:${job.name}:${job.id}`,
                        );

                        await this.worker.rateLimit(duration);

                        throw Worker.RateLimitError();
                    }
                } else {
                    throw error;
                }
            };
        }

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
                }
            },
        );

        this.worker.on(
            'completed',
            (job: Job<DataType>, returnvalue: string) => {
                logger.info(
                    `Message Completed - ${job.queueName}:${job.id}:${returnvalue}`,
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

    async setRepeatableJobs(
        repeatableJobs: RepeatableJob<DataType>[],
    ): Promise<void> {
        for await (const repeatableJob of repeatableJobs) {
            await this.queue.removeRepeatable(
                `${repeatableJob.name}-repeat`,
                repeatableJob.options,
            );

            const job = await this.queue.add(
                `${repeatableJob.name}-repeat`,
                repeatableJob.data,
                repeatableJob.options,
            );
            this.repeatableJobs.push(job);
        }
    }
}
