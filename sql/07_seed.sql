-- ============================================================
-- Seed data for Personalized Nutrition & Recipe Tracker
-- Demo user: demo@nutrition.test / Demo@1234
-- ============================================================
USE nutrition_tracker;

-- Users (bcrypt hash of "Demo@1234" with rounds=12 — pre-computed)
INSERT IGNORE INTO users
  (user_id, full_name, email, password_hash, date_of_birth, height_cm, weight_kg, activity_level)
VALUES
  ('aaaaaaaa-0000-4000-a000-000000000001',
   'Demo User', 'demo@nutrition.test',
   '$2b$10$U9GbYkVZlTZAzsmFtSbJmuXdmR9RieQjM5LhLx0Y1vTYm..DwnsS.',
   '1998-05-15', 170.00, 68.00, 'moderate'),
  ('bbbbbbbb-0000-4000-b000-000000000002',
   'Priya Sharma', 'priya@example.com',
   '$2b$10$U9GbYkVZlTZAzsmFtSbJmuXdmR9RieQjM5LhLx0Y1vTYm..DwnsS.',
   '2000-08-22', 162.00, 55.00, 'active'),
  ('cccccccc-0000-4000-c000-000000000003',
   'Rohan Mehra', 'rohan@example.com',
   '$2b$10$U9GbYkVZlTZAzsmFtSbJmuXdmR9RieQjM5LhLx0Y1vTYm..DwnsS.',
   '1995-12-10', 178.00, 80.00, 'very_active')
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name);

-- Dietary profiles (trigger creates them, so update existing ones)
UPDATE dietary_profiles SET diet_type='non_vegetarian', allergy_notes='peanut',    intolerance_notes='lactose' WHERE user_id='aaaaaaaa-0000-4000-a000-000000000001';
UPDATE dietary_profiles SET diet_type='vegetarian',     allergy_notes=NULL,        intolerance_notes=NULL      WHERE user_id='bbbbbbbb-0000-4000-b000-000000000002';
UPDATE dietary_profiles SET diet_type='non_vegetarian', allergy_notes='shellfish', intolerance_notes=NULL      WHERE user_id='cccccccc-0000-4000-c000-000000000003';

-- Nutrition goals
INSERT IGNORE INTO nutrition_goals
  (goal_id, user_id, goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g, start_date, end_date)
VALUES
  -- Demo user: past goal
  ('g1000001-0000-4000-a000-000000000001',
   'aaaaaaaa-0000-4000-a000-000000000001',
   'weight_loss', 1800, 140, 180, 60, '2026-09-01', '2026-10-31'),
  -- Demo user: current active goal
  ('g1000002-0000-4000-a000-000000000002',
   'aaaaaaaa-0000-4000-a000-000000000001',
   'maintenance', 2100, 160, 220, 70, '2026-11-01', NULL),
  -- Priya
  ('g2000001-0000-4000-b000-000000000001',
   'bbbbbbbb-0000-4000-b000-000000000002',
   'weight_loss', 1600, 120, 160, 55, '2026-10-01', NULL),
  -- Rohan
  ('g3000001-0000-4000-c000-000000000001',
   'cccccccc-0000-4000-c000-000000000003',
   'weight_gain', 2800, 200, 300, 90, '2026-10-15', NULL)
ON DUPLICATE KEY UPDATE goal_type = VALUES(goal_type);
