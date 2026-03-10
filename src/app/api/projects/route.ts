export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getProjects } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

const PRESET_COLOURS = [
  '#4f86c6', // Steel Blue
  '#e67e22', // Amber
  '#27ae60', // Emerald
  '#9b59b6', // Violet
  '#e74c3c', // Coral
  '#1abc9c', // Teal
];

/** GET /api/projects — list all projects */
export async function GET() {
  try {
    const allProjects = await getProjects();
    return NextResponse.json(allProjects);
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
      colour?: string;
      start_date?: string | null;
      end_date?: string | null;
      weekdays?: number[];
    };

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!Array.isArray(body.weekdays) || body.weekdays.length === 0) {
      return NextResponse.json({ error: 'weekdays must be a non-empty array' }, { status: 400 });
    }

    const validWeekdays = body.weekdays.every(
      (d) => Number.isInteger(d) && d >= 0 && d <= 6
    );
    if (!validWeekdays) {
      return NextResponse.json({ error: 'weekdays values must be integers 0–6' }, { status: 400 });
    }

    if (body.start_date && !isValidISODate(body.start_date)) {
      return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (body.end_date && !isValidISODate(body.end_date)) {
      return NextResponse.json({ error: 'end_date must be YYYY-MM-DD' }, { status: 400 });
    }

    // Auto-assign colour if not provided
    const existingProjects = await getProjects();
    const colour = body.colour ?? PRESET_COLOURS[existingProjects.length % PRESET_COLOURS.length];

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.insert(projects).values({
      id,
      name: body.name.trim(),
      colour,
      startDate: body.start_date ?? null,
      endDate: body.end_date ?? null,
      weekdays: JSON.stringify(body.weekdays),
      createdAt: now,
      updatedAt: now,
    });

    const created = await db.select().from(projects).where(eq(projects.id, id));

    const row = created[0];
    return NextResponse.json({
      id: row.id,
      name: row.name,
      colour: row.colour,
      startDate: row.startDate,
      endDate: row.endDate,
      weekdays: JSON.parse(row.weekdays) as number[],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }, { status: 201 });
  } catch (err) {
    console.error('Error creating project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
