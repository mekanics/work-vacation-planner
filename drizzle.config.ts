import type { Config } from 'drizzle-kit';

const dbPath = process.env.DATABASE_PATH ?? './dev.db';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbPath,
  },
} satisfies Config;
