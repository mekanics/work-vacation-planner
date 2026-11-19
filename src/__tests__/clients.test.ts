import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createCurrentTestSchema } from './helpers/testDatabase';

const INTERNAL_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
const tempDir = mkdtempSync(join(tmpdir(), 'planner-client-api-'));
process.env.DATABASE_PATH = join(tempDir, 'test.db');

let client: Client;
let clientRoutes: typeof import('@/app/api/clients/route');
let clientIdRoutes: typeof import('@/app/api/clients/[id]/route');
let projectRoutes: typeof import('@/app/api/projects/route');
let projectIdRoutes: typeof import('@/app/api/projects/[id]/route');
let clientReportRoutes: typeof import('@/app/api/reports/clients/route');

function request(url: string, init?: { method?: string; body?: unknown }): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: init?.method,
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    headers: init?.body === undefined ? undefined : { 'Content-Type': 'application/json' },
  });
}

async function seedInternal(): Promise<void> {
  await client.execute({
    sql: `INSERT INTO clients
      (id, name, colour, default_weekdays, archived, is_system, created_at, updated_at)
      VALUES (?, 'Internal', '#64748b', '[1,2,3,4,5]', 0, 1, ?, ?)`,
    args: [INTERNAL_CLIENT_ID, '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
  });
}

async function createTestClient(overrides: { name?: string; weekdays?: number[] } = {}) {
  const response = await clientRoutes.POST(request('/api/clients', {
    method: 'POST',
    body: {
      name: overrides.name ?? 'acme',
      colour: '#123456',
      defaultWeekdays: overrides.weekdays ?? [1, 2, 3],
    },
  }));
  expect(response.status).toBe(201);
  return await response.json() as { id: string; defaultWeekdays: number[] };
}

beforeAll(async () => {
  client = createClient({ url: `file:${process.env.DATABASE_PATH}` });
  await createCurrentTestSchema(client);
  clientRoutes = await import('@/app/api/clients/route');
  clientIdRoutes = await import('@/app/api/clients/[id]/route');
  projectRoutes = await import('@/app/api/projects/route');
  projectIdRoutes = await import('@/app/api/projects/[id]/route');
  clientReportRoutes = await import('@/app/api/reports/clients/route');
});

beforeEach(async () => {
  await client.batch([
    'DELETE FROM project_day_overrides',
    'DELETE FROM projects',
    'DELETE FROM days',
    'DELETE FROM public_holidays',
    'DELETE FROM clients',
  ]);
  await seedInternal();
});

afterAll(() => {
  client.close();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('Client API', () => {
  it('creates, lists, reads and updates a client', async () => {
    const created = await createTestClient({ weekdays: [1, 3, 5] });
    expect(created.defaultWeekdays).toEqual([1, 3, 5]);

    const list = await clientRoutes.GET();
    expect(list.status).toBe(200);
    expect(await list.json()).toHaveLength(2);

    const params = Promise.resolve({ id: created.id });
    const read = await clientIdRoutes.GET(request(`/api/clients/${created.id}`), { params });
    expect(read.status).toBe(200);
    expect((await read.json()).name).toBe('acme');

    const updated = await clientIdRoutes.PUT(request(`/api/clients/${created.id}`, {
      method: 'PUT',
      body: { name: 'Renamed', archived: true },
    }), { params });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ name: 'Renamed', archived: true });

    await projectRoutes.POST(request('/api/projects', {
      method: 'POST', body: { name: 'Linked project', clientId: created.id },
    }));
    const removed = await clientIdRoutes.DELETE(request(`/api/clients/${created.id}`, {
      method: 'DELETE',
    }), { params });
    expect(removed.status).toBe(409);
  });

  it('validates client fields and deletes an unused non-system client', async () => {
    const invalid = await clientRoutes.POST(request('/api/clients', {
      method: 'POST',
      body: { name: 'Bad weekdays', defaultWeekdays: [8] },
    }));
    expect(invalid.status).toBe(400);

    const created = await createTestClient();
    const params = Promise.resolve({ id: created.id });
    const removed = await clientIdRoutes.DELETE(request(`/api/clients/${created.id}`, {
      method: 'DELETE',
    }), { params });
    expect(removed.status).toBe(204);
    expect((await clientIdRoutes.GET(request(`/api/clients/${created.id}`), { params })).status).toBe(404);
  });

  it('protects the Internal system client from deletion', async () => {
    const params = Promise.resolve({ id: INTERNAL_CLIENT_ID });
    const response = await clientIdRoutes.DELETE(request(`/api/clients/${INTERNAL_CLIENT_ID}`, {
      method: 'DELETE',
    }), { params });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/system client/i);
  });
});

