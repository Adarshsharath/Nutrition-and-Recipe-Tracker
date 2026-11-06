import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import { requireAuth } from '@/lib/auth';
import { MealLogSchema } from '@/lib/validators';
import { getRecipe } from '@/lib/recipes-service';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await req.json();
    const data = MealLogSchema.parse(body);

    // If recipe_id provided, fetch nutrition from MongoDB
    let calPerServing   = data.cal_per_serving;
    let protPerServing  = data.protein_per_serving;
    let carbsPerServing = data.carbs_per_serving;
    let fatPerServing   = data.fat_per_serving;

    if (data.recipe_id) {
      const recipe = await getRecipe(data.recipe_id);
      if (recipe) {
        calPerServing   = recipe.nutrition_per_serving.calories;
        protPerServing  = recipe.nutrition_per_serving.protein_g;
        carbsPerServing = recipe.nutrition_per_serving.carbs_g;
        fatPerServing   = recipe.nutrition_per_serving.fat_g;
      }
    }

    const [result] = await pool.execute<RowDataPacket[][]>(
      'CALL sp_log_meal(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        auth.userId, data.log_date,
        data.recipe_id ?? null,
        data.meal_type, data.servings,
        calPerServing, protPerServing, carbsPerServing, fatPerServing,
        data.notes ?? null,
      ]
    );
    const ids = result[0]?.[0];
    return NextResponse.json(ids, { status: 201 });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown; message?: string; sqlMessage?: string };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    const msg = e.sqlMessage ?? e.message ?? String(err);
    if (msg.includes('inactive') || msg.includes('archived')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
