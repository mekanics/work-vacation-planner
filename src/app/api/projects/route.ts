// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { getClient } from '@/lib/services/clients';
import { getProject, getProjects } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

/** GET /api/projects — list all projects */
export async function GET() {
  try {
    return NextResponse.json(await getProjects());
  } catch (err) {
    console.error('Error fetching projects:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/projects — create a new project */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string;
      clientId?: string;
      endClient?: string | null;
      colour?: string | null;
      start_date?: string | null;
      end_date?: string | null;
      weekdays?: number[];
    };

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!body.clientId || typeof body.clientId !== 'string') {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }
    const client = await getClient(body.clientId);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 400 });
    }

    // Defaults are a creation-time template, never a live inheritance.
    const weekdays = body.weekdays ?? client.defaultWeekdays;
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      return NextResponse.json({ error: 'weekdays must be a non-empty array' }, { status: 400 });
    }
    if (!weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      return NextResponse.json({ error: 'weekdays values must be integers 0–6' }, { status: 400 });
    }
    if (body.start_date && !isValidISODate(body.start_date)) {
      return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (body.end_date && !isValidISODate(body.end_date)) {
      return NextResponse.json({ error: 'end_date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (body.colour !== undefined && body.colour !== null && typeof body.colour !== 'string') {
      return NextResponse.json({ error: 'colour must be a string or null' }, { status: 400 });
    }
    if (body.endClient !== undefined && body.endClient !== null && typeof body.endClient !== 'string') {
      return NextResponse.json({ error: 'endClient must be a string or null' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await db.insert(projects).values({
      id,
      name: body.name.trim(),
      clientId: client.id,
      endClient: body.endClient?.trim() || null,
      colour: body.colour?.trim() || null,
      startDate: body.start_date ?? null,
      endDate: body.end_date ?? null,
      weekdays: JSON.stringify(weekdays),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(await getProject(id), { status: 201 });
  } catch (err) {
    console.error('Error creating project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
