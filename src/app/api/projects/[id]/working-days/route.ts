export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { calculateProjectWorkingDays } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/projects/:id/working-days?from=YYYY-MM-DD&to=YYYY-MM-DD */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to || !isValidISODate(from) || !isValidISODate(to)) {
    return NextResponse.json(
      { error: 'Invalid date range. Use from=YYYY-MM-DD&to=YYYY-MM-DD' },
      { status: 400 }
    );
  }

  if (from > to) {
    return NextResponse.json({ error: 'from must be before to' }, { status: 400 });
  }

  try {
    const result = await calculateProjectWorkingDays(id, from, to);
    if (!result) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error calculating project working days:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
