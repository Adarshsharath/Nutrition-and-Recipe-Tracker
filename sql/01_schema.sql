-- ============================================================
-- Personalized Nutrition & Recipe Tracker
-- MySQL 8.0 Schema
-- Course: Database Management Systems
-- Instructor: Prof. Deena Hajim
-- Team: Adarsh Prakash PES2UG24CS027, Abhirama H Y PES2UG24CS023
-- ============================================================

CREATE DATABASE IF NOT EXISTS nutrition_tracker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE nutrition_tracker;

-- ============================================================
-- TABLE: users
-- Stores account credentials, body metrics, and activity level.
-- email is UNIQUE so each address maps to exactly one account.
-- password_hash stores a bcrypt hash — NEVER plaintext.
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id       CHAR(36)       NOT NULL,
  full_name     VARCHAR(100)   NOT NULL,
  email         VARCHAR(255)   NOT NULL,
  password_hash TEXT           NOT NULL,
  date_of_birth DATE           NULL,
  height_cm     DECIMAL(5,2)   NULL,
  weight_kg     DECIMAL(5,2)   NULL,
  activity_level VARCHAR(20)   NOT NULL DEFAULT 'moderate',
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_users           PRIMARY KEY (user_id),
  CONSTRAINT uq_users_email     UNIQUE      (email),
  CONSTRAINT chk_users_height   CHECK (height_cm   IS NULL OR height_cm   > 0),
  CONSTRAINT chk_users_weight   CHECK (weight_kg   IS NULL OR weight_kg   > 0),
  CONSTRAINT chk_users_activity CHECK (activity_level IN
    ('sedentary','light','moderate','active','very_active'))
);

-- ============================================================
-- TABLE: dietary_profiles
-- One profile per user (UNIQUE user_id).  Captures diet class,
-- allergy notes and intolerance notes as free-text so the
-- recommendation engine can parse keywords.
-- ============================================================
CREATE TABLE IF NOT EXISTS dietary_profiles (
  profile_id        CHAR(36)     NOT NULL,
  user_id           CHAR(36)     NOT NULL,
  diet_type         VARCHAR(30)  NOT NULL DEFAULT 'other',
  allergy_notes     TEXT         NULL,
  intolerance_notes TEXT         NULL,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT pk_dietary_profiles        PRIMARY KEY (profile_id),
  CONSTRAINT uq_dietary_profiles_user   UNIQUE      (user_id),
  CONSTRAINT fk_dietary_profiles_user   FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_dietary_profiles_type  CHECK (diet_type IN
    ('vegetarian','vegan','non_vegetarian','eggetarian','pescatarian','other'))
);

-- ============================================================
-- TABLE: nutrition_goals
-- Users may have multiple goals over time.  Triggers enforce
-- non-overlapping date ranges per user.
-- ============================================================
CREATE TABLE IF NOT EXISTS nutrition_goals (
  goal_id           CHAR(36)       NOT NULL,
  user_id           CHAR(36)       NOT NULL,
  goal_type         VARCHAR(30)    NOT NULL,
  target_calories   DECIMAL(7,2)   NOT NULL,
  target_protein_g  DECIMAL(7,2)   NOT NULL,
  target_carbs_g    DECIMAL(7,2)   NOT NULL,
  target_fat_g      DECIMAL(7,2)   NOT NULL,
  start_date        DATE           NOT NULL,
  end_date          DATE           NULL,
  CONSTRAINT pk_nutrition_goals           PRIMARY KEY (goal_id),
  CONSTRAINT fk_nutrition_goals_user      FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT chk_nutrition_goals_type     CHECK (goal_type IN
    ('weight_loss','weight_gain','maintenance','custom')),
  CONSTRAINT chk_nutrition_goals_targets  CHECK (
    target_calories  >= 0 AND
    target_protein_g >= 0 AND
    target_carbs_g   >= 0 AND
    target_fat_g     >= 0),
  CONSTRAINT chk_nutrition_goals_dates    CHECK (
    end_date IS NULL OR end_date >= start_date)
);

-- ============================================================
-- TABLE: recipe_catalog
-- Stable relational identity for recipes.  The same UUID is used
-- as _id in MongoDB so both databases reference the same recipe.
-- Soft-delete via is_active so historical meal_logs stay valid.
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_catalog (
  recipe_id    CHAR(36)      NOT NULL,
  recipe_name  VARCHAR(150)  NOT NULL,
  cuisine      VARCHAR(50)   NULL,
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT pk_recipe_catalog PRIMARY KEY (recipe_id)
);

-- ============================================================
-- TABLE: daily_nutrition_logs
-- One aggregate row per (user, date).  UNIQUE(user_id, log_date)
-- enforces the one-log-per-day rule.  Totals are maintained by
-- triggers on meal_logs — the app MUST NOT update them directly.
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_nutrition_logs (
  log_id         CHAR(36)      NOT NULL,
  user_id        CHAR(36)      NOT NULL,
  log_date       DATE          NOT NULL,
  total_calories DECIMAL(8,2)  NOT NULL DEFAULT 0,
  total_protein_g DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_carbs_g  DECIMAL(8,2)  NOT NULL DEFAULT 0,
  total_fat_g    DECIMAL(8,2)  NOT NULL DEFAULT 0,
  water_ml       INT           NOT NULL DEFAULT 0,
  CONSTRAINT pk_daily_nutrition_logs          PRIMARY KEY (log_id),
  CONSTRAINT fk_daily_logs_user               FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT uq_daily_logs_user_date          UNIQUE (user_id, log_date),
  CONSTRAINT chk_daily_logs_nonnegative       CHECK (
    total_calories  >= 0 AND
    total_protein_g >= 0 AND
    total_carbs_g   >= 0 AND
    total_fat_g     >= 0 AND
    water_ml        >= 0)
);

-- ============================================================
-- TABLE: meal_logs
-- Individual meal entries.  recipe_id is nullable (manual log).
-- FK to recipe_catalog uses ON DELETE SET NULL so records survive
-- recipe archival.  Triggers keep daily totals in sync.
-- ============================================================
CREATE TABLE IF NOT EXISTS meal_logs (
  meal_log_id  CHAR(36)      NOT NULL,
  log_id       CHAR(36)      NOT NULL,
  recipe_id    CHAR(36)      NULL,
  meal_type    VARCHAR(20)   NOT NULL,
  meal_time    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  servings     DECIMAL(5,2)  NOT NULL DEFAULT 1,
  calories     DECIMAL(8,2)  NOT NULL DEFAULT 0,
  protein_g    DECIMAL(8,2)  NOT NULL DEFAULT 0,
  carbs_g      DECIMAL(8,2)  NOT NULL DEFAULT 0,
  fat_g        DECIMAL(8,2)  NOT NULL DEFAULT 0,
  notes        TEXT          NULL,
  CONSTRAINT pk_meal_logs            PRIMARY KEY (meal_log_id),
  CONSTRAINT fk_meal_logs_daily_log  FOREIGN KEY (log_id)
    REFERENCES daily_nutrition_logs(log_id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_logs_recipe     FOREIGN KEY (recipe_id)
    REFERENCES recipe_catalog(recipe_id) ON DELETE SET NULL,
  CONSTRAINT chk_meal_logs_type      CHECK (meal_type IN
    ('breakfast','lunch','snack','dinner','other')),
  CONSTRAINT chk_meal_logs_values    CHECK (
    servings  > 0  AND
    calories  >= 0 AND
    protein_g >= 0 AND
    carbs_g   >= 0 AND
    fat_g     >= 0)
);

