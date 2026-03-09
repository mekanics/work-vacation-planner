import { db } from '@/lib/db';
import { days, projects } from '@/lib/db/schema';
import { and, eq, gte, lte, or } from 'drizzle-orm';
import { eachDayInRange, toISODate } from '@/lib/utils/dates';
import { getHolidayDateSet } from './holidays';
import { getDay, getYear, parseISO } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectRecord {
  id: string;
  name: string;
  colour: string;
  startDate: string | null;
  endDate: string | null;
  weekdays: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWorkingDaySummary {
  project_id: string;
  project_name: string;
  from: string;
  to: string;
  total_project_days: number;
  holidays: number;
  vacation_days: number;
  working_days: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseWeekdays(raw: string): number[] {
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

function rowToRecord(row: typeof projects.$inferSelect): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    colour: row.colour,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    weekdays: parseWeekdays(row.weekdays),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/** Fetch all projects from DB, ordered by creation date. */
export async function getProjects(): Promise<ProjectRecord[]> {
  const rows = await db.select().from(projects);
  return rows.map(rowToRecord);
}

/** Fetch a single project by ID. Returns null if not found. */
export async function getProject(id: string): Promise<ProjectRecord | null> {
  const rows = await db.select().from(projects).where(eq(projects.id, id));
  return rows.length > 0 ? rowToRecord(rows[0]) : null;
}

/**
 * Calculate working days for a project within a date range.
 *
 * Logic:
 * 1. Clamp [from, to] to the project's date range (if set)
 * 2. Count dates that match the project's weekday mask
 * 3. Subtract public holidays on those days
 * 4. Subtract global vacation days (day_type = 'vacation') on those days
 */
export async function calculateProjectWorkingDays(
  projectId: string,
  from: string,
  to: string
): Promise<ProjectWorkingDaySummary | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  // Clamp to project date range
  const effectiveFrom = project.startDate && project.startDate > from ? project.startDate : from;
  const effectiveTo = project.endDate && project.endDate < to ? project.endDate : to;

  if (effectiveFrom > effectiveTo) {
    return {
      project_id: project.id,
      project_name: project.name,
      from,
      to,
      total_project_days: 0,
      holidays: 0,
      vacation_days: 0,
      working_days: 0,
    };
  }

  const allDates = eachDayInRange(effectiveFrom, effectiveTo);
  const weekdaySet = new Set(project.weekdays);

  // Collect years in range for holiday caching
  const years = [...new Set(allDates.map((d) => getYear(d)))];
  const holidaySets = await Promise.all(years.map(getHolidayDateSet));
  const holidayDateSet = new Set<string>(holidaySets.flatMap((s) => [...s]));

  // Fetch vacation days in effective range from DB
  const dayRows = await db
    .select()
    .from(days)
    .where(
      and(
        gte(days.date, effectiveFrom),
        lte(days.date, effectiveTo),
        eq(days.dayType, 'vacation')
      )
    );
  const vacationSet = new Set(dayRows.map((r) => r.date));

  let totalProjectDays = 0;
  let holidays = 0;
  let vacationDays = 0;

  for (const date of allDates) {
    const iso = toISODate(date);
    const dow = getDay(date); // 0=Sun, 1=Mon, ..., 6=Sat

    if (!weekdaySet.has(dow)) continue;

    totalProjectDays++;

    const isHoliday = holidayDateSet.has(iso);
    const isVacation = vacationSet.has(iso);

    if (isHoliday) {
      holidays++;
    } else if (isVacation) {
      vacationDays++;
    }
  }

  const working_days = Math.max(0, totalProjectDays - holidays - vacationDays);

  return {
    project_id: project.id,
    project_name: project.name,
    from,
    to,
    total_project_days: totalProjectDays,
    holidays,
    vacation_days: vacationDays,
    working_days,
  };
}
