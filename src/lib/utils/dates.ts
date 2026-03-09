import { eachDayOfInterval, isWeekend as fnsIsWeekend, parseISO, format } from 'date-fns';

/**
 * Check if a date is a weekend (Saturday or Sunday)
 */
export function isWeekend(date: Date): boolean {
  return fnsIsWeekend(date);
}

/**
 * Get all dates in a range [from, to] inclusive
 */
export function eachDayInRange(from: string, to: string): Date[] {
  const start = parseISO(from);
  const end = parseISO(to);
  return eachDayOfInterval({ start, end });
}

/**
 * Convert a Date to YYYY-MM-DD string
 */
export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Validate an ISO date string (YYYY-MM-DD)
 */
export function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = parseISO(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Get current date as ISO string
 */
export function todayISO(): string {
  return toISODate(new Date());
}
