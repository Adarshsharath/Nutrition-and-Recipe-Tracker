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
      `SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, COLUMN_NAME`
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to fetch foreign key constraints') },
      { status: 500 }
    );
  }
}
