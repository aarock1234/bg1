import { serve } from '@hono/node-server';

import { env } from './config/env';
import { createApp } from './http/app';
import { logger } from './log';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

async function main(): Promise<void> {
  const app = await createApp({
    proxyUrls: env.DISNEY_PROXIES,
  });

  const server = serve(
    {
      fetch: app.fetch,
      port: env.PORT,
    },
    ({ port }) => {
      logger.info(
        {
          port,
        },
        'server listening'
      );
    }
  );

  // Railway stops the old deployment with SIGTERM once the new one is up.
  function shutDown(signal: string): void {
    logger.info(
      {
        signal,
      },
      'shutting down'
    );

    server.close(error => {
      if (error) {
        logger.error(
          {
            err: error,
          },
          'server did not close cleanly'
        );
        process.exitCode = 1;
      }
    });
  }

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, shutDown);
  }
}

main().catch((error: unknown) => {
  logger.fatal(
    {
      err: error,
    },
    'server failed to start'
  );
  process.exitCode = 1;
});
