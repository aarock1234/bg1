import pino from 'pino';

import { NodeEnv, env } from './config/env';

const prettyTransport = {
  target: 'pino-pretty',
  options: {
    translateTime: 'SYS:standard',
  },
};

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: env.NODE_ENV === NodeEnv.DEVELOPMENT ? prettyTransport : undefined,
});
