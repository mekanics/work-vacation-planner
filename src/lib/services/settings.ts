import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Returns the configured non-working weekday indices (0=Sun, 1=Mon, ..., 6=Sat).
 * Defaults to empty array (all weekdays are working).
 */
export async function getNonWorkingWeekdays(): Promise<number[]> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'non_working_weekdays'))
      .get();

    if (!row) return [];
    const parsed = JSON.parse(row.value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is number => typeof v === 'number');
  } catch {
    return [];
  }
}

/**
 * Returns the configured canton code.
 * Defaults to 'ZH' if not set. 'CH' means nationwide only.
 */
export async function getCanton(): Promise<string> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'canton'))
      .get();
    return row?.value ?? 'CH';
  } catch {
    return 'CH';
  }
}

/**
 * Returns the configured vacation budget (annual target days).
 * Defaults to 0 if not set.
 */
export async function getVacationBudget(): Promise<number> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'vacation_budget'))
      .get();

    if (!row) return 0;
    const parsed = parseInt(row.value, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}
