import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, correlationId, providerId, ...metadata }) => {
  let msg = `${timestamp} [${level}]`;

  if (correlationId) {
    msg += ` [${correlationId}]`;
  }

  if (providerId) {
    msg += ` [${providerId}]`;
  }

  msg += `: ${message}`;

  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }

  return msg;
});

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] ?? 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        logFormat
      ),
    }),
  ],
  defaultMeta: { service: 'crawler-service' },
});

if (process.env['NODE_ENV'] === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
    })
  );
}

export function createChildLogger(providerId: string): winston.Logger {
  return logger.child({ providerId });
}
