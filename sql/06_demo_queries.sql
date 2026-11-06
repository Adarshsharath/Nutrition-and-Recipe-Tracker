-- ============================================================
-- Demo / analytical queries for Personalized Nutrition & Recipe Tracker
-- Covers: GROUP BY/HAVING, JOINs, weekly average, most-logged
-- recipes, and trigger-proving scenarios.
-- ============================================================
USE nutrition_tracker;

-- ============================================================
-- Q1: Days where the user exceeded their calorie target
--     (GROUP BY / HAVING)
-- ============================================================
SELECT
  u.full_name,
  dnl.log_date,
  dnl.total_calories,
  g.target_calories,
  ROUND(dnl.total_calories - g.target_calories, 2) AS excess_calories
FROM daily_nutrition_logs dnl
JOIN users u ON u.user_id = dnl.user_id
LEFT JOIN nutrition_goals g
  ON  g.user_id    = dnl.user_id
  AND dnl.log_date BETWEEN g.start_date AND COALESCE(g.end_date, '9999-12-31')
WHERE g.target_calories IS NOT NULL
GROUP BY u.full_name, dnl.log_date, dnl.total_calories, g.target_calories
HAVING dnl.total_calories > g.target_calories
ORDER BY excess_calories DESC;

-- ============================================================
-- Q2: Full JOIN across users → daily_logs → meal_logs
-- ============================================================
SELECT
  u.full_name,
  dnl.log_date,
  ml.meal_type,
  ml.meal_time,
  ml.calories,
  ml.protein_g,
  ml.carbs_g,
  ml.fat_g,
  ml.notes
FROM users u
JOIN daily_nutrition_logs dnl ON dnl.user_id  = u.user_id
JOIN meal_logs            ml  ON ml.log_id    = dnl.log_id
ORDER BY u.full_name, dnl.log_date, ml.meal_time;

-- ============================================================
-- Q3: Weekly average calories per user (last 7 days)
-- ============================================================
SELECT
  u.full_name,
  ROUND(AVG(dnl.total_calories), 2) AS avg_calories_7d,
  ROUND(AVG(dnl.total_protein_g), 2) AS avg_protein_7d,
  ROUND(AVG(dnl.total_carbs_g), 2)   AS avg_carbs_7d,
  ROUND(AVG(dnl.total_fat_g), 2)     AS avg_fat_7d
FROM daily_nutrition_logs dnl
JOIN users u ON u.user_id = dnl.user_id
WHERE dnl.log_date >= CURDATE() - INTERVAL 7 DAY
GROUP BY u.user_id, u.full_name
ORDER BY avg_calories_7d DESC;

-- ============================================================
-- Q4: Most-logged recipes (top 10)
-- ============================================================
SELECT
  rc.recipe_name,
  rc.cuisine,
  COUNT(ml.meal_log_id) AS times_logged,
  ROUND(AVG(ml.servings), 2) AS avg_servings
FROM meal_logs ml
JOIN recipe_catalog rc ON rc.recipe_id = ml.recipe_id
GROUP BY rc.recipe_id, rc.recipe_name, rc.cuisine
ORDER BY times_logged DESC
LIMIT 10;

-- ============================================================
-- Q5: Prove trg_meal_after_insert fires
--     (Insert a meal and check the daily log totals change)
-- ============================================================
-- Step A — Note current totals
SELECT log_id, total_calories, total_protein_g
FROM daily_nutrition_logs
WHERE user_id = (SELECT user_id FROM users WHERE email = 'demo@nutrition.test')
ORDER BY log_date DESC LIMIT 1;

-- Step B — Insert a test meal via the procedure
CALL sp_log_meal(
  (SELECT user_id FROM users WHERE email = 'demo@nutrition.test'),
  CURDATE(),
  NULL,
  'snack',
  1,
  200, 10, 25, 5,
  'Demo trigger test meal'
);

-- Step C — Verify totals increased
SELECT log_id, total_calories, total_protein_g
FROM daily_nutrition_logs
WHERE user_id = (SELECT user_id FROM users WHERE email = 'demo@nutrition.test')
ORDER BY log_date DESC LIMIT 1;

-- ============================================================
-- Q6: Prove trg_goals_before_insert fires (overlapping dates → error)
-- ============================================================
-- This should raise SQLSTATE 45000 if a goal already exists for today:
-- INSERT INTO nutrition_goals VALUES (UUID(), (SELECT user_id FROM users WHERE email='demo@nutrition.test'),
--   'custom', 2000, 150, 200, 70, CURDATE(), NULL);

-- ============================================================
-- Q7: Prove trg_meal_before_insert fires (inactive recipe → error)
-- ============================================================
-- UPDATE recipe_catalog SET is_active = FALSE WHERE recipe_id = '<some_id>';
-- Then call sp_log_meal with that recipe_id → should raise 45000

-- ============================================================
-- Q8: CHECK violation example
-- ============================================================
-- INSERT INTO meal_logs VALUES (UUID(), '<log_id>', NULL, 'snack', NOW(), -1, 0, 0, 0, 0, NULL);
-- → violates chk_meal_logs_values (servings > 0)

-- ============================================================
-- Q9: User daily summary view
-- ============================================================
SELECT * FROM user_daily_nutrition_summary
ORDER BY log_date DESC, full_name
LIMIT 20;

-- ============================================================
-- Q10: Protein efficiency — meals with the highest protein per calorie
-- ============================================================
SELECT
  rc.recipe_name,
  ml.meal_type,
  ml.calories,
  ml.protein_g,
  ROUND(ml.protein_g / NULLIF(ml.calories, 0) * 100, 2) AS protein_pct_of_cal
FROM meal_logs ml
JOIN recipe_catalog rc ON rc.recipe_id = ml.recipe_id
WHERE ml.calories > 0
ORDER BY protein_pct_of_cal DESC
LIMIT 10;

