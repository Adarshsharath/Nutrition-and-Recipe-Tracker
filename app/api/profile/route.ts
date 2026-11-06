import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { ProfileUpdateSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const auth = await requireAuth();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id, full_name, email, date_of_birth, height_cm, weight_kg, activity_level, created_at FROM users WHERE user_id = ?',
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
    const data = ProfileUpdateSchema.parse(body);

    const fields: string[] = [];
    const values: any[] = [];
    if (data.full_name !== undefined)      { fields.push('full_name = ?');      values.push(data.full_name); }
    if (data.date_of_birth !== undefined)  { fields.push('date_of_birth = ?');  values.push(data.date_of_birth ?? null); }
    if (data.height_cm !== undefined)      { fields.push('height_cm = ?');      values.push(data.height_cm ?? null); }
    if (data.weight_kg !== undefined)      { fields.push('weight_kg = ?');      values.push(data.weight_kg ?? null); }
    if (data.activity_level !== undefined) { fields.push('activity_level = ?'); values.push(data.activity_level); }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

    values.push(auth.userId);
    await pool.execute(`UPDATE users SET ${fields.join(', ')} WHERE user_id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
