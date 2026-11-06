import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0];

    const [logRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM daily_nutrition_logs WHERE user_id = ? AND log_date = ?',
      [auth.userId, date]
    );
    const log = logRows[0];
    if (!log) return NextResponse.json({ log: null, meals: [] });

    const [mealRows] = await pool.execute<RowDataPacket[]>(
      `SELECT ml.*, rc.recipe_name, rc.cuisine
       FROM meal_logs ml
       LEFT JOIN recipe_catalog rc ON rc.recipe_id = ml.recipe_id
       WHERE ml.log_id = ?
       ORDER BY ml.meal_time`,
      [log.log_id]
    );

    return NextResponse.json({ log, meals: mealRows });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
