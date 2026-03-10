export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { and, gte, lte } from 'drizzle-orm';
import { format, eachDayOfInterval, getDay, parseISO } from 'date-fns';
import { getHolidaysForYear } from '@/lib/services/holidays';
import { getNonWorkingWeekdays } from '@/lib/services/settings';
import { getProjects, getOverridesForProjects } from '@/lib/services/projects';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const yearFrom = `${year}-01-01`;
  const yearTo = `${year}-12-31`;

  // Fetch all the data we need in parallel
  const [holidays, dayRows, allProjects, nonWorkingWeekdays] = await Promise.all([
    getHolidaysForYear(year),
    db.select().from(days).where(and(gte(days.date, yearFrom), lte(days.date, yearTo))),
    getProjects(),
    getNonWorkingWeekdays(),
  ]);

  const holidayMap = new Map(holidays.map((h) => [h.date, h.name]));
  const dayMap = new Map(dayRows.map((d) => [d.date, d.dayType]));
  const nonWorkingSet = new Set(nonWorkingWeekdays);

  // Build project override lookup
  const projectIds = allProjects.map((p) => p.id);
  const overridesMap = await getOverridesForProjects(projectIds);

  const projectOverrideSets = new Map<string, { includes: Set<string>; excludes: Set<string> }>();
  for (const project of allProjects) {
    const overrides = overridesMap.get(project.id) ?? [];
    projectOverrideSets.set(project.id, {
      includes: new Set(overrides.filter((o) => o.type === 'include').map((o) => o.date)),
      excludes: new Set(overrides.filter((o) => o.type === 'exclude').map((o) => o.date)),
    });
  }

  // Build CSV rows
  const rows: string[] = ['Date,DayOfWeek,Type,Holiday Name,Projects'];

  const allDates = eachDayOfInterval({
    start: parseISO(yearFrom),
    end: parseISO(yearTo),
  });

  for (const date of allDates) {
    const iso = format(date, 'yyyy-MM-dd');
    const dow = getDay(date); // 0=Sun, 6=Sat
    const isWeekendDay = dow === 0 || dow === 6;
    const isNonWorkingWeekday = !isWeekendDay && nonWorkingSet.has(dow);
    const isHoliday = holidayMap.has(iso);
    const holidayName = holidayMap.get(iso) ?? '';
    const storedType = dayMap.get(iso);
    const isVacation = storedType === 'vacation';
    const isWorkingWeekend = storedType === 'working_weekend';

    // Determine type string
    let type: string;
    if (isWeekendDay && !isWorkingWeekend) continue; // skip regular weekends
    if (isNonWorkingWeekday) {
      type = 'Non-working weekday';
    } else if (isWorkingWeekend) {
      type = 'Working Weekend';
    } else if (isHoliday) {
      type = 'Holiday';
    } else if (isVacation) {
      type = 'Vacation';
    } else {
      type = 'Working';
    }

    // Determine active projects for this day
    const activeProjectNames: string[] = [];
    if (!isNonWorkingWeekday && !isWeekendDay || isWorkingWeekend) {
      for (const project of allProjects) {
        if (project.startDate && iso < project.startDate) continue;
        if (project.endDate && iso > project.endDate) continue;

        const sets = projectOverrideSets.get(project.id)!;
        const hasExclude = sets.excludes.has(iso);
        const hasInclude = sets.includes.has(iso);
        const matchesMask = project.weekdays.includes(dow) && !hasExclude;

        if (matchesMask || hasInclude) {
          activeProjectNames.push(project.name);
        }
      }
    }

    // Escape CSV fields
    const csvHolidayName = holidayName.includes(',')
      ? `"${holidayName.replace(/"/g, '""')}"`
      : holidayName;
    const csvProjects = activeProjectNames.join('; ');
    const csvProjectsField = csvProjects.includes(',')
      ? `"${csvProjects.replace(/"/g, '""')}"`
      : csvProjects;

    rows.push(`${iso},${DAY_NAMES[dow]},${type},${csvHolidayName},${csvProjectsField}`);
  }

  const csv = rows.join('\r\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="work-planner-${year}.csv"`,
    },
  });
}
