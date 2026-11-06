import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { GoalSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = GoalSchema.parse(body);

    // Verify ownership
    const [ownerRows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id FROM nutrition_goals WHERE goal_id = ?', [id]
    );
    const row = ownerRows[0];
    if (!row || row.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await pool.execute(
      `UPDATE nutrition_goals
       SET goal_type=?, target_calories=?, target_protein_g=?, target_carbs_g=?, target_fat_g=?, start_date=?, end_date=?
       WHERE goal_id=? AND user_id=?`,
      [data.goal_type, data.target_calories, data.target_protein_g, data.target_carbs_g,
       data.target_fat_g, data.start_date, data.end_date ?? null, id, auth.userId]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown; message?: string };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    if (e.message?.includes('overlaps')) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    await pool.execute('DELETE FROM nutrition_goals WHERE goal_id = ? AND user_id = ?', [id, auth.userId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
