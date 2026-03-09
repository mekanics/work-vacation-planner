import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { projects } from '@/lib/db/schema';

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

import { calculateProjectWorkingDays } from '@/lib/services/projects';
import { db } from '@/lib/db';
import { getHolidayDateSet } from '@/lib/services/holidays';

function makeProject(overrides: Partial<typeof projects.$inferSelect> = {}): typeof projects.$inferSelect {
  return {
    id: 'proj-1',
    name: 'Test Project',
    colour: '#6366f1',
    startDate: null,
    endDate: null,
    weekdays: JSON.stringify([1, 2, 3, 4, 5]), // Mon-Fri
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Setup common mock chain for the 3 sequential db.where() calls:
 *  1. getProject
 *  2. vacation days in range
 *  3. project day overrides
 */
function mockDbCalls(
  projectRows: any[],
  vacationRows: any[] = [],
  overrideRows: any[] = [],
  holidaySet: Set<string> = new Set()
) {
  (db.where as any)
    .mockResolvedValueOnce(projectRows)    // getProject
    .mockResolvedValueOnce(vacationRows)   // vacation days
    .mockResolvedValueOnce(overrideRows);  // project overrides
  (getHolidayDateSet as any).mockResolvedValue(holidaySet);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('calculateProjectWorkingDays', () => {
  it('project not found — returns null', async () => {
    (db.where as any).mockResolvedValueOnce([]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).toBeNull();
  });

  it('basic weekday mask Mon-Fri — 5 project days, 5 working days', async () => {
    mockDbCalls([makeProject()]);

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(5);
    expect(result!.working_days).toBe(5);
    expect(result!.holidays).toBe(0);
    expect(result!.vacation_days).toBe(0);
  });

  it('weekday mask Mon-Wed only ([1,2,3]) — same week: 3 project days, 3 working days', async () => {
    mockDbCalls([makeProject({ weekdays: JSON.stringify([1, 2, 3]) })]);

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(3);
    expect(result!.working_days).toBe(3);
  });

  it('project date clamping (start) — project starts 2024-01-10, range starts 2024-01-08', async () => {
    // Only Wed-Fri counted = 3 days
    mockDbCalls([makeProject({ startDate: '2024-01-10' })]);

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(3);
    expect(result!.working_days).toBe(3);
  });

  it('project date clamping (end) — project ends 2024-01-10, range ends 2024-01-12', async () => {
    // Mon-Wed = 3 days
    mockDbCalls([makeProject({ endDate: '2024-01-10' })]);

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(3);
    expect(result!.working_days).toBe(3);
  });

  it('range entirely outside project dates — returns 0 working days (not null)', async () => {
    // Project ends before range starts
    (db.where as any).mockResolvedValueOnce([makeProject({ endDate: '2024-01-05' })]);
    (getHolidayDateSet as any).mockResolvedValue(new Set<string>());

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.working_days).toBe(0);
    expect(result!.total_project_days).toBe(0);
  });

  it('holiday on a project day — holidays = 1, working_days reduced', async () => {
    mockDbCalls([makeProject()], [], [], new Set(['2024-01-09'])); // Tue holiday

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.holidays).toBe(1);
    expect(result!.working_days).toBe(4);
  });

  it('vacation on a project day — vacation_days = 1, working_days reduced', async () => {
    mockDbCalls(
      [makeProject()],
      [{ date: '2024-01-09', dayType: 'vacation', note: null, createdAt: '', updatedAt: '' }]
    );

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.vacation_days).toBe(1);
    expect(result!.working_days).toBe(4);
  });

  it('include override on a weekend — Saturday counted as project day', async () => {
    // Project has Mon-Fri mask. Sat 2024-01-06 has an include override.
    mockDbCalls(
      [makeProject()],
      [],
      [{ projectId: 'proj-1', date: '2024-01-06', type: 'include' }]
    );

    // Range: Sat-Sun = 2024-01-06 to 2024-01-07 (0 normal project days, 1 include override)
    const result = await calculateProjectWorkingDays('proj-1', '2024-01-06', '2024-01-07');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(1);
    expect(result!.working_days).toBe(1);
  });

  it('exclude override on a weekday — Tuesday NOT counted', async () => {
    // Mon-Fri minus excluded Tuesday = 4 project days
    mockDbCalls(
      [makeProject()],
      [],
      [{ projectId: 'proj-1', date: '2024-01-09', type: 'exclude' }]
    );

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-08', '2024-01-12');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(4);
    expect(result!.working_days).toBe(4);
  });

  it('holiday wins over include override — totalProjectDays++ but holidays++, working_days not incremented', async () => {
    // Sat 2024-01-06 has an include override AND is a holiday
    mockDbCalls(
      [makeProject()],
      [],
      [{ projectId: 'proj-1', date: '2024-01-06', type: 'include' }],
      new Set(['2024-01-06'])
    );

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-06', '2024-01-07');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(1);
    expect(result!.holidays).toBe(1);
    expect(result!.working_days).toBe(0);
  });

  it('vacation wins over include override — vacation_days incremented', async () => {
    // Sat 2024-01-06 has an include override AND is a vacation day
    mockDbCalls(
      [makeProject()],
      [{ date: '2024-01-06', dayType: 'vacation', note: null, createdAt: '', updatedAt: '' }],
      [{ projectId: 'proj-1', date: '2024-01-06', type: 'include' }]
    );

    const result = await calculateProjectWorkingDays('proj-1', '2024-01-06', '2024-01-07');
    expect(result).not.toBeNull();
    expect(result!.total_project_days).toBe(1);
    expect(result!.vacation_days).toBe(1);
    expect(result!.working_days).toBe(0);
  });
});
