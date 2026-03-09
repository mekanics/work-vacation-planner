import { NextRequest, NextResponse } from 'next/server';
import { calculateWorkingDays } from '@/lib/services/working-days';
import { calculateProjectWorkingDays } from '@/lib/services/projects';
import { isValidISODate } from '@/lib/utils/dates';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const projectId = searchParams.get('project');

  if (!from || !to || !isValidISODate(from) || !isValidISODate(to)) {
    return NextResponse.json(
      { error: 'Invalid date range. Use from=YYYY-MM-DD&to=YYYY-MM-DD' },
      { status: 400 }
    );
  }

  if (from > to) {
    return NextResponse.json(
      { error: 'from must be before to' },
      { status: 400 }
    );
  }

  try {
    if (projectId) {
      // Delegate to project working-days logic
      const result = await calculateProjectWorkingDays(projectId, from, to);
      if (!result) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    const result = await calculateWorkingDays(from, to);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error calculating working days:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
