import { serve } from '@hono/node-server';

import { env } from './config/env';
import { closeDatabase, migrateDatabase } from './db/client';
import { describeError } from './describe-error';
import { minimumRequestsPerSecond } from './disney/pace';
import { proxiedFetch } from './disney/proxies';
import { createApp } from './http/app';
import { startWorker } from './jobs/worker';
import { logger } from './log';

const SHUTDOWN_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

async function main(): Promise<void> {
  await migrateDatabase();
  logger.info('database migrations applied');

  const worker = startWorker({
    pollIntervalMs: env.AUTO_BOOK_POLL_INTERVAL_MS,
    requestsPerSecond:
      env.DISNEY_REQUESTS_PER_SECOND ??
      minimumRequestsPerSecond(env.AUTO_BOOK_POLL_INTERVAL_MS),
    proxyUrls: env.DISNEY_USE_PROXIES ? env.DISNEY_PROXIES : [],
  });

  // The app's own requests to Disney take the same route as jobs: through a
  // proxy when proxies are switched on, since Disney may refuse this server's
  // own address for some requests.
  const relayProxy = env.DISNEY_USE_PROXIES
    ? proxiedFetch(env.DISNEY_PROXIES)
    : undefined;

  let app: Awaited<ReturnType<typeof createApp>>;

  try {
    app = await createApp({
      proxyUrls: env.DISNEY_PROXIES,
      relayFetch: relayProxy?.fetch,
      worker,
      vapidPublicKey: env.VAPID_PUBLIC_KEY,
    });
  } catch (error) {
    // Without an app there is nothing to serve, so the jobs the worker has
    // already claimed go back for another instance.
    await worker.stop();
    throw error;
  }

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

  function closeServer(): void {
    server.close(error => {
      if (error) {
        logger.error(describeError(error), 'server did not close cleanly');
        process.exitCode = 1;
      }
    });
  }

  // Railway stops the old deployment with SIGTERM once the new one is up.
  // The worker hands its jobs back first, so the new deployment continues
  // them at once instead of waiting for their leases to run out.
  async function shutDown(signal: string): Promise<void> {
    logger.info(
      {
        signal,
      },
      'shutting down'
    );

    closeServer();

    try {
      await worker.stop();
      await relayProxy?.close();
      await closeDatabase();
    } catch (error) {
      logger.error(describeError(error), 'shutdown did not finish cleanly');
      process.exitCode = 1;
    }
  }

  // `shutDown` reports its own failure and never rejects.
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => void shutDown(signal));
  }
}

main().catch(async (error: unknown) => {
  logger.fatal(describeError(error), 'server failed to start');
  process.exitCode = 1;

  // An open database connection would keep the failed process alive.
  await closeDatabase().catch(() => undefined);
});
