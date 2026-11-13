// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { clients, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getClient } from '@/lib/services/clients';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const client = await getClient(id);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(client);
  } catch (err) {
    console.error('Error fetching client:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const existing = await getClient(id);
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const body = await request.json() as {
      name?: string;
      colour?: string;
      defaultWeekdays?: number[];
      archived?: boolean;
    };
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }
    if (body.colour !== undefined && (typeof body.colour !== 'string' || !body.colour.trim())) {
      return NextResponse.json({ error: 'colour must be a non-empty string' }, { status: 400 });
    }
    if (body.defaultWeekdays !== undefined && (
      !Array.isArray(body.defaultWeekdays) || body.defaultWeekdays.length === 0 ||
      !body.defaultWeekdays.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )) {
      return NextResponse.json({ error: 'defaultWeekdays must contain integers 0–6' }, { status: 400 });
    }
    if (body.archived !== undefined && typeof body.archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 });
    }

    const updates: Partial<typeof clients.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.colour !== undefined) updates.colour = body.colour.trim();
    if (body.defaultWeekdays !== undefined) updates.defaultWeekdays = JSON.stringify(body.defaultWeekdays);
    if (body.archived !== undefined) updates.archived = body.archived;
    await db.update(clients).set(updates).where(eq(clients.id, id));
    return NextResponse.json(await getClient(id));
  } catch (err) {
    console.error('Error updating client:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const client = await getClient(id);
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (client.isSystem) {
      return NextResponse.json({ error: 'The Internal system client cannot be deleted' }, { status: 409 });
    }
    const linked = await db.select({ id: projects.id }).from(projects).where(eq(projects.clientId, id)).limit(1);
    if (linked.length > 0) {
      return NextResponse.json({ error: 'Archive this client or move its projects before deleting it' }, { status: 409 });
    }
    await db.delete(clients).where(eq(clients.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Error deleting client:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
