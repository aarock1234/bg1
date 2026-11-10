import { z } from 'zod';

import { minimumRequestsPerSecond } from '../disney/pace';
import { parseProxies } from '../disney/proxies';

export const NodeEnv = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type NodeEnv = (typeof NodeEnv)[keyof typeof NodeEnv];

export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

const AES_256_KEY_BYTES = 32;

// An uncompressed P-256 point, and the private scalar that goes with it.
const VAPID_PUBLIC_KEY_BYTES = 65;
const VAPID_PRIVATE_KEY_BYTES = 32;

const FASTEST_POLL_INTERVAL_MS = 100;
const DEFAULT_POLL_INTERVAL_MS = 1000;

function base64UrlKey(byteLength: number) {
  return z.string().refine(
    value => {
      return Buffer.from(value, 'base64url').length === byteLength;
    },
    {
      error: `must be ${byteLength} bytes, base64url encoded`,
    }
  );
}

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform(value => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(Object.values(NodeEnv)).default(NodeEnv.DEVELOPMENT),
    LOG_LEVEL: z.enum(Object.values(LogLevel)).default(LogLevel.INFO),
    PORT: z.coerce.number().int().positive().default(8080),

    // The Postgres database that holds auto-book jobs.
    DATABASE_URL: z.url(),

    // The AES-256 key that encrypts guests' Disney logins at rest: 32 random
    // bytes, base64 encoded.
    LOGIN_ENCRYPTION_KEY: z
      .base64()
      .transform(value => Buffer.from(value, 'base64'))
      .refine(key => key.length === AES_256_KEY_BYTES, {
        error: `must be ${AES_256_KEY_BYTES} bytes, base64 encoded`,
      }),

    // The key pair that signs Web Push notifications, base64url encoded, and
    // the contact address push services are given: an https: or mailto: URL.
    VAPID_PUBLIC_KEY: base64UrlKey(VAPID_PUBLIC_KEY_BYTES),
    VAPID_PRIVATE_KEY: base64UrlKey(VAPID_PRIVATE_KEY_BYTES),
    VAPID_SUBJECT: z.url(),

    // How long a job waits between two checks for a Lightning Lane.
    AUTO_BOOK_POLL_INTERVAL_MS: z.coerce
      .number()
      .int()
      .min(FASTEST_POLL_INTERVAL_MS)
      .default(DEFAULT_POLL_INTERVAL_MS),

    // How many requests one job may send Disney per second before it stops
    // itself. Defaults to the lowest limit the poll interval can never reach.
    DISNEY_REQUESTS_PER_SECOND: z.coerce.number().int().positive().optional(),

    // Proxies for requests to Disney, as `host:port:username:password`, one
    // per line or separated by commas.
    DISNEY_PROXIES: z.string().default('').transform(parseProxies),

    // What a job does when a return time in range comes up: `notify` the
    // guest, who books it in the Disney app, or `book` it. Disney refuses
    // BG1's bookings for now, so jobs notify unless told otherwise.
    AUTO_BOOK_ACTION: z.enum(['notify', 'book']).default('notify'),

    // A bot-protection token captured from the official Disney app, sent in
    // place of the ones the BG1 backend hands out, which Disney refuses for
    // offers and bookings.
    DISNEY_SENSOR_DATA: z.string().min(1).optional(),

    // Whether jobs send their requests through one of DISNEY_PROXIES. Disney
    // accepts direct requests, so this is off unless set to `true`.
    DISNEY_USE_PROXIES: flag,
  })
  .superRefine((values, context) => {
    const requestsPerSecond = values.DISNEY_REQUESTS_PER_SECOND;
    const minimum = minimumRequestsPerSecond(values.AUTO_BOOK_POLL_INTERVAL_MS);

    if (requestsPerSecond !== undefined && requestsPerSecond < minimum) {
      context.addIssue({
        code: 'custom',
        path: ['DISNEY_REQUESTS_PER_SECOND'],
        message: `must be at least ${minimum} when AUTO_BOOK_POLL_INTERVAL_MS is ${values.AUTO_BOOK_POLL_INTERVAL_MS}`,
      });
    }

    if (values.DISNEY_USE_PROXIES && values.DISNEY_PROXIES.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['DISNEY_USE_PROXIES'],
        message: 'needs at least one proxy in DISNEY_PROXIES',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

// Parses the environment once at startup, so a missing or malformed variable
// stops the server with a readable report instead of failing later.
function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map(issue => {
    const path = issue.path.join('.');

    return ` - ${path}: ${issue.message}`;
  });

  throw new Error(['invalid environment variables:', ...issues].join('\n'));
}

export const env = parseEnv();
