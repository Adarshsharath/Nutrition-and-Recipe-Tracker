import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { MealUpdateSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = MealUpdateSchema.parse(body);

    // Verify ownership via log → user
    const [ownerRows] = await pool.execute<RowDataPacket[]>(
      `SELECT dnl.user_id FROM meal_logs ml
       JOIN daily_nutrition_logs dnl ON dnl.log_id = ml.log_id
       WHERE ml.meal_log_id = ?`,
      [id]
    );
    const owner = ownerRows[0];
    if (!owner || owner.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const fields: string[] = [];
    const values: any[] = [];
    if (data.meal_type !== undefined) { fields.push('meal_type = ?'); values.push(data.meal_type); }
    if (data.servings  !== undefined) { fields.push('servings = ?');  values.push(data.servings); }
    if (data.calories  !== undefined) { fields.push('calories = ?');  values.push(data.calories); }
    if (data.protein_g !== undefined) { fields.push('protein_g = ?'); values.push(data.protein_g); }
    if (data.carbs_g   !== undefined) { fields.push('carbs_g = ?');   values.push(data.carbs_g); }
    if (data.fat_g     !== undefined) { fields.push('fat_g = ?');     values.push(data.fat_g); }
    if (data.notes     !== undefined) { fields.push('notes = ?');     values.push(data.notes ?? null); }

    if (fields.length === 0) return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    values.push(id);
    await pool.execute(`UPDATE meal_logs SET ${fields.join(', ')} WHERE meal_log_id = ?`, values);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const [ownerRows] = await pool.execute<RowDataPacket[]>(
      `SELECT dnl.user_id FROM meal_logs ml
       JOIN daily_nutrition_logs dnl ON dnl.log_id = ml.log_id
       WHERE ml.meal_log_id = ?`,
      [id]
    );
    const owner = ownerRows[0];
    if (!owner || owner.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await pool.execute('DELETE FROM meal_logs WHERE meal_log_id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
