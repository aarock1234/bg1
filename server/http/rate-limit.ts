import type { Context, MiddlewareHandler } from 'hono';

// How many visitors to track before forgetting the ones whose window is over.
const MAX_TRACKED_VISITORS = 10_000;

export type RateLimitOptions = {
  // How many requests one visitor may make per window.
  limit: number;
  windowMs: number;
};

type RequestWindow = {
  startedAt: number;
  count: number;
};

// Railway's proxy puts the visitor's address first in X-Forwarded-For.
function visitorAddress(context: Context): string {
  const forwardedFor = context.req.header('X-Forwarded-For') ?? '';
  const [address = ''] = forwardedFor.split(',');

  return address.trim() || 'unknown';
}

// Limits how often one visitor may call the routes it guards. The API is open
// to anyone, so this keeps a single visitor from flooding it.
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { limit, windowMs } = options;
  const windows = new Map<string, RequestWindow>();

  function forgetFinishedWindows(now: number): void {
    for (const [address, window] of windows) {
      if (now - window.startedAt >= windowMs) {
        windows.delete(address);
      }
    }
  }

  return async (context, next) => {
    const now = Date.now();
    const address = visitorAddress(context);
    let window = windows.get(address);

    if (!window || now - window.startedAt >= windowMs) {
      if (windows.size >= MAX_TRACKED_VISITORS) {
        forgetFinishedWindows(now);
      }

      window = {
        startedAt: now,
        count: 0,
      };
      windows.set(address, window);
    }

    window.count += 1;

    if (window.count > limit) {
      return context.json(
        {
          error: 'too many requests',
          code: 'rate_limited',
        },
        429
      );
    }

    await next();
  };
}
