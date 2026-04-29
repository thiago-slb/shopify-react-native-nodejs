import type { AppConfig } from '../../config/env.js';

export function loggerOptions(config: Pick<AppConfig, 'LOG_LEVEL' | 'NODE_ENV'>) {
  return {
    level: config.LOG_LEVEL,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers["x-shopify-access-token"]'
      ],
      remove: true
    },
    transport:
      config.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname'
            }
          }
        : undefined
  };
}
