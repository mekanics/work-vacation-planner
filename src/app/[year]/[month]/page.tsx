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
import { calculateWorkingDays } from '@/lib/services/working-days';
import { getProjects, getOverridesForProjects } from '@/lib/services/projects';
import { MonthGrid } from '@/components/calendar/MonthGrid';
import { MonthNav } from '@/components/calendar/MonthNav';
import { SummaryBar } from '@/components/summary/SummaryBar';
import type { CalendarDay, ProjectStripe } from '@/types';

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

export default async function MonthPage({ params }: PageProps) {
  const { year: yearStr, month: monthStr } = await params;

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 2000 || year > 2100) {
    notFound();
  }

  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  // Get holidays for this year (and adjacent months if needed)
  const holidays = await getHolidaysForYear(year);
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));

  // Get custom day records for this month range
  const from = format(monthStart, 'yyyy-MM-dd');
  const to = format(monthEnd, 'yyyy-MM-dd');

  // Also fetch days from adjacent months that appear in the calendar grid
  // Build calendar grid: weeks starting Monday
  const startDow = getDay(monthStart); // 0=Sun, 1=Mon, ...
  // Convert to Monday-based (Mon=0, ... Sun=6)
  const offset = startDow === 0 ? 6 : startDow - 1;

  // Grid start and end dates
  const gridStart = subDays(monthStart, offset);
  const gridEnd = addDays(monthEnd, 6 - ((getDay(monthEnd) === 0 ? 7 : getDay(monthEnd)) - 1));
  const gridStartStr = format(gridStart, 'yyyy-MM-dd');
  const gridEndStr = format(gridEnd, 'yyyy-MM-dd');

  const dayRows = await db
    .select()
    .from(days)
    .where(and(gte(days.date, gridStartStr), lte(days.date, gridEndStr)));

  const dayMap = new Map(dayRows.map((d) => [d.date, d.dayType]));

  // Build calendar days grid
  const gridDates = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const calendarDays: CalendarDay[] = gridDates.map((date) => {
    const iso = format(date, 'yyyy-MM-dd');
    const dow = getDay(date); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidayMap.has(iso);
    const storedType = dayMap.get(iso);
    const dayType =
      storedType === 'vacation' ? 'vacation' :
      storedType === 'day_off' ? 'day_off' : 'working';

    return {
      date: iso,
      dayType,
      isWeekend,
      isHoliday,
      holidayName: holidayMap.get(iso),
      isCurrentMonth: isSameMonth(date, monthStart),
    };
  });

  // Load projects + their overrides for colour enrichment
  const allProjects = await getProjects();
  const projectIds = allProjects.map((p) => p.id);
  const overridesMap = await getOverridesForProjects(projectIds);

  // Build per-project override sets for fast lookup
  const projectOverrideSets = new Map<string, { includes: Set<string>; excludes: Set<string> }>();
  for (const project of allProjects) {
    const overrides = overridesMap.get(project.id) ?? [];
    projectOverrideSets.set(project.id, {
      includes: new Set(overrides.filter((o) => o.type === 'include').map((o) => o.date)),
      excludes: new Set(overrides.filter((o) => o.type === 'exclude').map((o) => o.date)),
    });
  }

  // Enrich each calendar day with active project stripes
  const enrichedCalendarDays: CalendarDay[] = calendarDays.map((day) => {
    if (!day.isCurrentMonth) return day;

    const dow = getDay(new Date(day.date + 'T12:00:00')); // 0=Sun, 1=Mon, ..., 6=Sat
    const projectStripes: ProjectStripe[] = [];

    for (const project of allProjects) {
      // Check date range
      if (project.startDate && day.date < project.startDate) continue;
      if (project.endDate && day.date > project.endDate) continue;

      const sets = projectOverrideSets.get(project.id)!;
      const matchesMask = project.weekdays.includes(dow) && !sets.excludes.has(day.date);
      const explicitlyIncluded = sets.includes.has(day.date);

      // Show stripe if the project has any relevance to this day (included or excluded by override)
      const included = matchesMask || explicitlyIncluded;
      const hasExcludeOverride = sets.excludes.has(day.date);

      // Always show stripe for days in range:
      // - solid (included=true) when it's a project day
      // - dashed hint (included=false) when excluded by override or mask miss on a weekday
      // For weekends: only show hint if there's an explicit exclude (to avoid clutter)
      if (included) {
        projectStripes.push({ projectId: project.id, colour: project.colour, included: true });
      } else if (!day.isWeekend) {
        // Show a faint hint: mask miss or excluded override
        projectStripes.push({ projectId: project.id, colour: project.colour, included: false });
      } else if (hasExcludeOverride) {
        // Weekend with explicit exclude — shouldn't normally happen, but show hint
        projectStripes.push({ projectId: project.id, colour: project.colour, included: false });
      }
    }

    // Back-compat: also populate projectColours for components that still use it
    const projectColours = projectStripes.filter((s) => s.included).map((s) => s.colour);

    return { ...day, projectStripes, projectColours };
  });

  // Get month summary for stats
  const summary = await calculateWorkingDays(from, to);

  const monthLabel = format(monthStart, 'MMMM yyyy');

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back link */}
      <div className="mb-4">
        <Link href={`/${year}`} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← {year} overview
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{monthLabel}</h1>
          <p className="text-xs text-gray-400 mt-1">
            Click to toggle · drag for range · shift-click · week № = whole week
          </p>
        </div>
        <MonthNav year={year} month={month} />
      </div>

      {/* Summary bar */}
      <div className="mb-6">
        <SummaryBar
          working={summary.working_days}
          vacation={summary.vacation_days}
          holidays={summary.public_holidays}
          weekdays={summary.weekdays}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-white border border-gray-200" />
          <span>Working day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-400" />
          <span>Vacation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-400" />
          <span>Day off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400" />
          <span>Public holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
          <span>Weekend</span>
        </div>
      </div>

      {/* Project legend */}
      {allProjects.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3 text-xs">
          {allProjects.map((project) => (
            <div key={project.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: project.colour }}
              />
              <span className="text-gray-600">{project.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <MonthGrid days={enrichedCalendarDays} year={year} month={month} />
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { year, month } = await params;
  const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
  return {
    title: `${format(monthStart, 'MMMM yyyy')} · Work Planner`,
  };
}
