interface SummaryBarProps {
  working: number;
  vacation: number;
  holidays: number;
  weekdays: number;
  vacationBudget?: number;
  vacationUsedYTD?: number;
}

export function SummaryBar({
  working,
  vacation,
  holidays,
  weekdays,
  vacationBudget = 0,
  vacationUsedYTD = 0,
}: SummaryBarProps) {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <Stat
        label="Working days"
        value={working}
        color="text-gray-700"
        bg="bg-white border border-gray-200"
      />
      <Stat
        label="Vacation"
        value={vacation}
        color="text-green-700"
        bg="bg-green-50 border border-green-200"
      />
      <Stat
        label="Public holidays"
        value={holidays}
        color="text-blue-700"
        bg="bg-blue-50 border border-blue-200"
      />
      <Stat
        label="Weekdays"
        value={weekdays}
        color="text-gray-500"
        bg="bg-gray-50 border border-gray-200"
      />
      {vacationBudget > 0 && (
        <VacationBudgetStat used={vacationUsedYTD} budget={vacationBudget} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded ${bg}`}>
      <span className={`font-bold text-base ${color}`}>{value}</span>
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

function VacationBudgetStat({ used, budget }: { used: number; budget: number }) {
  const remaining = Math.max(0, budget - used);
  const pct = Math.min(100, Math.round((used / budget) * 100));
  const overBudget = used > budget;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-50 border border-amber-200">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className={`font-bold text-base ${overBudget ? 'text-red-600' : 'text-amber-700'}`}>
            {used}
          </span>
          <span className="text-gray-600">/ {budget} vacation days used YTD</span>
          {overBudget ? (
            <span className="text-xs text-red-600 font-medium">({used - budget} over)</span>
          ) : (
            <span className="text-xs text-gray-400">({remaining} left)</span>
          )}
        </div>
        {/* Progress bar */}
        <div className="w-32 h-1.5 bg-amber-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-400' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
