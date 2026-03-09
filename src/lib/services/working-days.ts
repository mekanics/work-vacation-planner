import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { and, eq, gte, lte, or } from 'drizzle-orm';
import { eachDayInRange, isWeekend, toISODate } from '@/lib/utils/dates';
import { getHolidayDateSet } from './holidays';
import { parseISO, getYear } from 'date-fns';

export interface WorkingDaySummary {
  from: string;
  to: string;
  total_days: number;
  weekdays: number;
  public_holidays: number;
  vacation_days: number;
  day_off_days: number;
  working_days: number;
}

/**
 * Calculate working days for a date range.
 * working_days = weekdays - holidays_on_weekdays - vacation_days - day_off_days (de-duped)
 * day_off days are structural schedule gaps — not vacation, not holidays, not counted as working.
 */
export async function calculateWorkingDays(
  from: string,
  to: string
): Promise<WorkingDaySummary> {
  const allDates = eachDayInRange(from, to);
  const total_days = allDates.length;

  // Gather years involved for holiday caching
  const years = [...new Set(allDates.map((d) => getYear(d)))];
  const holidaySets = await Promise.all(years.map(getHolidayDateSet));
  const holidayDateSet = new Set<string>(
    holidaySets.flatMap((s) => [...s])
  );

  // Get vacation and day_off records in range from DB
  const dayRows = await db
    .select()
    .from(days)
    .where(
      and(
        gte(days.date, from),
        lte(days.date, to),
        or(
          eq(days.dayType, 'vacation'),
          eq(days.dayType, 'day_off')
        )
      )
    );

  const vacationSet = new Set(dayRows.filter(r => r.dayType === 'vacation').map(r => r.date));
  const dayOffSet = new Set(dayRows.filter(r => r.dayType === 'day_off').map(r => r.date));

  let weekdays = 0;
  let holidaysOnWeekdays = 0;
  let vacationOnWeekdays = 0;
  let dayOffOnWeekdays = 0;

  for (const date of allDates) {
    const iso = toISODate(date);
    if (isWeekend(date)) continue;

    weekdays++;

    const isHoliday = holidayDateSet.has(iso);
    const isVacation = vacationSet.has(iso);
    const isDayOff = dayOffSet.has(iso);

    if (isHoliday) {
      holidaysOnWeekdays++;
    } else if (isVacation) {
      // Count vacation only if not already counted as holiday (de-dup)
      vacationOnWeekdays++;
    } else if (isDayOff) {
      dayOffOnWeekdays++;
    }
  }

  const working_days = weekdays - holidaysOnWeekdays - vacationOnWeekdays - dayOffOnWeekdays;

  return {
    from,
    to,
    total_days,
    weekdays,
    public_holidays: holidaysOnWeekdays,
    vacation_days: vacationOnWeekdays,
    day_off_days: dayOffOnWeekdays,
    working_days: Math.max(0, working_days),
  };
}
