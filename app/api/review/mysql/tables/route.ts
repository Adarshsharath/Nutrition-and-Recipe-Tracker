import { NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [tables] = await pool.execute<RowDataPacket[]>('SHOW TABLES');
    return NextResponse.json(tables);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
