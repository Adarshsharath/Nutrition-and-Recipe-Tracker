import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import pool from '@/lib/mysql';
import DashboardClient from './DashboardClient';
import type { RowDataPacket } from 'mysql2';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const auth = await getAuthUser();
  if (!auth) redirect('/login');

  const today = new Date().toISOString().split('T')[0];

  // Run all dashboard queries in parallel to minimize latency
  const [
    [logRows],
    [goalRows],
    [chartRows],
    [mealRows],
    [userRows],
  ] = await Promise.all([
    // 1. Fetch today's log
    pool.execute<RowDataPacket[]>(
      'SELECT * FROM daily_nutrition_logs WHERE user_id = ? AND log_date = ?',
      [auth.userId, today]
    ),
    // 2. Active goal
    pool.execute<RowDataPacket[]>(
      `SELECT * FROM nutrition_goals
       WHERE user_id = ? AND ? BETWEEN start_date AND COALESCE(end_date, '9999-12-31')
       LIMIT 1`,
      [auth.userId, today]
    ),
    // 3. Last 7 days chart data
    pool.execute<RowDataPacket[]>(
      `SELECT log_date, total_calories, total_protein_g, total_carbs_g, total_fat_g
       FROM daily_nutrition_logs
       WHERE user_id = ? AND log_date >= CURDATE() - INTERVAL 7 DAY
       ORDER BY log_date`,
      [auth.userId]
    ),
    // 4. Recent meals
    pool.execute<RowDataPacket[]>(
      `SELECT ml.meal_type, ml.meal_time, ml.calories, ml.protein_g,
              COALESCE(rc.recipe_name, 'Manual Entry') AS recipe_name
       FROM meal_logs ml
       LEFT JOIN recipe_catalog rc ON rc.recipe_id = ml.recipe_id
       WHERE ml.log_id = (
         SELECT log_id FROM daily_nutrition_logs WHERE user_id = ? AND log_date = ?
       )
       ORDER BY ml.meal_time DESC LIMIT 5`,
      [auth.userId, today]
    ),
    // 5. User profile name
    pool.execute<RowDataPacket[]>(
      'SELECT full_name FROM users WHERE user_id = ?',
      [auth.userId]
    ),
  ]);

  const todayLog = (logRows[0] as unknown as Record<string, unknown>) ?? {
    total_calories: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, water_ml: 0
  };
  const activeGoal = (goalRows[0] as unknown as Record<string, unknown>) ?? null;
  const fullName = (userRows[0]?.full_name as string) ?? 'User';

  return (
    <DashboardClient
      fullName={fullName}
      todayLog={JSON.parse(JSON.stringify(todayLog))}
      activeGoal={activeGoal ? JSON.parse(JSON.stringify(activeGoal)) : null}
      chartData={JSON.parse(JSON.stringify(chartRows))}
      recentMeals={JSON.parse(JSON.stringify(mealRows))}
      today={today}
    />
  );
}
