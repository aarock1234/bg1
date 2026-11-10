import { defineConfig } from 'drizzle-kit';

// `drizzle-kit generate` compares the schema with the existing migrations and
// needs no database. The server applies the migrations itself when it starts.
export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
});
