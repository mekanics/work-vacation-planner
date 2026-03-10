'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { CalendarDay, ProjectStripe } from '@/types';

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
  const router = useRouter();
  const isWorkingWeekend = day.dayType === 'working_weekend';
  const isVacation = day.dayType === 'vacation';
  // Weekdays (non-holiday) participate in drag-select
  const isInteractive = !day.isWeekend && !day.isHoliday && day.isCurrentMonth;
  // Holidays are clickable (single click only, not drag) to toggle vacation override
  const isHolidayClickable = day.isHoliday && day.isCurrentMonth;
  const isWeekendClickable = day.isWeekend && !day.isHoliday && day.isCurrentMonth;
  const isToday = day.date === TODAY;

  const dayNumber = parseInt(day.date.split('-')[2], 10);

  // Prefer rich stripe data; fall back to legacy projectColours for back-compat
  const projectStripes: ProjectStripe[] =
    day.projectStripes ??
    (day.projectColours ?? []).map((colour) => ({ projectId: '', projectName: '', colour, included: true }));

  // Render up to 3 project colour stripes on the left edge (active days only — excluded days show nothing)
  const visibleStripes = projectStripes.filter((s) => s.included).slice(0, 3);
  const stripeHeight = visibleStripes.length > 0 ? `${100 / visibleStripes.length}%` : '0%';

  async function handleWeekendClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (isWorkingWeekend) {
      // Toggle off — reset to plain weekend (delete the record)
      await fetch(`/api/days/${day.date}`, { method: 'DELETE' });
    } else {
      // Toggle on — mark as working_weekend
      await fetch(`/api/days/${day.date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayType: 'working_weekend' }),
      });
    }

    router.refresh();
  }

  async function handleHolidayClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (isVacation) {
      // Remove vacation override — revert to pure holiday
      await fetch(`/api/days/${day.date}`, { method: 'DELETE' });
    } else {
      // Mark as vacation (overrides holiday for display + counting)
      await fetch(`/api/days/${day.date}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayType: 'vacation' }),
      });
    }
    router.refresh();
  }

  return (
    <div
      role={isInteractive || isWeekendClickable || isHolidayClickable ? 'button' : 'gridcell'}
      tabIndex={isInteractive || isWeekendClickable || isHolidayClickable ? 0 : -1}
      aria-label={
        isInteractive
          ? `${day.date}: ${day.dayType}. Click to toggle.`
          : isWeekendClickable
          ? `${day.date}: ${isWorkingWeekend ? 'Working weekend. Click to remove.' : 'Weekend. Click to mark as working.'}`
          : isHolidayClickable
          ? `${day.date}: ${day.holidayName ?? 'Public holiday'}. ${isVacation ? 'Marked as vacation. Click to revert.' : 'Click to mark as vacation.'}`
          : day.date
      }
      onMouseDown={isInteractive ? onCellMouseDown : undefined}
      onMouseEnter={onCellMouseEnter}
      onMouseUp={isInteractive ? onCellMouseUp : undefined}
      onClick={
        isWeekendClickable ? (e) => void handleWeekendClick(e)
        : isHolidayClickable ? (e) => void handleHolidayClick(e)
        : undefined
      }
      className={cn(
        'relative flex flex-col p-1 min-h-[60px] sm:min-h-[80px] rounded-sm border text-sm transition-colors overflow-hidden',
        // Not in current month
        !day.isCurrentMonth && 'opacity-30 bg-gray-50 border-gray-100',
        // Working weekend (explicitly scheduled)
        day.isCurrentMonth && day.isWeekend && isWorkingWeekend &&
          'bg-indigo-50 text-indigo-700 border-2 border-indigo-500 cursor-pointer hover:bg-indigo-100',
        // Normal weekend
        day.isCurrentMonth && day.isWeekend && !isWorkingWeekend &&
          'bg-slate-200 text-slate-400 border-slate-300 cursor-pointer hover:bg-slate-300',
        // Public holiday with vacation override — show as vacation
        day.isCurrentMonth && day.isHoliday && isVacation &&
          'bg-green-100 border-green-400 cursor-pointer hover:bg-green-200',
        // Pure public holiday (no vacation override)
        day.isCurrentMonth && day.isHoliday && !isVacation &&
          'bg-blue-100 border-blue-400 cursor-pointer hover:bg-blue-200',
        // Vacation
        day.isCurrentMonth && !day.isWeekend && !day.isHoliday && isVacation &&
          'bg-green-100 border-green-400 cursor-pointer hover:bg-green-200',
        // Working (default) — subtle slate so cells are visible on white bg
        day.isCurrentMonth && !day.isWeekend && !day.isHoliday && !isVacation &&
          'bg-slate-50 border-slate-200 cursor-pointer hover:bg-slate-100',
        // Drag range highlight
        isInRange && 'ring-2 ring-indigo-400 ring-inset bg-indigo-50 border-indigo-300'
      )}
    >
      {/* Project colour stripes — 4px left border, stacked vertically, visual-only */}
      {visibleStripes.length > 0 && day.isCurrentMonth && (
        <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col z-10 pointer-events-none">
          {visibleStripes.map((stripe, i) => (
            <span
              key={i}
              style={{
                backgroundColor: stripe.colour,
                height: stripeHeight,
                width: '4px',
                display: 'block',
              }}
            />
          ))}
        </div>
      )}

      {/* Today indicator — indigo dot top-right */}
      {isToday && day.isCurrentMonth && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-indigo-500" />
      )}

      {day.isHoliday && !isVacation && day.holidayName && (
        <span className="text-xs text-blue-600 leading-tight mt-0.5 hidden sm:block truncate">
          {day.holidayName}
        </span>
      )}
      {day.isHoliday && isVacation && (
        <>
          <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-green-500 sm:hidden" />
          <span className="text-xs text-green-600 mt-0.5 hidden sm:block">🌴 Vacation</span>
          {day.holidayName && (
            <span className="text-xs text-green-400 leading-tight hidden sm:block truncate opacity-70">
              {day.holidayName}
            </span>
          )}
        </>
      )}

      {/* Vacation: dot on mobile, label on sm+ */}
      {day.isCurrentMonth && !day.isWeekend && !day.isHoliday && isVacation && (
        <>
          <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-green-500 sm:hidden" />
          <span className="text-xs text-green-600 mt-0.5 hidden sm:block">🌴 Vacation</span>
        </>
      )}

      {/* Working weekend: indigo label */}
      {day.isCurrentMonth && day.isWeekend && isWorkingWeekend && (
        <>
          <span className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-indigo-500 sm:hidden" />
          <span className="text-xs text-indigo-600 mt-0.5 hidden sm:block">💼 Working</span>
        </>
      )}

      {/* Day number — pinned to bottom of cell */}
      <span
        className={cn(
          'font-medium text-xs sm:text-sm mt-auto',
          isToday && day.isCurrentMonth && 'text-indigo-700 font-bold',
          day.isHoliday && !isVacation && 'text-blue-700',
          isVacation && 'text-green-700',
          isWorkingWeekend && day.isWeekend && 'text-indigo-700'
        )}
      >
        {dayNumber}
      </span>
    </div>
  );
}
