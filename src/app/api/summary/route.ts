import { NextRequest, NextResponse } from 'next/server';
import { calculateWorkingDays } from '@/lib/services/working-days';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  try {
    // Get vacation budget from settings
    const budgetKey = `vacation_budget_${year}`;
    const budgetRow = await db
      .select()
      .from(settings)
      .where(eq(settings.key, budgetKey))
      .then(rows => rows[0]);
    const vacation_budget = budgetRow ? parseInt(budgetRow.value, 10) : 20;

    // Calculate per-month summaries
    const months = [];
    let total_vacation = 0;

    for (let m = 0; m < 12; m++) {
      const monthStart = startOfMonth(new Date(year, m, 1));
      const monthEnd = endOfMonth(monthStart);
      const from = format(monthStart, 'yyyy-MM-dd');
      const to = format(monthEnd, 'yyyy-MM-dd');

      const summary = await calculateWorkingDays(from, to);
      total_vacation += summary.vacation_days;

      months.push({
        month: format(monthStart, 'yyyy-MM'),
        weekdays: summary.weekdays,
        public_holidays: summary.public_holidays,
        vacation_days: summary.vacation_days,
        working_days: summary.working_days,
      });
    }

    return NextResponse.json({
      year,
      vacation_budget,
      vacation_used: total_vacation,
      vacation_remaining: vacation_budget - total_vacation,
      months,
    });
  } catch (err) {
    console.error('Error calculating summary:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
