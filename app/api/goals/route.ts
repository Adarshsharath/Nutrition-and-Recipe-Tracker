import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { GoalSchema } from '@/lib/validators';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const auth = await requireAuth();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM nutrition_goals WHERE user_id = ? ORDER BY start_date DESC',
      [auth.userId]
    );
    return NextResponse.json(rows);
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const data = GoalSchema.parse(body);
    const goal_id = crypto.randomUUID();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO nutrition_goals
         (goal_id, user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [goal_id, auth.userId, data.goal_type, data.target_calories, data.target_protein_g,
       data.target_carbs_g, data.target_fat_g, data.start_date, data.end_date ?? null]
    );

    return NextResponse.json({ goal_id }, { status: 201 });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown; message?: string; sqlMessage?: string };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    if (e.sqlMessage?.includes('overlaps') || e.message?.includes('overlaps')) {
      return NextResponse.json({ error: e.message ?? e.sqlMessage }, { status: 409 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
