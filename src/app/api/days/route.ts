// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { isValidISODate } from '@/lib/utils/dates';

const VALID_DAY_TYPES = ['vacation', 'working'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, day_type, note } = body;

    if (!date || !isValidISODate(date)) {
      return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
    }

    if (!day_type || !VALID_DAY_TYPES.includes(day_type)) {
      return NextResponse.json(
        { error: `Invalid day_type. Must be one of: ${VALID_DAY_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    await db.insert(days)
      .values({
        date,
        dayType: day_type,
        note: note ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: days.date,
        set: {
          dayType: day_type,
          note: note ?? null,
          updatedAt: now,
        },
      });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('Error creating day:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
