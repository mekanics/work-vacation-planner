import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist mockDb so vi.mock factory can reference it ─────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));

// ─── Mock fetch ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSelectChain(returnValue: unknown) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
    get: vi.fn().mockResolvedValue(returnValue),
  };
  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  return chain;
}

function makeSelectChainAll(returnValue: unknown[]) {
  const chain = {
    from: vi.fn(),
    where: vi.fn(),
  };
  chain.from.mockReturnValue(chain);
  // await db.select().from(...).where(...) returns the array
  chain.where.mockReturnValue(Promise.resolve(returnValue));
  return chain;
}

function makeInsertChain() {
  const chain = {
    values: vi.fn(),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
  chain.values.mockReturnValue(chain);
  return chain;
}

// ─── Import after mocks ───────────────────────────────────────────────────────

import {
  getCantonSetting,
  ensureHolidaysCached,
  getHolidayDateSet,
} from '@/lib/services/holidays';

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getCantonSetting', () => {
  it('returns canton from settings table when row exists', async () => {
    const chain = makeSelectChain({ key: 'canton', value: 'BE' });
    mockDb.select.mockReturnValue(chain);

    const result = await getCantonSetting();
    expect(result).toBe('BE');
  });

  it('returns CH when no row found', async () => {
    const chain = makeSelectChain(undefined);
    mockDb.select.mockReturnValue(chain);

    const result = await getCantonSetting();
    expect(result).toBe('CH');
  });

  it('returns CH when db throws', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockRejectedValue(new Error('DB error')),
    };
    mockDb.select.mockReturnValue(chain);

    const result = await getCantonSetting();
    expect(result).toBe('CH');
  });
});

