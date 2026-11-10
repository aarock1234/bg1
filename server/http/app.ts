import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

// The built app, relative to the directory the server is started from.
const APP_BUILD_DIRECTORY = './dist';

// The path the app is served under. It has to match `base` in vite.config.mts,
// which the built files use to find each other.
const APP_PATH = '/bg1';

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

export function createApp(): Hono {
  const app = new Hono();

  app.get('/health', context => {
    return context.json({
      status: 'ok',
    });
  });

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

  return app;
}
