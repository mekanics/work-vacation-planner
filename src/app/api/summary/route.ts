// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { calculateWorkingDays } from '@/lib/services/working-days';
import { calculateProjectWorkingDays } from '@/lib/services/projects';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const projectId = searchParams.get('project');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  try {
    // Calculate per-month summaries
    const months = [];

    for (let m = 0; m < 12; m++) {
      const monthStart = startOfMonth(new Date(year, m, 1));
      const monthEnd = endOfMonth(monthStart);
      const from = format(monthStart, 'yyyy-MM-dd');
      const to = format(monthEnd, 'yyyy-MM-dd');

      if (projectId) {
        const summary = await calculateProjectWorkingDays(projectId, from, to);
        if (summary === null) {
          return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        months.push({
          month: format(monthStart, 'yyyy-MM'),
          weekdays: 0,
          public_holidays: summary.holidays,
          vacation_days: summary.vacation_days,
          working_days: summary.working_days,
        });
      } else {
        const summary = await calculateWorkingDays(from, to);
        months.push({
          month: format(monthStart, 'yyyy-MM'),
          weekdays: summary.weekdays,
          public_holidays: summary.public_holidays,
          vacation_days: summary.vacation_days,
          working_days: summary.working_days,
        });
      }
    }

    return NextResponse.json({
      year,
      months,
    });
  } catch (err) {
    console.error('Error calculating summary:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
