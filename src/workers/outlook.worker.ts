import { Job } from 'bullmq';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { createHash } from 'node:crypto';
import { Readable } from 'stream';
import { bold, join } from 'telegraf/format';
import { redis, redisQueue } from '../lib/cache';
import { logger } from '../lib/logger';
import { getAccessToken, generateXOAuth2Token } from '../lib/outlook-auth';
import {
    TELEGRAM_CHAT_ID,
    TELEGRAM_THREAD_IDS,
    bot as telegramBot,
} from '../lib/telegraf';
import { LocalWorker } from '../lib/worker';
import { OUTLOOK_MESSAGE } from '../types/message';

const QUEUE_NAME = 'outlook';
const BODY_TRUNCATE_LENGTH = 3800;
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Environment variables
const OUTLOOK_EMAIL = process.env.OUTLOOK_EMAIL ?? '';
const OUTLOOK_FOLDER = process.env.OUTLOOK_FOLDER ?? 'INBOX';
const OUTLOOK_TELEGRAM_THREAD = process.env.OUTLOOK_TELEGRAM_THREAD ?? 'going';
const OUTLOOK_ALLOWED_SENDERS = process.env.OUTLOOK_ALLOWED_SENDERS
    ? process.env.OUTLOOK_ALLOWED_SENDERS.split(',').map((s) =>
          s.trim().toLowerCase(),
      )
    : [];

function truncateBody(body: string | undefined, maxLength: number): string {
    if (!body) return '';
    if (body.length <= maxLength) return body;
    return body.substring(0, maxLength) + '... [truncated]';
}

function isAllowedSender(fromEmail: string | undefined): boolean {
    if (OUTLOOK_ALLOWED_SENDERS.length === 0) return true;
    if (!fromEmail) return false;
    return OUTLOOK_ALLOWED_SENDERS.includes(fromEmail.toLowerCase());
}

function createImapConnection(xoauth2Token: string): Imap {
    return new Imap({
        user: OUTLOOK_EMAIL,
        password: '', // Not used with xoauth2, but required by type
        xoauth2: xoauth2Token,
        host: 'outlook.office365.com',
        port: 993,
        tls: true,
        tlsOptions: { servername: 'outlook.office365.com' },
    });
}

async function fetchUnreadEmails(): Promise<OUTLOOK_MESSAGE[]> {
    // Get OAuth2 access token
    const accessToken = await getAccessToken();
    const xoauth2Token = generateXOAuth2Token(OUTLOOK_EMAIL, accessToken);

    return new Promise((resolve, reject) => {
        const imap = createImapConnection(xoauth2Token);
        const emails: OUTLOOK_MESSAGE[] = [];
        const uidsToMarkRead: number[] = [];

        imap.once('ready', () => {
            imap.openBox(OUTLOOK_FOLDER, false, (err: Error | null) => {
                if (err) {
                    imap.end();
                    reject(err);
                    return;
                }

                imap.search(
                    ['UNSEEN'],
                    (searchErr: Error | null, uids: number[]) => {
                        if (searchErr) {
                            imap.end();
                            reject(searchErr);
                            return;
                        }

                        if (!uids || uids.length === 0) {
                            logger.info('No unread emails found');
                            imap.end();
                            resolve([]);
                            return;
                        }

                        logger.info(`Found ${uids.length} unread emails`);

                        const fetch = imap.fetch(uids, {
                            bodies: '',
                            markSeen: false,
                        });

                        fetch.on(
                            'message',
                            (msg: Imap.ImapMessage, _seqno: number) => {
                                let uid: number | undefined;

                                msg.on(
                                    'attributes',
                                    (attrs: Imap.ImapMessageAttributes) => {
                                        uid = attrs.uid;
                                    },
                                );

                                msg.on('body', (stream: Readable) => {
                                    simpleParser(stream, (parseErr, parsed) => {
                                        if (parseErr) {
                                            logger.error(
                                                `Failed to parse email: ${parseErr}`,
                                            );
                                            return;
                                        }

                                        const fromAddress =
                                            parsed.from?.value?.[0]?.address ||
                                            '';

                                        if (!isAllowedSender(fromAddress)) {
                                            logger.debug(
                                                `Skipping email from non-allowed sender: ${fromAddress}`,
                                            );
                                            return;
                                        }

                                        const email: OUTLOOK_MESSAGE = {
                                            uid,
                                            messageId:
                                                parsed.messageId ||
                                                `uid-${uid}`,
                                            subject:
                                                parsed.subject ||
                                                '(No Subject)',
                                            body: parsed.text || '',
                                            from: fromAddress,
                                            fromName:
                                                parsed.from?.value?.[0]?.name ||
                                                '',
                                            date: parsed.date?.toISOString(),
                                            category: OUTLOOK_TELEGRAM_THREAD,
                                        };

                                        emails.push(email);
                                        if (uid) {
                                            uidsToMarkRead.push(uid);
                                        }
                                    });
                                });
                            },
                        );

                        fetch.once('error', (fetchErr: Error) => {
                            logger.error(`Fetch error: ${fetchErr}`);
                            imap.end();
                            reject(fetchErr);
                        });

                        fetch.once('end', () => {
                            // Wait for parsing, then mark as read
                            setTimeout(() => {
                                if (uidsToMarkRead.length > 0) {
                                    imap.addFlags(
                                        uidsToMarkRead,
                                        ['\\Seen'],
                                        (flagErr: Error | null) => {
                                            if (flagErr) {
                                                logger.error(
                                                    `Failed to mark emails as read: ${flagErr}`,
                                                );
                                            } else {
                                                logger.info(
                                                    `Marked ${uidsToMarkRead.length} emails as read`,
                                                );
                                            }
                                            imap.end();
                                            resolve(emails);
                                        },
                                    );
                                } else {
                                    imap.end();
                                    resolve(emails);
                                }
                            }, 1000);
                        });
                    },
                );
            });
        });

        imap.once('error', (imapErr: Error) => {
            logger.error(imapErr);
            logger.error(`IMAP connection error: ${imapErr}`);
            reject(imapErr);
        });

        imap.connect();
    });
}

