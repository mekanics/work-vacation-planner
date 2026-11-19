import type { Client } from '@libsql/client';

/** Create the current schema without running migration history (for API integration tests). */
export async function createCurrentTestSchema(client: Client): Promise<void> {
  await client.batch([
    `CREATE TABLE clients (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      colour text NOT NULL,
      default_weekdays text NOT NULL,
      archived integer NOT NULL DEFAULT 0,
      is_system integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE TABLE projects (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      client_id text NOT NULL REFERENCES clients(id) ON DELETE restrict,
      end_client text,
      colour text,
      start_date text,
      end_date text,
      weekdays text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE TABLE days (
      date text PRIMARY KEY NOT NULL,
      day_type text NOT NULL,
      note text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )`,
    `CREATE TABLE project_day_overrides (
      project_id text NOT NULL REFERENCES projects(id) ON DELETE cascade,
      date text NOT NULL,
      type text NOT NULL,
      PRIMARY KEY(project_id, date)
    )`,
    `CREATE TABLE public_holidays (
      date text NOT NULL,
      name text NOT NULL,
      canton text NOT NULL,
      year integer NOT NULL,
      global integer NOT NULL,
      PRIMARY KEY(date, canton)
    )`,
    `CREATE TABLE settings (key text PRIMARY KEY NOT NULL, value text NOT NULL)`,
  ]);
}
