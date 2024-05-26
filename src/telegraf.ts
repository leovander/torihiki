import { Redis } from '@telegraf/session/redis';
import { Telegraf, session, type Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { bold, italic, join, mention } from 'telegraf/format';
import type { Update, User } from 'telegraf/types';
import { audioFiles } from './audio';
import { REDIS_CONNECTION } from './cache';
import { logger } from './logger';
import { parseTelegramThreadIds } from './utilities';

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
export const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT || '';
const TELEGRAM_CHAT_TYPE = process.env.TELEGRAM_CHAT_TYPE;
const TELEGRAM_SESSION_DB = process.env.TELEGRAM_SESSION_DB
    ? parseInt(process.env.TELEGRAM_SESSION_DB)
    : 0;
export const TELEGRAM_THREAD_IDS = process.env.TELEGRAM_THREAD_IDS
    ? parseTelegramThreadIds(process.env.TELEGRAM_THREAD_IDS)
    : {};

export type SessionData = {
    filters: string[];
    isSubscribed: boolean;
    joined: number;
};

interface BotContext<U extends Update = Update> extends Context<U> {
    session?: SessionData;
}

const redisStore = Redis<SessionData>({
    url: REDIS_CONNECTION,
    config: {
        database: TELEGRAM_SESSION_DB,
    },
});

export const bot = new Telegraf<BotContext>(TELEGRAM_TOKEN);

// Set top level filter in middleware
bot.use(
    session({
        store: redisStore,
        defaultSession: () => ({
            filters: [],
            isSubscribed: false,
            joined: Date.now(),
        }),
    }),
);

bot.use(async (ctx, next) => {
    const start = performance.now();

    if (
        ctx.chat &&
        ctx.chat.type === TELEGRAM_CHAT_TYPE &&
        ctx.chat.id === parseInt(TELEGRAM_CHAT)
    ) {
        await next();
    }

    const end = performance.now();
    logger.info(
        `Processing update ${ctx.update.update_id}: ${(end - start).toPrecision(3)}ms`,
    );
});

// bot.on(message('text'), (ctx) => {
//     console.log(ctx.message);
// });

bot.on(message('new_chat_members'), async (ctx) => {
    let messageBuilder = [];

    ctx.update.message.new_chat_members.forEach((new_chat_member: User) => {
        messageBuilder.push(
            mention(new_chat_member.first_name, new_chat_member),
        );
        messageBuilder.push(', ');
    });

    messageBuilder.push("come on down!\nYou're the next contestant on, ");
    messageBuilder.push(bold(italic('The Price is Right!')));

    await ctx.replyWithVoice(
        {
            source: audioFiles.categories['salutations']['discord_join']
                .fullPath,
        },
        {
            caption: join(messageBuilder),
            reply_parameters: {
                message_id: ctx.update.message.message_id,
            },
        },
    );
});

/*
bot.on(message('left_chat_member'), async (ctx) => {
  await ctx.replyWithVoice({ source: audioFiles.categories['salutations']['discord_leave'].fullPath }, {
    caption: italic('Psssh… Nothin Personnel… Kid…'),
    reply_parameters: {
      message_id: ctx.update.message.message_id
    }
  });
});
 */
// Attempt to catch all middleware errors to prevent app exit
bot.catch((err, ctx) => {
    logger.error(`Error in Telegram Bot: ${err}`);
});
