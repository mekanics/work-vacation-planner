// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getProject, deleteProjectOverride } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

interface RouteParams {
  params: Promise<{ id: string; date: string }>;
}

/** DELETE /api/projects/:id/overrides/:date — remove override, reverts day to mask default */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const { id, date } = await params;
  try {
    if (!isValidISODate(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await deleteProjectOverride(id, date);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('Error deleting override:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
