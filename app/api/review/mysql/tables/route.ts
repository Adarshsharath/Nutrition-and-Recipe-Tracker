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
    const [tables] = await pool.execute<RowDataPacket[]>('SHOW TABLES');
    return NextResponse.json(tables);
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to fetch database tables') },
      { status: 500 }
    );
  }
}
