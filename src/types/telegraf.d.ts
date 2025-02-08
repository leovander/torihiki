import { Context } from 'telegraf';
import { Update } from 'telegraf/types';
import { Message } from 'typegram/message';

export type ChatMemberAction = 'add' | 'remove';

export type SessionData = {
    filters: string[];
    isSubscribed: boolean;
    joined: number;
    originalMessage?: Message.CommonMessage;
};

export interface BotContext<U extends Update = Update> extends Context<U> {
    session?: SessionData;
}

export interface ChatIds {
    [index: string]: number;
}
