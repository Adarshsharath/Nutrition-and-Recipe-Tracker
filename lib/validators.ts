import { z } from 'zod';

// ── Auth ────────────────────────────────────────────────────────────────────
export const RegisterSchema = z.object({
  full_name:      z.string().min(2).max(100),
  email:          z.string().email(),
  password:       z.string().min(8),
  date_of_birth:  z.string().optional(),
  height_cm:      z.number().positive().optional(),
  weight_kg:      z.number().positive().optional(),
  activity_level: z.enum(['sedentary','light','moderate','active','very_active']).default('moderate'),
});

export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

// ── Profile ─────────────────────────────────────────────────────────────────
export const ProfileUpdateSchema = z.object({
  full_name:      z.string().min(2).max(100).optional(),
  date_of_birth:  z.string().optional(),
  height_cm:      z.number().positive().optional().nullable(),
  weight_kg:      z.number().positive().optional().nullable(),
  activity_level: z.enum(['sedentary','light','moderate','active','very_active']).optional(),
});

export const DietaryProfileSchema = z.object({
  diet_type:         z.enum(['vegetarian','vegan','non_vegetarian','eggetarian','pescatarian','other']),
  allergy_notes:     z.string().optional().nullable(),
  intolerance_notes: z.string().optional().nullable(),
});

// ── Goals ───────────────────────────────────────────────────────────────────
export const GoalSchema = z.object({
  goal_type:        z.enum(['weight_loss','weight_gain','maintenance','custom']),
  target_calories:  z.number().nonnegative(),
  target_protein_g: z.number().nonnegative(),
  target_carbs_g:   z.number().nonnegative(),
  target_fat_g:     z.number().nonnegative(),
  start_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

// ── Meals ───────────────────────────────────────────────────────────────────
export const MealLogSchema = z.object({
  log_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipe_id:         z.string().uuid().optional().nullable(),
  meal_type:         z.enum(['breakfast','lunch','snack','dinner','other']),
  servings:          z.number().positive(),
  cal_per_serving:   z.number().nonnegative(),
  protein_per_serving: z.number().nonnegative(),
  carbs_per_serving: z.number().nonnegative(),
  fat_per_serving:   z.number().nonnegative(),
  notes:             z.string().optional().nullable(),
});

export const MealUpdateSchema = z.object({
  meal_type:  z.enum(['breakfast','lunch','snack','dinner','other']).optional(),
  servings:   z.number().positive().optional(),
  calories:   z.number().nonnegative().optional(),
  protein_g:  z.number().nonnegative().optional(),
  carbs_g:    z.number().nonnegative().optional(),
  fat_g:      z.number().nonnegative().optional(),
  notes:      z.string().optional().nullable(),
});

export const WaterSchema = z.object({
  date:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  add_ml:   z.number().int().positive(),
});

// ── Recipes ─────────────────────────────────────────────────────────────────
const IngredientSchema = z.object({
  name:     z.string().min(1),
  quantity: z.number().positive(),
  unit:     z.string().min(1),
});

const InstructionSchema = z.object({
  step: z.number().int().positive(),
  text: z.string().min(1),
});

const NutritionSchema = z.object({
  calories:   z.number().nonnegative(),
  protein_g:  z.number().nonnegative(),
  carbs_g:    z.number().nonnegative(),
  fat_g:      z.number().nonnegative(),
  fiber_g:    z.number().nonnegative().optional(),
  sodium_mg:  z.number().nonnegative().optional(),
});

export const RecipeSchema = z.object({
  recipe_name:          z.string().min(2).max(150),
  description:          z.string().optional(),
  cuisine:              z.string().max(50).optional(),
  meal_type:            z.enum(['breakfast','lunch','snack','dinner','other']).optional(),
  dietary_tags:         z.array(z.string()).default([]),
  allergens:            z.array(z.string()).default([]),
  ingredients:          z.array(IngredientSchema),
  instructions:         z.array(InstructionSchema),
  nutrition_per_serving: NutritionSchema,
  preparation:          z.object({
    prep_minutes: z.number().int().nonnegative(),
    cook_minutes: z.number().int().nonnegative(),
  }).optional(),
  // allow extra free-form fields
}).passthrough();

export const RecipeUpdateSchema = RecipeSchema.partial();

// ── Recommendation query params ──────────────────────────────────────────────
export const RecommendQuerySchema = z.object({
  meal_type: z.enum(['breakfast','lunch','snack','dinner','other']).optional(),
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

