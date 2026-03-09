import { describe, it, expect } from 'vitest';
import {
  isWeekend,
  eachDayInRange,
  toISODate,
  isValidISODate,
  todayISO,
} from '@/lib/utils/dates';

describe('isWeekend', () => {
  it('returns true for Saturday (2024-01-06)', () => {
    expect(isWeekend(new Date('2024-01-06'))).toBe(true);
  });

  it('returns true for Sunday (2024-01-07)', () => {
    expect(isWeekend(new Date('2024-01-07'))).toBe(true);
  });

  it('returns false for Monday (2024-01-08)', () => {
    expect(isWeekend(new Date('2024-01-08'))).toBe(false);
  });
});

describe('eachDayInRange', () => {
  it('single day returns 1 item', () => {
    const days = eachDayInRange('2024-01-08', '2024-01-08');
    expect(days).toHaveLength(1);
  });

  it('Mon-Fri returns 5 items', () => {
    const days = eachDayInRange('2024-01-08', '2024-01-12');
    expect(days).toHaveLength(5);
  });

  it('handles cross-month boundary', () => {
    // Jan 29, 30, 31, Feb 1 = 4 days
    const days = eachDayInRange('2024-01-29', '2024-02-01');
    expect(days).toHaveLength(4);
  });
});

describe('toISODate', () => {
  it('converts a known date to the right string', () => {
    // Use UTC noon to avoid timezone issues
    const d = new Date('2024-03-15T12:00:00');
    expect(toISODate(d)).toBe('2024-03-15');
  });
});

describe('isValidISODate', () => {
  it('accepts a valid date', () => {
    expect(isValidISODate('2024-06-15')).toBe(true);
  });

  it('rejects an invalid string', () => {
    expect(isValidISODate('not-a-date')).toBe(false);
  });

  it('rejects wrong format', () => {
    expect(isValidISODate('06/15/2024')).toBe(false);
  });

  it('accepts leap year Feb 29 (2024)', () => {
    expect(isValidISODate('2024-02-29')).toBe(true);
  });

  it('rejects non-leap year Feb 29 (2023)', () => {
    expect(isValidISODate('2023-02-29')).toBe(false);
  });
});

describe('todayISO', () => {
  it('returns a string matching YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
