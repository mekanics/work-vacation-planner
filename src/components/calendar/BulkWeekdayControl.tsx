'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const WEEKDAYS = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
];

interface BulkWeekdayControlProps {
  year: number;
}

export function BulkWeekdayControl({ year }: BulkWeekdayControlProps) {
  const router = useRouter();
  const [weekday, setWeekday] = useState(5); // Default: Friday
  const [dayType, setDayType] = useState<'day_off' | 'working'>('day_off');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleApply = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/days/bulk-weekday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, weekday, day_type: dayType }),
      });
      const data = await res.json();
      if (res.ok) {
        const label = WEEKDAYS.find(w => w.value === weekday)?.label ?? 'days';
        setResult(`✓ ${data.count} ${label}s in ${year} set to "${dayType === 'day_off' ? 'Day Off' : 'Working'}"`);
        router.refresh();
      } else {
        setResult(`Error: ${data.error}`);
      }
    } catch {
      setResult('Error: request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm">
      <span className="text-gray-600 font-medium">Bulk set all</span>
      <select
        value={weekday}
        onChange={(e) => setWeekday(parseInt(e.target.value))}
        className="border border-gray-300 rounded-sm px-2 py-1 text-sm bg-white"
      >
        {WEEKDAYS.map((w) => (
          <option key={w.value} value={w.value}>{w.label}s</option>
        ))}
      </select>
      <span className="text-gray-600">in {year} to</span>
      <select
        value={dayType}
        onChange={(e) => setDayType(e.target.value as 'day_off' | 'working')}
        className="border border-gray-300 rounded-sm px-2 py-1 text-sm bg-white"
      >
        <option value="day_off">Day Off</option>
        <option value="working">Working (clear)</option>
      </select>
      <button
        onClick={handleApply}
        disabled={loading}
        className="px-3 py-1 bg-amber-500 text-white rounded-sm hover:bg-amber-600 disabled:opacity-50 transition-colors font-medium"
      >
        {loading ? 'Applying…' : 'Apply'}
      </button>
      {result && <span className="text-gray-600 text-xs">{result}</span>}
    </div>
  );
}
