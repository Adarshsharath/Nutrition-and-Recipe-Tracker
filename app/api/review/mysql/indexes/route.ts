import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';
import { requireReviewAccess, sanitizeError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authCheck = await requireReviewAccess(req);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const table = req.nextUrl.searchParams.get('table');
    if (table) {
      const allowed = ['users', 'dietary_profiles', 'nutrition_goals', 'recipe_catalog',
                       'daily_nutrition_logs', 'meal_logs'];
      if (!allowed.includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
      const [rows] = await pool.execute<RowDataPacket[]>(`SHOW INDEX FROM \`${table}\``);
      return NextResponse.json(rows);
    }
    // All tables
    const tables = ['users', 'dietary_profiles', 'nutrition_goals', 'recipe_catalog',
                    'daily_nutrition_logs', 'meal_logs'];
    const result: Record<string, unknown[]> = {};
    for (const t of tables) {
      const [rows] = await pool.execute<RowDataPacket[]>(`SHOW INDEX FROM \`${t}\``);
      result[t] = rows;
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to fetch index information') },
      { status: 500 }
    );
  }
}
