import { Client, Message, TextChannel } from 'discord.js-selfbot-v13';
import { logger } from './logger';
import { DEFAULT_JOB_OPTIONS, discordQueue } from './queues';
import { isEmpty } from './utilities';

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? '';
export interface DISCORD_MESSAGE {
  author: string,
  guildName: string,
  guildId: string,
  channelName: string,
  channelId: string,
  content: string
}

export const client = new Client();

client.on('ready', async () => {
  logger.info(`Discord bot (${client.user.username}) is ready!`);
})

client.on('messageCreate', async (message: Message) => {
  const channelName = (message.channel as TextChannel).name;

  // TODO: Filter out messages before adding to queue: by known guild/chatIds
  if (message.isMessage && isEmpty(message.content)) {
    return;
  }

  const {
    author,
    guild: {
      name: guildName
    },
    guildId,
    channelId,
    content
  } = message;

  const jobData = {
    author: author.displayName,
    guildName,
    guildId,
    channelName,
    channelId,
    content
  };
  
  await discordQueue.add('message', jobData, DEFAULT_JOB_OPTIONS);
});

// Enable graceful stop
process.once('SIGINT', () => client.destroy());
process.once('SIGTERM', () => client.destroy());
