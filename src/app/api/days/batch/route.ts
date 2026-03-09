import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { isValidISODate } from '@/lib/utils/dates';

const VALID_DAY_TYPES = ['vacation', 'working'];

/**
 * POST /api/days/batch
 * Body: { dates: string[], day_type: string }
 *
 * Bulk upsert or delete day records.
 * - day_type === 'working' → delete records (working is the implicit default)
 * - day_type === 'vacation' → bulk upsert
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dates, day_type } = body;

    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'dates must be a non-empty array' }, { status: 400 });
    }

    if (!day_type || !VALID_DAY_TYPES.includes(day_type)) {
      return NextResponse.json(
        { error: `Invalid day_type. Must be one of: ${VALID_DAY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate all dates
    const invalidDates = dates.filter((d) => !isValidISODate(d));
    if (invalidDates.length > 0) {
      return NextResponse.json(
        { error: `Invalid dates: ${invalidDates.slice(0, 5).join(', ')}` },
        { status: 400 }
      );
    }

    if (day_type === 'working') {
      // Delete records — 'working' is the implicit default state
      await db.delete(days).where(inArray(days.date, dates));
    } else {
      // Bulk upsert
      const now = new Date().toISOString();
      await db
        .insert(days)
        .values(
          dates.map((date) => ({
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

    return NextResponse.json({ success: true, count: dates.length }, { status: 200 });
  } catch (err) {
    console.error('Error in batch days:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
