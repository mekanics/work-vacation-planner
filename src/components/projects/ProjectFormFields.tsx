import type { ClientRecord } from '@/lib/services/clients';
import type { ProjectRecord } from '@/lib/services/projects';

const PRESET_COLOURS = ['#4f86c6', '#e67e22', '#27ae60', '#9b59b6', '#e74c3c', '#1abc9c'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NUMS = [1, 2, 3, 4, 5, 6, 0];

export interface ProjectFormState {
  name: string;
  clientId: string;
  endClient: string;
  colourOverride: string;
  startDate: string;
  endDate: string;
  weekdays: number[];
}

export function emptyProjectForm(): ProjectFormState {
  return {
    name: '', clientId: '', endClient: '', colourOverride: '',
    startDate: '', endDate: '', weekdays: [1, 2, 3, 4, 5],
  };
}

export function projectToForm(project: ProjectRecord): ProjectFormState {
  return {
    name: project.name,
    clientId: project.clientId,
    endClient: project.endClient ?? '',
    colourOverride: project.colourOverride ?? '',
    startDate: project.startDate ?? '',
    endDate: project.endDate ?? '',
    weekdays: [...project.weekdays],
  };
}

interface ProjectFormFieldsProps {
  form: ProjectFormState;
  clients: ClientRecord[];
  isNew: boolean;
  onChange: (form: ProjectFormState) => void;
}

export function ProjectFormFields({ form, clients, isNew, onChange }: ProjectFormFieldsProps) {
  const selectedClient = clients.find((client) => client.id === form.clientId);
  const selectableClients = clients.filter((client) => !client.archived || client.id === form.clientId);

  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId);
    onChange({
      ...form,
      clientId,
      colourOverride: isNew ? '' : form.colourOverride,
      weekdays: isNew && client ? [...client.defaultWeekdays] : form.weekdays,
    });
  };

  const toggleWeekday = (day: number) => {
    onChange({
      ...form,
      weekdays: form.weekdays.includes(day)
        ? form.weekdays.filter((item) => item !== day)
        : [...form.weekdays, day],
    });
  };

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-client">
          Client
        </label>
        <select
          id="project-client"
          value={form.clientId}
          onChange={(event) => selectClient(event.target.value)}
          className="w-full border rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
          required
        >
          <option value="">Select a client…</option>
          {selectableClients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}{client.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          type="text"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="e.g. Alpha"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="project-end-client">
          End client <span className="text-gray-400">(optional label)</span>
        </label>
        <input
          id="project-end-client"
          type="text"
          value={form.endClient}
          onChange={(event) => onChange({ ...form, endClient: event.target.value })}
          placeholder="e.g. ACME"
          className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Colour override</label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onChange({ ...form, colourOverride: '' })}
            className={`h-8 px-2 rounded border-2 text-xs ${form.colourOverride === '' ? 'border-slate-800' : 'border-gray-200'}`}
            title="Use the client colour"
          >
            <span className="inline-block w-3 h-3 rounded-full align-middle mr-1" style={{ backgroundColor: selectedClient?.colour ?? '#d1d5db' }} />
            Client colour
          </button>
          {PRESET_COLOURS.map((colour) => (
            <button
              key={colour}
              type="button"
              aria-label={`Use colour ${colour}`}
              onClick={() => onChange({ ...form, colourOverride: colour })}
              className="w-7 h-7 rounded-full border-2 transition-transform"
              style={{
                backgroundColor: colour,
                borderColor: form.colourOverride === colour ? '#1e293b' : 'transparent',
                transform: form.colourOverride === colour ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Working days</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAY_NUMS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleWeekday(day)}
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
        {isNew && <p className="text-xs text-gray-400 mt-1">Copied from the client template; changes here do not alter the template.</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start date <span className="text-gray-400">(optional)</span></label>
          <input
            type="date"
            value={form.startDate}
            onChange={(event) => onChange({ ...form, startDate: event.target.value })}
            className="w-full min-w-0 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End date <span className="text-gray-400">(optional)</span></label>
          <input
            type="date"
            value={form.endDate}
            onChange={(event) => onChange({ ...form, endDate: event.target.value })}
            className="w-full min-w-0 border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>
    </>
  );
}
