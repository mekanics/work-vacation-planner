// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getProject, getProjectOverrides, upsertProjectOverride } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/:id/overrides — list all overrides for a project */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const overrides = await getProjectOverrides(id);
    return NextResponse.json(overrides);
  } catch (err) {
    console.error('Error fetching overrides:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/projects/:id/overrides — upsert an override
 *  Body: { date: string, type: 'include' | 'exclude' }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const body = await req.json() as { date?: string; type?: string };

    if (!body.date || !isValidISODate(body.date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }
    if (body.type !== 'include' && body.type !== 'exclude') {
      return NextResponse.json({ error: 'type must be "include" or "exclude"' }, { status: 400 });
    }

    await upsertProjectOverride(id, body.date, body.type);
    return NextResponse.json({ projectId: id, date: body.date, type: body.type }, { status: 200 });
  } catch (err) {
    console.error('Error upserting override:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
