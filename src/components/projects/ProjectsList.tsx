'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ClientRecord } from '@/lib/services/clients';
import type { ProjectRecord } from '@/lib/services/projects';
import { emptyProjectForm, ProjectFormFields, type ProjectFormState } from './ProjectFormFields';

const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 0];

interface NewProjectModalProps {
  clients: ClientRecord[];
  onClose: () => void;
  onSaved: () => void;
}

function NewProjectModal({ clients, onClose, onSaved }: NewProjectModalProps) {
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId) { setError('Client is required'); return; }
    if (!form.name.trim()) { setError('Project name is required'); return; }
    if (form.weekdays.length === 0) { setError('Select at least one working day'); return; }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          clientId: form.clientId,
          endClient: form.endClient.trim() || null,
          colour: form.colourOverride || null,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          weekdays: form.weekdays,
        }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
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
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Project</h2>
        {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2 mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <ProjectFormFields form={form} clients={clients} isNew onChange={setForm} />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add project'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ProjectsListProps {
  projects: ProjectRecord[];
  clients: ClientRecord[];
  yearWorkingDays: Record<string, number>;
}

export function ProjectsList({ projects, clients, yearWorkingDays }: ProjectsListProps) {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          {projects.length === 0 ? 'No projects yet.' : `${projects.length} project${projects.length === 1 ? '' : 's'}`}
        </span>
        <button onClick={() => setShowNewModal(true)} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
          + New Project
        </button>
      </div>

      {projects.length > 0 && (
        <div className="divide-y divide-gray-100 border rounded-lg overflow-hidden bg-white">
          {projects.map((project) => {
            const days = yearWorkingDays[project.id];
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.colour }} />
                <span className="flex-1 min-w-0">
                  <span className="block font-medium text-gray-900 truncate group-hover:text-indigo-700 transition-colors">{project.name}</span>
                  <span className="block text-xs text-gray-500 truncate">
                    {project.clientName}{project.endClient ? ` · End client: ${project.endClient}` : ''}
                  </span>
                </span>
                <span className="hidden sm:flex items-center gap-1 flex-shrink-0">
                  {WEEKDAY_NUMS.filter((day) => project.weekdays.includes(day)).map((day) => (
                    <span key={day} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">{WEEKDAY_SHORT[day]}</span>
                  ))}
                </span>
                {(project.startDate || project.endDate) && (
                  <span className="hidden md:block text-xs text-gray-500 flex-shrink-0 tabular-nums">{project.startDate ?? '∞'} → {project.endDate ?? '∞'}</span>
                )}
                {days !== undefined && <span className="text-xs font-medium text-indigo-600 flex-shrink-0 tabular-nums">{days} days</span>}
                <span className="text-gray-400 group-hover:text-indigo-500 transition-colors flex-shrink-0">→</span>
              </Link>
            );
          })}
        </div>
      )}

      {projects.length === 0 && (
        <div className="text-center py-12 text-gray-400 border rounded-lg bg-gray-50">
          <p className="text-sm">No projects yet.</p>
          <p className="text-xs mt-1">Click &ldquo;+ New Project&rdquo; to get started.</p>
        </div>
      )}
      {showNewModal && <NewProjectModal clients={clients} onClose={() => setShowNewModal(false)} onSaved={() => { setShowNewModal(false); router.refresh(); }} />}
    </div>
  );
}
