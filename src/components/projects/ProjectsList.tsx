'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ProjectRecord } from '@/lib/services/projects';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRESET_COLOURS = [
  '#4f86c6', '#e67e22', '#27ae60', '#9b59b6', '#e74c3c', '#1abc9c',
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun order for display

// ─── Form types ───────────────────────────────────────────────────────────────

interface ProjectFormState {
  name: string;
  colour: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
}

const DEFAULT_FORM: ProjectFormState = {
  name: '',
  colour: PRESET_COLOURS[0],
  startDate: '',
  endDate: '',
  weekdays: [1, 2, 3, 4, 5],
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProjectsListProps {
  projects: ProjectRecord[];
  yearWorkingDays: Record<string, number>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface NewProjectModalProps {
  onClose: () => void;
  onSaved: () => void;
}

function NewProjectModal({ onClose, onSaved }: NewProjectModalProps) {
  const [form, setForm] = useState<ProjectFormState>(DEFAULT_FORM);
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
    if (!form.name.trim()) {
      setError('Project name is required');
      return;
    }
    if (form.weekdays.length === 0) {
      setError('Select at least one working day');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
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
        setError(data.error ?? 'Failed to save project');
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
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Project</h2>

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
              placeholder="e.g. Client A"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start date <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full min-w-0 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                className="w-full min-w-0 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
              {saving ? 'Saving…' : 'Add project'}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function ProjectsList({ projects, yearWorkingDays }: ProjectsListProps) {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);

  const handleSaved = () => {
    setShowNewModal(false);
    router.refresh();
  };

  return (
    <div>
      {/* Header row with button */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          {projects.length === 0
            ? 'No projects yet.'
            : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
        </span>
        <button
          onClick={() => setShowNewModal(true)}
          className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        >
          + New Project
        </button>
      </div>

      {/* List */}
      {projects.length > 0 && (
        <div className="divide-y divide-gray-100 border rounded-lg overflow-hidden bg-white">
          {projects.map((project) => {
            const days = yearWorkingDays[project.id];
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                {/* Colour dot */}
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.colour }}
                />

                {/* Name */}
                <span className="font-medium text-gray-900 flex-1 min-w-0 truncate group-hover:text-indigo-700 transition-colors">
                  {project.name}
                </span>

                {/* Weekday pills */}
                <span className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  {WEEKDAY_NUMS.filter((d) => project.weekdays.includes(d)).map((day) => (
                    <span
                      key={day}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700"
                    >
                      {WEEKDAY_SHORT[day]}
                    </span>
                  ))}
                </span>

                {/* Date range */}
                {(project.startDate || project.endDate) && (
                  <span className="hidden md:block text-xs text-gray-500 flex-shrink-0 tabular-nums">
                    {project.startDate ?? '∞'} → {project.endDate ?? '∞'}
                  </span>
                )}

                {/* Working days */}
                {days !== undefined && (
                  <span className="text-xs font-medium text-indigo-600 flex-shrink-0 tabular-nums">
                    {days} days
                  </span>
                )}

                {/* Chevron */}
                <span className="text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="text-center py-12 text-gray-400 border rounded-lg bg-gray-50">
          <p className="text-sm">No projects yet.</p>
          <p className="text-xs mt-1">Click &ldquo;+ New Project&rdquo; to get started.</p>
        </div>
      )}

      {/* New project modal */}
      {showNewModal && (
        <NewProjectModal
          onClose={() => setShowNewModal(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
