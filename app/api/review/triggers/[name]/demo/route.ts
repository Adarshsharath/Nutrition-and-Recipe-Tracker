import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';

const DEMO_EMAIL = 'demo@nutrition.test';

async function getDemoUser() {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id FROM users WHERE email = ?', [DEMO_EMAIL]
  );
  return rows[0] as { user_id: string } | undefined;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const conn = await pool.getConnection();
  try {
    const demo = await getDemoUser();
    if (!demo) return NextResponse.json({ error: 'Demo user not found' }, { status: 404 });

    let result: Record<string, unknown> = {};

    if (name === 'trg_users_after_insert') {
      // Show that inserting a user auto-creates dietary_profiles
      await conn.beginTransaction();
      const testId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO users (user_id,full_name,email,password_hash,activity_level)
         VALUES (?, 'Trigger Test', ?, 'hash', 'moderate')`,
        [testId, `trigtest_${testId.slice(0,8)}@test.com`]
      );
      const [profRows] = await conn.execute<RowDataPacket[]>(
        'SELECT * FROM dietary_profiles WHERE user_id = ?', [testId]
      );
      result = { action: 'INSERT user', auto_created_profile: profRows[0] };
      await conn.rollback();
    }

    else if (name === 'trg_goals_before_insert') {
      // Prove overlapping dates throw an error
      const today = new Date().toISOString().split('T')[0];
      try {
        await conn.execute(
          `INSERT INTO nutrition_goals (goal_id,user_id,goal_type,target_calories,target_protein_g,target_carbs_g,target_fat_g,start_date)
           VALUES (UUID(),?,'custom',2000,150,200,70,?)`,
          [demo.user_id, today]
        );
        await conn.execute(
          `INSERT INTO nutrition_goals (goal_id,user_id,goal_type,target_calories,target_protein_g,target_carbs_g,target_fat_g,start_date)
           VALUES (UUID(),?,'custom',2100,160,210,80,?)`,
          [demo.user_id, today]
        );
        result = { error: 'Expected trigger to fire but no error raised' };
      } catch (e) {
        result = { triggered: true, error: (e as Error).message };
      } finally {
        await conn.execute('DELETE FROM nutrition_goals WHERE user_id = ? AND goal_type = ?', [demo.user_id, 'custom']);
      }
    }

    else if (name === 'trg_meal_before_insert') {
      // Prove inactive recipe blocks meal logging
      const recipeId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO recipe_catalog (recipe_id,recipe_name,is_active) VALUES (?,'Inactive Test Recipe',FALSE)`,
        [recipeId]
      );
      const logId = crypto.randomUUID();
      const today = new Date().toISOString().split('T')[0];
      await conn.execute(
        `INSERT INTO daily_nutrition_logs (log_id,user_id,log_date) VALUES (?,?,?)`,
        [logId, demo.user_id, today]
      );
      try {
        await conn.execute(
          `INSERT INTO meal_logs (meal_log_id,log_id,recipe_id,meal_type,servings,calories,protein_g,carbs_g,fat_g)
           VALUES (UUID(),?,?,'snack',1,200,10,30,5)`,
          [logId, recipeId]
        );
        result = { error: 'Expected trigger to block insert but it succeeded' };
      } catch (e) {
        result = { triggered: true, error: (e as Error).message };
      } finally {
        await conn.execute('DELETE FROM daily_nutrition_logs WHERE log_id = ?', [logId]);
        await conn.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [recipeId]);
      }
    }

    else if (name === 'trg_meal_after_insert') {
      // Insert meal, check daily log totals updated
      await conn.beginTransaction();
      const logId = crypto.randomUUID();
      const today = new Date().toISOString().split('T')[0];
      await conn.execute(
        `INSERT INTO daily_nutrition_logs (log_id,user_id,log_date) VALUES (?,?,?)`,
        [logId, demo.user_id, today + '-demo']
      );
      const [before] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories FROM daily_nutrition_logs WHERE log_id = ?', [logId]
      );
      await conn.execute(
        `INSERT INTO meal_logs (meal_log_id,log_id,meal_type,servings,calories,protein_g,carbs_g,fat_g)
         VALUES (UUID(),?,'snack',1,350,20,40,10)`,
        [logId]
      );
      const [after] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories FROM daily_nutrition_logs WHERE log_id = ?', [logId]
      );
      result = {
        before: before[0],
        after:  after[0],
        triggered: true,
      };
      await conn.rollback();
    }

    else if (name === 'trg_meal_after_update') {
      await conn.beginTransaction();
      const logId = crypto.randomUUID();
      const today = new Date().toISOString().split('T')[0];
      await conn.execute(
        `INSERT INTO daily_nutrition_logs (log_id,user_id,log_date) VALUES (?,?,?)`,
        [logId, demo.user_id, today + '-demo2']
      );
      const mealId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO meal_logs (meal_log_id,log_id,meal_type,servings,calories,protein_g,carbs_g,fat_g)
         VALUES (?,?,'lunch',1,500,30,60,15)`,
        [mealId, logId]
      );
      const [before] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories FROM daily_nutrition_logs WHERE log_id = ?', [logId]
      );
      await conn.execute('UPDATE meal_logs SET calories = 400 WHERE meal_log_id = ?', [mealId]);
      const [after] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories FROM daily_nutrition_logs WHERE log_id = ?', [logId]
      );
      result = { before: before[0], after: after[0], triggered: true };
      await conn.rollback();
    }

    else if (name === 'trg_meal_after_delete') {
      await conn.beginTransaction();
      const logId = crypto.randomUUID();
      const today = new Date().toISOString().split('T')[0];
      await conn.execute(
        `INSERT INTO daily_nutrition_logs (log_id,user_id,log_date) VALUES (?,?,?)`,
        [logId, demo.user_id, today + '-demo3']
      );
      const mealId = crypto.randomUUID();
      await conn.execute(
        `INSERT INTO meal_logs (meal_log_id,log_id,meal_type,servings,calories,protein_g,carbs_g,fat_g)
         VALUES (?,?,'dinner',1,600,35,70,20)`,
        [mealId, logId]
      );
      const [before] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories FROM daily_nutrition_logs WHERE log_id = ?', [logId]
      );
      await conn.execute('DELETE FROM meal_logs WHERE meal_log_id = ?', [mealId]);
      const [after] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories FROM daily_nutrition_logs WHERE log_id = ?', [logId]
      );
      result = { before: before[0], after: after[0], triggered: true };
      await conn.rollback();
    }

    else {
      return NextResponse.json({ error: `Unknown trigger: ${name}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    try { await conn.rollback(); } catch {}
    return NextResponse.json({ error: String(err) }, { status: 500 });
  } finally {
    conn.release();
  }
}
