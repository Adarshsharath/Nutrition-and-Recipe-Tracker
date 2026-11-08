import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';
import { requireReviewAccess, sanitizeError } from '@/lib/auth';

const QUERIES: Record<string, { label: string; sql: string }> = {
  overCalorie: {
    label: 'Days over calorie target (GROUP BY/HAVING)',
    sql: `SELECT u.full_name, dnl.log_date, dnl.total_calories, g.target_calories,
           ROUND(dnl.total_calories - g.target_calories,2) AS excess
          FROM daily_nutrition_logs dnl
          JOIN users u ON u.user_id = dnl.user_id
          LEFT JOIN nutrition_goals g
            ON g.user_id = dnl.user_id
            AND dnl.log_date BETWEEN g.start_date AND COALESCE(g.end_date,'9999-12-31')
          WHERE g.target_calories IS NOT NULL
          GROUP BY u.full_name, dnl.log_date, dnl.total_calories, g.target_calories
          HAVING dnl.total_calories > g.target_calories
          ORDER BY excess DESC`,
  },
  joinAll: {
    label: 'Full JOIN users → logs → meals',
    sql: `SELECT u.full_name, dnl.log_date, ml.meal_type, ml.calories, ml.protein_g
          FROM users u
          JOIN daily_nutrition_logs dnl ON dnl.user_id = u.user_id
          JOIN meal_logs ml ON ml.log_id = dnl.log_id
          ORDER BY u.full_name, dnl.log_date LIMIT 50`,
  },
  weeklyAvg: {
    label: 'Weekly average calories per user',
    sql: `SELECT u.full_name, ROUND(AVG(dnl.total_calories),2) AS avg_cal_7d
          FROM daily_nutrition_logs dnl
          JOIN users u ON u.user_id = dnl.user_id
          WHERE dnl.log_date >= CURDATE() - INTERVAL 7 DAY
          GROUP BY u.user_id, u.full_name`,
  },
  topRecipes: {
    label: 'Most-logged recipes (top 10)',
    sql: `SELECT rc.recipe_name, COUNT(ml.meal_log_id) AS times_logged
          FROM meal_logs ml
          JOIN recipe_catalog rc ON rc.recipe_id = ml.recipe_id
          GROUP BY rc.recipe_id, rc.recipe_name
          ORDER BY times_logged DESC LIMIT 10`,
  },
  viewSummary: {
    label: 'user_daily_nutrition_summary view',
    sql: 'SELECT * FROM user_daily_nutrition_summary ORDER BY log_date DESC LIMIT 20',
  },
  proteinEfficiency: {
    label: 'Protein efficiency per meal',
    sql: `SELECT rc.recipe_name, ml.calories, ml.protein_g,
           ROUND(ml.protein_g / NULLIF(ml.calories,0)*100,2) AS prot_pct
          FROM meal_logs ml JOIN recipe_catalog rc ON rc.recipe_id = ml.recipe_id
          WHERE ml.calories > 0 ORDER BY prot_pct DESC LIMIT 10`,
  },
};

export async function GET(req: NextRequest) {
  const authCheck = await requireReviewAccess(req);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const qname = req.nextUrl.searchParams.get('q');
    if (qname) {
      const q = QUERIES[qname];
      if (!q) return NextResponse.json({ error: 'Unknown query' }, { status: 400 });
      const [rows] = await pool.execute<RowDataPacket[]>(q.sql);
      return NextResponse.json({ label: q.label, sql: q.sql, rows });
    }
    // Return query list
    return NextResponse.json(Object.entries(QUERIES).map(([key, v]) => ({ key, label: v.label })));
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to execute query') },
      { status: 500 }
    );
  }
}
