import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { DietaryProfileSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const auth = await requireAuth();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM dietary_profiles WHERE user_id = ?',
      [auth.userId]
    );
    return NextResponse.json(rows[0] ?? null);
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const data = DietaryProfileSchema.parse(body);

    await pool.execute(
      `UPDATE dietary_profiles
       SET diet_type = ?, allergy_notes = ?, intolerance_notes = ?
       WHERE user_id = ?`,
      [data.diet_type, data.allergy_notes ?? null, data.intolerance_notes ?? null, auth.userId]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
