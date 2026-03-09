'use client';

import { cn } from '@/lib/utils';
import type { CalendarDay } from '@/types';

interface DayCellProps {
  day: CalendarDay;
  isInRange?: boolean;
  onCellMouseDown?: (e: React.MouseEvent) => void;
  onCellMouseEnter?: (e: React.MouseEvent) => void;
  onCellMouseUp?: (e: React.MouseEvent) => void;
}

function getTodayISO(): string {
  // Use local date to avoid UTC timezone issues
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const TODAY = getTodayISO();

export function DayCell({
  day,
  isInRange = false,
  onCellMouseDown,
  onCellMouseEnter,
  onCellMouseUp,
}: DayCellProps) {
  const isInteractive = !day.isWeekend && !day.isHoliday && day.isCurrentMonth;
  const isDayOff = day.dayType === 'day_off';
  const isVacation = day.dayType === 'vacation';
  const isToday = day.date === TODAY;

  const dayNumber = parseInt(day.date.split('-')[2], 10);

  const projectColours = day.projectColours ?? [];
  // Render up to 3 project colour stripes on the left edge (4px each, stacked vertically)
  const stripeColours = projectColours.slice(0, 3);
  const stripeHeight = stripeColours.length > 0 ? `${100 / stripeColours.length}%` : '0%';

  return (
    <div
      role={isInteractive ? 'button' : 'gridcell'}
      tabIndex={isInteractive ? 0 : -1}
      aria-label={
        isInteractive
          ? `${day.date}: ${day.dayType}. Click to toggle.`
          : day.isHoliday
          ? `${day.date}: ${day.holidayName ?? 'Public holiday'}`
          : day.date
      }
      onMouseDown={isInteractive ? onCellMouseDown : undefined}
      onMouseEnter={onCellMouseEnter}
      onMouseUp={isInteractive ? onCellMouseUp : undefined}
      className={cn(
        'relative flex flex-col p-1 min-h-[60px] sm:min-h-[80px] rounded-sm border text-sm transition-colors overflow-hidden',
        // Not in current month
        !day.isCurrentMonth && 'opacity-30 bg-gray-50 border-gray-100',
        // Weekend
        day.isCurrentMonth && day.isWeekend &&
          'bg-slate-200 text-slate-400 border-slate-300 cursor-default',
        // Public holiday
        day.isCurrentMonth && day.isHoliday &&
          'bg-blue-100 border-blue-400 cursor-default',
        // Day off (structural schedule gap — amber/orange)
        day.isCurrentMonth && !day.isHoliday && isDayOff &&
          'bg-amber-100 border-amber-400 cursor-pointer hover:bg-amber-200',
        // Vacation
        day.isCurrentMonth && !day.isWeekend && !day.isHoliday && !isDayOff && isVacation &&
          'bg-green-100 border-green-400 cursor-pointer hover:bg-green-200',
        // Working (default) — subtle slate so cells are visible on white bg
        day.isCurrentMonth && !day.isWeekend && !day.isHoliday && !isDayOff && !isVacation &&
          'bg-slate-50 border-slate-200 cursor-pointer hover:bg-slate-100',
        // Drag range highlight
        isInRange && 'ring-2 ring-indigo-400 ring-inset bg-indigo-50 border-indigo-300'
      )}
    >
      {/* Project colour stripes — 4px left border, stacked vertically */}
      {stripeColours.length > 0 && !day.isWeekend && day.isCurrentMonth && (
        <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col z-10">
          {stripeColours.map((colour, i) => (
            <div
              key={i}
              style={{ backgroundColor: colour, height: stripeHeight }}
            />
          ))}
        </div>
      )}

      {/* Today indicator — indigo dot top-right */}
      {isToday && day.isCurrentMonth && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
      )}

      <span
        className={cn(
          'font-medium text-xs sm:text-sm',
          isToday && day.isCurrentMonth && 'text-indigo-700 font-bold',
          day.isHoliday && 'text-blue-700',
          isDayOff && !day.isHoliday && 'text-amber-700',
          isVacation && !day.isHoliday && !isDayOff && 'text-green-700'
        )}
      >
        {dayNumber}
      </span>

      {day.isHoliday && day.holidayName && (
        <span className="text-xs text-blue-600 leading-tight mt-0.5 hidden sm:block truncate">
          {day.holidayName}
        </span>
      )}

      {/* Vacation: dot on mobile, label on sm+ */}
      {day.isCurrentMonth && !day.isWeekend && !day.isHoliday && isVacation && (
        <>
          <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-green-500 sm:hidden" />
          <span className="text-xs text-green-600 mt-0.5 hidden sm:block">🌴 Vacation</span>
        </>
      )}

      {/* Day off: dot on mobile, label on sm+ */}
      {day.isCurrentMonth && !day.isHoliday && isDayOff && (
        <>
          <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-amber-500 sm:hidden" />
          <span className="text-xs text-amber-600 mt-0.5 hidden sm:block">🔕 Day off</span>
        </>
      )}
    </div>
  );
}
