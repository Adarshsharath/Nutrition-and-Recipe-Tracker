import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket, PoolConnection } from 'mysql2/promise';

/**
 * Creates an isolated temporary user within an active transaction.
 * The transaction is always rolled back after the demo, guaranteeing
 * zero lingering records and leaving all production/demo data untouched.
 */
async function createTempUser(conn: PoolConnection) {
  const userId = crypto.randomUUID();
  const email = `temp_trigger_${userId.slice(0, 8)}_${Date.now()}@test.local`;
  await conn.execute(
    `INSERT INTO users (user_id, full_name, email, password_hash, activity_level)
     VALUES (?, 'Temporary Trigger Test User', ?, '$2b$10$temporaryhashfortestusers00000000000000000000000000', 'moderate')`,
    [userId, email]
  );
  return { userId, email };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const conn = await pool.getConnection();

  try {
    let result: Record<string, unknown> = {};

    // ============================================================
    // 1. trg_users_after_insert
    // ============================================================
    if (name === 'trg_users_after_insert') {
      await conn.beginTransaction();
      const testId = crypto.randomUUID();
      const testEmail = `user_trigger_${testId.slice(0, 8)}_${Date.now()}@test.local`;

      await conn.execute(
        `INSERT INTO users (user_id, full_name, email, password_hash, activity_level)
         VALUES (?, 'Auto Profile Test User', ?, 'test_hash', 'moderate')`,
        [testId, testEmail]
      );

      const [profRows] = await conn.execute<RowDataPacket[]>(
        'SELECT profile_id, user_id, diet_type FROM dietary_profiles WHERE user_id = ?',
        [testId]
      );

      const profile = profRows[0];
      const verified = profile !== undefined && profile.diet_type === 'other';

      result = {
        action: 'INSERT into users',
        user_id: testId,
        auto_created_profile: profile,
        verified,
        message: verified
          ? 'Dietary profile was automatically created by trg_users_after_insert with default diet_type="other"'
          : 'Dietary profile was not created',
      };
      await conn.rollback();
    }

    // ============================================================
    // 2. trg_goals_before_insert
    // ============================================================
    else if (name === 'trg_goals_before_insert') {
      await conn.beginTransaction();
      const { userId } = await createTempUser(conn);
      const goal1Id = crypto.randomUUID();
      const goal2Id = crypto.randomUUID();

      // Goal 1: 2026-05-01 to 2026-05-31
      await conn.execute(
        `INSERT INTO nutrition_goals (goal_id, user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, start_date, end_date)
         VALUES (?, ?, 'custom', 2000, 150, 200, 70, '2026-05-01', '2026-05-31')`,
        [goal1Id, userId]
      );

      let triggerFired = false;
      let capturedError = '';

      try {
        // Attempt to insert Goal 2 with overlapping range: 2026-05-15 to 2026-06-15
        await conn.execute(
          `INSERT INTO nutrition_goals (goal_id, user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, start_date, end_date)
           VALUES (?, ?, 'custom', 2200, 160, 220, 80, '2026-05-15', '2026-06-15')`,
          [goal2Id, userId]
        );
      } catch (e) {
        triggerFired = true;
        capturedError = (e as Error).message;
      }

      // Verify only 1 goal exists in database for this user
      const [goalCountRows] = await conn.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM nutrition_goals WHERE user_id = ?',
        [userId]
      );
      const goalCount = (goalCountRows[0] as { cnt: number }).cnt;
      const verified = triggerFired &&
        capturedError.includes('Goal date range overlaps') &&
        goalCount === 1;

      result = {
        triggered: triggerFired,
        expected_error: 'Goal date range overlaps an existing goal for this user.',
        actual_error: capturedError,
        goals_in_db: goalCount,
        verified,
        message: verified
          ? 'Trigger successfully rejected overlapping goal insert with SIGNAL 45000'
          : 'Trigger check failed to properly reject overlapping goal',
      };
      await conn.rollback();
    }

    // ============================================================
    // 3. trg_goals_before_update
    // ============================================================
    else if (name === 'trg_goals_before_update') {
      await conn.beginTransaction();
      const { userId } = await createTempUser(conn);
      const goal1Id = crypto.randomUUID();
      const goal2Id = crypto.randomUUID();

      // Goal 1: 2026-01-01 to 2026-01-31
      await conn.execute(
        `INSERT INTO nutrition_goals (goal_id, user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, start_date, end_date)
         VALUES (?, ?, 'custom', 2000, 150, 200, 70, '2026-01-01', '2026-01-31')`,
        [goal1Id, userId]
      );

      // Goal 2: 2026-02-01 to 2026-02-28
      await conn.execute(
        `INSERT INTO nutrition_goals (goal_id, user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, start_date, end_date)
         VALUES (?, ?, 'custom', 2200, 160, 220, 80, '2026-02-01', '2026-02-28')`,
        [goal2Id, userId]
      );

      let triggerFired = false;
      let capturedError = '';

      try {
        // Attempt to update Goal 2 to start on 2026-01-15 (which overlaps Goal 1)
        await conn.execute(
          'UPDATE nutrition_goals SET start_date = ? WHERE goal_id = ?',
          ['2026-01-15', goal2Id]
        );
      } catch (e) {
        triggerFired = true;
        capturedError = (e as Error).message;
      }

      // Verify Goal 2 in DB was unchanged
      const [goal2Rows] = await conn.execute<RowDataPacket[]>(
        "SELECT DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date FROM nutrition_goals WHERE goal_id = ?",
        [goal2Id]
      );
      const startDateInDb = (goal2Rows[0] as { start_date: string }).start_date;
      const verified = triggerFired &&
        capturedError.includes('Updated goal date range overlaps') &&
        startDateInDb === '2026-02-01';

      result = {
        triggered: triggerFired,
        expected_error: 'Updated goal date range overlaps an existing goal for this user.',
        actual_error: capturedError,
        start_date_in_db: startDateInDb,
        verified,
        message: verified
          ? 'Trigger successfully rejected overlapping goal update with SIGNAL 45000'
          : 'Trigger check failed to properly reject overlapping goal update',
      };
      await conn.rollback();
    }

    // ============================================================
    // 4. trg_meal_before_insert
    // ============================================================
    else if (name === 'trg_meal_before_insert') {
      await conn.beginTransaction();
      const { userId } = await createTempUser(conn);
      const recipeId = crypto.randomUUID();
      const logId = crypto.randomUUID();

      // Insert an inactive recipe into catalog
      await conn.execute(
        'INSERT INTO recipe_catalog (recipe_id, recipe_name, is_active) VALUES (?, ?, FALSE)',
        [recipeId, 'Inactive Archived Recipe']
      );

      // Insert daily log with valid date
      await conn.execute(
        'INSERT INTO daily_nutrition_logs (log_id, user_id, log_date) VALUES (?, ?, ?)',
        [logId, userId, '2026-01-01']
      );

      let triggerFired = false;
      let capturedError = '';

      try {
        // Attempt to log meal referencing inactive recipe
        await conn.execute(
          `INSERT INTO meal_logs (meal_log_id, log_id, recipe_id, meal_type, servings, calories, protein_g, carbs_g, fat_g)
           VALUES (UUID(), ?, ?, 'snack', 1, 200, 10, 30, 5)`,
          [logId, recipeId]
        );
      } catch (e) {
        triggerFired = true;
        capturedError = (e as Error).message;
      }

      // Verify meal was rejected and not inserted
      const [mealRows] = await conn.execute<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM meal_logs WHERE log_id = ?',
        [logId]
      );
      const mealCount = (mealRows[0] as { cnt: number }).cnt;
      const verified = triggerFired &&
        capturedError.includes('inactive/archived') &&
        mealCount === 0;

      result = {
        triggered: triggerFired,
        expected_error: 'Cannot log meal: the referenced recipe is inactive/archived.',
        actual_error: capturedError,
        meals_in_db: mealCount,
        verified,
        message: verified
          ? 'Trigger successfully blocked meal logging with inactive recipe with SIGNAL 45000'
          : 'Trigger check failed to block inactive recipe',
      };
      await conn.rollback();
    }

    // ============================================================
    // 5. trg_meal_after_insert
    // ============================================================
    else if (name === 'trg_meal_after_insert') {
      await conn.beginTransaction();
      const { userId } = await createTempUser(conn);
      const logId = crypto.randomUUID();

      // Insert clean daily log: initial totals 0
      await conn.execute(
        'INSERT INTO daily_nutrition_logs (log_id, user_id, log_date) VALUES (?, ?, ?)',
        [logId, userId, '2026-01-01']
      );

      const [beforeRows] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories, total_protein_g, total_carbs_g, total_fat_g FROM daily_nutrition_logs WHERE log_id = ?',
        [logId]
      );
      const before = beforeRows[0];

      // Insert meal with 350 calories
      await conn.execute(
        `INSERT INTO meal_logs (meal_log_id, log_id, meal_type, servings, calories, protein_g, carbs_g, fat_g)
         VALUES (UUID(), ?, 'snack', 1, 350, 20, 40, 10)`,
        [logId]
      );

      const [afterRows] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories, total_protein_g, total_carbs_g, total_fat_g FROM daily_nutrition_logs WHERE log_id = ?',
        [logId]
      );
      const after = afterRows[0];

      const calBefore = Number(before.total_calories);
      const calAfter = Number(after.total_calories);
      const verified = calBefore === 0 && calAfter === 350;

      result = {
        triggered: true,
        verified,
        expected: '0 calories -> 350 calories',
        actual: `${calBefore} calories -> ${calAfter} calories`,
        before: {
          total_calories: calBefore,
          total_protein_g: Number(before.total_protein_g),
          total_carbs_g: Number(before.total_carbs_g),
          total_fat_g: Number(before.total_fat_g),
        },
        after: {
          total_calories: calAfter,
          total_protein_g: Number(after.total_protein_g),
          total_carbs_g: Number(after.total_carbs_g),
          total_fat_g: Number(after.total_fat_g),
        },
      };
      await conn.rollback();
    }

    // ============================================================
    // 6. trg_meal_after_update
    // ============================================================
    else if (name === 'trg_meal_after_update') {
      await conn.beginTransaction();
      const { userId } = await createTempUser(conn);
      const logId = crypto.randomUUID();
      const mealId = crypto.randomUUID();

      // Insert daily log
      await conn.execute(
        'INSERT INTO daily_nutrition_logs (log_id, user_id, log_date) VALUES (?, ?, ?)',
        [logId, userId, '2026-01-01']
      );

      // Insert meal with 500 calories
      await conn.execute(
        `INSERT INTO meal_logs (meal_log_id, log_id, meal_type, servings, calories, protein_g, carbs_g, fat_g)
         VALUES (?, ?, 'lunch', 1, 500, 30, 60, 15)`,
        [mealId, logId]
      );

      const [beforeRows] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories, total_protein_g, total_carbs_g, total_fat_g FROM daily_nutrition_logs WHERE log_id = ?',
        [logId]
      );
      const before = beforeRows[0];

      // Update meal from 500 to 400 calories
      await conn.execute('UPDATE meal_logs SET calories = 400 WHERE meal_log_id = ?', [mealId]);

      const [afterRows] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories, total_protein_g, total_carbs_g, total_fat_g FROM daily_nutrition_logs WHERE log_id = ?',
        [logId]
      );
      const after = afterRows[0];

      const calBefore = Number(before.total_calories);
      const calAfter = Number(after.total_calories);
      const verified = calBefore === 500 && calAfter === 400;

      result = {
        triggered: true,
        verified,
        expected: '500 calories -> 400 calories',
        actual: `${calBefore} calories -> ${calAfter} calories`,
        before: { total_calories: calBefore },
        after: { total_calories: calAfter },
      };
      await conn.rollback();
    }

    // ============================================================
    // 7. trg_meal_after_delete
    // ============================================================
    else if (name === 'trg_meal_after_delete') {
      await conn.beginTransaction();
      const { userId } = await createTempUser(conn);
      const logId = crypto.randomUUID();
      const mealId = crypto.randomUUID();

      // Insert daily log
      await conn.execute(
        'INSERT INTO daily_nutrition_logs (log_id, user_id, log_date) VALUES (?, ?, ?)',
        [logId, userId, '2026-01-01']
      );

      // Insert meal with 600 calories
      await conn.execute(
        `INSERT INTO meal_logs (meal_log_id, log_id, meal_type, servings, calories, protein_g, carbs_g, fat_g)
         VALUES (?, ?, 'dinner', 1, 600, 35, 70, 20)`,
        [mealId, logId]
      );

      const [beforeRows] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories, total_protein_g, total_carbs_g, total_fat_g FROM daily_nutrition_logs WHERE log_id = ?',
        [logId]
      );
      const before = beforeRows[0];

      // Delete the meal
      await conn.execute('DELETE FROM meal_logs WHERE meal_log_id = ?', [mealId]);

      const [afterRows] = await conn.execute<RowDataPacket[]>(
        'SELECT total_calories, total_protein_g, total_carbs_g, total_fat_g FROM daily_nutrition_logs WHERE log_id = ?',
        [logId]
      );
      const after = afterRows[0];

      const calBefore = Number(before.total_calories);
      const calAfter = Number(after.total_calories);
      const verified = calBefore === 600 && calAfter === 0;

      result = {
        triggered: true,
        verified,
        expected: '600 calories -> 0 calories',
        actual: `${calBefore} calories -> ${calAfter} calories`,
        before: { total_calories: calBefore },
        after: { total_calories: calAfter },
      };
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
    try { await conn.rollback(); } catch {}
    conn.release();
  }
}
