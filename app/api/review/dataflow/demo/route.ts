import { NextResponse } from 'next/server';
import { createRecipe } from '@/lib/recipes-service';
import { getDb } from '@/lib/mongo';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';

export async function POST() {
  try {
    const sampleData = {
      recipe_name:          'Demo Dual-Write Recipe ' + Date.now(),
      description:          'Created via the Review-1 Data Flow demo.',
      cuisine:              'Indian',
      meal_type:            'lunch' as const,
      dietary_tags:         ['vegetarian', 'high-protein'],
      allergens:            ['milk'],
      ingredients:          [
        { name: 'Paneer',  quantity: 100, unit: 'g' },
        { name: 'Spinach', quantity: 150, unit: 'g' },
      ],
      instructions:         [
        { step: 1, text: 'Sauté spinach.' },
        { step: 2, text: 'Add paneer and spices.' },
        { step: 3, text: 'Serve hot.' },
      ],
      nutrition_per_serving: { calories: 350, protein_g: 22, carbs_g: 15, fat_g: 20 },
      preparation:           { prep_minutes: 10, cook_minutes: 15 },
    };

    const { recipe_id, syncLog } = await createRecipe(sampleData);

    // Retrieve from both DBs for side-by-side display
    const db = await getDb();
    const mongoDoc = await db.collection('recipes').findOne({ _id: recipe_id } as any);

    const [mysqlRows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM recipe_catalog WHERE recipe_id = ?',
      [recipe_id]
    );
    const mysqlRow = mysqlRows[0];

    return NextResponse.json({
      recipe_id,
      syncLog,
      mongodb:  mongoDoc,
      mysql:    mysqlRow,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
