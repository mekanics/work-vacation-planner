'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ClientRecord } from '@/lib/services/clients';

const COLOURS = ['#4f86c6', '#e67e22', '#27ae60', '#9b59b6', '#e74c3c', '#1abc9c', '#64748b'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface ClientForm {
  name: string;
  colour: string;
  defaultWeekdays: number[];
  archived: boolean;
}

const emptyForm = (): ClientForm => ({
  name: '', colour: COLOURS[0], defaultWeekdays: [1, 2, 3, 4, 5], archived: false,
});

export function ClientsManager({ clients }: { clients: ClientRecord[] }) {
  const router = useRouter();
  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  };

  const edit = (client: ClientRecord) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      colour: client.colour,
      defaultWeekdays: [...client.defaultWeekdays],
      archived: client.archived,
    });
    setShowForm(true);
    setError(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) { setError('Client name is required'); return; }
    if (form.defaultWeekdays.length === 0) { setError('Select at least one default working day'); return; }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(editingId ? `/api/clients/${editingId}` : '/api/clients', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      if (!response.ok) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Failed to save client');
        return;
      }
      cancel();
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (client: ClientRecord) => {
    if (!confirm(`Delete client "${client.name}"? Projects must be moved first.`)) return;
    const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = await response.json() as { error?: string };
      alert(data.error ?? 'Failed to delete client');
      return;
    }
    router.refresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        {!showForm && <button onClick={() => setShowForm(true)} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700">+ New Client</button>}
      </div>

      <div className="divide-y divide-gray-100 border rounded-lg bg-white mb-6">
        {clients.map((client) => (
          <div key={client.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: client.colour }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 truncate">{client.name}</span>
                {client.isSystem && <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">System</span>}
                {client.archived && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Archived</span>}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                New projects: {WEEKDAY_ORDER.filter((day) => client.defaultWeekdays.includes(day)).map((day) => WEEKDAYS[day]).join(', ')}
              </p>
            </div>
            <button onClick={() => edit(client)} className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1">Edit</button>
            {!client.isSystem && <button onClick={() => void remove(client)} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Delete</button>}
          </div>
        ))}
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-white border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold text-gray-800">{editingId ? 'Edit Client' : 'New Client'}</h2>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="client-name">Name</label>
            <input id="client-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full border rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Colour</label>
            <div className="flex gap-2">
              {COLOURS.map((colour) => (
                <button key={colour} type="button" aria-label={`Use colour ${colour}`} onClick={() => setForm({ ...form, colour })} className="w-7 h-7 rounded-full border-2" style={{ backgroundColor: colour, borderColor: form.colour === colour ? '#1e293b' : 'transparent' }} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default project weekdays</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_ORDER.map((day) => (
                <button key={day} type="button" onClick={() => setForm({ ...form, defaultWeekdays: form.defaultWeekdays.includes(day) ? form.defaultWeekdays.filter((item) => item !== day) : [...form.defaultWeekdays, day] })} className={`w-10 h-9 rounded text-xs font-medium border ${form.defaultWeekdays.includes(day) ? 'bg-indigo-100 border-indigo-400 text-indigo-700' : 'bg-white border-gray-200 text-gray-400'}`}>
                  {WEEKDAYS[day]}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Copied when a project is created. Existing projects are not changed.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.archived} onChange={(event) => setForm({ ...form, archived: event.target.checked })} />
            Archived (hidden from new-project client choices)
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded disabled:opacity-50">{saving ? 'Saving…' : 'Save client'}</button>
            <button type="button" onClick={cancel} className="px-4 py-2 text-sm text-gray-600 bg-white border rounded">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
