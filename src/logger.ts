import { createLogger, format, transports } from 'winston';

const LOG_LEVEL = process.env.LOG_LEVEL;

export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.timestamp(),
    format.colorize(),
    format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
  ),
  transports: [
    new transports.Console()
  ],
  exitOnError: false
});
