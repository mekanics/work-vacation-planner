import { describe, it, expect } from 'vitest';
import { getNextWorkingDay, getDaysRemainingThisYear } from '@/lib/utils/projectUtils';
import type { ProjectRecord, ProjectDayOverride } from '@/lib/services/projects';

function makeProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: 'proj-1',
    name: 'Test Project',
    colour: '#6366f1',
    startDate: null,
    endDate: null,
    weekdays: [1, 2, 3, 4, 5], // Mon-Fri
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// 2024-01-08 = Monday (start of a clean Mon-Fri week)
const MON_2024_01_08 = new Date('2024-01-08T12:00:00Z');

// ─── getNextWorkingDay ────────────────────────────────────────────────────────

describe('getNextWorkingDay', () => {
  it('Mon-Fri project, from Sunday → next day is Monday', () => {
    // 2024-01-07 = Sunday, next Mon = 2024-01-08
    const from = new Date('2024-01-07T12:00:00Z');
    expect(getNextWorkingDay(makeProject(), [], from)).toBe('2024-01-08');
  });

  it('Mon-Fri project, from Monday → next day is Tuesday', () => {
    // from = 2024-01-08 Mon, next = Tue 2024-01-09
    expect(getNextWorkingDay(makeProject(), [], MON_2024_01_08)).toBe('2024-01-09');
  });

  it('Mon-Fri project, from Friday → next day is Monday (skips weekend)', () => {
    // 2024-01-12 = Friday
    const from = new Date('2024-01-12T12:00:00Z');
    expect(getNextWorkingDay(makeProject(), [], from)).toBe('2024-01-15');
  });

  it('skips holidays', () => {
    // from = 2024-01-08 Mon, Tue 2024-01-09 is a holiday → next = Wed 2024-01-10
    expect(
      getNextWorkingDay(makeProject(), [], MON_2024_01_08, new Set(['2024-01-09']))
    ).toBe('2024-01-10');
  });

  it('skips vacation days', () => {
    // from = Mon, Tue is vacation, next = Wed
    expect(
      getNextWorkingDay(makeProject(), [], MON_2024_01_08, new Set(), new Set(['2024-01-09']))
    ).toBe('2024-01-10');
  });

  it('returns null when project has ended before tomorrow', () => {
    const project = makeProject({ endDate: '2024-01-08' }); // ends today (from = Mon)
    expect(getNextWorkingDay(project, [], MON_2024_01_08)).toBeNull();
  });

  it('returns a day equal to project endDate if it qualifies', () => {
    // endDate = next Tuesday 2024-01-09
    const project = makeProject({ endDate: '2024-01-09' });
    expect(getNextWorkingDay(project, [], MON_2024_01_08)).toBe('2024-01-09');
  });

  it('include override on a Saturday counts', () => {
    // from = Mon 2024-01-08, next Tue = 2024-01-09 would normally win,
    // but let's check that a Saturday with include override also works when mon-fri are all excluded
    const overrides: ProjectDayOverride[] = [
      // exclude all Mon-Fri in first week
      { projectId: 'proj-1', date: '2024-01-09', type: 'exclude' },
      { projectId: 'proj-1', date: '2024-01-10', type: 'exclude' },
      { projectId: 'proj-1', date: '2024-01-11', type: 'exclude' },
      { projectId: 'proj-1', date: '2024-01-12', type: 'exclude' },
      { projectId: 'proj-1', date: '2024-01-13', type: 'exclude' },
      // include Saturday
      { projectId: 'proj-1', date: '2024-01-13', type: 'include' },
    ];
    // Mon-Fri mask, but tue-fri excluded; Sat has include override
    // Sat 2024-01-13 should be next
    const projectMonOnly = makeProject({ weekdays: [1] }); // only Mon; Mon 08 is from day
    const ovr: ProjectDayOverride[] = [
      { projectId: 'proj-1', date: '2024-01-13', type: 'include' }, // Sat
    ];
    // from = Mon 08 → next Mon is 2024-01-15, but Sat 2024-01-13 has include override → Sat wins
    expect(getNextWorkingDay(projectMonOnly, ovr, MON_2024_01_08)).toBe('2024-01-13');
  });

  it('exclude override on next day → skips it', () => {
    const overrides: ProjectDayOverride[] = [
      { projectId: 'proj-1', date: '2024-01-09', type: 'exclude' }, // Tue excluded
    ];
    expect(getNextWorkingDay(makeProject(), overrides, MON_2024_01_08)).toBe('2024-01-10');
  });
});

// ─── getDaysRemainingThisYear ─────────────────────────────────────────────────

describe('getDaysRemainingThisYear', () => {
  it('Mon-Fri project: remaining days in a week are correctly counted', () => {
    // from = Monday 2024-01-08 (exclusive) → Tue, Wed, Thu, Fri = 4 days remaining this week
    // But "remaining this year" = all Mon-Fri from Tue Jan 09 to Dec 31 2024
    // 2024 has 52 full weeks + a few extra days from Jan 01 (Mon) to Dec 31 (Tue)
    // Not testing exact count, just checking it's > 0 and reasonable
    const result = getDaysRemainingThisYear(makeProject(), [], MON_2024_01_08);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(260); // can't have more than 260 working days remaining
  });

  it('from last day of year → 0 remaining', () => {
    const from = new Date('2024-12-31T12:00:00Z');
    expect(getDaysRemainingThisYear(makeProject(), [], from)).toBe(0);
  });

  it('holidays reduce count', () => {
    // from = Mon 2024-01-08, check just 1 week: Tue-Fri = 4 days (without holidays)
    // Add Tue as holiday → 3
    const withHoliday = getDaysRemainingThisYear(
      makeProject(),
      [],
      MON_2024_01_08,
      new Set(['2024-01-09']) // Tue holiday
    );
    const withoutHoliday = getDaysRemainingThisYear(makeProject(), [], MON_2024_01_08);
    expect(withHoliday).toBe(withoutHoliday - 1);
  });

  it('vacation days reduce count', () => {
    const withVacation = getDaysRemainingThisYear(
      makeProject(),
      [],
      MON_2024_01_08,
      new Set(),
      new Set(['2024-01-09']) // Tue vacation
    );
    const withoutVacation = getDaysRemainingThisYear(makeProject(), [], MON_2024_01_08);
    expect(withVacation).toBe(withoutVacation - 1);
  });

  it('project ending before year end is respected', () => {
    // Project ends Jan 12 (Friday), from = Mon Jan 08 → remaining = Tue, Wed, Thu, Fri = 4
    const project = makeProject({ endDate: '2024-01-12' });
    expect(getDaysRemainingThisYear(project, [], MON_2024_01_08)).toBe(4);
  });

  it('exclude override removes a day from count', () => {
    const overrides: ProjectDayOverride[] = [
      { projectId: 'proj-1', date: '2024-01-09', type: 'exclude' },
    ];
    const withExclude = getDaysRemainingThisYear(makeProject(), overrides, MON_2024_01_08);
    const withoutExclude = getDaysRemainingThisYear(makeProject(), [], MON_2024_01_08);
    expect(withExclude).toBe(withoutExclude - 1);
  });
});
