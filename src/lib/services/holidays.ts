import { db } from '@/lib/db';
import { publicHolidays, settings } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// ─── openholidays.org API types ──────────────────────────────────────────────

interface OpenHolidayName {
  language: string;
  text: string;
}

interface OpenHolidaySubdivision {
  code: string;
  shortName: string;
}

interface OpenHoliday {
  startDate: string;        // "YYYY-MM-DD"
  endDate: string;
  name: OpenHolidayName[];
  nationwide: boolean;
  subdivisions: OpenHolidaySubdivision[];
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface Holiday {
  date: string;
  name: string;
  canton: string;
  year: number;
  global: number;
}

// ─── Canton helpers ───────────────────────────────────────────────────────────

/**
 * Reads the active canton from the settings table.
 * Falls back to CANTON env var or 'ZH' if not set.
 * Special value 'CH' means nationwide-only (no canton-specific filtering).
 */
export async function getCantonSetting(): Promise<string> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, 'canton'))
      .get();
    return row?.value ?? process.env.CANTON ?? 'ZH';
  } catch {
    return process.env.CANTON ?? 'ZH';
  }
}

// ─── Sentinel helpers ─────────────────────────────────────────────────────────

function sentinelKey(year: number, canton: string): string {
  return `holidays_fetched_${year}_${canton}`;
}

async function getSentinel(year: number, canton: string): Promise<string | null> {
  try {
    const row = await db
      .select()
      .from(settings)
      .where(eq(settings.key, sentinelKey(year, canton)))
      .get();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSentinel(year: number, canton: string, value: 'ok' | 'unavailable'): Promise<void> {
  const key = sentinelKey(year, canton);
  await db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

// ─── Name helper ─────────────────────────────────────────────────────────────

function pickName(names: OpenHolidayName[]): string {
  return (
    names.find((n) => n.language === 'DE')?.text ??
    names[0]?.text ??
    'Unknown'
  );
}

// ─── Core service ─────────────────────────────────────────────────────────────

/**
 * Ensures holidays for the given year+canton are cached in the DB.
 * Fetches from openholidaysapi.org if not already stored.
 * Uses a sentinel in settings to avoid re-fetching unavailable years.
 */
export async function ensureHolidaysCached(year: number, canton?: string): Promise<void> {
  const activeCanton = canton ?? await getCantonSetting();

  // Check sentinel first — avoid any DB/API call for known states
  const sentinel = await getSentinel(year, activeCanton);
  if (sentinel === 'unavailable') return;
  if (sentinel === 'ok') return;

  // Check DB cache keyed by (year, canton)
  const existing = await db
    .select()
    .from(publicHolidays)
    .where(
      and(
        eq(publicHolidays.year, year),
        eq(publicHolidays.canton, activeCanton)
      )
    );

  if (existing.length > 0) {
    await setSentinel(year, activeCanton, 'ok');
    return;
  }

  // Fetch from openholidays.org
  const url =
    `https://openholidaysapi.org/PublicHolidays?countryIsoCode=CH&languageIsoCode=DE` +
    `&validFrom=${year}-01-01&validTo=${year}-12-31`;

  let holidays: OpenHoliday[];
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } } as RequestInit);
    if (!res.ok) {
      console.error(`openholidaysapi.org returned ${res.status} for year ${year}`);
      await setSentinel(year, activeCanton, 'unavailable');
      return;
    }
    holidays = await res.json();
  } catch (err) {
    console.error('Failed to fetch holidays:', err);
    await setSentinel(year, activeCanton, 'unavailable');
    return;
  }

  if (!Array.isArray(holidays) || holidays.length === 0) {
    await setSentinel(year, activeCanton, 'unavailable');
    return;
  }

  // Filter: nationwide OR canton match
  // Special canton 'CH' = nationwide only (no canton-specific filtering)
  const filtered = holidays.filter((h) => {
    if (h.nationwide) return true;
    if (activeCanton === 'CH') return false;
    return h.subdivisions?.some(
      (s) => s.code === `CH-${activeCanton}` || s.code.startsWith(`CH-${activeCanton}-`)
    );
  });

  if (filtered.length === 0) {
    await setSentinel(year, activeCanton, 'unavailable');
    return;
  }

  await db.insert(publicHolidays)
    .values(
      filtered.map((h) => ({
        date: h.startDate,
        name: pickName(h.name),
        canton: activeCanton,
        year,
        global: h.nationwide ? 1 : 0,
      }))
    )
    .onConflictDoNothing();

  await setSentinel(year, activeCanton, 'ok');
}

/**
 * Returns all holidays for the given year and canton.
 * Fetches and caches from openholidays.org if not already stored.
 */
export async function getHolidaysForYear(year: number, canton?: string): Promise<Holiday[]> {
  const activeCanton = canton ?? await getCantonSetting();
  await ensureHolidaysCached(year, activeCanton);
  return db
    .select()
    .from(publicHolidays)
    .where(
      and(
        eq(publicHolidays.year, year),
        eq(publicHolidays.canton, activeCanton)
      )
    );
}

/**
 * Returns a Set of holiday date strings for a given year.
 */
export async function getHolidayDateSet(year: number, canton?: string): Promise<Set<string>> {
  const holidays = await getHolidaysForYear(year, canton);
  return new Set(holidays.map((h) => h.date));
}
