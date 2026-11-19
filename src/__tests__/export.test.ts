import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB module
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

// Mock holiday service
vi.mock('@/lib/services/holidays', () => ({
  getHolidaysForYear: vi.fn().mockResolvedValue([]),
}));

// Mock settings service
vi.mock('@/lib/services/settings', () => ({
  getNonWorkingWeekdays: vi.fn().mockResolvedValue([]),
}));

// Mock projects service
vi.mock('@/lib/services/projects', () => ({
  getProjects: vi.fn().mockResolvedValue([]),
  getOverridesForProjects: vi.fn().mockResolvedValue(new Map()),
}));

import { GET } from '@/app/api/export/route';
import { db } from '@/lib/db';
import { getHolidaysForYear } from '@/lib/services/holidays';
import { getNonWorkingWeekdays } from '@/lib/services/settings';
import { getProjects, getOverridesForProjects } from '@/lib/services/projects';

const makeRequest = (year: string) =>
  new Request(`http://localhost/api/export?year=${year}`) as any;

const makeRequestNoYear = () =>
  new Request(`http://localhost/api/export`) as any;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset all mocks to safe defaults
  (db as any).select.mockReturnThis();
  (db as any).from.mockReturnThis();
  (db as any).where.mockResolvedValue([]);
  (getHolidaysForYear as any).mockResolvedValue([]);
  (getNonWorkingWeekdays as any).mockResolvedValue([]);
  (getProjects as any).mockResolvedValue([]);
  (getOverridesForProjects as any).mockResolvedValue(new Map());
});

// ─── Helper to parse CSV from a Response ─────────────────────────────────────

async function parseCsv(response: Response): Promise<string[][]> {
  const text = await response.text();
  return text
    .split(/\r\n|\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split(','));
}

async function getCsvLines(response: Response): Promise<string[]> {
  const text = await response.text();
  return text.split(/\r\n|\n/).filter((line) => line.length > 0);
}

// ─── Invalid year tests ───────────────────────────────────────────────────────

