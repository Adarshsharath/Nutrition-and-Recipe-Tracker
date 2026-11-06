-- ============================================================
-- Indexes for Personalized Nutrition & Recipe Tracker
-- ============================================================
USE nutrition_tracker;

-- nutrition_goals: speed up per-user goal look-ups
CREATE INDEX idx_nutrition_goals_user
  ON nutrition_goals(user_id);

-- daily_nutrition_logs: (user_id, log_date) is already covered by
-- the UNIQUE constraint uq_daily_logs_user_date.  The explicit index
-- below is kept to match the PDF schema diagram; MySQL may merge it
-- with the unique index internally.
-- (redundant with UNIQUE constraint — kept per spec)
CREATE INDEX idx_daily_logs_user_date
  ON daily_nutrition_logs(user_id, log_date);

-- meal_logs: look up all meals for a given daily log
CREATE INDEX idx_meal_logs_log
  ON meal_logs(log_id);

-- meal_logs: look up which meals referenced a given recipe
CREATE INDEX idx_meal_logs_recipe
  ON meal_logs(recipe_id);

