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
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM user_daily_nutrition_summary ORDER BY log_date DESC LIMIT 50'
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to query database view') },
      { status: 500 }
    );
  }
}
