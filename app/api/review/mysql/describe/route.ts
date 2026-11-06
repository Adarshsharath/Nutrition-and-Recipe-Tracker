import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';

export async function GET(req: NextRequest) {
  try {
    const table = req.nextUrl.searchParams.get('table');
    if (!table) return NextResponse.json({ error: 'table param required' }, { status: 400 });
    const allowed = ['users','dietary_profiles','nutrition_goals','recipe_catalog',
                     'daily_nutrition_logs','meal_logs'];
    if (!allowed.includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    const [desc] = await pool.execute<RowDataPacket[]>(`DESC \`${table}\``);
    const [counts] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT * FROM \`${table}\` LIMIT 20`);
    return NextResponse.json({ desc, count: (counts[0] as { cnt: number } | undefined)?.cnt ?? 0, rows });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
