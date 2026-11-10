import { Hono } from 'hono';

import { ApiClient } from '@/api/client';
import { VQClient } from '@/api/vq';

import { logger } from '../log';

const RELAY_TIMEOUT_MS = 15_000;

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD']);

// The request headers Disney's services read. Everything else a browser adds,
// such as cookies and its own address, stays behind.
const FORWARDED_HEADERS = [
  'Authorization',
  'Accept-Language',
  'Content-Type',
  'x-user-id',
  'x-acf-sensor-data',
  'x-app-id',
  'x-vq-guest-app-version',
];

// The only hosts the relay will talk to: the Disney services BG1's clients
// use.
const ALLOWED_HOSTS = new Set(
  [...ApiClient.allOrigins, ...VQClient.allOrigins].map(origin => {
    return new URL(origin).host;
  })
);

function forwardedHeaders(incoming: Headers): Headers {
  const headers = new Headers();

  for (const name of FORWARDED_HEADERS) {
    const value = incoming.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  return headers;
}

// Passes requests from the app on BG1's own site on to Disney and returns
// Disney's answers. Browsers won't let that page call Disney directly.
export function createRelay(): Hono {
  const relay = new Hono();

  relay.all('/:host/*', async context => {
    const host = context.req.param('host');

    if (!ALLOWED_HOSTS.has(host)) {
      return context.json(
        {
          error: 'host not allowed',
        },
        403
      );
    }

    const { pathname, search } = new URL(context.req.url);
    const hostSegment = `/${host}/`;
    const path = pathname.slice(
      pathname.indexOf(hostSegment) + hostSegment.length - 1
    );
    const { method } = context.req;

    try {
      const response = await fetch(`https://${host}${path}${search}`, {
        method,
        headers: forwardedHeaders(context.req.raw.headers),
        body: METHODS_WITHOUT_BODY.has(method)
          ? undefined
          : await context.req.arrayBuffer(),
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') ?? 'text/plain',
        },
      });
    } catch (error) {
      logger.warn(
        {
          err: error,
          host,
        },
        'relayed request failed'
      );

      return context.json(
        {
          error: 'upstream request failed',
        },
        502
      );
    }
  });

  return relay;
}
