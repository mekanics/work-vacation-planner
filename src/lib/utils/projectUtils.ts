import { addDays, format } from 'date-fns';
import { computeIsProjectDay, computeIsIncluded } from './projectCalendar';
import type { ProjectRecord, ProjectDayOverride } from '@/lib/services/projects';

/**
 * Find the next working day for a project after the given `from` date.
 *
 * A day is a "next working day" if:
 * - It is included in the project (matches weekday mask or has include override, not excluded)
 * - It is not in the holidaySet
 * - It is not in the vacationSet
 *
 * Returns the ISO date string (YYYY-MM-DD) or null if no day found in the next 365 days
 * (or if the project has already ended).
 */
export function getNextWorkingDay(
  project: ProjectRecord,
  overrides: ProjectDayOverride[],
  from: Date,
  holidaySet: Set<string> = new Set(),
  vacationSet: Set<string> = new Set()
): string | null {
  const includeOverrides = new Set(
    overrides.filter((o) => o.type === 'include').map((o) => o.date)
  );
  const excludeOverrides = new Set(
    overrides.filter((o) => o.type === 'exclude').map((o) => o.date)
  );

  for (let i = 1; i <= 365; i++) {
    const date = addDays(from, i);
    const iso = format(date, 'yyyy-MM-dd');

    // If project has ended, no future days possible
    if (project.endDate && iso > project.endDate) return null;

    const isProjectDay = computeIsProjectDay(iso, project);
    const hasInclude = includeOverrides.has(iso);
    const hasExclude = excludeOverrides.has(iso);
    const isIncluded = computeIsIncluded(isProjectDay, hasInclude, hasExclude);

    if (isIncluded && !holidaySet.has(iso) && !vacationSet.has(iso)) {
      return iso;
    }
  }

  return null;
}

/**
 * Calculate working days remaining for a project from `from` (exclusive) to Dec 31 of current year.
 * Uses the same logic as calculateProjectWorkingDays but as a pure utility (no DB).
 *
 * A day counts if:
 * - It is included in the project (weekday mask + overrides)
 * - It is not a holiday
 * - It is not a vacation day
 */
export function getDaysRemainingThisYear(
  project: ProjectRecord,
  overrides: ProjectDayOverride[],
  from: Date,
  holidaySet: Set<string> = new Set(),
  vacationSet: Set<string> = new Set()
): number {
  const includeOverrides = new Set(
    overrides.filter((o) => o.type === 'include').map((o) => o.date)
  );
  const excludeOverrides = new Set(
    overrides.filter((o) => o.type === 'exclude').map((o) => o.date)
  );

  const year = from.getFullYear();
  const yearEnd = new Date(year, 11, 31); // Dec 31
  let count = 0;

  let current = addDays(from, 1); // exclusive of `from`
  while (current <= yearEnd) {
    const iso = format(current, 'yyyy-MM-dd');

    const isProjectDay = computeIsProjectDay(iso, project);
    const hasInclude = includeOverrides.has(iso);
    const hasExclude = excludeOverrides.has(iso);
    const isIncluded = computeIsIncluded(isProjectDay, hasInclude, hasExclude);

    if (isIncluded && !holidaySet.has(iso) && !vacationSet.has(iso)) {
      count++;
    }

    current = addDays(current, 1);
  }

  return count;
}
