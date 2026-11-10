import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFile } from 'node:fs/promises';

import { ApiClient } from '@/api/client';
import { fetchTokenFromService } from '@/api/sensor-data';
import { HOSTS } from '@/config';
import { WEB_ROUTE_PATHS } from '@/web-route';

import { createJobRoutes } from '../jobs/routes';
import type { Worker } from '../jobs/worker';
import { logger } from '../log';
import { probe, probeRequestSchema } from '../probe/probe';
import { rateLimit } from './rate-limit';
import { createRelay } from './relay';
import { SHORT_LINKS } from './short-links';

// The built app, relative to the directory the server is started from.
const APP_BUILD_DIRECTORY = './dist';

// BG1's own pages: the landing page and the page the app runs in.
const SITE_DIRECTORY = './site';
const APP_SHELL_FILE = `${SITE_DIRECTORY}/app.html`;

// The path the app's files are served under. It has to match `base` in
// vite.config.mts, which the built files use to find each other.
const APP_PATH = '/bg1';

const ONE_MINUTE_MS = 60_000;

// How often one visitor may run the probe, which makes several requests to
// Disney each time.
const PROBE_RATE_LIMIT = {
  limit: 10,
  windowMs: ONE_MINUTE_MS,
};

// How often one visitor's app may call Disney through the server. Using the
// app makes a few requests per screen, and auto booking about one a second.
const RELAY_RATE_LIMIT = {
  limit: 600,
  windowMs: ONE_MINUTE_MS,
};

// How often one visitor may ask for the key push subscriptions are made with.
const PUSH_KEY_RATE_LIMIT = {
  limit: 60,
  windowMs: ONE_MINUTE_MS,
};

type AppOptions = {
  proxyUrls: string[];

  // Runs the auto-book jobs the API creates.
  worker: Pick<Worker, 'wake' | 'cancel'>;

  // The key browsers subscribe to this server's push notifications with.
  vapidPublicKey: string;
};

export type PushPublicKeyResponse = {
  publicKey: string;
};

// The autoloader fetches the app from Disney's pages as a module script, which
// browsers only run when the response allows other origins.
function allowAnyOrigin(headers: Headers): void {
  headers.set('Access-Control-Allow-Origin', '*');
}

// The built files keep the same names across deploys, so browsers must check
// for a newer version on every load.
function revalidateOnEveryLoad(headers: Headers): void {
  headers.set('Cache-Control', 'no-cache');
}

// Returns undefined for a body that isn't JSON, which then fails validation
// like any other malformed request.
async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    return undefined;
  }
}

// The API is open: callers act with their own Disney login, and each visitor
// is rate limited.
function createApi(options: AppOptions): Hono {
  const api = new Hono();

  // Browsers may call the API from BG1's site and from the Disney pages the
  // app runs on when the userscript loads it.
  api.use(
    cors({
      origin: [HOSTS.HOME, ...ApiClient.allOrigins],
    })
  );

  api.use('/relay/*', rateLimit(RELAY_RATE_LIMIT));
  api.route('/relay', createRelay());

  api.post('/sensor-data', rateLimit(RELAY_RATE_LIMIT), async context => {
    return context.text(await fetchTokenFromService());
  });

  api.post('/probe', rateLimit(PROBE_RATE_LIMIT), async context => {
    const request = probeRequestSchema.safeParse(await readJson(context));

    if (!request.success) {
      return context.json(
        {
          error: 'invalid request',
          issues: request.error.issues.map(issue => issue.message),
        },
        400
      );
    }

    const report = await probe(request.data, {
      proxyUrls: options.proxyUrls,
    });

    logger.info(
      {
        report,
      },
      'probe finished'
    );

    return context.json(report);
  });

  api.route('/jobs', createJobRoutes(options.worker));

  api.get('/push/public-key', rateLimit(PUSH_KEY_RATE_LIMIT), context => {
    const response: PushPublicKeyResponse = {
      publicKey: options.vapidPublicKey,
    };

    return context.json(response);
  });

  return api;
}

export async function createApp(options: AppOptions): Promise<Hono> {
  const app = new Hono();
  const appShell = await readFile(APP_SHELL_FILE, 'utf8');

  app.get('/health', context => {
    return context.json({
      status: 'ok',
    });
  });

  app.route('/api', createApi(options));

  app.use(
    `${APP_PATH}/*`,
    serveStatic({
      root: APP_BUILD_DIRECTORY,
      rewriteRequestPath: path => path.slice(APP_PATH.length),
      onFound: (_path, context) => {
        allowAnyOrigin(context.res.headers);
        revalidateOnEveryLoad(context.res.headers);
      },
    })
  );

  // Each of these pages runs the app. The app reads the page's address to
  // tell which resort and which service to show.
  for (const path of WEB_ROUTE_PATHS) {
    app.get(path, context => {
      revalidateOnEveryLoad(context.res.headers);

      return context.html(appShell);
    });
  }

  for (const [path, destination] of Object.entries(SHORT_LINKS)) {
    app.get(path, context => context.redirect(destination));
  }

  app.use(
    '/*',
    serveStatic({
      root: SITE_DIRECTORY,
      onFound: (_path, context) => {
        revalidateOnEveryLoad(context.res.headers);
      },
    })
  );

  app.onError((error, context) => {
    logger.error(
      {
        err: error,
        path: context.req.path,
      },
      'request failed'
    );

    return context.json(
      {
        error: 'internal error',
      },
      500
    );
  });

  return app;
}
