import { Hono } from 'hono';

import { ApiClient } from '@/api/client';
import { VQClient } from '@/api/vq';

import { describeError } from '../describe-error';
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

// Disney's answers are data for the app. These keep a browser from ever
// showing one as a page, where its scripts would run on the site that holds
// guests' logins.
const INERT_RESPONSE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "sandbox; default-src 'none'",
};

// Works out the Disney address a relayed request is for: everything after
// the host in the request's own address. Returns undefined unless the result
// is certain to be on that host, which a host written with escapes or a path
// that doesn't start where expected would put in doubt.
function upstreamUrl(requested: URL, host: string): URL | undefined {
  const hostSegment = `/${host}/`;
  const hostStart = requested.pathname.indexOf(hostSegment);

  if (hostStart === -1) {
    return undefined;
  }

  const path = requested.pathname.slice(hostStart + hostSegment.length - 1);
  const target = new URL(path + requested.search, `https://${host}`);

  if (target.protocol !== 'https:' || target.host !== host) {
    return undefined;
  }

  return target;
}

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

export type RelayOptions = {
  // Sends the relayed requests, such as through a proxy. Defaults to the
  // global fetch, which sends them straight from this server.
  fetch?: typeof fetch;
};

// Passes requests from the app on BG1's own site on to Disney and returns
// Disney's answers. Browsers won't let that page call Disney directly.
export function createRelay(options: RelayOptions = {}): Hono {
  const relay = new Hono();
  const send = options.fetch ?? fetch;

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

    const target = upstreamUrl(new URL(context.req.url), host);

    if (!target) {
      return context.json(
        {
          error: 'invalid path',
        },
        400
      );
    }

    const { method } = context.req;

    try {
      // A redirect is passed back as it is instead of being followed, which
      // could take the request to a host outside the list.
      const response = await send(target, {
        method,
        headers: forwardedHeaders(context.req.raw.headers),
        body: METHODS_WITHOUT_BODY.has(method)
          ? undefined
          : await context.req.arrayBuffer(),
        redirect: 'manual',
        signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
      });

      return new Response(response.body, {
        status: response.status,
        headers: {
          ...INERT_RESPONSE_HEADERS,
          'Content-Type': response.headers.get('Content-Type') ?? 'text/plain',
        },
      });
    } catch (error) {
      logger.warn(
        {
          ...describeError(error),
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
