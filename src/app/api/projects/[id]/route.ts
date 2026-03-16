// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getProject } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/:id — get single project */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (err) {
    console.error('Error fetching project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PUT /api/projects/:id — update project */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await request.json() as {
      name?: string;
      colour?: string;
      start_date?: string | null;
      end_date?: string | null;
      weekdays?: number[];
    };

    if (body.name !== undefined && (typeof body.name !== 'string' || body.name.trim() === '')) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 400 });
    }

    if (body.weekdays !== undefined) {
      if (!Array.isArray(body.weekdays) || body.weekdays.length === 0) {
        return NextResponse.json({ error: 'weekdays must be a non-empty array' }, { status: 400 });
      }
      const validWeekdays = body.weekdays.every(
        (d) => Number.isInteger(d) && d >= 0 && d <= 6
      );
      if (!validWeekdays) {
        return NextResponse.json({ error: 'weekdays values must be integers 0–6' }, { status: 400 });
      }
    }

    if (body.start_date && !isValidISODate(body.start_date)) {
      return NextResponse.json({ error: 'start_date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (body.end_date && !isValidISODate(body.end_date)) {
      return NextResponse.json({ error: 'end_date must be YYYY-MM-DD' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const updates: Partial<typeof projects.$inferInsert> = {
      updatedAt: now,
    };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.colour !== undefined) updates.colour = body.colour;
    if ('start_date' in body) updates.startDate = body.start_date ?? null;
    if ('end_date' in body) updates.endDate = body.end_date ?? null;
    if (body.weekdays !== undefined) updates.weekdays = JSON.stringify(body.weekdays);

    await db.update(projects).set(updates).where(eq(projects.id, id));

    const updated = await getProject(id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Error updating project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/projects/:id — delete project */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await db.delete(projects).where(eq(projects.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Error deleting project:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
