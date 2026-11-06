import pool from './mysql';
import { getDb } from './mongo';
import type { RecipeDocument } from './recipes-service';
import type { RowDataPacket } from 'mysql2';

// Dietary tag map: diet_type → allowed tags (empty = all)
const DIET_TAG_MAP: Record<string, string[]> = {
  vegetarian:    ['vegetarian', 'vegan', 'eggetarian'],
  vegan:         ['vegan'],
  eggetarian:    ['vegetarian', 'vegan', 'eggetarian'],
  pescatarian:   ['vegetarian', 'vegan', 'eggetarian', 'pescatarian'],
  non_vegetarian: [],
  other:          [],
};

// Meals remaining given current hour
function mealsRemainingToday(hour: number): number {
  if (hour < 9)  return 4; // breakfast/lunch/snack/dinner
  if (hour < 12) return 3;
  if (hour < 15) return 2;
  if (hour < 19) return 1;
  return 1;
}

// Infer meal_type from hour
function inferMealType(hour: number): string {
  if (hour < 10) return 'breakfast';
  if (hour < 13) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

// Parse keyword allergens from free text
function parseAllergens(text?: string | null): string[] {
  if (!text) return [];
  const keywords = ['milk','dairy','egg','gluten','wheat','nut','peanut',
                    'soy','shellfish','fish','sesame','mustard'];
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k));
}

export interface RecommendationResult {
  recipe:     RecipeDocument;
  score:      number;
  why:        string;
  mongoFilter: object;
  mysqlContext: {
    goal_type:       string | null;
    target_calories: number | null;
    today_calories:  number;
    remaining_cal:   number;
    budget_per_meal: number;
    diet_type:       string;
    allergens:       string[];
  };
}

export async function getRecommendations(
  userId: string,
  params: { meal_type?: string; date?: string }
): Promise<RecommendationResult[]> {
  const today = params.date ?? new Date().toISOString().split('T')[0];
  const hour  = new Date().getHours();

  // 1. Fetch active goal + dietary profile from MySQL
  const [goalRows] = await pool.execute<RowDataPacket[]>(
    `SELECT goal_type, target_calories, target_protein_g, target_carbs_g, target_fat_g
     FROM nutrition_goals
     WHERE user_id = ? AND ? BETWEEN start_date AND COALESCE(end_date, '9999-12-31')
     ORDER BY start_date DESC LIMIT 1`,
    [userId, today]
  );
  const goalRow = goalRows[0];

  const [profileRows] = await pool.execute<RowDataPacket[]>(
    `SELECT diet_type, allergy_notes, intolerance_notes
     FROM dietary_profiles WHERE user_id = ?`,
    [userId]
  );
  const profileRow = profileRows[0];

  const [logRows] = await pool.execute<RowDataPacket[]>(
    `SELECT total_calories FROM daily_nutrition_logs
     WHERE user_id = ? AND log_date = ?`,
    [userId, today]
  );
  const logRow = logRows[0];

  const goal        = goalRow   as { goal_type: string; target_calories: number; target_protein_g: number } | undefined;
  const profile     = profileRow as { diet_type: string; allergy_notes: string | null; intolerance_notes: string | null } | undefined;
  const todayCal    = Number(logRow?.total_calories ?? 0);
  const targetCal   = Number(goal?.target_calories ?? 2000);
  const remaining   = Math.max(0, targetCal - todayCal);
  const mealsLeft   = mealsRemainingToday(hour);
  const budget      = remaining / mealsLeft;

  const dietType    = profile?.diet_type ?? 'other';
  const allergens   = [
    ...parseAllergens(profile?.allergy_notes),
    ...parseAllergens(profile?.intolerance_notes),
  ];

  const mealType    = params.meal_type ?? inferMealType(hour);
  const allowedTags = DIET_TAG_MAP[dietType] ?? [];

  // 2. Build MongoDB filter
  const mongoFilter: Record<string, any> = { archived: { $ne: true } };

  if (allowedTags.length > 0) {
    mongoFilter.dietary_tags = { $in: allowedTags };
  }
  if (allergens.length > 0) {
    mongoFilter.allergens = { $nin: allergens };
  }
  if (mealType) {
    mongoFilter.meal_type = mealType;
  }
  // ±20% calorie window around per-meal budget
  const calLow  = budget * 0.80;
  const calHigh = budget * 1.20;
  mongoFilter['nutrition_per_serving.calories'] = { $gte: calLow, $lte: calHigh };

  // 3. Query MongoDB
  const db = await getDb();
  let docs = await db.collection('recipes')
    .find(mongoFilter)
    .limit(20)
    .toArray();

  // If strict filter returns nothing, relax calories
  if (docs.length === 0) {
    const relaxedFilter: Record<string, any> = { ...mongoFilter };
    delete relaxedFilter['nutrition_per_serving.calories'];
    docs = await db.collection('recipes')
      .find(relaxedFilter)
      .limit(20)
      .toArray();
  }

  const recipes = docs as unknown as RecipeDocument[];

  // 4. Rank by proximity to calorie budget and protein density
  const targetProtein = Number(goal?.target_protein_g ?? 50);

  const scored = recipes.map((r) => {
    const cal    = r.nutrition_per_serving?.calories ?? 0;
    const prot   = r.nutrition_per_serving?.protein_g ?? 0;
    const calDiff = Math.abs(cal - budget);
    const protScore = prot / Math.max(1, cal) * 100;
    const score  = 100 - calDiff / Math.max(1, budget) * 50 + protScore * 0.5;

    const why = `Calories ${cal} kcal is ${calDiff.toFixed(0)} kcal from your per-meal budget of ${budget.toFixed(0)} kcal. ` +
      `Protein ${prot}g supports your daily target of ${targetProtein}g. ` +
      `Matches your ${dietType} diet.`;

    return {
      recipe: r,
      score: Math.round(score * 10) / 10,
      why,
      mongoFilter,
      mysqlContext: {
        goal_type:       goal?.goal_type ?? null,
        target_calories: targetCal,
        today_calories:  todayCal,
        remaining_cal:   remaining,
        budget_per_meal: Math.round(budget),
        diet_type:       dietType,
        allergens,
      },
    } satisfies RecommendationResult;
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 10);
}
