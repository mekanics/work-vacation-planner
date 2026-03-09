export type DayType = 'working' | 'vacation' | 'day_off' | 'working_weekend';

export interface DayRecord {
  date: string;
  dayType: DayType;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HolidayRecord {
  date: string;
  name: string;
  canton: string;
  year: number;
  global: number;
}

export interface ProjectStripe {
  projectId: string;
  colour: string;
  /** true = project day (solid stripe); false = not a project day (dashed hint) */
  included: boolean;
}

export interface CalendarDay {
  date: string;
  dayType: DayType;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isCurrentMonth: boolean;
  /** Hex colours of projects active on this day (empty if none) — kept for back-compat */
  projectColours?: string[];
  /** Rich stripe info: one entry per project, carrying id + colour + inclusion state */
  projectStripes?: ProjectStripe[];
}

export interface MonthSummary {
  month: string; // YYYY-MM
  weekdays: number;
  public_holidays: number;
  vacation_days: number;
  working_days: number;
  day_off_days: number;
}

export interface YearSummary {
  year: number;
  vacation_budget: number;
  vacation_used: number;
  vacation_remaining: number;
  day_off_days: number;
  months: MonthSummary[];
}
