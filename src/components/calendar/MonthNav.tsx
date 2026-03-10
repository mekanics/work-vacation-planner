'use client';

import { useRouter } from 'next/navigation';
import { addMonths, subMonths } from 'date-fns';

interface MonthNavProps {
  year: number;
  month: number;
}

export function MonthNav({ year, month }: MonthNavProps) {
  const router = useRouter();

  const currentDate = new Date(year, month - 1, 1);
  const prevDate = subMonths(currentDate, 1);
  const nextDate = addMonths(currentDate, 1);

  const navigate = (date: Date) => {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    router.push(`/${y}/${m}`);
  };

  const goToToday = () => {
    const now = new Date();
    router.push(`/${now.getFullYear()}/${now.getMonth() + 1}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(prevDate)}
        className="px-3 py-1.5 text-sm rounded-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Previous month"
      >
        ←
      </button>
      <button
        onClick={goToToday}
        className="px-3 py-1.5 text-sm rounded-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Go to today"
      >
        Today
      </button>
      <button
        onClick={() => navigate(nextDate)}
        className="px-3 py-1.5 text-sm rounded-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-label="Next month"
      >
        →
      </button>
    </div>
  );
}
