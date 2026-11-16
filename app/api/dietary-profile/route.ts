import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { DietaryProfileSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const auth = await requireAuth();
    let [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM dietary_profiles WHERE user_id = ?',
      [auth.userId]
    );

    if (!rows[0]) {
      // Auto-heal: Ensure dietary profile row exists if user had none
      await pool.execute(
        `INSERT IGNORE INTO dietary_profiles (profile_id, user_id, diet_type, allergy_notes, intolerance_notes)
         VALUES (UUID(), ?, 'other', NULL, NULL)`,
        [auth.userId]
      );
      [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM dietary_profiles WHERE user_id = ?',
        [auth.userId]
      );
    }

    return NextResponse.json(
      rows[0] ?? { user_id: auth.userId, diet_type: 'other', allergy_notes: null, intolerance_notes: null }
    );
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
      `INSERT INTO dietary_profiles (profile_id, user_id, diet_type, allergy_notes, intolerance_notes)
       VALUES (UUID(), ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         diet_type = VALUES(diet_type),
         allergy_notes = VALUES(allergy_notes),
         intolerance_notes = VALUES(intolerance_notes)`,
      [auth.userId, data.diet_type, data.allergy_notes ?? null, data.intolerance_notes ?? null]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
