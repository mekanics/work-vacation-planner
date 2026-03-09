import { db } from '@/lib/db';
import { publicHolidays } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

export interface Holiday {
  date: string;
  name: string;
  canton: string;
  year: number;
  global: number;
}

const canton = process.env.CANTON ?? 'ZH';

/**
 * Ensures holidays for the given year are cached in the DB.
 * Fetches from date.nager.at if not already stored.
 */
export async function ensureHolidaysCached(year: number): Promise<void> {
  const existing = await db
    .select()
    .from(publicHolidays)
    .where(eq(publicHolidays.year, year));

  if (existing.length > 0) return;

  const res = await fetch(
    `https://date.nager.at/api/v3/PublicHolidays/${year}/CH`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch holidays: ${res.status}`);
  }

  const holidays: NagerHoliday[] = await res.json();

  // Filter for Zurich: global holidays OR CH-ZH canton-specific
  const zhHolidays = holidays.filter(
    (h) => h.global === true || h.counties?.includes(`CH-${canton}`)
  );

  if (zhHolidays.length === 0) return;

  await db.insert(publicHolidays)
    .values(
      zhHolidays.map((h) => ({
        date: h.date,
        name: h.localName,
        canton,
        year,
        global: h.global ? 1 : 0,
      }))
    );
}

/**
 * Returns all holidays for the given year (canton ZH).
 * Fetches and caches if needed.
 */
export async function getHolidaysForYear(year: number): Promise<Holiday[]> {
  await ensureHolidaysCached(year);
  return db
    .select()
    .from(publicHolidays)
    .where(eq(publicHolidays.year, year));
}

/**
 * Returns a Set of holiday date strings for a given year.
 */
export async function getHolidayDateSet(year: number): Promise<Set<string>> {
  const holidays = await getHolidaysForYear(year);
  return new Set(holidays.map((h) => h.date));
}
