import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { and, eq, gte, lte, or } from 'drizzle-orm';
import { eachDayInRange, isWeekend, toISODate } from '@/lib/utils/dates';
import { getHolidayDateSet } from './holidays';
import { getNonWorkingWeekdays } from './settings';
import { getDay, getYear } from 'date-fns';

export interface WorkingDaySummary {
  from: string;
  to: string;
  total_days: number;
  weekdays: number;
  public_holidays: number;
  vacation_days: number;
  working_days: number;
  working_weekend_days?: number;
  non_working_weekday_days?: number;
}

/**
 * Calculate working days for a date range.
 * working_days = weekdays - holidays_on_weekdays - vacation_days (de-duped)
 *              - non_working_weekday_days (weekdays configured as non-working)
 *              + working_weekend_days (explicitly-scheduled weekend days)
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
  const holidaySets = await Promise.all(years.map((y) => getHolidayDateSet(y)));
  const holidayDateSet = new Set<string>(
    holidaySets.flatMap((s) => [...s])
  );

  // Fetch non-working weekday configuration
  const nonWorkingWeekdays = await getNonWorkingWeekdays();
  const nonWorkingWeekdaySet = new Set(nonWorkingWeekdays);

  // Get vacation and working_weekend records in range from DB
  const dayRows = await db
    .select()
    .from(days)
    .where(
      and(
        gte(days.date, from),
        lte(days.date, to),
        or(
          eq(days.dayType, 'vacation'),
          eq(days.dayType, 'working_weekend')
        )
      )
    );

  const vacationSet = new Set(dayRows.filter(r => r.dayType === 'vacation').map(r => r.date));
  const workingWeekendSet = new Set(dayRows.filter(r => r.dayType === 'working_weekend').map(r => r.date));

  let weekdays = 0;
  let holidaysOnWeekdays = 0;
  let vacationOnWeekdays = 0;
  let workingWeekendDays = 0;
  let nonWorkingWeekdayDays = 0;

  for (const date of allDates) {
    const iso = toISODate(date);
    const dow = getDay(date); // 0=Sun, 1=Mon, ..., 6=Sat

    if (isWeekend(date)) {
      // Normal weekends are skipped unless explicitly marked as working_weekend
      if (!workingWeekendSet.has(iso)) continue;

      // This is an explicitly-working weekend day — treat like a virtual weekday
      const isHoliday = holidayDateSet.has(iso);
      const isVacation = vacationSet.has(iso);

      if (isHoliday) {
        holidaysOnWeekdays++;
      } else if (isVacation) {
        vacationOnWeekdays++;
      } else {
        workingWeekendDays++;
      }
      continue;
    }

    // Regular weekday
    weekdays++;

    // Check if this weekday is configured as non-working
    if (nonWorkingWeekdaySet.has(dow)) {
      nonWorkingWeekdayDays++;
      continue; // Don't count as working; skip holiday/vacation counting too
    }

    const isHoliday = holidayDateSet.has(iso);
    const isVacation = vacationSet.has(iso);

    // Vacation wins over holiday when explicitly set by the user
    // (e.g. employer doesn't observe this holiday — user spent a vacation day)
    if (isVacation) {
      vacationOnWeekdays++;
    } else if (isHoliday) {
      holidaysOnWeekdays++;
    }
  }

  const working_days = weekdays
    - holidaysOnWeekdays
    - vacationOnWeekdays
    - nonWorkingWeekdayDays
    + workingWeekendDays;

  return {
    from,
    to,
    total_days,
    weekdays,
    public_holidays: holidaysOnWeekdays,
    vacation_days: vacationOnWeekdays,
    working_days: Math.max(0, working_days),
    working_weekend_days: workingWeekendDays,
    non_working_weekday_days: nonWorkingWeekdayDays,
  };
}
