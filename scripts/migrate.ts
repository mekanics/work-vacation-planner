/**
 * Run database migrations.
 * Used in Docker startup or manual setup.
 * Usage: npx tsx scripts/migrate.ts
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';

const dbPath = process.env.DATABASE_PATH ?? './dev.db';
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

console.log(`Running migrations on: ${absolutePath}`);

const client = createClient({ url: `file:${absolutePath}` });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle/migrations' });

console.log('Migrations complete ✓');
client.close();