describe('GET /api/export — invalid year', () => {
  it('returns 400 for non-numeric year (?year=abc)', async () => {
    const res = await GET(makeRequest('abc'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for year below range (?year=1999)', async () => {
    const res = await GET(makeRequest('1999'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 for year above range (?year=2101)', async () => {
    const res = await GET(makeRequest('2101'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});

// ─── Empty year (no data) tests ───────────────────────────────────────────────

describe('GET /api/export — empty year (no holidays, vacation, projects)', () => {
  it('returns 200 with text/csv content type', async () => {
    const res = await GET(makeRequest('2024'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
  });

  it('Content-Disposition includes work-planner-2024.csv', async () => {
    const res = await GET(makeRequest('2024'));
    const disposition = res.headers.get('Content-Disposition') ?? '';
    expect(disposition).toContain('work-planner-2024.csv');
  });

  it('CSV has header row as first line', async () => {
    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    expect(lines[0]).toBe('Date,DayOfWeek,Type,Holiday Name,Projects,Client,End Client');
  });

  it('Mon–Fri weekdays appear in CSV with type "Working"', async () => {
    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    // 2024-01-01 is Monday — should appear as Working
    const jan1 = lines.find((l) => l.startsWith('2024-01-01,'));
    expect(jan1).toBeDefined();
    expect(jan1).toContain('Monday');
    expect(jan1).toContain('Working');
  });

  it('Saturday and Sunday rows are skipped (regular weekends not in CSV)', async () => {
    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    // 2024-01-06 = Saturday, 2024-01-07 = Sunday — should NOT appear
    const sat = lines.find((l) => l.startsWith('2024-01-06,'));
    const sun = lines.find((l) => l.startsWith('2024-01-07,'));
    expect(sat).toBeUndefined();
    expect(sun).toBeUndefined();
  });

  it('each data row has exactly 7 comma-separated fields', async () => {
    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    // Spot-check first 10 data rows (skip header)
    const dataLines = lines.slice(1, 11);
    for (const line of dataLines) {
      const fields = line.split(',');
      expect(fields).toHaveLength(7);
    }
  });

  it('header is exactly Date,DayOfWeek,Type,Holiday Name,Projects,Client,End Client', async () => {
    const res = await GET(makeRequest('2024'));
    const rows = await parseCsv(res);
    expect(rows[0]).toEqual([
      'Date',
      'DayOfWeek',
      'Type',
      'Holiday Name',
      'Projects',
      'Client',
      'End Client',
    ]);
  });
});

// ─── Holiday row ──────────────────────────────────────────────────────────────

describe('GET /api/export — holiday row', () => {
  it('a day matching a holiday appears as type "Holiday" with holiday name', async () => {
    // 2024-01-02 = Tuesday
    (getHolidaysForYear as any).mockResolvedValue([
      { date: '2024-01-02', name: 'New Year Holiday', canton: 'ZH', year: 2024, global: 1 },
    ]);

    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    const holidayLine = lines.find((l) => l.startsWith('2024-01-02,'));
    expect(holidayLine).toBeDefined();
    expect(holidayLine).toContain('Holiday');
    expect(holidayLine).toContain('New Year Holiday');
  });
});

// ─── Vacation row ─────────────────────────────────────────────────────────────

describe('GET /api/export — vacation row', () => {
  it('a day with dayType="vacation" in DB appears as type "Vacation"', async () => {
    // 2024-01-03 = Wednesday
    (db as any).where.mockResolvedValue([{ date: '2024-01-03', dayType: 'vacation' }]);

    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    const vacationLine = lines.find((l) => l.startsWith('2024-01-03,'));
    expect(vacationLine).toBeDefined();
    expect(vacationLine).toContain('Vacation');
  });
});

// ─── Non-working weekday ──────────────────────────────────────────────────────

describe('GET /api/export — non-working weekday', () => {
  it('all Fridays in year are "Non-working weekday" when dow=5 is configured', async () => {
    (getNonWorkingWeekdays as any).mockResolvedValue([5]); // Friday = dow 5

    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    // 2024-01-05 = Friday (first Friday of 2024)
    const fridayLine = lines.find((l) => l.startsWith('2024-01-05,'));
    expect(fridayLine).toBeDefined();
    expect(fridayLine).toContain('Non-working weekday');

    // 2024-01-12 = second Friday — also non-working
    const friday2 = lines.find((l) => l.startsWith('2024-01-12,'));
    expect(friday2).toBeDefined();
    expect(friday2).toContain('Non-working weekday');
  });
});

// ─── Working weekend ──────────────────────────────────────────────────────────

describe('GET /api/export — working weekend', () => {
  it('a Saturday with dayType="working_weekend" appears as "Working Weekend"', async () => {
    // 2024-01-06 = Saturday
    (db as any).where.mockResolvedValue([{ date: '2024-01-06', dayType: 'working_weekend' }]);

    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    // Regular Sat 2024-01-13 should still be absent
    const regularSat = lines.find((l) => l.startsWith('2024-01-13,'));
    expect(regularSat).toBeUndefined();

    // Working weekend Saturday should be present
    const workingWeekendLine = lines.find((l) => l.startsWith('2024-01-06,'));
    expect(workingWeekendLine).toBeDefined();
    expect(workingWeekendLine).toContain('Working Weekend');
    expect(workingWeekendLine).toContain('Saturday');
  });
});

// ─── CSV structure spot-check ─────────────────────────────────────────────────

describe('GET /api/export — CSV structure spot-check', () => {
  it('known date 2024-01-01 (Monday) has 7 fields: date, day, type, holiday name, projects, client, end client', async () => {
    const res = await GET(makeRequest('2024'));
    const lines = await getCsvLines(res);
    const jan1 = lines.find((l) => l.startsWith('2024-01-01,'));
    expect(jan1).toBeDefined();
    const fields = jan1!.split(',');
    expect(fields).toHaveLength(7);
    expect(fields[0]).toBe('2024-01-01');
    expect(fields[1]).toBe('Monday');
    expect(fields[2]).toBe('Working');
    expect(fields[3]).toBe(''); // no holiday name
    expect(fields[4]).toBe(''); // no projects
    expect(fields[5]).toBe(''); // no client
    expect(fields[6]).toBe(''); // no end client
  });
});

// ─── Client and end-client columns ──────────────────────────────────────────

describe('GET /api/export — client and end-client columns', () => {
  it('a working day with an active project shows client and end client', async () => {
    (getProjects as any).mockResolvedValue([
      {
        id: 'project-acme-001',
        name: 'Acme Redesign',
        clientId: 'client-acme-001',
        clientName: 'acme',
        endClient: 'Alpha',
        colour: '#4f86c6',
        colourOverride: null,
        startDate: null,
        endDate: null,
        weekdays: [1, 2, 3, 4, 5],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ]);
    (getOverridesForProjects as any).mockResolvedValue(new Map());

    const res = await GET(makeRequest('2024'));
    const rows = await parseCsv(res);
    const jan1 = rows.find((r) => r[0] === '2024-01-01');
    expect(jan1).toBeDefined();
    expect(jan1![4]).toBe('Acme Redesign');
    expect(jan1![5]).toBe('acme');
    expect(jan1![6]).toBe('Alpha');
  });

  it('vacation and holiday rows with no active project leave client/end client blank', async () => {
    (db as any).where.mockResolvedValue([{ date: '2024-01-03', dayType: 'vacation' }]);
    (getHolidaysForYear as any).mockResolvedValue([
      { date: '2024-01-02', name: 'New Year Holiday', canton: 'ZH', year: 2024, global: 1 },
    ]);

    const res = await GET(makeRequest('2024'));
    const rows = await parseCsv(res);
    const holidayRow = rows.find((r) => r[0] === '2024-01-02');
    const vacationRow = rows.find((r) => r[0] === '2024-01-03');
    expect(holidayRow).toBeDefined();
    expect(holidayRow![4]).toBe('');
    expect(holidayRow![5]).toBe('');
    expect(holidayRow![6]).toBe('');
    expect(vacationRow).toBeDefined();
    expect(vacationRow![4]).toBe('');
    expect(vacationRow![5]).toBe('');
    expect(vacationRow![6]).toBe('');
  });

  it('internal system project shows client name "Internal" verbatim', async () => {
    (getProjects as any).mockResolvedValue([
      {
        id: 'project-internal-001',
        name: 'Internal Planning',
        clientId: 'client-internal-001',
        clientName: 'Internal',
        endClient: null,
        colour: '#6366f1',
        colourOverride: null,
        startDate: null,
        endDate: null,
        weekdays: [1, 2, 3, 4, 5],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ]);
    (getOverridesForProjects as any).mockResolvedValue(new Map());

    const res = await GET(makeRequest('2024'));
    const rows = await parseCsv(res);
    const jan1 = rows.find((r) => r[0] === '2024-01-01');
    expect(jan1).toBeDefined();
    expect(jan1![4]).toBe('Internal Planning');
    expect(jan1![5]).toBe('Internal');
    expect(jan1![6]).toBe('');
  });
});
