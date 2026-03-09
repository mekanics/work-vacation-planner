import { getDay } from 'date-fns';
import type { ProjectRecord } from '@/lib/services/projects';

/**
 * Determine if a date is a "natural" project day (within date range AND matches weekday mask).
 * Does NOT take overrides into account — this is the pre-override baseline.
 */
export function computeIsProjectDay(date: string, project: ProjectRecord): boolean {
  // Check date range
  if (project.startDate && date < project.startDate) return false;
  if (project.endDate && date > project.endDate) return false;

  // Check weekday mask (use T12:00:00 to avoid UTC rollover issues)
  const dow = getDay(new Date(date + 'T12:00:00')); // 0=Sun … 6=Sat
  return project.weekdays.includes(dow);
}

/**
 * Compute the final "is this date included in the project?" state after applying overrides.
 *
 * Truth table:
 * - isProjectDay + no override              → included
 * - isProjectDay + exclude override         → excluded
 * - NOT isProjectDay + include override     → included
 * - NOT isProjectDay + no override          → excluded
 * - (include + exclude simultaneously is a data anomaly — include wins for safety)
 */
export function computeIsIncluded(
  isProjectDay: boolean,
  hasIncludeOverride: boolean,
  hasExcludeOverride: boolean
): boolean {
  if (hasIncludeOverride) return true;
  if (hasExcludeOverride) return false;
  return isProjectDay;
}
