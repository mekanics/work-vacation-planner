import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import path from 'path';

const dbPath = process.env.DATABASE_PATH ?? './dev.db';
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

const client = createClient({ url: `file:${absolutePath}` });

export const db = drizzle(client, { schema });
export type DB = typeof db;
