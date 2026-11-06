import { NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const auth = await requireAuth();
    const today = new Date().toISOString().split('T')[0];
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM nutrition_goals
       WHERE user_id = ? AND ? BETWEEN start_date AND COALESCE(end_date, '9999-12-31')
       ORDER BY start_date DESC LIMIT 1`,
      [auth.userId, today]
    );
    return NextResponse.json(rows[0] ?? null);
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
