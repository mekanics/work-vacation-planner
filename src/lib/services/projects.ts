import { db } from '@/lib/db';
import { days, projects, projectDayOverrides } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { eachDayInRange, toISODate } from '@/lib/utils/dates';
import { getHolidayDateSet } from './holidays';
import { getDay, getYear } from 'date-fns';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProjectDayOverride {
  projectId: string;
  date: string;
  type: 'include' | 'exclude';
}

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

/** Fetch all overrides for a project. */
export async function getProjectOverrides(projectId: string): Promise<ProjectDayOverride[]> {
  const rows = await db
    .select()
    .from(projectDayOverrides)
    .where(eq(projectDayOverrides.projectId, projectId));
  return rows.map((r) => ({
    projectId: r.projectId,
    date: r.date,
    type: r.type as 'include' | 'exclude',
  }));
}

/** Fetch all overrides for multiple projects at once (keyed by projectId). */
export async function getOverridesForProjects(
  projectIds: string[]
): Promise<Map<string, ProjectDayOverride[]>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db.select().from(projectDayOverrides);
  const result = new Map<string, ProjectDayOverride[]>();
  for (const row of rows) {
    if (!projectIds.includes(row.projectId)) continue;
    const overrides = result.get(row.projectId) ?? [];
    overrides.push({ projectId: row.projectId, date: row.date, type: row.type as 'include' | 'exclude' });
    result.set(row.projectId, overrides);
  }
  return result;
}

/** Upsert (insert or replace) a day override. */
export async function upsertProjectOverride(
  projectId: string,
  date: string,
  type: 'include' | 'exclude'
): Promise<void> {
  // SQLite upsert via insert … on conflict replace
  await db
    .insert(projectDayOverrides)
    .values({ projectId, date, type })
    .onConflictDoUpdate({
      target: [projectDayOverrides.projectId, projectDayOverrides.date],
      set: { type },
    });
}

/** Delete a day override (reverts the day to mask default). */
export async function deleteProjectOverride(projectId: string, date: string): Promise<void> {
  await db
    .delete(projectDayOverrides)
    .where(
      and(
        eq(projectDayOverrides.projectId, projectId),
        eq(projectDayOverrides.date, date)
      )
    );
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

  // Fetch per-project day overrides
  const overrides = await getProjectOverrides(projectId);
  const includeOverrides = new Set(overrides.filter((o) => o.type === 'include').map((o) => o.date));
  const excludeOverrides = new Set(overrides.filter((o) => o.type === 'exclude').map((o) => o.date));

  let totalProjectDays = 0;
  let holidays = 0;
  let vacationDays = 0;

  for (const date of allDates) {
    const iso = toISODate(date);
    const dow = getDay(date); // 0=Sun, 1=Mon, ..., 6=Sat

    // A date counts if: (matches weekday mask AND not excluded) OR (explicitly included)
    // In both cases, the date must be within the effective range (already guaranteed by allDates).
    const matchesMask = weekdaySet.has(dow) && !excludeOverrides.has(iso);
    const explicitlyIncluded = includeOverrides.has(iso);

    if (!matchesMask && !explicitlyIncluded) continue;

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
