'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProjectRecord } from '@/lib/services/projects';

const PRESET_COLOURS = [
  '#4f86c6', // Steel Blue
  '#e67e22', // Amber
  '#27ae60', // Emerald
  '#9b59b6', // Violet
  '#e74c3c', // Coral
  '#1abc9c', // Teal
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NUMS = [1, 2, 3, 4, 5]; // Mon–Fri by default

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

interface ProjectsManagerProps {
  projects: ProjectRecord[];
  yearWorkingDays: Record<string, number>;
}

export function ProjectsManager({ projects, yearWorkingDays }: ProjectsManagerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatWeekdays = (weekdays: number[]) =>
    weekdays.sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d]).join(', ');

  const handleEdit = (project: ProjectRecord) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      colour: project.colour,
      startDate: project.startDate ?? '',
      endDate: project.endDate ?? '',
      weekdays: [...project.weekdays],
    });
    setShowForm(true);
    setError(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError(null);
  };

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
      const payload = {
        name: form.name.trim(),
        colour: form.colour,
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        weekdays: form.weekdays,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/projects/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Failed to save project');
        return;
      }

      handleCancel();
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        alert('Failed to delete project');
        return;
      }
      router.refresh();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  return (
    <div>
      {/* Project list */}
      {projects.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm mb-4">
          No projects yet. Add one to track working days by contract.
        </p>
      )}

      {projects.length > 0 && (
        <div className="space-y-2 mb-6">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between gap-3 p-3 bg-white border rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Colour dot */}
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.colour }}
                />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{project.name}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>{formatWeekdays(project.weekdays)}</span>
                    {(project.startDate || project.endDate) && (
                      <span>
                        {project.startDate ?? '∞'} → {project.endDate ?? '∞'}
                      </span>
                    )}
                    {yearWorkingDays[project.id] !== undefined && (
                      <span className="text-indigo-600 font-medium">
                        {yearWorkingDays[project.id]} working days this year
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(project)}
                  className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(project.id, project.name)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">
            {editingId ? 'Edit Project' : 'New Project'}
          </h3>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Client A"
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              required
            />
          </div>

          {/* Colour picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Colour
            </label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Working days
            </label>
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
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add project'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setForm(DEFAULT_FORM);
          }}
          className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
        >
          + Add project
        </button>
      )}
    </div>
  );
}
