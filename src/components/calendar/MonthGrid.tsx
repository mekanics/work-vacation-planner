'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getISOWeek } from 'date-fns';
import { DayCell } from './DayCell';
import type { CalendarDay, DayType } from '@/types';

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface MonthGridProps {
  days: CalendarDay[];
  year: number;
  month: number;
}

function groupByWeeks(days: CalendarDay[]): CalendarDay[][] {
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

export function MonthGrid({ days, year, month }: MonthGridProps) {
  const router = useRouter();

  // Drag state (refs to avoid stale closures in event handlers)
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<string | null>(null);

  // Shift-click anchor (ref + state so we can read in callbacks without stale closures)
  const shiftAnchorRef = useRef<string | null>(null);

  // Derived display state
  const [dragRange, setDragRange] = useState<{ start: string; end: string } | null>(null);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  // ─── Range utilities ───────────────────────────────────────────────────────

  const getDateRange = (from: string, to: string): string[] => {
    const [s, e] = from <= to ? [from, to] : [to, from];
    const result: string[] = [];
    // Use noon (T12:00:00) to avoid UTC rollback in UTC+ timezones (e.g. Zurich UTC+1/+2)
    const cur = new Date(s + 'T12:00:00');
    const end = new Date(e + 'T12:00:00');
    const pad = (n: number) => String(n).padStart(2, '0');
    while (cur <= end) {
      const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const d = dayMap.get(iso);
      // Skip weekends and holidays (those are structural / fixed)
      if (d && !d.isWeekend && !d.isHoliday) {
        result.push(iso);
      }
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  };

  // Highlighted dates from active drag (for visual feedback)
  const highlightedDates = useMemo(() => {
    if (!dragRange) return new Set<string>();
    return new Set<string>(getDateRange(dragRange.start, dragRange.end));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragRange, dayMap]);

  // ─── API helpers ──────────────────────────────────────────────────────────

  const batchPost = async (dates: string[], dayType: 'vacation' | 'working') => {
    if (dates.length === 0) return;
    await fetch('/api/days/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates, day_type: dayType }),
    });
    router.refresh();
  };

  const singleToggle = async (date: string, currentType: DayType) => {
    if (currentType === 'vacation') {
      // Clear the explicit state → back to implicit "working"
      await fetch(`/api/days/${date}`, { method: 'DELETE' });
    } else {
      // Mark as vacation
      await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, day_type: 'vacation' }),
      });
    }
    router.refresh();
  };

  // ─── Mouse handlers ───────────────────────────────────────────────────────

  const handleCellMouseDown = (date: string, shiftKey: boolean) => {
    const d = dayMap.get(date);
    if (!d || d.isWeekend || d.isHoliday || !d.isCurrentMonth) return;

    if (shiftKey && shiftAnchorRef.current) {
      // Shift-click range: from anchor → this date
      const range = getDateRange(shiftAnchorRef.current, date);
      const anchor = dayMap.get(shiftAnchorRef.current);
      const targetType: 'vacation' | 'working' =
        anchor?.dayType === 'vacation' ? 'working' : 'vacation';
      shiftAnchorRef.current = date;
      batchPost(range, targetType);
    } else {
      // Start drag
      isDraggingRef.current = true;
      dragStartRef.current = date;
      setDragRange({ start: date, end: date });
    }
  };

  const handleCellMouseEnter = (date: string) => {
    if (isDraggingRef.current && dragStartRef.current) {
      setDragRange({ start: dragStartRef.current, end: date });
    }
  };

  const handleCellMouseUp = (date: string) => {
    if (!isDraggingRef.current) return;

    const start = dragStartRef.current;
    isDraggingRef.current = false;
    dragStartRef.current = null;
    setDragRange(null);

    if (!start) return;

    if (start === date) {
      // No drag movement → single click toggle
      const d = dayMap.get(start);
      if (d) {
        shiftAnchorRef.current = start;
        singleToggle(start, d.dayType);
      }
    } else {
      // Drag range: determine target type from the first clicked day
      const range = getDateRange(start, date);
      const firstDay = dayMap.get(start);
      const targetType: 'vacation' | 'working' =
        firstDay?.dayType === 'vacation' ? 'working' : 'vacation';
      shiftAnchorRef.current = date;
      batchPost(range, targetType);
    }
  };

  const handleWeekClick = (week: CalendarDay[]) => {
    const workable = week.filter(
      (d) => d.isCurrentMonth && !d.isWeekend && !d.isHoliday
    );
    if (workable.length === 0) return;
    // Toggle: if all are vacation, clear them; otherwise mark as vacation
    const allVacation = workable.every((d) => d.dayType === 'vacation');
    batchPost(
      workable.map((d) => d.date),
      allVacation ? 'working' : 'vacation'
    );
  };

  // Release drag if mouse goes outside the grid
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        dragStartRef.current = null;
        setDragRange(null);
      }
    };
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => window.removeEventListener('mouseup', onWindowMouseUp);
  }, []);

  const weeks = groupByWeeks(days);

  return (
    <div
      className="w-full select-none"
      // Prevent browser text-selection during drag
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Header row — placeholder for week handle column + day headers */}
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
            {/* Week handle — click to toggle all working days in this week */}
            <button
              className="w-8 flex-shrink-0 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
              onClick={() => handleWeekClick(week)}
              title="Toggle all working days this week"
              type="button"
            >
              {weekNum}
            </button>

            {/* Day cells */}
            <div className="flex-1 grid grid-cols-7 gap-1">
              {week.map((day) => (
                <DayCell
                  key={day.date}
                  day={day}
                  isInRange={highlightedDates.has(day.date)}
                  onCellMouseDown={(e) => handleCellMouseDown(day.date, e.shiftKey)}
                  onCellMouseEnter={() => handleCellMouseEnter(day.date)}
                  onCellMouseUp={() => handleCellMouseUp(day.date)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
