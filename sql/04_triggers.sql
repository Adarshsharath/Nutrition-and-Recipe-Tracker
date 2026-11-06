-- ============================================================
-- TRIGGERS for Personalized Nutrition & Recipe Tracker
-- All triggers are live and demonstrable (Review-1 requirement).
-- ============================================================
USE nutrition_tracker;

-- Drop existing triggers so the file is re-runnable
DROP TRIGGER IF EXISTS trg_users_after_insert;
DROP TRIGGER IF EXISTS trg_goals_before_insert;
DROP TRIGGER IF EXISTS trg_goals_before_update;
DROP TRIGGER IF EXISTS trg_meal_before_insert;
DROP TRIGGER IF EXISTS trg_meal_after_insert;
DROP TRIGGER IF EXISTS trg_meal_after_update;
DROP TRIGGER IF EXISTS trg_meal_after_delete;

DELIMITER $$

-- ============================================================
-- TRIGGER 1: trg_users_after_insert
-- Purpose: Auto-create a dietary_profiles row (diet_type='other')
--          immediately after a user is registered.
-- ============================================================
CREATE TRIGGER trg_users_after_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO dietary_profiles (profile_id, user_id, diet_type)
  VALUES (UUID(), NEW.user_id, 'other');
END$$

-- ============================================================
-- TRIGGER 2: trg_goals_before_insert
-- Purpose: Prevent overlapping goal date ranges for the same user.
--          A new goal [start, COALESCE(end,'9999-12-31')] must not
--          overlap any existing goal range.
-- ============================================================
CREATE TRIGGER trg_goals_before_insert
BEFORE INSERT ON nutrition_goals
FOR EACH ROW
BEGIN
  DECLARE overlap_count INT DEFAULT 0;

  SELECT COUNT(*) INTO overlap_count
  FROM nutrition_goals
  WHERE user_id = NEW.user_id
    AND NEW.start_date <= COALESCE(end_date, '9999-12-31')
    AND COALESCE(NEW.end_date, '9999-12-31') >= start_date;

  IF overlap_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Goal date range overlaps an existing goal for this user.';
  END IF;
END$$

-- ============================================================
-- TRIGGER 3: trg_goals_before_update
-- Purpose: Same overlap check on UPDATE (excluding self).
-- ============================================================
CREATE TRIGGER trg_goals_before_update
BEFORE UPDATE ON nutrition_goals
FOR EACH ROW
BEGIN
  DECLARE overlap_count INT DEFAULT 0;

  SELECT COUNT(*) INTO overlap_count
  FROM nutrition_goals
  WHERE user_id  = NEW.user_id
    AND goal_id <> NEW.goal_id
    AND NEW.start_date <= COALESCE(end_date, '9999-12-31')
    AND COALESCE(NEW.end_date, '9999-12-31') >= start_date;

  IF overlap_count > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Updated goal date range overlaps an existing goal for this user.';
  END IF;
END$$

-- ============================================================
-- TRIGGER 4: trg_meal_before_insert
-- Purpose: Block logging a meal that references an archived
--          (is_active = FALSE) recipe in recipe_catalog.
-- ============================================================
CREATE TRIGGER trg_meal_before_insert
BEFORE INSERT ON meal_logs
FOR EACH ROW
BEGIN
  DECLARE recipe_active BOOLEAN DEFAULT TRUE;

  IF NEW.recipe_id IS NOT NULL THEN
    SELECT is_active INTO recipe_active
    FROM recipe_catalog
    WHERE recipe_id = NEW.recipe_id;

    IF recipe_active = FALSE THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT =
          'Cannot log meal: the referenced recipe is inactive/archived.';
    END IF;
  END IF;
END$$

-- ============================================================
-- TRIGGER 5: trg_meal_after_insert
-- Purpose: Add the new meal's nutrients to the parent daily log.
--          The DB maintains totals — the app must NOT do it too.
-- ============================================================
CREATE TRIGGER trg_meal_after_insert
AFTER INSERT ON meal_logs
FOR EACH ROW
BEGIN
  UPDATE daily_nutrition_logs
  SET
    total_calories  = total_calories  + NEW.calories,
    total_protein_g = total_protein_g + NEW.protein_g,
    total_carbs_g   = total_carbs_g   + NEW.carbs_g,
    total_fat_g     = total_fat_g     + NEW.fat_g
  WHERE log_id = NEW.log_id;
END$$

-- ============================================================
-- TRIGGER 6: trg_meal_after_update
-- Purpose: Subtract OLD nutrients and add NEW nutrients.
--          Also handles log_id change (meal moved to another day).
-- ============================================================
CREATE TRIGGER trg_meal_after_update
AFTER UPDATE ON meal_logs
FOR EACH ROW
BEGIN
  -- Subtract OLD values from the OLD daily log
  UPDATE daily_nutrition_logs
  SET
    total_calories  = GREATEST(0, total_calories  - OLD.calories),
    total_protein_g = GREATEST(0, total_protein_g - OLD.protein_g),
    total_carbs_g   = GREATEST(0, total_carbs_g   - OLD.carbs_g),
    total_fat_g     = GREATEST(0, total_fat_g     - OLD.fat_g)
  WHERE log_id = OLD.log_id;

  -- Add NEW values to the NEW daily log
  UPDATE daily_nutrition_logs
  SET
    total_calories  = total_calories  + NEW.calories,
    total_protein_g = total_protein_g + NEW.protein_g,
    total_carbs_g   = total_carbs_g   + NEW.carbs_g,
    total_fat_g     = total_fat_g     + NEW.fat_g
  WHERE log_id = NEW.log_id;
END$$

-- ============================================================
-- TRIGGER 7: trg_meal_after_delete
-- Purpose: Subtract deleted meal's nutrients from daily totals.
--          GREATEST(0, …) prevents CHECK constraint violations
--          from floating-point underflow.
-- ============================================================
CREATE TRIGGER trg_meal_after_delete
AFTER DELETE ON meal_logs
FOR EACH ROW
BEGIN
  UPDATE daily_nutrition_logs
  SET
    total_calories  = GREATEST(0, total_calories  - OLD.calories),
    total_protein_g = GREATEST(0, total_protein_g - OLD.protein_g),
    total_carbs_g   = GREATEST(0, total_carbs_g   - OLD.carbs_g),
    total_fat_g     = GREATEST(0, total_fat_g     - OLD.fat_g)
  WHERE log_id = OLD.log_id;
END$$

DELIMITER ;