describe('Project client fields', () => {
  it('requires clientId and rejects an unknown client', async () => {
    const missing = await projectRoutes.POST(request('/api/projects', {
      method: 'POST',
      body: { name: 'No client', weekdays: [1] },
    }));
    expect(missing.status).toBe(400);

    const unknown = await projectRoutes.POST(request('/api/projects', {
      method: 'POST',
      body: { name: 'Unknown client', clientId: 'missing', weekdays: [1] },
    }));
    expect(unknown.status).toBe(400);
  });

  it('copies client weekday defaults, stores endClient and falls back to client colour', async () => {
    const testClient = await createTestClient({ weekdays: [2, 4] });
    const createdResponse = await projectRoutes.POST(request('/api/projects', {
      method: 'POST',
      body: { name: 'Alpha', clientId: testClient.id, endClient: 'Alpha' },
    }));
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({
      clientId: testClient.id,
      clientName: 'acme',
      endClient: 'Alpha',
      weekdays: [2, 4],
      colour: '#123456',
      colourOverride: null,
    });

    await clientIdRoutes.PUT(request(`/api/clients/${testClient.id}`, {
      method: 'PUT', body: { colour: '#abcdef' },
    }), { params: Promise.resolve({ id: testClient.id }) });

    const params = Promise.resolve({ id: created.id });
    const read = await projectIdRoutes.GET(request(`/api/projects/${created.id}`), { params });
    expect((await read.json()).colour).toBe('#abcdef');

    const overridden = await projectIdRoutes.PUT(request(`/api/projects/${created.id}`, {
      method: 'PUT', body: { colour: '#000001', endClient: 'Alpha Energy' },
    }), { params });
    expect(await overridden.json()).toMatchObject({
      colour: '#000001', colourOverride: '#000001', endClient: 'Alpha Energy',
    });

    const cleared = await projectIdRoutes.PUT(request(`/api/projects/${created.id}`, {
      method: 'PUT', body: { colour: null, endClient: null },
    }), { params });
    expect(await cleared.json()).toMatchObject({
      colour: '#abcdef', colourOverride: null, endClient: null,
    });
  });

  it('does not recopy weekday defaults when a project changes client', async () => {
    const first = await createTestClient({ name: 'First', weekdays: [1, 2] });
    const second = await createTestClient({ name: 'Second', weekdays: [4, 5] });
    const createdResponse = await projectRoutes.POST(request('/api/projects', {
      method: 'POST', body: { name: 'Engagement', clientId: first.id },
    }));
    const created = await createdResponse.json();

    const response = await projectIdRoutes.PUT(request(`/api/projects/${created.id}`, {
      method: 'PUT', body: { clientId: second.id },
    }), { params: Promise.resolve({ id: created.id }) });
    expect(await response.json()).toMatchObject({ clientId: second.id, weekdays: [1, 2] });
  });
});

describe('Client working-day report', () => {
  it('totals projects by client and excludes Internal by default', async () => {
    const testClient = await createTestClient({ weekdays: [1, 2, 3, 4, 5] });
    await projectRoutes.POST(request('/api/projects', {
      method: 'POST', body: { name: 'Billable', clientId: testClient.id },
    }));
    await projectRoutes.POST(request('/api/projects', {
      method: 'POST', body: { name: 'Admin', clientId: INTERNAL_CLIENT_ID },
    }));

    const response = await clientReportRoutes.GET(request(
      '/api/reports/clients?from=2024-01-08&to=2024-01-12',
    ));
    expect(response.status).toBe(200);
    const report = await response.json();
    expect(report.clients).toHaveLength(1);
    expect(report.clients[0]).toMatchObject({ client_name: 'acme', working_days: 5 });

    const withInternal = await clientReportRoutes.GET(request(
      '/api/reports/clients?from=2024-01-08&to=2024-01-12&includeInternal=true',
    ));
    expect((await withInternal.json()).clients).toHaveLength(2);
  });
});
