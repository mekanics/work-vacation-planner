import { describe, it, expect } from 'vitest';
import { computeIsProjectDay, computeIsIncluded } from '@/lib/utils/projectCalendar';
import type { ProjectRecord } from '@/lib/services/projects';

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

// ─── computeIsProjectDay ─────────────────────────────────────────────────────

describe('computeIsProjectDay', () => {
  it('Monday in Mon-Fri project → true', () => {
    // 2024-01-08 = Monday
    expect(computeIsProjectDay('2024-01-08', makeProject())).toBe(true);
  });

  it('Saturday in Mon-Fri project → false', () => {
    // 2024-01-06 = Saturday
    expect(computeIsProjectDay('2024-01-06', makeProject())).toBe(false);
  });

  it('Sunday in Mon-Fri project → false', () => {
    // 2024-01-07 = Sunday
    expect(computeIsProjectDay('2024-01-07', makeProject())).toBe(false);
  });

  it('Wednesday in Mon-Wed project → true', () => {
    // 2024-01-10 = Wednesday
    expect(computeIsProjectDay('2024-01-10', makeProject({ weekdays: [1, 2, 3] }))).toBe(true);
  });

  it('Thursday in Mon-Wed project → false', () => {
    // 2024-01-11 = Thursday
    expect(computeIsProjectDay('2024-01-11', makeProject({ weekdays: [1, 2, 3] }))).toBe(false);
  });

  it('date before project startDate → false', () => {
    const project = makeProject({ startDate: '2024-01-10' });
    // 2024-01-08 = Monday, but project hasn't started
    expect(computeIsProjectDay('2024-01-08', project)).toBe(false);
  });

  it('date equal to project startDate → uses weekday mask', () => {
    // 2024-01-10 = Wednesday (in Mon-Fri mask)
    const project = makeProject({ startDate: '2024-01-10' });
    expect(computeIsProjectDay('2024-01-10', project)).toBe(true);
  });

  it('date after project endDate → false', () => {
    const project = makeProject({ endDate: '2024-01-10' });
    // 2024-01-12 = Friday, but project has ended
    expect(computeIsProjectDay('2024-01-12', project)).toBe(false);
  });

  it('date equal to project endDate → uses weekday mask', () => {
    // 2024-01-12 = Friday
    const project = makeProject({ endDate: '2024-01-12' });
    expect(computeIsProjectDay('2024-01-12', project)).toBe(true);
  });

  it('no startDate or endDate constraint — only weekday mask matters', () => {
    const project = makeProject({ startDate: null, endDate: null });
    // 2024-01-09 = Tuesday
    expect(computeIsProjectDay('2024-01-09', project)).toBe(true);
  });

  it('project with only Sunday active', () => {
    // 2024-01-07 = Sunday (dow=0)
    const project = makeProject({ weekdays: [0] });
    expect(computeIsProjectDay('2024-01-07', project)).toBe(true);
    // 2024-01-08 = Monday → false
    expect(computeIsProjectDay('2024-01-08', project)).toBe(false);
  });
});

// ─── computeIsIncluded ───────────────────────────────────────────────────────

describe('computeIsIncluded', () => {
  it('project day, no overrides → included', () => {
    expect(computeIsIncluded(true, false, false)).toBe(true);
  });

  it('project day + exclude override → excluded', () => {
    expect(computeIsIncluded(true, false, true)).toBe(false);
  });

  it('non-project day, no overrides → excluded', () => {
    expect(computeIsIncluded(false, false, false)).toBe(false);
  });

  it('non-project day + include override → included', () => {
    expect(computeIsIncluded(false, true, false)).toBe(true);
  });

  it('include override wins over exclude override (data anomaly)', () => {
    expect(computeIsIncluded(true, true, true)).toBe(true);
  });

  it('non-project day + exclude override (redundant) → excluded', () => {
    expect(computeIsIncluded(false, false, true)).toBe(false);
  });

  it('project day + include override (redundant) → included', () => {
    expect(computeIsIncluded(true, true, false)).toBe(true);
  });
});
