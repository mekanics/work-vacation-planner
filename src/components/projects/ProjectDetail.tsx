'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addMonths, subMonths } from 'date-fns';
import type { ProjectRecord, ProjectDayOverride, ProjectWorkingDaySummary } from '@/lib/services/projects';
import type { ProjectCalendarDay } from './ProjectMonthGrid';
import { ProjectMonthGrid } from './ProjectMonthGrid';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLOURS = [
  '#4f86c6', '#e67e22', '#27ae60', '#9b59b6', '#e74c3c', '#1abc9c',
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun display order

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'calendar';

interface ProjectFormState {
  name: string;
  colour: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
}

export interface ProjectDetailProps {
  project: ProjectRecord;
  yearWorkingDays: number;
  daysRemaining: number;
  workingDaysRemaining: number;
  vacationDaysInWindow: number;
  nextWorkingDay: string | null;
  overrides: ProjectDayOverride[];
  initialTab?: Tab;
  initialMonth?: string; // 'YYYY-MM'
  calendarDays?: ProjectCalendarDay[];
  calendarSummary?: ProjectWorkingDaySummary | null;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  project: ProjectRecord;
  onClose: () => void;
  onSaved: () => void;
}

function EditModal({ project, onClose, onSaved }: EditModalProps) {
  const [form, setForm] = useState<ProjectFormState>({
    name: project.name,
    colour: project.colour,
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    weekdays: [...project.weekdays],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleWeekdayToggle = (day: number) => {
    setForm((prev) => ({
      ...prev,
      weekdays: prev.weekdays.includes(day)
        ? prev.weekdays.filter((d) => d !== day)
        : [...prev.weekdays, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Project name is required'); return; }
    if (form.weekdays.length === 0) { setError('Select at least one working day'); return; }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          colour: form.colour,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          weekdays: form.weekdays,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Failed to save');
        return;
      }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit Project</h2>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          {/* Colour picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
            <div className="flex gap-2">
              {PRESET_COLOURS.map((colour) => (
                <button
                  key={colour}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, colour }))}
                  className="w-7 h-7 rounded-full border-2 transition-transform"
                  style={{
                    backgroundColor: colour,
                    borderColor: form.colour === colour ? '#1e293b' : 'transparent',
                    transform: form.colour === colour ? 'scale(1.2)' : 'scale(1)',
                  }}
                  title={colour}
                />
              ))}
            </div>
          </div>

          {/* Weekdays */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Working days</label>
            <div className="flex gap-2">
              {WEEKDAY_NUMS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleWeekdayToggle(day)}
                  className={`w-10 h-9 rounded text-xs font-medium border transition-colors ${
                    form.weekdays.includes(day)
                      ? 'bg-indigo-100 border-indigo-400 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {WEEKDAY_LABELS[day]}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start date <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End date <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

interface OverviewTabProps {
  project: ProjectRecord;
  yearWorkingDays: number;
  daysRemaining: number;
  workingDaysRemaining: number;
  vacationDaysInWindow: number;
  nextWorkingDay: string | null;
  overrides: ProjectDayOverride[];
}

function OverviewTab({ project, yearWorkingDays, daysRemaining, workingDaysRemaining, vacationDaysInWindow, nextWorkingDay, overrides }: OverviewTabProps) {
  const includeOverrides = overrides.filter((o) => o.type === 'include');
  const excludeOverrides = overrides.filter((o) => o.type === 'exclude');

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Working days this year</div>
          <div className="text-2xl font-bold text-gray-900">{yearWorkingDays}</div>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Days remaining</div>
          <div className="text-2xl font-bold text-indigo-600">{daysRemaining}</div>
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Working days remaining</div>
          <div className="text-2xl font-bold text-emerald-600">{workingDaysRemaining}</div>
          {vacationDaysInWindow > 0 && (
            <div className="text-xs text-gray-400 mt-0.5">
              {vacationDaysInWindow} vacation {vacationDaysInWindow === 1 ? 'day' : 'days'} planned
            </div>
          )}
        </div>
        <div className="bg-white border rounded-lg px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Next working day</div>
          <div className="text-lg font-bold text-gray-900">
            {nextWorkingDay ?? <span className="text-gray-400 text-sm font-normal">N/A</span>}
          </div>
        </div>
      </div>

      {/* Schedule summary */}
      <div className="bg-white border rounded-lg px-4 py-3">
        <div className="text-sm font-medium text-gray-700 mb-2">Schedule</div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Weekday pills */}
          {WEEKDAY_NUMS.map((day) => (
            <span
              key={day}
              className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                project.weekdays.includes(day)
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {WEEKDAY_SHORT[day]}
            </span>
          ))}
          <span className="text-gray-300 mx-1">|</span>
          {/* Date range */}
          <span className="text-sm text-gray-600">
            {project.startDate ?? '∞'} → {project.endDate ?? '∞'}
          </span>
        </div>
      </div>

      {/* Overrides */}
      <div className="bg-white border rounded-lg px-4 py-3">
        <div className="text-sm font-medium text-gray-700 mb-2">Overrides</div>
        {overrides.length === 0 ? (
          <p className="text-sm text-gray-400">No overrides</p>
        ) : (
          <div className="space-y-3">
            {includeOverrides.length > 0 && (
              <div>
                <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">
                  Include ({includeOverrides.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {includeOverrides.map((o) => (
                    <span
                      key={o.date}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      {o.date}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {excludeOverrides.length > 0 && (
              <div>
                <div className="text-xs font-medium text-red-500 uppercase tracking-wide mb-1">
                  Exclude ({excludeOverrides.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {excludeOverrides.map((o) => (
                    <span
                      key={o.date}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 text-red-600 rounded text-xs"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                      {o.date}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

interface CalendarTabProps {
  project: ProjectRecord;
  initialMonth: string; // 'YYYY-MM'
  calendarDays?: ProjectCalendarDay[];
  calendarSummary?: ProjectWorkingDaySummary | null;
}

function CalendarTab({ project, initialMonth, calendarDays, calendarSummary }: CalendarTabProps) {
  const router = useRouter();

  // Parse the current month for navigation (use prop directly — state would stale on re-render)
  const [yearStr, monthStr] = initialMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const monthDate = new Date(year, month - 1, 1);

  const navigate = (targetDate: Date) => {
    const m = format(targetDate, 'yyyy-MM');
    router.push(`/projects/${project.id}?tab=calendar&month=${m}`);
  };

  const prevDate = subMonths(monthDate, 1);
  const nextDate = addMonths(monthDate, 1);
  const monthLabel = format(monthDate, 'MMMM yyyy');

  return (
    <div>
      {/* Month navigation */}
      <nav className="flex items-center gap-2 mb-6" aria-label="Month navigation">
        <button
          onClick={() => navigate(prevDate)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          ← Prev
        </button>
        <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
          {monthLabel}
        </span>
        <button
          onClick={() => navigate(nextDate)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50 transition-colors"
        >
          Next →
        </button>
      </nav>

      {/* Month summary bar */}
      {calendarSummary && (
        <div className="mb-6 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: project.colour }}
            />
            <span className="text-gray-600">
              <span className="font-semibold text-gray-900">{calendarSummary.working_days}</span>
              {' '}project working days
            </span>
          </div>
          {calendarSummary.holidays > 0 && (
            <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 text-gray-600">
              <span className="font-semibold text-gray-900">{calendarSummary.holidays}</span>
              {' '}holidays
            </div>
          )}
          {calendarSummary.vacation_days > 0 && (
            <div className="flex items-center gap-2 bg-white border rounded-lg px-4 py-2 text-gray-600">
              <span className="font-semibold text-gray-900">{calendarSummary.vacation_days}</span>
              {' '}vacation days
            </div>
          )}
        </div>
      )}

      {/* Calendar grid */}
      {calendarDays ? (
        <ProjectMonthGrid
          days={calendarDays}
          projectId={project.id}
          projectColour={project.colour}
          year={year}
          month={month}
        />
      ) : (
        <div className="text-center py-12 text-gray-400 bg-gray-50 border rounded-lg">
          <p className="text-sm">Loading calendar…</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Click a day to toggle include / exclude override
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectDetail({
  project,
  yearWorkingDays,
  daysRemaining,
  workingDaysRemaining,
  vacationDaysInWindow,
  nextWorkingDay,
  overrides,
  initialTab = 'overview',
  initialMonth,
  calendarDays,
  calendarSummary,
}: ProjectDetailProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [showEdit, setShowEdit] = useState(false);

  // Determine current month for calendar tab
  const now = new Date();
  const currentMonthStr = initialMonth ?? format(now, 'yyyy-MM');

  const handleTabSwitch = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === 'calendar') {
      router.push(`/projects/${project.id}?tab=calendar&month=${currentMonthStr}`);
    } else {
      router.push(`/projects/${project.id}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (!res.ok) { alert('Failed to delete project'); return; }
      router.push('/projects');
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const handleEditSaved = () => {
    setShowEdit(false);
    router.refresh();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: project.colour }}
            />
            <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowEdit(true)}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-sm text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-0" aria-label="Tabs">
          {(['overview', 'calendar'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => handleTabSwitch(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <OverviewTab
          project={project}
          yearWorkingDays={yearWorkingDays}
          daysRemaining={daysRemaining}
          workingDaysRemaining={workingDaysRemaining}
          vacationDaysInWindow={vacationDaysInWindow}
          nextWorkingDay={nextWorkingDay}
          overrides={overrides}
        />
      )}

      {tab === 'calendar' && (
        <CalendarTab
          project={project}
          initialMonth={currentMonthStr}
          calendarDays={calendarDays}
          calendarSummary={calendarSummary}
        />
      )}

      {/* Edit modal */}
      {showEdit && (
        <EditModal
          project={project}
          onClose={() => setShowEdit(false)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  );
}
