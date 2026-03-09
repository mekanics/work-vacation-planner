import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  isSameMonth,
  subDays,
  addDays,
} from 'date-fns';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { and, gte, lte } from 'drizzle-orm';
import { getHolidaysForYear } from '@/lib/services/holidays';
import { getProject, getProjectOverrides } from '@/lib/services/projects';
import { calculateProjectWorkingDays } from '@/lib/services/projects';
import { computeIsProjectDay, computeIsIncluded } from '@/lib/utils/projectCalendar';
import { ProjectMonthGrid } from '@/components/projects/ProjectMonthGrid';
import type { ProjectCalendarDay } from '@/components/projects/ProjectMonthGrid';
import { MonthNav } from '@/components/calendar/MonthNav';

interface PageProps {
  params: Promise<{
    id: string;
    year: string;
    month: string;
  }>;
}

export default async function ProjectMonthPage({ params }: PageProps) {
  const { id, year: yearStr, month: monthStr } = await params;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    notFound();
  }

  const project = await getProject(id);
  if (!project) notFound();

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const from = format(monthStart, 'yyyy-MM-dd');
  const to = format(monthEnd, 'yyyy-MM-dd');

  // Build calendar grid (Monday-first)
  const startDow = getDay(monthStart);
  const offset = startDow === 0 ? 6 : startDow - 1;
  const gridStart = subDays(monthStart, offset);
  const gridEnd = addDays(monthEnd, 6 - ((getDay(monthEnd) === 0 ? 7 : getDay(monthEnd)) - 1));

  // Fetch dependencies in parallel
  const [holidays, overrides, dayRows] = await Promise.all([
    getHolidaysForYear(year),
    getProjectOverrides(id),
    db
      .select()
      .from(days)
      .where(
        and(
          gte(days.date, format(gridStart, 'yyyy-MM-dd')),
          lte(days.date, format(gridEnd, 'yyyy-MM-dd'))
        )
      ),
  ]);

  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));
  const vacationSet = new Set(dayRows.filter((d) => d.dayType === 'vacation').map((d) => d.date));
  const includeOverrides = new Set(overrides.filter((o) => o.type === 'include').map((o) => o.date));
  const excludeOverrides = new Set(overrides.filter((o) => o.type === 'exclude').map((o) => o.date));

  const gridDates = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const calendarDays: ProjectCalendarDay[] = gridDates.map((date) => {
    const iso = format(date, 'yyyy-MM-dd');
    const dow = getDay(date);
    const isCurrentMonth = isSameMonth(date, monthStart);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidayMap.has(iso);
    const isVacation = vacationSet.has(iso);
    const isProjectDay = computeIsProjectDay(iso, project);
    const hasIncludeOverride = includeOverrides.has(iso);
    const hasExcludeOverride = excludeOverrides.has(iso);
    const isIncluded = computeIsIncluded(isProjectDay, hasIncludeOverride, hasExcludeOverride);
    const overrideType: 'include' | 'exclude' | undefined = hasIncludeOverride
      ? 'include'
      : hasExcludeOverride
      ? 'exclude'
      : undefined;

    return {
      date: iso,
      dayOfMonth: parseInt(iso.split('-')[2], 10),
      isCurrentMonth,
      isWeekend,
      isHoliday,
      holidayName: holidayMap.get(iso),
      isVacation,
      isProjectDay,
      isIncluded,
      overrideType,
    };
  });

  // Month summary
  const summary = await calculateProjectWorkingDays(id, from, to);

  // Prev / next month links (within project view)
  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prevHref = `/projects/${id}/${prevDate.getFullYear()}/${prevDate.getMonth() + 1}`;
  const nextHref = `/projects/${id}/${nextDate.getFullYear()}/${nextDate.getMonth() + 1}`;

  const monthLabel = format(monthStart, 'MMMM yyyy');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/projects"
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Back to projects
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: project.colour }}
            />
            <span className="text-sm text-gray-500">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{monthLabel}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Click a day to toggle include / exclude override
          </p>
        </div>

        {/* Month nav — stays within /projects/[id]/... */}
        <nav className="flex items-center gap-2" aria-label="Month navigation">
          <Link
            href={prevHref}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </Link>
          <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
            {monthLabel}
          </span>
          <Link
            href={nextHref}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            Next →
          </Link>
        </nav>
      </div>

      {/* Month summary bar */}
      {summary && (
        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: project.colour }}
            />
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{summary.working_days}</span>
              {' '}project working days
            </span>
          </div>
          {summary.holidays > 0 && (
            <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 text-gray-600">
              <span className="font-semibold text-gray-900">{summary.holidays}</span>
              {' '}holidays
            </div>
          )}
          {summary.vacation_days > 0 && (
            <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 text-gray-600">
              <span className="font-semibold text-gray-900">{summary.vacation_days}</span>
              {' '}vacation days
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      <ProjectMonthGrid
        days={calendarDays}
        projectId={id}
        projectColour={project.colour}
        year={year}
        month={month}
      />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id, year, month } = await params;
  const project = await getProject(id);
  const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
  return {
    title: `${project?.name ?? 'Project'} · ${format(monthStart, 'MMMM yyyy')} · Work Planner`,
  };
}
