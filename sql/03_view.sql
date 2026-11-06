-- ============================================================
-- VIEW: user_daily_nutrition_summary
-- Joins users, daily_nutrition_logs, meal_logs, and the active
-- nutrition_goal for each log date.  Shown in SHOW TABLES output.
-- ============================================================
USE nutrition_tracker;

DROP VIEW IF EXISTS user_daily_nutrition_summary;

CREATE VIEW user_daily_nutrition_summary AS
SELECT
  u.user_id,
  u.full_name,
  dnl.log_id,
  dnl.log_date,
  dnl.total_calories,
  dnl.total_protein_g,
  dnl.total_carbs_g,
  dnl.total_fat_g,
  dnl.water_ml,
  COUNT(ml.meal_log_id)                       AS meal_count,
  g.goal_id,
  g.goal_type,
  g.target_calories,
  g.target_protein_g,
  g.target_carbs_g,
  g.target_fat_g,
  CASE
    WHEN g.target_calories > 0
    THEN ROUND((dnl.total_calories / g.target_calories) * 100, 2)
    ELSE NULL
  END                                          AS calorie_pct_of_target
FROM daily_nutrition_logs dnl
JOIN users u
  ON u.user_id = dnl.user_id
LEFT JOIN meal_logs ml
  ON ml.log_id = dnl.log_id
LEFT JOIN nutrition_goals g
  ON  g.user_id    = dnl.user_id
  AND dnl.log_date BETWEEN g.start_date AND COALESCE(g.end_date, '9999-12-31')
GROUP BY
  u.user_id, u.full_name,
  dnl.log_id, dnl.log_date,
  dnl.total_calories, dnl.total_protein_g, dnl.total_carbs_g,
  dnl.total_fat_g, dnl.water_ml,
  g.goal_id, g.goal_type,
  g.target_calories, g.target_protein_g, g.target_carbs_g, g.target_fat_g;

