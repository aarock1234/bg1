import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '../config/env';
import * as schema from './schema';

// The migrations drizzle-kit generates, relative to the directory the server
// is started from.
const MIGRATIONS_DIRECTORY = './server/db/migrations';

// An arbitrary number that identifies the migration lock in Postgres.
const MIGRATION_LOCK_ID = 2_071_001;

const client = postgres(env.DATABASE_URL, {
  // Postgres notices, such as "relation already exists, skipping", would
  // otherwise be printed to the console.
  onnotice: () => undefined,
});

export const db = drizzle(client, {
  schema,
});

// Applies the migrations that haven't run yet. A new deployment starts while
// the old one is still up and several instances may start together, so a lock
// lets only one of them migrate at a time.
export async function migrateDatabase(): Promise<void> {
  const connection = await client.reserve();

  try {
    await connection`select pg_advisory_lock(${MIGRATION_LOCK_ID})`;

    try {
      await migrate(db, {
        migrationsFolder: MIGRATIONS_DIRECTORY,
      });
    } finally {
      await connection`select pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
    }
  } finally {
    connection.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await client.end();
}
