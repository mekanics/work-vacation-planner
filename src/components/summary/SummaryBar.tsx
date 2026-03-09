interface SummaryBarProps {
  working: number;
  vacation: number;
  holidays: number;
  weekdays: number;
}

export function SummaryBar({
  working,
  vacation,
  holidays,
  weekdays,
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
