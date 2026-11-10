import type { MiddlewareHandler } from 'hono';
import { createHash, timingSafeEqual } from 'node:crypto';

const BEARER_PREFIX = 'Bearer ';

// Hashing first gives both values the same length, which the constant-time
// comparison requires.
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function isSameSecret(presented: string, expected: string): boolean {
  return timingSafeEqual(digest(presented), digest(expected));
}

// Rejects any request that doesn't present the API secret as a bearer token.
export function requireSecret(secret: string): MiddlewareHandler {
  return async (context, next) => {
    const authorization = context.req.header('Authorization') ?? '';
    const presented = authorization.startsWith(BEARER_PREFIX)
      ? authorization.slice(BEARER_PREFIX.length)
      : '';

    if (!isSameSecret(presented, secret)) {
      return context.json(
        {
          error: 'unauthorized',
        },
        401
      );
    }

    await next();
  };
}
