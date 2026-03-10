export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, subDays, addDays } from 'date-fns';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { and, gte, lte } from 'drizzle-orm';
import { getHolidaysForYear } from '@/lib/services/holidays';
import { calculateWorkingDays } from '@/lib/services/working-days';
import { getNonWorkingWeekdays } from '@/lib/services/settings';
import { getProjects, calculateProjectWorkingDays } from '@/lib/services/projects';
import type { CalendarDay } from '@/types';

interface PageProps {
  params: Promise<{ year: string }>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DOT_COLORS: Record<string, string> = {
  vacation: 'bg-green-400',
  holiday: 'bg-blue-400',
  weekend: 'bg-gray-300',
  working: 'bg-gray-100',
  working_weekend: 'bg-orange-400',
};

interface MiniMonth {
  monthIdx: number; // 0–11
  days: CalendarDay[];
}

export default async function YearPage({ params }: PageProps) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr, 10);

  if (isNaN(year) || year < 2000 || year > 2100) {
    notFound();
  }

  // Fetch holidays
  const holidays = await getHolidaysForYear(year);
  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));

  // Non-working weekdays from settings
  const nonWorkingWeekdays = await getNonWorkingWeekdays();
  const nonWorkingWeekdaySet = new Set(nonWorkingWeekdays);

  // Fetch all day records for the entire year
  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;
  const dayRows = await db.select().from(days).where(
    and(gte(days.date, yearFrom), lte(days.date, yearTo))
  );
  const dayMap = new Map(dayRows.map((d) => [d.date, d.dayType]));

  // Year-level summary
  const yearSummary = await calculateWorkingDays(yearFrom, yearTo);

  // Fetch projects and their year-level working day counts
  const allProjects = await getProjects();
  const projectYearSummaries = await Promise.all(
    allProjects.map(async (project) => {
      const summary = await calculateProjectWorkingDays(project.id, yearFrom, yearTo);
      return { project, summary };
    })
  );

  // Build mini-calendars for all 12 months
  const miniMonths: MiniMonth[] = [];
  for (let m = 0; m < 12; m++) {
    const monthStart = startOfMonth(new Date(year, m, 1));
    const monthEnd = endOfMonth(monthStart);

    // Monday-based grid padding
    const startDow = getDay(monthStart);
    const offset = startDow === 0 ? 6 : startDow - 1;
    const gridStart = subDays(monthStart, offset);
    const endDow = getDay(monthEnd);
    const endOffset = endDow === 0 ? 0 : 7 - endDow;
    const gridEnd = addDays(monthEnd, endOffset);

    const gridDates = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const calDays: CalendarDay[] = gridDates.map((date) => {
      const iso = format(date, 'yyyy-MM-dd');
      const dow = getDay(date);
      const isWeekendDay = dow === 0 || dow === 6;
      const isNonWorkingWeekday = !isWeekendDay && nonWorkingWeekdaySet.has(dow);
      const isWeekend = isWeekendDay || isNonWorkingWeekday;
      const isHoliday = holidayMap.has(iso);
      const storedType = dayMap.get(iso);
      const dayType =
        storedType === 'vacation' ? 'vacation'
        : storedType === 'working_weekend' ? 'working_weekend'
        : 'working';

      return {
        date: iso,
        dayType,
        isWeekend,
        isHoliday,
        holidayName: holidayMap.get(iso),
        isCurrentMonth: isSameMonth(date, monthStart),
      };
    });

    miniMonths.push({ monthIdx: m, days: calDays });
  }

  const prevYear = year - 1;
  const nextYear = year + 1;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link href={`/${prevYear}`} className="text-gray-400 hover:text-gray-700 text-2xl px-2" title={`${prevYear}`}>‹</Link>
        <h1 className="text-3xl font-bold text-gray-900">{year}</h1>
        <Link href={`/${nextYear}`} className="text-gray-400 hover:text-gray-700 text-2xl px-2" title={`${nextYear}`}>›</Link>
      </div>

      {/* Export CSV */}
      <div className="flex justify-end mb-4">
        <a
          href={`/api/export?year=${year}`}
          download={`work-planner-${year}.csv`}
          className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
        >
          ↓ Export CSV
        </a>
      </div>

      {/* Year summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        <StatCard label="Working days" value={yearSummary.working_days} color="text-gray-900" />
        <StatCard label="Vacation days" value={yearSummary.vacation_days} color="text-green-700" />
        <StatCard label="Public holidays" value={yearSummary.public_holidays} color="text-blue-700" />
      </div>

      {/* Projects summary */}
      {projectYearSummaries.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">Projects</h2>
            <Link
              href="/projects"
              className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Manage →
            </Link>
          </div>
          <div className="bg-white border rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Project</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Project days</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Holidays</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Vacation</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 font-semibold">Working</th>
                </tr>
              </thead>
              <tbody>
                {projectYearSummaries.map(({ project, summary }) => (
                  <tr key={project.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: project.colour }}
                        />
                        <span className="font-medium text-gray-800">{project.name}</span>
                        {(project.startDate || project.endDate) && (
                          <span className="text-xs text-gray-400 hidden sm:block">
                            {project.startDate ?? '∞'} → {project.endDate ?? '∞'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">{summary?.total_project_days ?? 0}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{summary?.holidays ?? 0}</td>
                    <td className="px-3 py-2 text-right text-green-600">{summary?.vacation_days ?? 0}</td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{summary?.working_days ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 12-month grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {miniMonths.map(({ monthIdx, days: calDays }) => (
          <Link
            key={monthIdx}
            href={`/${year}/${monthIdx + 1}`}
            className="block border rounded p-3 hover:border-indigo-300 hover:shadow-sm transition-all bg-white"
          >
            <div className="text-sm font-semibold text-gray-700 mb-2">{MONTH_NAMES[monthIdx]}</div>
            {/* Mini weekday headers */}
            <div className="grid grid-cols-7 gap-px mb-1">
              {['M','T','W','T','F','S','S'].map((d, i) => (
                <div key={i} className="text-center text-gray-400" style={{ fontSize: '8px' }}>{d}</div>
              ))}
            </div>
            {/* Mini day dots — gap-0.5 for more readable cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {calDays.map((day) => {
                let dotColor: string;
                if (!day.isCurrentMonth) {
                  dotColor = 'bg-transparent';
                } else if (day.isHoliday) {
                  dotColor = DOT_COLORS.holiday;
                } else if (day.dayType === 'working_weekend') {
                  dotColor = DOT_COLORS.working_weekend;
                } else if (day.isWeekend) {
                  dotColor = DOT_COLORS.weekend;
                } else if (day.dayType === 'vacation') {
                  dotColor = DOT_COLORS.vacation;
                } else {
                  dotColor = DOT_COLORS.working;
                }
                return (
                  <div
                    key={day.date}
                    className={`w-full rounded-sm min-h-[5px] ${dotColor}`}
                    style={{ aspectRatio: '1' }}
                    title={day.date}
                  />
                );
              })}
            </div>
            {/* Working day count */}
            <div className="mt-2 text-xs text-gray-400">
              {calDays.filter(d => d.isCurrentMonth && (!d.isWeekend || d.dayType === 'working_weekend') && !d.isHoliday && d.dayType !== 'vacation').length} working days
            </div>
          </Link>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" /><span>Working</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-400" /><span>Vacation</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-blue-400" /><span>Holiday</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-gray-300" /><span>Weekend</span></div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-400" /><span>Working weekend</span></div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white border rounded p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { year } = await params;
  return { title: `${year} · Work Planner` };
}
