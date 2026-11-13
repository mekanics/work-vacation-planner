// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { getClient, getClients } from '@/lib/services/clients';

const PRESET_COLOURS = ['#4f86c6', '#e67e22', '#27ae60', '#9b59b6', '#e74c3c', '#1abc9c'];

/** GET /api/clients — list clients, including archived records for management/reporting. */
export async function GET() {
  try {
    return NextResponse.json(await getClients());
  } catch (err) {
    console.error('Error fetching clients:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/clients — create a client. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string;
      colour?: string;
      defaultWeekdays?: number[];
      archived?: boolean;
    };
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const defaultWeekdays = body.defaultWeekdays ?? [1, 2, 3, 4, 5];
    if (!Array.isArray(defaultWeekdays) || defaultWeekdays.length === 0 ||
      !defaultWeekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
      return NextResponse.json({ error: 'defaultWeekdays must contain integers 0–6' }, { status: 400 });
    }
    if (body.colour !== undefined && (typeof body.colour !== 'string' || !body.colour.trim())) {
      return NextResponse.json({ error: 'colour must be a non-empty string' }, { status: 400 });
    }
    if (body.archived !== undefined && typeof body.archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const existing = await getClients();
    await db.insert(clients).values({
      id,
      name: body.name.trim(),
      colour: body.colour?.trim() ?? PRESET_COLOURS[existing.length % PRESET_COLOURS.length],
      defaultWeekdays: JSON.stringify(defaultWeekdays),
      archived: body.archived ?? false,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json(await getClient(id), { status: 201 });
  } catch (err) {
    console.error('Error creating client:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
