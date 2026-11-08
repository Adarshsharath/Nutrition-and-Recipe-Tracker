import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { WaterSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const data = WaterSchema.parse(body);

    // Concurrency-safe find-or-create daily log
    const tempLogId = crypto.randomUUID();
    await pool.execute(
      `INSERT INTO daily_nutrition_logs (log_id, user_id, log_date)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE log_id = log_id`,
      [tempLogId, auth.userId, data.date]
    );

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT log_id FROM daily_nutrition_logs WHERE user_id = ? AND log_date = ?',
      [auth.userId, data.date]
    );
    const log_id = (rows[0] as { log_id: string }).log_id;

    await pool.execute(
      'UPDATE daily_nutrition_logs SET water_ml = GREATEST(0, water_ml + ?) WHERE log_id = ?',
      [data.add_ml, log_id]
    );

    const [updated] = await pool.execute<RowDataPacket[]>(
      'SELECT water_ml FROM daily_nutrition_logs WHERE log_id = ?',
      [log_id]
    );
    return NextResponse.json({ water_ml: (updated[0] as { water_ml: number } | undefined)?.water_ml });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
