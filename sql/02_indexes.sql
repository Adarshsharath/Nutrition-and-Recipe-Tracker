-- ============================================================
-- Indexes for Personalized Nutrition & Recipe Tracker
-- ============================================================
USE nutrition_tracker;

-- Helper procedure to ensure idempotent index creation in MySQL 8
DROP PROCEDURE IF EXISTS sp_create_index_if_not_exists;

DELIMITER $$
CREATE PROCEDURE sp_create_index_if_not_exists(
  IN p_table_name VARCHAR(64),
  IN p_index_name VARCHAR(64),
  IN p_column_defs VARCHAR(255)
)
BEGIN
  DECLARE index_count INT DEFAULT 0;

  SELECT COUNT(*) INTO index_count
  FROM information_schema.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = p_table_name
    AND index_name = p_index_name;

  IF index_count = 0 THEN
    SET @sql_stmt = CONCAT('CREATE INDEX ', p_index_name, ' ON ', p_table_name, '(', p_column_defs, ')');
    PREPARE stmt FROM @sql_stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

-- nutrition_goals: speed up per-user goal look-ups
CALL sp_create_index_if_not_exists('nutrition_goals', 'idx_nutrition_goals_user', 'user_id');

-- daily_nutrition_logs: (user_id, log_date) is already covered by
-- the UNIQUE constraint uq_daily_logs_user_date. The explicit index
-- below is kept to match the PDF schema diagram.
CALL sp_create_index_if_not_exists('daily_nutrition_logs', 'idx_daily_logs_user_date', 'user_id, log_date');

-- meal_logs: look up all meals for a given daily log
CALL sp_create_index_if_not_exists('meal_logs', 'idx_meal_logs_log', 'log_id');

-- meal_logs: look up which meals referenced a given recipe
CALL sp_create_index_if_not_exists('meal_logs', 'idx_meal_logs_recipe', 'recipe_id');

-- Clean up helper procedure
DROP PROCEDURE IF EXISTS sp_create_index_if_not_exists;
