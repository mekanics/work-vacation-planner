'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { CalendarDay, ProjectStripe } from '@/types';

interface DayContextMenuProps {
  day: CalendarDay;
  children: React.ReactNode;
  onOverrideChange: () => void;
}

interface MenuPosition {
  x: number;
  y: number;
}

export function DayContextMenu({ day, children, onOverrideChange }: DayContextMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Track client mount so createPortal works with SSR
  useEffect(() => { setMounted(true); }, []);

  const close = useCallback(() => setPosition(null), []);

  // Adjust menu position so it doesn't overflow the viewport
  useEffect(() => {
    if (!position || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = position;
    if (x + rect.width > vw - 8) x = vw - rect.width - 8;
    if (y + rect.height > vh - 8) y = vh - rect.height - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [position]);

  // Close on Escape key
  useEffect(() => {
    if (!position) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [position, close]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
  };

  const projectStripes: ProjectStripe[] = day.projectStripes ?? [];

  const handleProjectToggle = async (stripe: ProjectStripe) => {
    close();
    if (!stripe.projectId) return;

    if (stripe.included) {
      if (stripe.overrideType === 'include') {
        // Day is included via an explicit include override → DELETE to revert to mask
        await fetch(`/api/projects/${stripe.projectId}/overrides/${day.date}`, {
          method: 'DELETE',
        });
      } else {
        // Day is included by mask (no override) → POST exclude to disable it
        await fetch(`/api/projects/${stripe.projectId}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: day.date, type: 'exclude' }),
        });
      }
    } else {
      if (stripe.overrideType === 'exclude') {
        // Day is excluded via an explicit exclude override → DELETE to revert to mask
        await fetch(`/api/projects/${stripe.projectId}/overrides/${day.date}`, {
          method: 'DELETE',
        });
      } else {
        // Day is excluded by mask (no override) → POST include to add it
        await fetch(`/api/projects/${stripe.projectId}/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: day.date, type: 'include' }),
        });
      }
    }

    onOverrideChange();
  };

  const handleMarkVacation = async () => {
    close();
    await fetch('/api/days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: day.date, day_type: 'vacation' }),
    });
    onOverrideChange();
  };

  const handleClearDay = async () => {
    close();
    await fetch(`/api/days/${day.date}`, { method: 'DELETE' });
    onOverrideChange();
  };

  const canToggleVacation =
    !day.isWeekend && !day.isHoliday && day.isCurrentMonth;

  return (
    <>
      <div onContextMenu={handleContextMenu} className="contents">
        {children}
      </div>

      {mounted && position &&
        createPortal(
          <>
            {/* Transparent backdrop — click anywhere to dismiss */}
            <div
              className="fixed inset-0 z-40"
              onClick={close}
              onContextMenu={(e) => {
                e.preventDefault();
                close();
              }}
            />

            {/* Context menu */}
            <div
              ref={menuRef}
              role="menu"
              aria-label={`Actions for ${day.date}`}
              className="fixed z-50 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm select-none"
              style={{ left: position.x, top: position.y }}
            >
              {/* Date header */}
              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 border-b border-gray-100">
                {day.date}
              </div>

              {/* Project toggle items */}
              {projectStripes.length === 0 ? (
                <div className="px-3 py-2 text-gray-400 text-xs italic">
                  No projects on this day
                </div>
              ) : (
                <div className="py-1">
                  {projectStripes.map((stripe, i) => (
                    <button
                      key={`${stripe.projectId}-${i}`}
                      role="menuitem"
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                      onClick={() => void handleProjectToggle(stripe)}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stripe.colour }}
                      />
                      <span className="flex-1 text-gray-800 truncate">
                        {stripe.projectName || stripe.projectId}
                      </span>
                      <span
                        className={
                          stripe.included
                            ? 'text-emerald-600 font-medium text-xs'
                            : 'text-gray-400 text-xs'
                        }
                      >
                        {stripe.included ? '✓ Included' : '○ Excluded'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Vacation quick actions — only for interactive weekdays */}
              {canToggleVacation && (
                <>
                  <div className="border-t border-gray-100 my-1" />
                  {day.dayType === 'vacation' ? (
                    <button
                      role="menuitem"
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors text-gray-700"
                      onClick={() => void handleClearDay()}
                    >
                      <span className="text-gray-400">✕</span>
                      <span>Clear (mark working)</span>
                    </button>
                  ) : (
                    <button
                      role="menuitem"
                      type="button"
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors text-gray-700"
                      onClick={() => void handleMarkVacation()}
                    >
                      <span>🌴</span>
                      <span>Mark vacation</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
