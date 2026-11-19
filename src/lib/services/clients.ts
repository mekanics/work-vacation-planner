import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';

export interface ClientRecord {
  id: string;
  name: string;
  colour: string;
  defaultWeekdays: number[];
  archived: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

function parseWeekdays(raw: string): number[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as number[] : [];
  } catch {
    return [];
  }
}

function rowToRecord(row: typeof clients.$inferSelect): ClientRecord {
  return { ...row, defaultWeekdays: parseWeekdays(row.defaultWeekdays) };
}

export async function getClients(): Promise<ClientRecord[]> {
  const rows = await db.select().from(clients).orderBy(asc(clients.name));
  return rows.map(rowToRecord);
}

export async function getClient(id: string): Promise<ClientRecord | null> {
  const rows = await db.select().from(clients).where(eq(clients.id, id));
  return rows[0] ? rowToRecord(rows[0]) : null;
}
