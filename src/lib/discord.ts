import {
    Client,
    Message,
    MessageAttachment,
    MessageEmbed,
    Role,
    TextChannel,
    User,
} from 'discord.js-selfbot-v13';
import { DISCORD_MESSAGE } from '../types/message';
import { logger } from './logger';
import { shutdownHandler } from './shutdown';
import { parseChatIds } from './utilities';
import { workers } from './workers';

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? '';
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID ?? '';

const DISCORD_CHANNEL_IDS = process.env.DISCORD_CHANNEL_IDS
    ? parseChatIds(process.env.DISCORD_CHANNEL_IDS)
    : {};

export const client = new Client();

client.on('ready', async () => {
    if (client?.user) {
        logger.info(`Discord bot (${client.user.username})`);
    }
});

client.on('messageCreate', async (message: Message) => {
    const channelName = (message.channel as TextChannel).name;
    const guildName = message?.guild?.name ?? 'none';
    const guildId = message.guildId ?? 'none';
    const author = message.author;
    const channelId = message.channelId;

    // Only filter messages if DISCORD_GUILD_ID set
    if (DISCORD_GUILD_ID.length > 0 && guildId !== DISCORD_GUILD_ID) {
        return;
    }

    if (
        Object.keys(DISCORD_CHANNEL_IDS).length > 0 &&
        !Object.prototype.hasOwnProperty.call(
            DISCORD_CHANNEL_IDS,
            channelName,
        ) &&
        !Object.values(DISCORD_CHANNEL_IDS).includes(parseInt(channelId))
    ) {
        return;
    }

    console.log(message);

    let content = message.content;

    if (content.length > 0) {
        if (message.mentions.users.size > 0) {
            message.mentions.users.forEach((user: User, key: string) => {
                content = content.replace(`<@${key}>`, `@${user.username}`);
            });
        }

        if (message.mentions.roles.size > 0) {
            message.mentions.roles.forEach((role: Role, key: string) => {
                content = content.replace(`<@&${key}>`, `@${role.name}`);
            });
        }
    }

    if (message.attachments.size > 0) {
        message.attachments.forEach((attachment: MessageAttachment) => {
            if (message.content.length > 0) {
                content = `${content}\n${attachment.url}`;
            } else {
                content = attachment.url;
            }
        });
    }

    if (message.embeds.length > 0) {
        message.embeds.forEach((embed: MessageEmbed) => {
            console.log(embed);
            if (message.content.length > 0) {
                if (author.displayName === 'Chipotle Codes') {
                    const title = embed.title;
                    const descriptipn = embed.description;

                    if (title) {
                        content = `${content}\n${embed.title ?? ''}`;
                    }

                    if (descriptipn) {
                        content = `${content}\n${embed.description ?? ''}`;
                    }
                } else {
                    content = `${content}\n${embed.url ?? ''}`;
                }
            } else {
                content = embed.url ?? '';
            }
        });
    }

    const jobData: DISCORD_MESSAGE = {
        author: author.displayName,
        guildName,
        guildId,
        channelName,
        channelId,
        content,
    };

    if (content.length > 0) {
        await workers.discord.addJob(jobData);
    }
});

shutdownHandler.addStopCallback();

process.on('SIGINT', () => {
    logger.info('Received SIGINT, stopping Discord Bot');
    client.destroy();
    shutdownHandler.gracefulShutdown('SIGINT');
});
process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, stopping Discord Bot');
    client.destroy();
    shutdownHandler.gracefulShutdown('SIGTERM');
});
