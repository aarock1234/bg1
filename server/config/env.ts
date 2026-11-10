import { z } from 'zod';

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

const envSchema = z.object({
  NODE_ENV: z.enum(Object.values(NodeEnv)).default(NodeEnv.DEVELOPMENT),
  LOG_LEVEL: z.enum(Object.values(LogLevel)).default(LogLevel.INFO),
  PORT: z.coerce.number().int().positive().default(8080),
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