export const worker = new LocalWorker<OUTLOOK_MESSAGE>(
    QUEUE_NAME,
    { connection: redisQueue },
    async (job: Job<OUTLOOK_MESSAGE>): Promise<string> => {
        const emailData = job.data;

        // Mode 2: FORWARD mode - process individual email
        if (emailData.messageId && emailData.subject && emailData.category) {
            const message = [];

            // Subject (bold)
            message.push(bold(emailData.subject));
            message.push('\n\n');

            // From info
            if (emailData.fromName || emailData.from) {
                const fromDisplay = emailData.fromName
                    ? `${emailData.fromName} <${emailData.from}>`
                    : emailData.from;
                message.push(`From: ${fromDisplay}`);
                message.push('\n\n');
            }

            // Body (truncated)
            if (emailData.body) {
                message.push(
                    truncateBody(emailData.body, BODY_TRUNCATE_LENGTH),
                );
            }

            const telegramResponse = await telegramBot.telegram
                .sendMessage(TELEGRAM_CHAT_ID, join(message), {
                    reply_parameters: {
                        message_id: TELEGRAM_THREAD_IDS[emailData.category],
                    },
                })
                .catch(async (err: Error) => {
                    if (worker.rateLimiter) {
                        await worker.rateLimiter(err, job);
                    }
                });

            return `telegram:${telegramResponse?.message_id}`;
        } else {
            // Mode 1: FETCH mode - poll for unread emails
            logger.info(
                `Fetching Outlook emails from folder: ${OUTLOOK_FOLDER}`,
            );

            try {
                // Emails are marked as read during fetch
                const emails = await fetchUnreadEmails();

                for (const email of emails) {
                    const messageId = email.messageId || `uid-${email.uid}`;
                    const cacheKey = createHash('sha256')
                        .update(messageId)
                        .digest('hex');

                    // Check if already processed
                    const isCached = await redis.get(`outlook:${cacheKey}`);
                    if (isCached !== null) {
                        logger.debug(
                            `Skipping already processed email: ${email.subject}`,
                        );
                        continue;
                    }

                    // Add job and cache
                    await worker.addJob(email).then(async (createdJob: Job) => {
                        if (createdJob.id) {
                            // Cache to prevent re-processing
                            await redis.set(
                                `outlook:${cacheKey}`,
                                JSON.stringify({
                                    messageId: email.messageId,
                                    subject: email.subject,
                                }),
                                'EX',
                                CACHE_TTL_SECONDS,
                            );
                        }
                    });
                }
            } catch (err) {
                logger.error(`Failed to fetch Outlook emails: ${err}`);
                throw err;
            }

            return 'repeatableJob';
        }
    },
    [
        {
            data: {},
            name: 'outlook-poll',
            options: {
                repeat: {
                    pattern: '0 */1 * * * *',
                },
            },
        },
    ],
);
