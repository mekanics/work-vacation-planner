'use client';

import { useRouter } from 'next/navigation';
import { getISOWeek } from 'date-fns';
import { cn } from '@/lib/utils';

export interface ProjectCalendarDay {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isVacation: boolean;
  isProjectDay: boolean;   // in mask range, before overrides
  isIncluded: boolean;     // final state after overrides
  overrideType?: 'include' | 'exclude';
}

interface ProjectMonthGridProps {
  days: ProjectCalendarDay[];
  projectId: string;
  projectColour: string;
  year: number;
  month: number;
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function groupByWeeks(days: ProjectCalendarDay[]): ProjectCalendarDay[][] {
  const weeks: ProjectCalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function ProjectMonthGrid({
  days,
  projectId,
  projectColour,
}: ProjectMonthGridProps) {
  const router = useRouter();

  const handleToggle = async (day: ProjectCalendarDay) => {
    if (!day.isCurrentMonth || day.isHoliday || day.isVacation) return;

    if (day.isIncluded) {
      if (day.overrideType === 'include') {
        // Included via an explicit include override → DELETE to revert to mask
        await fetch(`/api/projects/${projectId}/overrides/${day.date}`, {
          method: 'DELETE',
        });
      } else {
        // Included by mask → POST exclude
        await fetch(`/api/projects/${projectId}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: day.date, type: 'exclude' }),
        });
      }
    } else {
      if (day.overrideType === 'exclude') {
        // Excluded via an explicit exclude override → DELETE to revert to mask
        await fetch(`/api/projects/${projectId}/overrides/${day.date}`, {
          method: 'DELETE',
        });
      } else {
        // Excluded by mask → POST include
        await fetch(`/api/projects/${projectId}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: day.date, type: 'include' }),
        });
      }
    }

    router.refresh();
  };

  const weeks = groupByWeeks(days);

  return (
    <div className="w-full select-none" onMouseDown={(e) => e.preventDefault()}>
      {/* Header */}
      <div className="flex gap-1 mb-1">
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 grid grid-cols-7 gap-1">
          {WEEKDAY_HEADERS.map((h) => (
            <div key={h} className="text-center text-xs font-semibold text-gray-500 py-2">
              {h}
            </div>
          ))}
        </div>
      </div>

      {/* Week rows */}
      {weeks.map((week, wi) => {
        const repDay = week.find((d) => d.isCurrentMonth) ?? week[3];
        const weekNum = getISOWeek(new Date(repDay.date + 'T00:00:00'));

        return (
          <div key={wi} className="flex gap-1 mb-1">
            {/* Week number */}
            <div className="w-8 flex-shrink-0 flex items-center justify-center text-xs text-gray-400">
              {weekNum}
            </div>

            {/* Day cells */}
            <div className="flex-1 grid grid-cols-7 gap-1">
              {week.map((day) => {
                const isClickable =
                  day.isCurrentMonth && !day.isHoliday && !day.isVacation;
                const isExcludeOverride = day.overrideType === 'exclude';
                const isIncludeOverride = day.overrideType === 'include';

                return (
                  <button
                    key={day.date}
                    type="button"
                    disabled={!isClickable}
                    onClick={() => void handleToggle(day)}
                    aria-label={
                      day.isHoliday
                        ? `${day.date}: ${day.holidayName ?? 'Public holiday'}`
                        : day.isVacation
                        ? `${day.date}: Vacation`
                        : `${day.date}: ${day.isIncluded ? 'Project day (click to exclude)' : 'Not a project day (click to include)'}`
                    }
                    className={cn(
                      'relative flex flex-col items-end justify-end p-1 min-h-[60px] sm:min-h-[80px] rounded-sm border text-sm transition-colors overflow-hidden',
                      // Out-of-month
                      !day.isCurrentMonth && 'opacity-30 bg-gray-50 border-gray-100 cursor-default',
                      // Holiday (wins over project colour)
                      day.isCurrentMonth && day.isHoliday && 'bg-blue-100 border-blue-400 cursor-default',
                      // Vacation (wins over project colour)
                      day.isCurrentMonth && !day.isHoliday && day.isVacation && 'bg-green-100 border-green-400 cursor-default',
                      // Project day — included
                      day.isCurrentMonth && !day.isHoliday && !day.isVacation && day.isIncluded &&
                        'border-2 cursor-pointer hover:opacity-80',
                      // Project day — excluded
                      day.isCurrentMonth && !day.isHoliday && !day.isVacation && !day.isIncluded && day.isProjectDay &&
                        'bg-gray-100 border-gray-200 cursor-pointer hover:bg-gray-50',
                      // Non-project day (not in mask, no override)
                      day.isCurrentMonth && !day.isHoliday && !day.isVacation && !day.isIncluded && !day.isProjectDay &&
                        'bg-gray-50 border-gray-100 cursor-pointer hover:bg-gray-100',
                    )}
                    style={
                      day.isCurrentMonth && !day.isHoliday && !day.isVacation && day.isIncluded
                        ? { backgroundColor: `${projectColour}25`, borderColor: projectColour }
                        : undefined
                    }
                  >
                    {/* Override indicator badge */}
                    {day.isCurrentMonth && (isExcludeOverride || isIncludeOverride) && (
                      <span
                        className={cn(
                          'absolute top-1 left-1 w-2 h-2 rounded-full',
                          isIncludeOverride ? 'bg-emerald-500' : 'bg-red-400'
                        )}
                        title={isIncludeOverride ? 'Include override' : 'Exclude override'}
                      />
                    )}

                    {/* Holiday label */}
                    {day.isCurrentMonth && day.isHoliday && day.holidayName && (
                      <span className="absolute top-1 left-1 right-1 text-xs text-blue-600 leading-tight hidden sm:block truncate">
                        {day.holidayName}
                      </span>
                    )}

                    {/* Vacation label */}
                    {day.isCurrentMonth && day.isVacation && (
                      <span className="text-xs text-green-600 hidden sm:block">🌴</span>
                    )}

                    {/* Day number */}
                    <span
                      className={cn(
                        'font-medium text-xs sm:text-sm mt-auto',
                        day.isHoliday && 'text-blue-700',
                        day.isVacation && !day.isHoliday && 'text-green-700',
                        day.isCurrentMonth && !day.isHoliday && !day.isVacation && day.isIncluded && 'font-bold',
                        !day.isCurrentMonth && 'text-gray-300',
                      )}
                    >
                      {day.dayOfMonth}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded-sm border-2"
            style={{ backgroundColor: `${projectColour}25`, borderColor: projectColour }}
          />
          <span>Project day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" />
          <span>Excluded from project</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
          <span>Include override</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          <span>Exclude override</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-blue-100 border border-blue-400" />
          <span>Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-green-100 border border-green-400" />
          <span>Vacation</span>
        </div>
      </div>
    </div>
  );
}
