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
  // Weekdays only participate in drag-select; weekends have their own click toggle
  const isInteractive = !day.isWeekend && !day.isHoliday && day.isCurrentMonth;
  const isWeekendClickable = day.isWeekend && !day.isHoliday && day.isCurrentMonth;
  const isVacation = day.dayType === 'vacation';
  const isToday = day.date === TODAY;

  const dayNumber = parseInt(day.date.split('-')[2], 10);

  // Prefer rich stripe data; fall back to legacy projectColours for back-compat
  const projectStripes: ProjectStripe[] =
    day.projectStripes ??
    (day.projectColours ?? []).map((colour) => ({ projectId: '', colour, included: true }));

  // Render up to 3 project colour stripes on the left edge (stacked vertically)
  const visibleStripes = projectStripes.slice(0, 3);
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

  async function handleStripeClick(e: React.MouseEvent, stripe: ProjectStripe) {
    // Prevent the cell's drag handlers from firing
    e.stopPropagation();
    e.preventDefault();

    if (!stripe.projectId) return; // legacy mode with no id — skip

    if (stripe.included) {
      // Currently a project day → add exclude override
      await fetch(`/api/projects/${stripe.projectId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: day.date, type: 'exclude' }),
      });
    } else {
      // Not a project day → add include override
      await fetch(`/api/projects/${stripe.projectId}/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: day.date, type: 'include' }),
      });
    }

    router.refresh();
  }

  return (
    <div
      role={isInteractive || isWeekendClickable ? 'button' : 'gridcell'}
      tabIndex={isInteractive || isWeekendClickable ? 0 : -1}
      aria-label={
        isInteractive
          ? `${day.date}: ${day.dayType}. Click to toggle.`
          : isWeekendClickable
          ? `${day.date}: ${isWorkingWeekend ? 'Working weekend. Click to remove.' : 'Weekend. Click to mark as working.'}`
          : day.isHoliday
          ? `${day.date}: ${day.holidayName ?? 'Public holiday'}`
          : day.date
      }
      onMouseDown={isInteractive ? onCellMouseDown : undefined}
      onMouseEnter={onCellMouseEnter}
      onMouseUp={isInteractive ? onCellMouseUp : undefined}
      onClick={isWeekendClickable ? (e) => void handleWeekendClick(e) : undefined}
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
        // Public holiday
        day.isCurrentMonth && day.isHoliday &&
          'bg-blue-100 border-blue-400 cursor-default',
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
      {/* Project colour stripes — 4px left border, stacked vertically, clickable */}
      {visibleStripes.length > 0 && day.isCurrentMonth && (
        <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col z-10">
          {visibleStripes.map((stripe, i) => (
            <button
              key={i}
              type="button"
              title={
                stripe.included
                  ? `Click to exclude this day from project`
                  : `Click to include this day in project`
              }
              aria-label={
                stripe.included
                  ? `Exclude ${day.date} from project`
                  : `Include ${day.date} in project`
              }
              onClick={(e) => void handleStripeClick(e, stripe)}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                backgroundColor: stripe.included ? stripe.colour : 'transparent',
                borderLeft: stripe.included ? 'none' : `4px dashed ${stripe.colour}`,
                height: stripeHeight,
                width: '4px',
                padding: 0,
                border: 'none',
                cursor: stripe.projectId ? 'pointer' : 'default',
                opacity: stripe.included ? 1 : 0.45,
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
          day.isHoliday && 'text-blue-700',
          isVacation && !day.isHoliday && 'text-green-700',
          isWorkingWeekend && day.isWeekend && 'text-indigo-700'
        )}
      >
        {dayNumber}
      </span>
    </div>
  );
}
