import { NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';

export async function GET() {
  try {
    const [triggers] = await pool.execute<RowDataPacket[]>('SHOW TRIGGERS');
    const details: Array<Record<string,unknown>> = [];
    for (const t of triggers as Array<{Trigger: string}>) {
      const [createRows] = await pool.execute<RowDataPacket[]>(
        `SHOW CREATE TRIGGER \`${t.Trigger}\``
      );
      details.push({ ...t, createSql: createRows[0] });
    }
    return NextResponse.json(details);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
