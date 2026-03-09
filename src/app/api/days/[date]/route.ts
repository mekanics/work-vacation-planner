import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { days } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isValidISODate } from '@/lib/utils/dates';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
  }

  const existing = await db.select().from(days).where(eq(days.date, date)).then(rows => rows[0]);

  if (!existing) {
    return NextResponse.json({ error: 'Day not found' }, { status: 404 });
  }

  await db.delete(days).where(eq(days.date, date));

  return NextResponse.json({ success: true });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  if (!date || !isValidISODate(date)) {
    return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
  }

  const record = await db.select().from(days).where(eq(days.date, date)).then(rows => rows[0]);

  if (!record) {
    return NextResponse.json({ error: 'Day not found' }, { status: 404 });
  }

  return NextResponse.json(record);
}
