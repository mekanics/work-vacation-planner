import type { Client } from '@libsql/client';

export const INTERNAL_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
export const LEGACY_CLIENT_SLOTS = [
  { id: '00000000-0000-0000-0000-000000000001', colour: '#4f86c6' },
  { id: '00000000-0000-0000-0000-000000000002', colour: '#27ae60' },
] as const;

const MIGRATION_SETTING = 'client_data_migration_v1';
const LEGACY_NAME_SEPARATOR = ' - ';

export interface MigrationCounts {
  projects: number;
  days: number;
  projectDayOverrides: number;
}

export interface ClientMigrationResult {
  alreadyApplied: boolean;
  clientsCreated: number;
  projectsMapped: number;
  before: MigrationCounts;
  after: MigrationCounts;
}

interface ParsedLegacyName {
  clientName: string;
  projectName: string;
  endClient: string;
}

function parseLegacyName(name: string): ParsedLegacyName | null {
  const separatorIndex = name.indexOf(LEGACY_NAME_SEPARATOR);
  if (separatorIndex < 0) return null;

  const clientName = name.slice(0, separatorIndex).trim();
  const projectName = name.slice(separatorIndex + LEGACY_NAME_SEPARATOR.length).trim();
  if (!clientName || !projectName) return null;

  return { clientName, projectName, endClient: projectName };
}

async function counts(client: Client): Promise<MigrationCounts> {
  const result = await client.execute(`SELECT
    (SELECT COUNT(*) FROM projects) AS projects,
    (SELECT COUNT(*) FROM days) AS days,
    (SELECT COUNT(*) FROM project_day_overrides) AS project_day_overrides`);
  const row = result.rows[0];
  return {
    projects: Number(row.projects),
    days: Number(row.days),
    projectDayOverrides: Number(row.project_day_overrides),
  };
}

/**
 * One-time, additive mapping for pre-Client installations. The settings marker
 * prevents later project/client edits from being overwritten on every startup.
 * Legacy names use "client - project"; a bare name matching such a client is
 * linked without being renamed, and unrelated projects remain under Internal.
 */
export async function runClientDataMigration(client: Client): Promise<ClientMigrationResult> {
  const before = await counts(client);
  const marker = await client.execute({
    sql: 'SELECT value FROM settings WHERE key = ?',
    args: [MIGRATION_SETTING],
  });
  if (marker.rows.length > 0) {
    return {
      alreadyApplied: true,
      clientsCreated: 0,
      projectsMapped: 0,
      before,
      after: await counts(client),
    };
  }

  const transaction = await client.transaction('write');
  let clientsCreated = 0;
  let projectsMapped = 0;
  try {
    const now = new Date().toISOString();
    const result = await transaction.execute('SELECT id, name FROM projects ORDER BY name, id');
    const legacyProjects = result.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      parsed: parseLegacyName(String(row.name)),
    }));
    const clientNames = [...new Set(
      legacyProjects.flatMap((project) => project.parsed ? [project.parsed.clientName] : []),
    )].sort();

    if (clientNames.length > LEGACY_CLIENT_SLOTS.length) {
      throw new Error(
        `Legacy client migration supports at most ${LEGACY_CLIENT_SLOTS.length} clients; found ${clientNames.length}`,
      );
    }

    const legacyClients = clientNames.map((name, index) => ({ name, ...LEGACY_CLIENT_SLOTS[index] }));
    const clientIds = new Map(legacyClients.map((legacyClient) => [legacyClient.name, legacyClient.id]));

    for (const legacyClient of legacyClients) {
      const inserted = await transaction.execute({
        sql: `INSERT INTO clients
          (id, name, colour, default_weekdays, archived, is_system, created_at, updated_at)
          VALUES (?, ?, ?, '[1,2,3,4,5]', 0, 0, ?, ?)
          ON CONFLICT(id) DO NOTHING`,
        args: [legacyClient.id, legacyClient.name, legacyClient.colour, now, now],
      });
      clientsCreated += inserted.rowsAffected;
    }

    for (const project of legacyProjects) {
      if (!project.parsed) continue;
      const clientId = clientIds.get(project.parsed.clientName);
      if (!clientId) throw new Error(`Missing migrated client for project ${project.id}`);

      const updated = await transaction.execute({
        sql: `UPDATE projects
          SET client_id = ?, name = ?, end_client = ?, updated_at = ?
          WHERE id = ?`,
        args: [clientId, project.parsed.projectName, project.parsed.endClient, now, project.id],
      });
      projectsMapped += updated.rowsAffected;
    }

    for (const project of legacyProjects) {
      if (project.parsed) continue;
      const clientId = clientIds.get(project.name);
      if (!clientId) continue;

      const updated = await transaction.execute({
        sql: 'UPDATE projects SET client_id = ?, updated_at = ? WHERE id = ?',
        args: [clientId, now, project.id],
      });
      projectsMapped += updated.rowsAffected;
    }

    await transaction.execute({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?)',
      args: [MIGRATION_SETTING, now],
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  const after = await counts(client);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`Client migration changed record counts: ${JSON.stringify({ before, after })}`);
  }

  return { alreadyApplied: false, clientsCreated, projectsMapped, before, after };
}
