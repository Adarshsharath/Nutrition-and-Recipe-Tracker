-- ============================================================
-- STORED PROCEDURES for Personalized Nutrition & Recipe Tracker
-- ============================================================
USE nutrition_tracker;

DROP PROCEDURE IF EXISTS sp_log_meal;
DROP PROCEDURE IF EXISTS sp_get_active_goal;

DELIMITER $$

-- ============================================================
-- PROCEDURE: sp_log_meal
-- Atomically find-or-create the daily log and insert a meal row.
-- Nutrient totals are updated by triggers — not here.
-- Parameters:
--   p_user_id            CHAR(36)      — the user
--   p_log_date           DATE          — the day being tracked
--   p_recipe_id          CHAR(36)/NULL — optional recipe reference
--   p_meal_type          VARCHAR(20)   — breakfast/lunch/snack/dinner/other
--   p_servings           DECIMAL(5,2)  — number of servings
--   p_cal_per_serving    DECIMAL(8,2)  — calories per serving
--   p_protein_per_serving DECIMAL(8,2) — protein per serving
--   p_carbs_per_serving  DECIMAL(8,2)  — carbs per serving
--   p_fat_per_serving    DECIMAL(8,2)  — fat per serving
--   p_notes              TEXT/NULL     — optional notes
-- ============================================================
CREATE PROCEDURE sp_log_meal(
  IN p_user_id             CHAR(36),
  IN p_log_date            DATE,
  IN p_recipe_id           CHAR(36),
  IN p_meal_type           VARCHAR(20),
  IN p_servings            DECIMAL(5,2),
  IN p_cal_per_serving     DECIMAL(8,2),
  IN p_protein_per_serving DECIMAL(8,2),
  IN p_carbs_per_serving   DECIMAL(8,2),
  IN p_fat_per_serving     DECIMAL(8,2),
  IN p_notes               TEXT
)
BEGIN
  DECLARE v_log_id      CHAR(36) DEFAULT NULL;
  DECLARE v_meal_log_id CHAR(36);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  -- Concurrency-safe find-or-create for daily log:
  -- Attempt insert with a new UUID. If a row for (user_id, log_date) already exists,
  -- ON DUPLICATE KEY UPDATE avoids a duplicate key collision while preserving UNIQUE(user_id, log_date).
  SET v_log_id = UUID();
  INSERT INTO daily_nutrition_logs (log_id, user_id, log_date)
  VALUES (v_log_id, p_user_id, p_log_date)
  ON DUPLICATE KEY UPDATE log_id = log_id;

  -- Retrieve the effective log_id (either newly inserted or existing)
  SELECT log_id INTO v_log_id
  FROM daily_nutrition_logs
  WHERE user_id = p_user_id AND log_date = p_log_date
  LIMIT 1;

  -- Insert the meal log row; triggers will update daily totals
  SET v_meal_log_id = UUID();
  INSERT INTO meal_logs
    (meal_log_id, log_id, recipe_id, meal_type, servings,
     calories, protein_g, carbs_g, fat_g, notes)
  VALUES
    (v_meal_log_id, v_log_id, p_recipe_id, p_meal_type, p_servings,
     p_cal_per_serving     * p_servings,
     p_protein_per_serving * p_servings,
     p_carbs_per_serving   * p_servings,
     p_fat_per_serving     * p_servings,
     p_notes);

  COMMIT;

  -- Return both IDs for the caller
  SELECT v_log_id AS log_id, v_meal_log_id AS meal_log_id;
END$$

-- ============================================================
-- PROCEDURE: sp_get_active_goal
-- Returns the nutrition_goals row that is active on p_date.
-- ============================================================
CREATE PROCEDURE sp_get_active_goal(
  IN p_user_id CHAR(36),
  IN p_date    DATE
)
BEGIN
  SELECT *
  FROM nutrition_goals
  WHERE user_id    = p_user_id
    AND p_date BETWEEN start_date AND COALESCE(end_date, '9999-12-31')
  ORDER BY start_date DESC
  LIMIT 1;
END$$

DELIMITER ;

