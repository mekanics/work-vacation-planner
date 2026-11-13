/**
 * Run database migrations.
 * Used in Docker startup or manual setup.
 * Usage: node --experimental-strip-types scripts/migrate.ts
 */
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'path';
import { runClientDataMigration } from '../src/lib/db/client-migration.ts';

const dbPath = process.env.DATABASE_PATH ?? './dev.db';
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

console.log(`Running migrations on: ${absolutePath}`);

const client = createClient({ url: `file:${absolutePath}` });
const db = drizzle(client);

await migrate(db, { migrationsFolder: './drizzle/migrations' });
const clientMigration = await runClientDataMigration(client);
console.log(`Client data migration: ${JSON.stringify(clientMigration)}`);

console.log('Migrations complete ✓');
client.close();
