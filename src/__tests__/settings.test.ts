import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB module — chain: select().from().where().get()
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(),
  },
}));

import { getNonWorkingWeekdays, getVacationBudget } from '@/lib/services/settings';
import { db } from '@/lib/db';

beforeEach(() => {
  vi.clearAllMocks();
  (db.select as any).mockReturnThis();
  (db.from as any).mockReturnThis();
  (db.where as any).mockReturnThis();
});

describe('getNonWorkingWeekdays', () => {
  it('returns parsed array when row exists and value is a valid JSON array', async () => {
    (db.get as any).mockResolvedValue({ key: 'non_working_weekdays', value: '[1, 5]' });

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([1, 5]);
  });

  it('returns [] when no row found (get returns undefined)', async () => {
    (db.get as any).mockResolvedValue(undefined);

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([]);
  });

  it('returns [] when no row found (get returns null)', async () => {
    (db.get as any).mockResolvedValue(null);

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([]);
  });

  it('returns [] when value is not valid JSON ("not json")', async () => {
    (db.get as any).mockResolvedValue({ key: 'non_working_weekdays', value: 'not json' });

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([]);
  });

  it('returns [] when value is a JSON object, not an array ("{}")', async () => {
    (db.get as any).mockResolvedValue({ key: 'non_working_weekdays', value: '{}' });

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([]);
  });

  it('filters out non-number entries from the array', async () => {
    (db.get as any).mockResolvedValue({ key: 'non_working_weekdays', value: '[1, "foo", 3]' });

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([1, 3]);
  });

  it('returns [] when db throws', async () => {
    (db.get as any).mockRejectedValue(new Error('DB connection error'));

    const result = await getNonWorkingWeekdays();
    expect(result).toEqual([]);
  });
});

describe('getVacationBudget', () => {
  it('returns parsed int when row exists (value "25" → 25)', async () => {
    (db.get as any).mockResolvedValue({ key: 'vacation_budget', value: '25' });

    const result = await getVacationBudget();
    expect(result).toBe(25);
  });

  it('returns 0 when no row found', async () => {
    (db.get as any).mockResolvedValue(undefined);

    const result = await getVacationBudget();
    expect(result).toBe(0);
  });

  it('returns 0 when value is not a valid number ("abc")', async () => {
    (db.get as any).mockResolvedValue({ key: 'vacation_budget', value: 'abc' });

    const result = await getVacationBudget();
    expect(result).toBe(0);
  });

  it('returns 0 when db throws', async () => {
    (db.get as any).mockRejectedValue(new Error('DB connection error'));

    const result = await getVacationBudget();
    expect(result).toBe(0);
  });
});