describe('ensureHolidaysCached', () => {
  it('returns early when sentinel is a recent ISO timestamp (within 7-day TTL)', async () => {
    const recentTs = new Date(Date.now() - 1000).toISOString(); // 1 second ago
    const sentinelChain = makeSelectChain({ key: 'holidays_fetched_2025_ZH', value: recentTs });
    mockDb.select.mockReturnValue(sentinelChain);

    await ensureHolidaysCached(2025, 'ZH');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('when sentinel is "ok", DB check still runs (not short-circuited)', async () => {
    const sentinelChain = makeSelectChain({ key: 'holidays_fetched_2025_ZH', value: 'ok' });
    const existingChain = makeSelectChainAll([
      { date: '2025-01-01', name: 'Neujahr', canton: 'ZH', year: 2025, global: 1 },
    ]);

    mockDb.select
      .mockReturnValueOnce(sentinelChain)  // isFetchBlocked → 'ok' → false
      .mockReturnValueOnce(existingChain); // existing check → has rows → return early

    await ensureHolidaysCached(2025, 'ZH');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled(); // No sentinel insert (just returned)
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });

  it('fetches again when "unavailable" sentinel is older than 7 days (TTL expired)', async () => {
    // Timestamp 8 days ago = beyond 7-day TTL → should retry
    const expiredTs = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const sentinelChain = makeSelectChain({ key: 'holidays_fetched_2025_ZH', value: expiredTs });
    const cacheChain = makeSelectChainAll([]); // no cached rows
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)  // isFetchBlocked → expired → false
      .mockReturnValueOnce(cacheChain);    // existing check → empty
    mockDb.insert.mockReturnValue(insertChain);

    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await ensureHolidaysCached(2025, 'ZH');

    // Should have attempted fetch (even though it returns empty)
    expect(mockFetch).toHaveBeenCalledOnce();
    // Sets a new unavailable sentinel (fresh timestamp)
    const values = insertChain.values.mock.calls[0][0];
    expect(values.key).toBe('holidays_fetched_2025_ZH');
    expect(values.value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns early when DB already has rows for (year, canton)', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([
      { date: '2025-01-01', name: 'Neujahr', canton: 'ZH', year: 2025, global: 1 },
    ]);

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);

    await ensureHolidaysCached(2025, 'ZH');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled(); // No sentinel insert (just returned)
  });

  it('fetches from API and inserts when no cache and no sentinel', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    const apiHolidays = [
      {
        startDate: '2025-01-01',
        endDate: '2025-01-01',
        name: [{ language: 'DE', text: 'Neujahr' }],
        nationwide: true,
        subdivisions: [],
      },
      {
        startDate: '2025-01-02',
        endDate: '2025-01-02',
        name: [{ language: 'DE', text: 'Berchtoldstag' }],
        nationwide: false,
        subdivisions: [{ code: 'CH-ZH', shortName: 'ZH' }],
      },
    ];

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => apiHolidays,
    });

    await ensureHolidaysCached(2025, 'ZH');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch.mock.calls[0][0]).toContain('openholidaysapi.org');
    // insert for holidays + insert for sentinel
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
    const insertValues = insertChain.values.mock.calls[0][0];
    expect(insertValues).toHaveLength(2);
    expect(insertValues[0]).toMatchObject({ date: '2025-01-01', name: 'Neujahr', canton: 'ZH', global: 1 });
    expect(insertValues[1]).toMatchObject({ date: '2025-01-02', name: 'Berchtoldstag', canton: 'ZH', global: 0 });
  });

  it('includes nationwide=true holidays regardless of canton', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    const apiHolidays = [
      {
        startDate: '2025-12-25',
        endDate: '2025-12-25',
        name: [{ language: 'DE', text: 'Weihnachten' }],
        nationwide: true,
        subdivisions: [],
      },
    ];

    mockFetch.mockResolvedValue({ ok: true, json: async () => apiHolidays });

    await ensureHolidaysCached(2025, 'AG');

    const insertValues = insertChain.values.mock.calls[0][0];
    expect(insertValues[0]).toMatchObject({ name: 'Weihnachten', canton: 'AG', global: 1 });
  });

  it('excludes canton-specific holidays for a different canton', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    const apiHolidays = [
      {
        startDate: '2025-01-02',
        endDate: '2025-01-02',
        name: [{ language: 'DE', text: 'Berchtoldstag' }],
        nationwide: false,
        subdivisions: [{ code: 'CH-ZH', shortName: 'ZH' }],
      },
    ];

    mockFetch.mockResolvedValue({ ok: true, json: async () => apiHolidays });

    await ensureHolidaysCached(2025, 'GR');

    // No holidays matched → sentinel = ISO timestamp, no holiday insert
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const sentinelValues = insertChain.values.mock.calls[0][0];
    expect(sentinelValues).toMatchObject({ key: 'holidays_fetched_2025_GR' });
    expect(sentinelValues.value).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
  });

  it('when canton is "CH", includes only nationwide holidays', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    const apiHolidays = [
      {
        startDate: '2025-01-01',
        name: [{ language: 'DE', text: 'Neujahr' }],
        nationwide: true,
        subdivisions: [],
      },
      {
        startDate: '2025-01-02',
        name: [{ language: 'DE', text: 'Berchtoldstag' }],
        nationwide: false,
        subdivisions: [{ code: 'CH-ZH', shortName: 'ZH' }],
      },
    ];

    mockFetch.mockResolvedValue({ ok: true, json: async () => apiHolidays });

    await ensureHolidaysCached(2025, 'CH');

    const insertValues = insertChain.values.mock.calls[0][0];
    expect(insertValues).toHaveLength(1);
    expect(insertValues[0]).toMatchObject({ name: 'Neujahr' });
  });

  it('sets "unavailable" sentinel when API returns empty array', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await ensureHolidaysCached(2030, 'ZH');

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const values = insertChain.values.mock.calls[0][0];
    expect(values).toMatchObject({ key: 'holidays_fetched_2030_ZH' });
    expect(values.value).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
  });

  it('sets "unavailable" sentinel when fetch throws', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    mockFetch.mockRejectedValue(new Error('Network error'));

    await ensureHolidaysCached(2025, 'ZH');

    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    const values = insertChain.values.mock.calls[0][0];
    expect(values).toMatchObject({ key: 'holidays_fetched_2025_ZH' });
    expect(values.value).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
  });

  it('sets "unavailable" sentinel when API returns non-ok status', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await ensureHolidaysCached(2025, 'ZH');

    const values = insertChain.values.mock.calls[0][0];
    expect(values.key).toBe('holidays_fetched_2025_ZH');
    expect(values.value).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
  });

  it('picks German name from multilingual name array', async () => {
    const sentinelChain = makeSelectChain(null);
    const cacheChain = makeSelectChainAll([]);
    const insertChain = makeInsertChain();

    mockDb.select
      .mockReturnValueOnce(sentinelChain)
      .mockReturnValueOnce(cacheChain);
    mockDb.insert.mockReturnValue(insertChain);

    const apiHolidays = [
      {
        startDate: '2025-01-01',
        name: [
          { language: 'FR', text: 'Nouvel An' },
          { language: 'DE', text: 'Neujahr' },
          { language: 'IT', text: 'Capodanno' },
        ],
        nationwide: true,
        subdivisions: [],
      },
    ];

    mockFetch.mockResolvedValue({ ok: true, json: async () => apiHolidays });

    await ensureHolidaysCached(2025, 'ZH');

    const insertValues = insertChain.values.mock.calls[0][0];
    expect(insertValues[0].name).toBe('Neujahr');
  });
});

describe('getHolidayDateSet', () => {
  it('returns a Set of date strings', async () => {
    // Canton passed explicitly → getCantonSetting is NOT called
    // Use a recent timestamp as sentinel → isFetchBlocked returns true → skips existing check
    // Then getHolidaysForYear does its own final DB select
    const recentTs = new Date(Date.now() - 1000).toISOString();
    const sentinelChain = makeSelectChain({ key: 'holidays_fetched_2025_ZH', value: recentTs });
    const holidaysChain = makeSelectChainAll([
      { date: '2025-01-01', name: 'Neujahr', canton: 'ZH', year: 2025, global: 1 },
      { date: '2025-01-02', name: 'Berchtoldstag', canton: 'ZH', year: 2025, global: 0 },
    ]);

    mockDb.select
      .mockReturnValueOnce(sentinelChain)   // isFetchBlocked → recent timestamp → true (blocked)
      .mockReturnValueOnce(holidaysChain);  // final DB select in getHolidaysForYear

    const result = await getHolidayDateSet(2025, 'ZH');

    expect(result).toBeInstanceOf(Set);
    expect(result.has('2025-01-01')).toBe(true);
    expect(result.has('2025-01-02')).toBe(true);
    expect(result.size).toBe(2);
  });
});
