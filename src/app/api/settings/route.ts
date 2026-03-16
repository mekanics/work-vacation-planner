// See /openapi.yaml for spec
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';


export async function GET() {
  try {
    const allSettings = await db.select().from(settings);
    const result: Record<string, string> = {};
    for (const row of allSettings) {
      result[row.key] = row.value;
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('Error fetching settings:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Body must be an object of key-value pairs' }, { status: 400 });
    }

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') {
        return NextResponse.json(
          { error: `Value for key "${key}" must be a string` },
          { status: 400 }
        );
      }

      await db.insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value },
        });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error updating settings:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
