import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
  },
}));

// Mock holiday service
vi.mock('@/lib/services/holidays', () => ({
  getHolidayDateSet: vi.fn(),
}));

// Mock settings service — calculateWorkingDays calls getNonWorkingWeekdays()
vi.mock('@/lib/services/settings', () => ({
  getNonWorkingWeekdays: vi.fn(),
}));

import { calculateWorkingDays } from '@/lib/services/working-days';
import { db } from '@/lib/db';
import { getHolidayDateSet } from '@/lib/services/holidays';
import { getNonWorkingWeekdays } from '@/lib/services/settings';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no non-working weekdays (preserves existing test behaviour)
  (getNonWorkingWeekdays as any).mockResolvedValue([]);
});

describe('calculateWorkingDays', () => {
  it('pure weekdays only — Mon-Fri with no holidays or vacation', async () => {
    (db as any).where.mockResolvedValue([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.total_days).toBe(5);
    expect(result.weekdays).toBe(5);
    expect(result.public_holidays).toBe(0);
    expect(result.vacation_days).toBe(0);
    expect(result.working_days).toBe(5);
  });

  it('weekend exclusion — Sat-Sun: 0 weekdays, 0 working days', async () => {
    (db as any).where.mockResolvedValue([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-06', '2024-01-07');
    expect(result.total_days).toBe(2);
    expect(result.weekdays).toBe(0);
    expect(result.working_days).toBe(0);
  });

  it('full week with weekend — Mon-Sun: 7 days, 5 weekdays, 5 working days', async () => {
    (db as any).where.mockResolvedValue([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-08', '2024-01-14');
    expect(result.total_days).toBe(7);
    expect(result.weekdays).toBe(5);
    expect(result.working_days).toBe(5);
  });

  it('holiday on a weekday — working_days = weekdays - 1', async () => {
    (db as any).where.mockResolvedValue([]);
    // Tuesday 2024-01-09 is a holiday
    (getHolidayDateSet as any).mockResolvedValue(new Set(['2024-01-09']));

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.weekdays).toBe(5);
    expect(result.public_holidays).toBe(1);
    expect(result.working_days).toBe(4);
  });

  it('holiday on a weekend — public_holidays = 0, working_days unchanged', async () => {
    (db as any).where.mockResolvedValue([]);
    // Saturday 2024-01-06 is a holiday but falls on weekend
    (getHolidayDateSet as any).mockResolvedValue(new Set(['2024-01-06']));

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.weekdays).toBe(5);
    expect(result.public_holidays).toBe(0);
    expect(result.working_days).toBe(5);
  });

  it('vacation on a weekday — vacation_days = 1, working_days reduced', async () => {
    // Tuesday 2024-01-09 is a vacation day
    (db as any).where.mockResolvedValue([{ date: '2024-01-09', dayType: 'vacation' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.vacation_days).toBe(1);
    expect(result.working_days).toBe(4);
  });

  it('vacation on a weekend — NOT counted (vacation_days = 0)', async () => {
    // Saturday 2024-01-06 stored as vacation in DB
    (db as any).where.mockResolvedValue([{ date: '2024-01-06', dayType: 'vacation' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-06', '2024-01-07');
    expect(result.vacation_days).toBe(0);
    expect(result.working_days).toBe(0);
  });

  it('holiday + vacation same day — holiday wins, vacation_days = 0', async () => {
    // Tuesday 2024-01-09 is both a holiday and vacation
    (db as any).where.mockResolvedValue([{ date: '2024-01-09', dayType: 'vacation' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set(['2024-01-09']));

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.public_holidays).toBe(1);
    expect(result.vacation_days).toBe(0);
    expect(result.working_days).toBe(4);
  });

  it('working_days never negative — more holidays+vacation than weekdays: working_days = 0', async () => {
    // Mon-Fri (5 days), all 5 are holidays AND vacations (holidays win each, so 5 holidays = -5, clamped)
    (db as any).where.mockResolvedValue([
      { date: '2024-01-08', dayType: 'vacation' },
      { date: '2024-01-09', dayType: 'vacation' },
      { date: '2024-01-10', dayType: 'vacation' },
      { date: '2024-01-11', dayType: 'vacation' },
      { date: '2024-01-12', dayType: 'vacation' },
    ]);
    (getHolidayDateSet as any).mockResolvedValue(
      new Set(['2024-01-08', '2024-01-09', '2024-01-10', '2024-01-11', '2024-01-12'])
    );

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.working_days).toBe(0);
  });
});

describe('calculateWorkingDays — working weekends', () => {
  it('working_weekend day on Saturday is counted in working_days', async () => {
    // Sat 2024-01-06 is marked as working_weekend
    (db as any).where.mockResolvedValue([{ date: '2024-01-06', dayType: 'working_weekend' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-06', '2024-01-07');
    expect(result.working_days).toBe(1);
    expect(result.weekdays).toBe(0); // Sat/Sun are still not "weekdays"
  });

  it('working_weekend on a regular weekday — treated as normal working day, not double-counted', async () => {
    // Monday 2024-01-08 somehow has dayType='working_weekend' — should count once as normal weekday
    (db as any).where.mockResolvedValue([{ date: '2024-01-08', dayType: 'working_weekend' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.weekdays).toBe(5);
    expect(result.working_days).toBe(5); // Not 6
  });

  it('holiday beats working_weekend — working_days = 0', async () => {
    // Sat 2024-01-06 is working_weekend AND a holiday
    (db as any).where.mockResolvedValue([{ date: '2024-01-06', dayType: 'working_weekend' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set(['2024-01-06']));

    const result = await calculateWorkingDays('2024-01-06', '2024-01-07');
    expect(result.working_days).toBe(0);
  });

  it('vacation beats working_weekend — vacation wins, working_days = 0', async () => {
    // Sat 2024-01-06 is working_weekend AND vacation
    (db as any).where.mockResolvedValue([
      { date: '2024-01-06', dayType: 'working_weekend' },
      { date: '2024-01-06', dayType: 'vacation' },
    ]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateWorkingDays('2024-01-06', '2024-01-07');
    expect(result.working_days).toBe(0);
  });

});

describe('calculateWorkingDays — non-working weekdays', () => {
  // Reference week: 2024-01-08 (Mon) to 2024-01-12 (Fri)
  // dow: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5

  it('Friday (dow=5) configured as non-working: Mon–Fri → weekdays=5, non_working_weekday_days=1, working_days=4', async () => {
    (db as any).where.mockResolvedValue([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());
    (getNonWorkingWeekdays as any).mockResolvedValue([5]); // Friday is non-working

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.weekdays).toBe(5);
    expect(result.non_working_weekday_days).toBe(1);
    expect(result.working_days).toBe(4);
  });

  it('Mon+Fri (dow=1,5) configured as non-working: Mon–Fri → weekdays=5, non_working_weekday_days=2, working_days=3', async () => {
    (db as any).where.mockResolvedValue([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());
    (getNonWorkingWeekdays as any).mockResolvedValue([1, 5]); // Monday and Friday are non-working

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.weekdays).toBe(5);
    expect(result.non_working_weekday_days).toBe(2);
    expect(result.working_days).toBe(3);
  });

  it('non-working weekday that is also a holiday — holiday NOT counted (non-working skip takes priority)', async () => {
    (db as any).where.mockResolvedValue([]);
    // Friday 2024-01-12 is both non-working AND a holiday
    (getHolidayDateSet as any).mockResolvedValue(new Set(['2024-01-12']));
    (getNonWorkingWeekdays as any).mockResolvedValue([5]); // Friday is non-working

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.public_holidays).toBe(0);   // holiday not counted (day skipped via nonWorkingWeekdaySet)
    expect(result.non_working_weekday_days).toBe(1);
    expect(result.working_days).toBe(4);
  });

  it('non-working weekday with a vacation DB entry — vacation NOT counted', async () => {
    // Friday 2024-01-12 is non-working AND has a vacation entry
    (db as any).where.mockResolvedValue([{ date: '2024-01-12', dayType: 'vacation' }]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());
    (getNonWorkingWeekdays as any).mockResolvedValue([5]); // Friday is non-working

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.vacation_days).toBe(0);     // vacation not counted (non-working skips vacation logic)
    expect(result.non_working_weekday_days).toBe(1);
    expect(result.working_days).toBe(4);
  });

  it('no non-working weekdays configured ([]) — existing behaviour unchanged, non_working_weekday_days=0', async () => {
    (db as any).where.mockResolvedValue([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());
    (getNonWorkingWeekdays as any).mockResolvedValue([]); // no non-working weekdays

    const result = await calculateWorkingDays('2024-01-08', '2024-01-12');
    expect(result.weekdays).toBe(5);
    expect(result.non_working_weekday_days).toBe(0);
    expect(result.working_days).toBe(5);
  });
});
