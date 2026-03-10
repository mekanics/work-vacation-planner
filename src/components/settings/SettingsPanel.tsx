'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const WEEKDAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
];

const CANTONS = [
  { code: 'CH',  name: 'Schweizweit (nur nationale Feiertage)' },
  { code: 'AG',  name: 'Aargau' },
  { code: 'AI',  name: 'Appenzell Innerrhoden' },
  { code: 'AR',  name: 'Appenzell Ausserrhoden' },
  { code: 'BE',  name: 'Bern' },
  { code: 'BL',  name: 'Basel-Landschaft' },
  { code: 'BS',  name: 'Basel-Stadt' },
  { code: 'FR',  name: 'Freiburg' },
  { code: 'GE',  name: 'Genf' },
  { code: 'GL',  name: 'Glarus' },
  { code: 'GR',  name: 'Graubünden' },
  { code: 'JU',  name: 'Jura' },
  { code: 'LU',  name: 'Luzern' },
  { code: 'NE',  name: 'Neuenburg' },
  { code: 'NW',  name: 'Nidwalden' },
  { code: 'OW',  name: 'Obwalden' },
  { code: 'SG',  name: 'St. Gallen' },
  { code: 'SH',  name: 'Schaffhausen' },
  { code: 'SO',  name: 'Solothurn' },
  { code: 'SZ',  name: 'Schwyz' },
  { code: 'TG',  name: 'Thurgau' },
  { code: 'TI',  name: 'Tessin' },
  { code: 'UR',  name: 'Uri' },
  { code: 'VD',  name: 'Waadt' },
  { code: 'VS',  name: 'Wallis' },
  { code: 'ZG',  name: 'Zug' },
  { code: 'ZH',  name: 'Zürich' },
];

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [nonWorkingWeekdays, setNonWorkingWeekdays] = useState<number[]>([]);
  const [vacationBudget, setVacationBudget] = useState<string>('0');
  const [canton, setCanton] = useState<string>('ZH');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load settings on open
  useEffect(() => {
    if (!open) return;
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        if (data.non_working_weekdays) {
          try {
            const parsed = JSON.parse(data.non_working_weekdays);
            if (Array.isArray(parsed)) setNonWorkingWeekdays(parsed);
          } catch {
            setNonWorkingWeekdays([]);
          }
        } else {
          setNonWorkingWeekdays([]);
        }
        if (data.vacation_budget) {
          setVacationBudget(data.vacation_budget);
        } else {
          setVacationBudget('0');
        }
        if (data.canton) {
          setCanton(data.canton);
        } else {
          setCanton('ZH');
        }
      })
      .catch(() => {});
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function toggleWeekday(dow: number) {
    const next = nonWorkingWeekdays.includes(dow)
      ? nonWorkingWeekdays.filter((d) => d !== dow)
      : [...nonWorkingWeekdays, dow];
    setNonWorkingWeekdays(next);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ non_working_weekdays: JSON.stringify(next) }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveVacationBudget() {
    const val = parseInt(vacationBudget, 10);
    const sanitized = isNaN(val) ? '0' : String(Math.max(0, val));
    setVacationBudget(sanitized);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vacation_budget: sanitized }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveOrChangeCanton(code: string) {
    setCanton(code);
    setSaving(true);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canton: code }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
        title="Settings"
        aria-label="Open settings"
      >
        {/* Gear icon via SVG (lucide-react compatible) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg w-72 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Settings</h3>

          {/* Non-working weekdays */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Non-working weekdays</p>
            <div className="flex gap-2">
              {WEEKDAYS.map(({ label, value }) => {
                const active = nonWorkingWeekdays.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => toggleWeekday(value)}
                    disabled={saving}
                    className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    } disabled:opacity-50`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Selected days are treated like weekends</p>
          </div>

          {/* Vacation budget */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Annual vacation budget (days)</p>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="365"
                value={vacationBudget}
                onChange={(e) => setVacationBudget(e.target.value)}
                onBlur={saveVacationBudget}
                onKeyDown={(e) => e.key === 'Enter' && saveVacationBudget()}
                disabled={saving}
                className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
              />
              <button
                onClick={saveVacationBudget}
                disabled={saving}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Shown as a tracker in the month summary bar</p>
          </div>

          {/* Canton selection */}
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-600 mb-2">Kanton (Feiertage)</p>
            <select
              value={canton}
              onChange={(e) => saveOrChangeCanton(e.target.value)}
              disabled={saving}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
            >
              {CANTONS.map(({ code, name }) => (
                <option key={code} value={code}>
                  {code === 'CH' ? name : `${code} – ${name}`}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1.5">Nur Feiertage für diesen Kanton werden angezeigt</p>
          </div>

          {saving && (
            <p className="text-xs text-gray-400 mt-3 text-center">Saving…</p>
          )}
        </div>
      )}
    </div>
  );
}
