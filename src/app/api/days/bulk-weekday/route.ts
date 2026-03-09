import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

const VALID_DAY_TYPES = ['vacation', 'working', 'day_off'];

/**
 * POST /api/days/bulk-weekday
 * Body: { year: number, weekday: number, day_type: string }
 *
 * Sets all days matching a specific weekday in a year to the given day_type.
 * weekday uses JS convention: 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
 *
 * Example: { year: 2026, weekday: 5, day_type: 'day_off' }
 * → marks all Fridays in 2026 as day_off
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, weekday, day_type } = body;

    if (!year || typeof year !== 'number' || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year (2000–2100)' }, { status: 400 });
    }

    if (typeof weekday !== 'number' || weekday < 0 || weekday > 6) {
      return NextResponse.json(
        { error: 'Invalid weekday (0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat)' },
        { status: 400 }
      );
    }

    if (!day_type || !VALID_DAY_TYPES.includes(day_type)) {
      return NextResponse.json(
        { error: `Invalid day_type. Must be one of: ${VALID_DAY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate all dates in the year matching the weekday
    // Use noon to avoid UTC rollback in UTC+ timezones
    const matchingDates: string[] = [];
    const cur = new Date(year, 0, 1, 12, 0, 0); // Jan 1 at noon
    const end = new Date(year, 11, 31, 12, 0, 0); // Dec 31 at noon
    const pad = (n: number) => String(n).padStart(2, '0');

    while (cur <= end) {
      if (cur.getDay() === weekday) {
        const iso = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        matchingDates.push(iso);
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (matchingDates.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    if (day_type === 'working') {
      // Delete records — 'working' is the implicit default
      await db.delete(days).where(inArray(days.date, matchingDates));
    } else {
      const now = new Date().toISOString();
      await db
        .insert(days)
        .values(
          matchingDates.map((date) => ({
            date,
            dayType: day_type,
            note: null,
            createdAt: now,
            updatedAt: now,
          }))
        )
        .onConflictDoUpdate({
          target: days.date,
          set: {
            dayType: day_type,
            updatedAt: now,
          },
        });
    }

    return NextResponse.json({ success: true, count: matchingDates.length });
  } catch (err) {
    console.error('Error in bulk-weekday:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
