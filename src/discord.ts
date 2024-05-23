import { Client, Message, TextChannel } from 'discord.js-selfbot-v13';
import { logger } from './logger';
import { worker as discordWorker } from './workers/discord.worker';
import { isEmpty } from './utilities';

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? '';

export const client = new Client();

client.on('ready', async () => {
    if (client?.user) {
        logger.info(`Discord bot (${client.user.username}) is ready!`);
    }
});

client.on('messageCreate', async (message: Message) => {
    // TODO: Filter out messages before adding to queue: by known guild/chatIds
    if (message.isMessage && isEmpty(message.content)) {
        return;
    }

    const channelName = (message.channel as TextChannel).name;
    const guildName = message?.guild?.name ?? 'none';
    const guildId = message.guildId ?? 'none';

    const { author, channelId, content } = message;

    const jobData = {
        author: author.displayName,
        guildName,
        guildId,
        channelName,
        channelId,
        content,
    };

    await discordWorker.addJob(jobData);
});

// Enable graceful stop
process.once('SIGINT', () => client.destroy());
process.once('SIGTERM', () => client.destroy());
