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
  working_weekend_days?: number;
}

/**
 * Calculate working days for a date range.
 * working_days = weekdays - holidays_on_weekdays - vacation_days - day_off_days (de-duped)
 *              + working_weekend_days (explicitly-scheduled weekend days)
 * day_off days are structural schedule gaps — not vacation, not holidays, not counted as working.
 * working_weekend days are weekend days explicitly marked as working, subject to holiday/vacation deduction.
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

  // Get vacation, day_off, and working_weekend records in range from DB
  const dayRows = await db
    .select()
    .from(days)
    .where(
      and(
        gte(days.date, from),
        lte(days.date, to),
        or(
          eq(days.dayType, 'vacation'),
          eq(days.dayType, 'day_off'),
          eq(days.dayType, 'working_weekend')
        )
      )
    );

  const vacationSet = new Set(dayRows.filter(r => r.dayType === 'vacation').map(r => r.date));
  const dayOffSet = new Set(dayRows.filter(r => r.dayType === 'day_off').map(r => r.date));
  const workingWeekendSet = new Set(dayRows.filter(r => r.dayType === 'working_weekend').map(r => r.date));

  let weekdays = 0;
  let holidaysOnWeekdays = 0;
  let vacationOnWeekdays = 0;
  let dayOffOnWeekdays = 0;
  let workingWeekendDays = 0;

  for (const date of allDates) {
    const iso = toISODate(date);

    if (isWeekend(date)) {
      // Normal weekends are skipped unless explicitly marked as working_weekend
      if (!workingWeekendSet.has(iso)) continue;

      // This is an explicitly-working weekend day — treat like a virtual weekday
      const isHoliday = holidayDateSet.has(iso);
      const isVacation = vacationSet.has(iso);
      const isDayOff = dayOffSet.has(iso);

      if (isHoliday) {
        // Holiday wins — same counter as weekday holidays for simplicity
        holidaysOnWeekdays++;
      } else if (isVacation) {
        vacationOnWeekdays++;
      } else if (isDayOff) {
        dayOffOnWeekdays++;
      } else {
        workingWeekendDays++;
      }
      continue;
    }

    // Regular weekday
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

  const working_days = weekdays - holidaysOnWeekdays - vacationOnWeekdays - dayOffOnWeekdays + workingWeekendDays;

  return {
    from,
    to,
    total_days,
    weekdays,
    public_holidays: holidaysOnWeekdays,
    vacation_days: vacationOnWeekdays,
    day_off_days: dayOffOnWeekdays,
    working_days: Math.max(0, working_days),
    working_weekend_days: workingWeekendDays,
  };
}
