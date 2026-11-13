import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { describe, expect, it } from 'vitest';
import {
  INTERNAL_CLIENT_ID,
  LEGACY_CLIENT_SLOTS,
  runClientDataMigration,
} from '@/lib/db/client-migration';

const tempDir = mkdtempSync(join(tmpdir(), 'planner-client-migration-'));
const [acmeClient, contosoClient] = LEGACY_CLIENT_SLOTS;

async function applySqlFile(client: ReturnType<typeof createClient>, filename: string): Promise<void> {
  const sql = readFileSync(join(process.cwd(), 'drizzle/migrations', filename), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
  await client.batch(statements.map((sql) => ({ sql, args: [] })));
}

describe('Client additive data migration', () => {
  it('maps legacy project names without changing IDs or day records and is idempotent', async () => {
    const client = createClient({ url: `file:${join(tempDir, 'legacy.db')}` });
    try {
      for (const filename of [
        '0000_aspiring_gravity.sql',
        '0001_add_projects.sql',
        '0002_add_project_day_overrides.sql',
        '0003_merge_day_off.sql',
        '0004_canton_composite_pk.sql',
      ]) {
        await applySqlFile(client, filename);
      }

      const legacyProjects = [
        ['project-alpha', 'acme - Alpha'],
        ['project-beta', 'acme - Beta'],
        ['project-contoso', 'contoso'],
        ['project-contoso-q2', 'contoso - Q2'],
        ['project-internal', 'Admin'],
      ];
      await client.batch(legacyProjects.map(([id, name]) => ({
        sql: `INSERT INTO projects
          (id, name, colour, start_date, end_date, weekdays, created_at, updated_at)
          VALUES (?, ?, '#112233', NULL, NULL, '[1,2,3,4,5]', '2024-01-01', '2024-01-01')`,
        args: [id, name],
      })));
      await client.batch([
        { sql: `INSERT INTO days VALUES ('2024-01-08', 'vacation', NULL, '2024-01-01', '2024-01-01')`, args: [] },
        { sql: `INSERT INTO days VALUES ('2024-01-09', 'vacation', NULL, '2024-01-01', '2024-01-01')`, args: [] },
        { sql: `INSERT INTO days VALUES ('2024-01-10', 'working_weekend', NULL, '2024-01-01', '2024-01-01')`, args: [] },
        { sql: `INSERT INTO project_day_overrides VALUES ('project-alpha', '2024-01-08', 'include')`, args: [] },
        { sql: `INSERT INTO project_day_overrides VALUES ('project-contoso', '2024-01-09', 'exclude')`, args: [] },
      ]);

      await applySqlFile(client, '0005_add_clients.sql');
      const result = await runClientDataMigration(client);

      expect(result.before).toEqual({ projects: 5, days: 3, projectDayOverrides: 2 });
      expect(result.after).toEqual(result.before);
      expect(result.clientsCreated).toBe(2);
      expect(result.projectsMapped).toBe(4);

      const projects = await client.execute(
        'SELECT id, name, client_id, end_client, colour FROM projects ORDER BY id',
      );
      expect(projects.rows).toHaveLength(5);
      const byId = Object.fromEntries(projects.rows.map((row) => [row.id, row]));
      expect(byId['project-alpha']).toMatchObject({
        id: 'project-alpha', name: 'Alpha', client_id: acmeClient.id,
        end_client: 'Alpha', colour: '#112233',
      });
      expect(byId['project-beta']).toMatchObject({
        name: 'Beta', client_id: acmeClient.id, end_client: 'Beta',
      });
      expect(byId['project-contoso']).toMatchObject({
        name: 'contoso', client_id: contosoClient.id, end_client: null,
      });
      expect(byId['project-contoso-q2']).toMatchObject({
        name: 'Q2', client_id: contosoClient.id, end_client: 'Q2',
      });
      expect(byId['project-internal']).toMatchObject({ name: 'Admin', client_id: INTERNAL_CLIENT_ID });

      const clients = await client.execute('SELECT name, is_system FROM clients ORDER BY name');
      expect(clients.rows).toHaveLength(3);
      expect(clients.rows.map((row) => row.name)).toEqual(['Internal', 'acme', 'contoso']);
      expect(clients.rows.find((row) => row.name === 'Internal')).toMatchObject({ is_system: 1 });

      const secondRun = await runClientDataMigration(client);
      expect(secondRun.alreadyApplied).toBe(true);
      expect(secondRun.clientsCreated).toBe(0);
      expect(secondRun.projectsMapped).toBe(0);
      expect(secondRun.after).toEqual(result.before);
    } finally {
      client.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
