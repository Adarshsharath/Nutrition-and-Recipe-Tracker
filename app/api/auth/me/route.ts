import { NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { getAuthUser } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id, full_name, email, date_of_birth, height_cm, weight_kg, activity_level, created_at FROM users WHERE user_id = ?',
    [auth.userId]
  );
  const user = rows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  return NextResponse.json(user);
}
