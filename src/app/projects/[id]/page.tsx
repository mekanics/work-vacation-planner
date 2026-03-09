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
import { getHolidaysForYear, getHolidayDateSet } from '@/lib/services/holidays';
import {
  getProject,
  getProjectOverrides,
  calculateProjectWorkingDays,
} from '@/lib/services/projects';
import { computeIsProjectDay, computeIsIncluded } from '@/lib/utils/projectCalendar';
import { getNextWorkingDay, getDaysRemainingThisYear } from '@/lib/utils/projectUtils';
import { ProjectDetail } from '@/components/projects/ProjectDetail';
import type { ProjectCalendarDay } from '@/components/projects/ProjectMonthGrid';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}

export default async function ProjectDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { tab: tabParam, month: monthParam } = await searchParams;

  const project = await getProject(id);
  if (!project) notFound();

  const now = new Date();
  const currentYear = now.getFullYear();
  const yearFrom = `${currentYear}-01-01`;
  const yearTo = `${currentYear}-12-31`;

  // Fetch base data in parallel
  const [yearSummary, overrides, holidaySet] = await Promise.all([
    calculateProjectWorkingDays(id, yearFrom, yearTo),
    getProjectOverrides(id),
    getHolidayDateSet(currentYear),
  ]);

  const yearWorkingDays = yearSummary?.working_days ?? 0;

  // Compute days remaining (today → Dec 31, exclusive of today)
  const daysRemaining = getDaysRemainingThisYear(project, overrides, now, holidaySet);

  // Compute next working day (after today)
  const nextWorkingDay = getNextWorkingDay(project, overrides, now, holidaySet);

  // Determine active tab and month
  const initialTab = tabParam === 'calendar' ? 'calendar' : 'overview';
  const initialMonth = monthParam ?? format(now, 'yyyy-MM');

  // Conditionally fetch calendar data when tab=calendar
  let calendarDays: ProjectCalendarDay[] | undefined;
  let calendarSummary = null;

  if (initialTab === 'calendar' && initialMonth) {
    const [yearStr, monthStr] = initialMonth.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const monthStart = startOfMonth(new Date(year, month - 1, 1));
      const monthEnd = endOfMonth(monthStart);

      const from = format(monthStart, 'yyyy-MM-dd');
      const to = format(monthEnd, 'yyyy-MM-dd');

      // Build calendar grid (Monday-first)
      const startDow = getDay(monthStart);
      const offset = startDow === 0 ? 6 : startDow - 1;
      const gridStart = subDays(monthStart, offset);
      const gridEnd = addDays(
        monthEnd,
        6 - ((getDay(monthEnd) === 0 ? 7 : getDay(monthEnd)) - 1)
      );

      const [calHolidays, dayRows] = await Promise.all([
        getHolidaysForYear(year),
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

      const holidayMap = new Map(calHolidays.map((h) => [h.date, h.name]));
      const vacationSet = new Set(
        dayRows.filter((d) => d.dayType === 'vacation').map((d) => d.date)
      );
      const includeOverrides = new Set(
        overrides.filter((o) => o.type === 'include').map((o) => o.date)
      );
      const excludeOverrides = new Set(
        overrides.filter((o) => o.type === 'exclude').map((o) => o.date)
      );

      const gridDates = eachDayOfInterval({ start: gridStart, end: gridEnd });

      calendarDays = gridDates.map((date) => {
        const iso = format(date, 'yyyy-MM-dd');
        const dow = getDay(date);
        const isCurrentMonth = isSameMonth(date, monthStart);
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
          isWeekend: dow === 0 || dow === 6,
          isHoliday,
          holidayName: holidayMap.get(iso),
          isVacation,
          isProjectDay,
          isIncluded,
          overrideType,
        };
      });

      calendarSummary = await calculateProjectWorkingDays(id, from, to);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/projects"
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          ← Projects
        </Link>
      </div>

      <ProjectDetail
        project={project}
        yearWorkingDays={yearWorkingDays}
        daysRemaining={daysRemaining}
        nextWorkingDay={nextWorkingDay}
        overrides={overrides}
        initialTab={initialTab}
        initialMonth={initialMonth}
        calendarDays={calendarDays}
        calendarSummary={calendarSummary}
      />
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  return {
    title: `${project?.name ?? 'Project'} · Work Planner`,
  };
}
