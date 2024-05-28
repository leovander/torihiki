import { Redis } from '@telegraf/session/redis';
import {
    Markup,
    Telegraf,
    TelegramError,
    session,
    type Context,
} from 'telegraf';
import { message } from 'telegraf/filters';
import { FmtString, bold, italic, join, mention } from 'telegraf/format';
import type {
    ChatMemberAdministrator,
    ChatMemberOwner,
    Update,
    User,
} from 'telegraf/types';
import { Message } from 'typegram';
import { REDIS_CONNECTION, redis } from './cache';
import { logger } from './logger';
import { parseTelegramAdminIds, parseTelegramThreadIds } from './utilities';
import { LocalWorker, LocalWorkerDataTypes } from './worker';
import { Workers, workers } from './workers';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const REDIS_TELEGRAM_SESSION_DB = process.env.REDIS_TELEGRAM_SESSION_DB
    ? parseInt(process.env.REDIS_TELEGRAM_SESSION_DB)
    : 0;
export const TELEGRAM_THREAD_IDS = process.env.TELEGRAM_THREAD_IDS
    ? parseTelegramThreadIds(process.env.TELEGRAM_THREAD_IDS)
    : {};
export const TELEGRAM_ADMIN_IDS = process.env.TELEGRAM_ADMIN_IDS
    ? parseTelegramAdminIds(process.env.TELEGRAM_ADMIN_IDS)
    : [];
const TELEGRAM_NAMESPACE = 'telegram:details';

export type SessionData = {
    filters: string[];
    isSubscribed: boolean;
    joined: number;
    originalMessage?: Message.CommonMessage;
};

interface BotContext<U extends Update = Update> extends Context<U> {
    session?: SessionData;
}

const redisStore = Redis<SessionData>({
    url: REDIS_CONNECTION,
    config: {
        database: REDIS_TELEGRAM_SESSION_DB,
    },
});

export const bot = new Telegraf<BotContext>(TELEGRAM_TOKEN);

bot.use(
    session({
        store: redisStore,
        defaultSession: () => ({
            filters: [],
            isSubscribed: false,
            joined: Date.now(),
            originalMessage: undefined,
        }),
    }),
);

bot.use(async (ctx, next) => {
    if (ctx.chat) {
        let validMessage = false;

        switch (ctx.chat.type) {
            case 'private':
                validMessage = TELEGRAM_ADMIN_IDS.includes(ctx.chat.id);
                break;
            case 'supergroup':
                validMessage = ctx.chat.id === parseInt(TELEGRAM_CHAT_ID);
                break;
            default:
                validMessage = false;
        }

        if (validMessage) {
            const start = performance.now();
            updateChatMemberList(ctx.message?.from);
            await next();
            const end = performance.now();
            logger.info(
                `Processing update ${ctx.update.update_id}: ${(end - start).toPrecision(3)}ms`,
            );
        }
    } else {
        logger.warn('Filtered message');
    }
});

type ChatMemberAction = 'add' | 'remove';

async function updateChatMemberList(
    user: User | undefined,
    action: ChatMemberAction = 'add',
) {
    if (user) {
        const cachedMembers = await redis.get(`${TELEGRAM_NAMESPACE}:members`);
        const members: Record<string, User> = JSON.parse(cachedMembers ?? '{}');

        if (action === 'add') {
            if (!Object.prototype.hasOwnProperty.call(members, user.id)) {
                members[user.id] = user;
            }
        } else {
            if (Object.prototype.hasOwnProperty.call(members, user.id)) {
                delete members[user.id];
            }
        }

        await redis.set(
            `${TELEGRAM_NAMESPACE}:members`,
            JSON.stringify(members),
        );
    }
}

export const setTelegramDetails = async (): Promise<void> => {
    const chatAdmins =
        await bot.telegram.getChatAdministrators(TELEGRAM_CHAT_ID);
    const admins: Record<number, User> = {};
    chatAdmins.forEach((admin: ChatMemberOwner | ChatMemberAdministrator) => {
        admins[admin.user.id] = admin.user;
    });

    await redis.set(`${TELEGRAM_NAMESPACE}:admins`, JSON.stringify(admins));
};

export const generateDynamicActions = (workers: Workers) => {
    if (!workers || typeof workers !== 'object') {
        console.error('Invalid workers object');
        return;
    }

    Object.values(workers).forEach((worker) => {
        const tmpWorker = worker as LocalWorker<LocalWorkerDataTypes>;

        bot.action(`btn_${tmpWorker.queueName}`, async (ctx) => {
            if (!isAdmin(ctx.from.id)) {
                return;
            }

            const stats = await tmpWorker.getCounts();
            const buf: FmtString[] = [];
            Object.entries(stats).forEach(([key, value]) => {
                buf.push(join([bold(key), `: ${value}\n`]));
            });

            await ctx.editMessageText(
                join([
                    `Queue: ${tmpWorker.queueName}\nStatus: ${tmpWorker.worker.isRunning() ? 'Running' : 'Paused'}\n\n`,
                    ...buf,
                ]),
                Markup.inlineKeyboard([Markup.button.callback('Back', 'back')]),
            );
        });
    });

    bot.action('back', async (ctx) => {
        if (!isAdmin(ctx.from.id)) {
            return;
        }

        const originalKeyboard = Markup.inlineKeyboard(
            Object.keys(workers).map((key) =>
                Markup.button.callback(key, `btn_${key}`),
            ),
        );
        await ctx.editMessageText(
            'Select an available Queue',
            originalKeyboard,
        );
    });
};

function isAdmin(userId: number): boolean {
    return TELEGRAM_ADMIN_IDS.includes(userId);
}

bot.hears(/^\/admin (\w+)\s*(.*)$/, async (ctx) => {
    if (!isAdmin(ctx.from.id)) {
        return;
    }

    // subCommand options available as next array value
    const [, subCommand] = ctx.match;

    switch (subCommand) {
        case 'queues':
            if (ctx.session) {
                if (workers && typeof workers === 'object') {
                    const queuesKeyboard = Markup.inlineKeyboard(
                        Object.keys(workers).map((key) =>
                            Markup.button.callback(key, `btn_${key}`),
                        ),
                    );

                    ctx.session.originalMessage = await ctx.reply(
                        'Select an available Queue',
                        queuesKeyboard,
                    );
                } else {
                    ctx.reply('No queues configured');
                }
            }
            break;
        default:
            ctx.reply('Invalid /admin command.');
    }
});

bot.on(message('new_chat_members'), async (ctx) => {
    const messageBuilder = [];

    ctx.update.message.new_chat_members.forEach((new_chat_member: User) => {
        messageBuilder.push(
            mention(new_chat_member.first_name, new_chat_member),
        );
        messageBuilder.push(', ');
        updateChatMemberList(new_chat_member);
    });

    messageBuilder.push('welcome to the club!');
    await ctx.reply(join(messageBuilder), {
        reply_parameters: {
            message_id: ctx.update.message.message_id,
        },
    });
});

bot.on(message('left_chat_member'), async (ctx) => {
    await updateChatMemberList(ctx.message.from);

    await ctx.reply(italic('Psssh… Nothin Personnel… Kid…'), {
        reply_parameters: {
            message_id: ctx.update.message.message_id,
        },
    });
});

// Attempt to catch all middleware errors to prevent app exit
bot.catch((err, ctx) => {
    const error = err as TelegramError;
    logger.error(`Telegram Bot Error: ${error}`);
    // sendAdminError('Telegram Bot Error', error.message);
});
