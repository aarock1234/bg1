import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';

import { ApiClient } from '@/api/client';

import { logger } from '../log';
import { probe, probeRequestSchema } from '../probe/probe';
import { requireSecret } from './require-secret';

// The built app, relative to the directory the server is started from.
const APP_BUILD_DIRECTORY = './dist';

// The path the app is served under. It has to match `base` in vite.config.mts,
// which the built files use to find each other.
const APP_PATH = '/bg1';

type AppOptions = {
  apiSecret: string;
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

function createApi(options: AppOptions): Hono {
  const api = new Hono();

  // The app calls the API from the Disney pages it runs on.
  api.use(
    cors({
      origin: ApiClient.allOrigins,
    })
  );
  api.use(requireSecret(options.apiSecret));

  api.post('/probe', async context => {
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

    const report = await probe(request.data);

    logger.info(
      {
        report,
      },
      'probe finished'
    );

    return context.json(report);
  });

  return api;
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono();

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
