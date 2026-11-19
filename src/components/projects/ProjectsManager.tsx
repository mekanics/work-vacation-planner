'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientRecord } from '@/lib/services/clients';
import type { ProjectRecord } from '@/lib/services/projects';
import { emptyProjectForm, ProjectFormFields, projectToForm, type ProjectFormState } from './ProjectFormFields';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ProjectsManagerProps {
  projects: ProjectRecord[];
  clients: ClientRecord[];
  yearWorkingDays: Record<string, number>;
}

export function ProjectsManager({ projects, clients, yearWorkingDays }: ProjectsManagerProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProjectFormState>(emptyProjectForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = (project: ProjectRecord) => {
    setEditingId(project.id);
    setForm(projectToForm(project));
    setShowForm(true);
    setError(null);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyProjectForm());
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId) { setError('Client is required'); return; }
    if (!form.name.trim()) { setError('Project name is required'); return; }
    if (form.weekdays.length === 0) { setError('Select at least one working day'); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(editingId ? `/api/projects/${editingId}` : '/api/projects', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(), clientId: form.clientId,
          endClient: form.endClient.trim() || null, colour: form.colourOverride || null,
          start_date: form.startDate || null, end_date: form.endDate || null, weekdays: form.weekdays,
        }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
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
      const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!response.ok) { alert('Failed to delete project'); return; }
      router.refresh();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  return (
    <div>
      {projects.length === 0 && !showForm && <p className="text-gray-500 text-sm mb-4">No projects yet. Add one to track working days by contract.</p>}
      {projects.length > 0 && (
        <div className="space-y-2 mb-6">
          {projects.map((project) => (
            <div key={project.id} className="flex items-center justify-between gap-3 p-3 bg-white border rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.colour }} />
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{project.name}</div>
                  <div className="text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    <span>{project.clientName}</span>
                    <span>{[...project.weekdays].sort((a, b) => a - b).map((day) => WEEKDAY_LABELS[day]).join(', ')}</span>
                    {yearWorkingDays[project.id] !== undefined && <span className="text-indigo-600 font-medium">{yearWorkingDays[project.id]} working days this year</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleEdit(project)} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Edit</button>
                <button onClick={() => handleDelete(project.id, project.name)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-800">{editingId ? 'Edit Project' : 'New Project'}</h3>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <ProjectFormFields form={form} clients={clients} isNew={!editingId} onChange={setForm} />
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors">{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add project'}</button>
            <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm text-gray-600 bg-white border rounded hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyProjectForm()); }} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">+ Add project</button>
      )}
    </div>
  );
}
