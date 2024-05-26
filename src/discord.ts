import { Client, Message, TextChannel } from 'discord.js-selfbot-v13';
import { logger } from './logger';
import { isEmpty } from './utilities';
import { worker as discordWorker } from './workers/discord.worker';

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? '';

export const client = new Client();

client.on('ready', async () => {
    if (client?.user) {
        logger.info(`Discord bot (${client.user.username})`);
    }
});

client.on('messageCreate', async (message: Message) => {
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
