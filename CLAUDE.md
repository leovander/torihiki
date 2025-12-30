# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Torihiki is a TypeScript-based Node.js bot that forwards messages between Discord and Telegram, with RSS feed monitoring for Slickdeals. It uses a queue-based architecture with BullMQ and Redis for reliable message delivery.

## Common Commands

```bash
# Install dependencies (requires pnpm 8.6.0+)
pnpm install

# Build TypeScript to ./dist
pnpm build

# Run compiled application
pnpm start

# Development mode - watch for changes
pnpm watch

# Linting and formatting
pnpm lint
pnpm prettier

# Run with pm2
pnpm serve
```

## Architecture

### Data Flow
```
Discord Messages → Discord Worker → BullMQ Queue → Telegraf Bot → Telegram Threads
RSS Feeds → Slickdeal Worker → BullMQ Queue → Telegraf Bot → Telegram Threads
```

### Core Components

- **src/index.ts** - Entry point; initializes Telegram bot, Redis, workers, and dynamic commands
- **src/lib/telegraf.ts** - Telegram bot using Telegraf framework; handles admin commands (`/admin queues`, `/admin filters`), session management, and message filtering
- **src/lib/discord.ts** - Discord self-bot client; listens for messages, filters by guild/channel, queues for forwarding (currently disabled)
- **src/lib/worker.ts** & **src/lib/workers.ts** - BullMQ workers for Discord and Slickdeal job processing with retry logic and rate limiting
- **src/lib/cache.ts** - Redis instances for queues (DB #1) and sessions/data (DB #0)
- **src/lib/server.ts** - Express server with Bull Board UI at `/queues`
- **src/lib/shutdown.ts** - Graceful shutdown coordination across all services
- **src/lib/logger.ts** - Winston-based logging

### Key Dependencies

- **Telegraf** - Telegram bot framework
- **discord.js-selfbot-v13** - Discord self-bot (note: against Discord TOS)
- **BullMQ** - Job queue system
- **ioredis** - Redis client
- **Express** - HTTP server for Bull Board UI

## Configuration

Environment variables are defined in `.env` (copy from `.env.example`). Key configurations:

- **Redis**: `REDIS_HOST`, `REDIS_PORT`, separate DBs for queues vs sessions
- **Telegram**: `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_THREAD_IDS` (format: `topic:threadid;`)
- **Discord**: `DISCORD_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_CHANNEL_IDS` (format: `name:id;`)
- **BullMQ**: Retry attempts, backoff strategy, rate limiting (`QUEUE_LIMIT_MAX`, `QUEUE_LIMIT_DURATION`)

## Code Style

- TypeScript with strict mode
- ESLint + Prettier (single quotes)
- 4-space indentation
- Pre-commit hooks run lint-staged via Husky
