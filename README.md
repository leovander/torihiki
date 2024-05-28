# Torihiki

Torihiki (とりひき), a Telegram and Discord-Self bot, that forwards Discord messages to Telegram.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [Features](#features)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Installation

To get started with the Torihiki, follow these steps:

1. Clone the repository:

   ```sh
   git clone https://github.com/leovander/torihiki.git
   cd torihiki
   ```

2. Install the necessary dependencies using `pnpm`:

   ```sh
   pnpm install
   ```

3. Set up your environment variables. Create a `.env` file in the root directory based on the `.env.example` file:

   ```sh
   cp .env.example .env
   ```

   Fill in the required values in the `.env` file:

   ```
   REDIS_PORT="host"
   DISCORD_TOKEN="personal-token"
   TELEGRAM_TOKEN="telegram-token-from-botfather"
   TELEGRAM_CHAT_ID="supergroup-id"
   TELEGRAM_THREAD_IDS="topicname:messagethreadid;topicname1:messagethreadid1;"
   TELEGRAM_ADMIN_IDS="userid:userid2:userid3"
   ```

   > See more details on how to get tokens and ids, and set other options: [Environment Variables](#environment-variables)

4. Build the bot:

   ```sh
   pnpm build

   # If working on the project, to watch for changes and run from ./dist
   pnpm watch
   ```

5. Start the bot:
   ```sh
   pnpm start
   ```

## Usage

Once the bot is running, admins can interact with it on Telegram using the following command:

- `/admin queues` - Get queue stats

## Environment Variables

### Logger

- `LOG_LEVEL (default: info)`: Available log levels from winstonjs (https://github.com/winstonjs/winston?tab=readme-ov-file#logging-levels)

### Redis

- `REDIS_HOST (default: 127.0.0.1)`: Hostname of redis instance
- `REDIS_PORT (default: 6379)`: redis instance listening port
- `REDIS_DEFAULT_DB (default: 0)`: Default redis database to use i.e. `d0`. (redis's default databdase is `d0` when not specified)
- `REDIS_QUEUE_DB (default: 1)`: redis database used by [BullMQ](https://docs.bullmq.io)
- `REDIS_TELEGRAM_SESSION_DB (default: 0)`: redis database used by [@telegraf/session](https://github.com/telegraf/session)

### Telegram

- `TELEGRAM_TOKEN`: Telegram Bot Token (https://core.telegram.org/bots/tutorial#obtain-your-bot-token)
- `TELEGRAM_CHAT_ID`: Telegram Group Id

  1. Once you launch your bot, temporarily add the following to the [src/lib/telegraf.ts]() and store the returned id here:

  ```js
  bot.on(message('text'), (ctx) => {
    console.log(`TELEGRAM_CHAT_ID: ${ctx.chat.id}`);
  });
  ```

- `TELEGRAM_THREAD_IDS`: Delimited Telegram Topic Names & Message Thread Ids e.g. `topic-name1:topic-message-thread-id1;topic-name2:topic-message-thread-id2;`

  1. Once you launch your bot, temporarily add the following to the [src/lib/telegraf.ts]() and store the topic name and returned id here:

  ```js
  bot.on(message('text'), (ctx) => {
    console.log(`TELEGRAM_MESSAGE_THREAD_ID: ${ctx.message.message_thread_id}`);
  });
  ```

- `TELEGRAM_ADMIN_IDS`: When `TELEGRAM_CHAT_ID` is set on launch, you can get the list of admin user ids e.g. `user-id1:user-id2` via redis:

  ```bash
  get 'telegram:details:admins'
  ```

### Discord

> :warning: Disclaimer: It is against [Discord's TOS](https://discord.com/terms) to use the [discord.js-selfbot](https://github.com/aiko-chan-ai/discord.js-selfbot-v13) package this project depends on. Use this at your own risk.

- `DISCORD_TOKEN`: Your Discord User Token (https://discordjs-self-v13.netlify.app/#/docs/docs/main/general/welcome)

### BullMQ

#### Jobs

Read more about BullMQ's; [Auto-removal of jobs](https://docs.bullmq.io/guide/queues/auto-removal-of-jobs) and [Retrying failing jobs](https://docs.bullmq.io/guide/retrying-failing-jobs).

- `REMOVE_ON_COMPLETE_AGE (default: 3600)`: Maximum age in seconds for job to be kept.
- `REMOVE_ON_COMPLETE_COUNT (default: 1000)`: Maximum count of jobs to be kept.
- `REMOVE_ON_FAIL_COUNT (default: 5000)`: Specifies the maximum amount of jobs to keep
- `ATTEMPTS (default: 3)`: The total number of attempts to try the job until it completes.
- `BACKOFF_TYPE (default: exponential)`: Name of the backoff strategy.
- `BACKOFF_DELAY (default: 1000)`: Delay in milliseconds.

#### Workers

Read more about [BullMQ's Rate Limiting](https://docs.bullmq.io/guide/rate-limiting) strategies.

- `QUEUE_LIMIT_MAX (default: 10)`: Max number of jobs to process in the time period specified in `duration`.
- `QUEUE_LIMIT_DURATION (default: 60000)`: Time in milliseconds. During this time, a maximum of `max` jobs will be processed.

## Features

- [Telegraf Sessions](https://github.com/telegraf/session) to keep persistent context of user messsages
- [BullMQ](https://docs.bullmq.io/) to manage queue of messages to avoid Telegram Bot [Rate Limits](https://core.telegram.org/bots/faq#my-bot-is-hitting-limits-how-do-i-avoid-this)
- [redis](https://redis.io) with persistence enabled to; power queues, store sessions and light app details

## Contributing

Contributions are welcome! Here's how you can contribute to this project:

1. Fork the repository.
2. Create a new branch:
   ```sh
   git checkout -b feature/your-feature-name
   ```
3. Make your changes and commit them:
   ```sh
   git commit -m 'Add some feature'
   ```
4. Push to the branch:
   ```sh
   git push origin feature/your-feature-name
   ```
5. Create a new Pull Request.

## License

This project is licensed under [AGPL-3.0-only](LICENSE).

## Contact

If you have any questions or suggestions, feel free to open an issue.
