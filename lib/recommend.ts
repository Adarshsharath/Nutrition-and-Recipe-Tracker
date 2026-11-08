import pool from './mysql';
import { getDb } from './mongo';
import type { RecipeDocument } from './recipes-service';
import type { RowDataPacket } from 'mysql2';
import type { Filter, Document } from 'mongodb';

// ── DIETARY COMPATIBILITY MODEL ──────────────────────────────────────────────
export interface DietaryRules {
  allowedTags: string[];
  disallowedTags: string[];
  inherentExcludedAllergens: string[];
}

/**
 * Returns allowed tags, strictly disallowed tags, and inherent allergen exclusions
 * for each canonical diet type.
 *
 * Dietary Hierarchy:
 *   vegan ⊂ vegetarian ⊂ eggetarian ⊂ pescatarian ⊂ non_vegetarian
 *
 * Rules:
 *   - vegan: strictly plant-based; rejects egg, dairy/milk, seafood, meat.
 *   - vegetarian: rejects eggs, fish, seafood, and meat.
 *   - eggetarian: allows eggs; rejects fish, seafood, and meat.
 *   - pescatarian: allows fish and seafood; rejects poultry and meat.
 *   - non_vegetarian & other: unrestricted by diet type.
 */
export function getDietaryRules(dietType: string): DietaryRules {
  const norm = (dietType || '').toLowerCase().trim();
  switch (norm) {
    case 'vegan':
      return {
        allowedTags: ['vegan'],
        disallowedTags: ['eggetarian', 'pescatarian', 'non_vegetarian', 'non-vegetarian'],
        inherentExcludedAllergens: ['milk', 'dairy', 'lactose', 'egg', 'eggs', 'fish', 'shellfish'],
      };
    case 'vegetarian':
      return {
        allowedTags: ['vegetarian', 'vegan'],
        disallowedTags: ['eggetarian', 'pescatarian', 'non_vegetarian', 'non-vegetarian'],
        inherentExcludedAllergens: ['egg', 'eggs', 'fish', 'shellfish'],
      };
    case 'eggetarian':
      return {
        allowedTags: ['vegetarian', 'vegan', 'eggetarian'],
        disallowedTags: ['pescatarian', 'non_vegetarian', 'non-vegetarian'],
        inherentExcludedAllergens: ['fish', 'shellfish'],
      };
    case 'pescatarian':
      return {
        allowedTags: ['vegetarian', 'vegan', 'eggetarian', 'pescatarian'],
        disallowedTags: ['non_vegetarian', 'non-vegetarian'],
        inherentExcludedAllergens: [],
      };
    case 'non_vegetarian':
    case 'other':
    default:
      return {
        allowedTags: [],
        disallowedTags: [],
        inherentExcludedAllergens: [],
      };
  }
}

// ── CANONICAL ALLERGEN NORMALIZATION ────────────────────────────────────────
export interface AllergenRule {
  category: string;
  dbTokens: string[];
  pattern: RegExp;
}

export const CANONICAL_ALLERGEN_RULES: AllergenRule[] = [
  {
    category: 'milk',
    dbTokens: ['milk', 'dairy', 'lactose'],
    pattern: /\b(milk|dairy|lactose|cheese|butter|paneer|curd|yogurt|cream|ghee|whey|casein)\b/i,
  },
  {
    category: 'egg',
    dbTokens: ['egg', 'eggs'],
    pattern: /\b(eggs?|egg-whites?|egg-yolks?|albumen|mayonnaise)\b/i,
  },
  {
    category: 'gluten',
    dbTokens: ['gluten', 'wheat'],
    pattern: /\b(gluten|wheat|barley|rye|flour|maida|atta|semolina|sooji|oats)\b/i,
  },
  {
    category: 'peanut',
    dbTokens: ['peanut', 'peanuts'],
    pattern: /\b(peanuts?|groundnuts?|arachis)\b/i,
  },
  {
    category: 'cashew',
    dbTokens: ['cashew', 'cashews', 'tree_nut', 'tree nuts', 'nut', 'nuts'],
    pattern: /\b(cashews?|kaju)\b/i,
  },
  {
    category: 'almond',
    dbTokens: ['almond', 'almonds', 'tree_nut', 'tree nuts', 'nut', 'nuts'],
    pattern: /\b(almonds?|badam)\b/i,
  },
  {
    category: 'walnut',
    dbTokens: ['walnut', 'walnuts', 'tree_nut', 'tree nuts', 'nut', 'nuts'],
    pattern: /\b(walnuts?|akhrot)\b/i,
  },
  {
    category: 'pistachio',
    dbTokens: ['pistachio', 'pistachios', 'tree_nut', 'tree nuts', 'nut', 'nuts'],
    pattern: /\b(pistachios?|pistas?)\b/i,
  },
  {
    category: 'tree_nut',
    dbTokens: ['tree_nut', 'tree nuts', 'nut', 'nuts', 'almond', 'cashew', 'walnut', 'pistachio', 'hazelnut', 'pecan'],
    pattern: /\b(tree\s*nuts?|treenuts?|hazelnuts?|pecans?|macadamias?|brazil\s*nuts?)\b/i,
  },
  {
    category: 'soy',
    dbTokens: ['soy', 'soya', 'soybean'],
    pattern: /\b(soya?|soybeans?|tofu|edamame|tempeh|miso)\b/i,
  },
  {
    category: 'fish',
    dbTokens: ['fish'],
    pattern: /\b(fish|salmon|tuna|cod|tilapia|trout|anchov(y|ies)|halibut|sardines?|mackerel)\b/i,
  },
  {
    category: 'shellfish',
    dbTokens: ['shellfish'],
    pattern: /\b(shellfish|prawns?|shrimps?|crabs?|lobsters?|clams?|oysters?|mussels?|scallops?)\b/i,
  },
  {
    category: 'sesame',
    dbTokens: ['sesame'],
    pattern: /\b(sesame(\s*seeds?)?|tahini|til|gingelly)\b/i,
  },
  {
    category: 'mustard',
    dbTokens: ['mustard'],
    pattern: /\b(mustards?(\s*seeds?)?|dijon|sarson)\b/i,
  },
];

const STOP_WORDS = new Set([
  'i', 'have', 'an', 'a', 'the', 'allergic', 'allergy', 'allergies',
  'intolerance', 'intolerant', 'to', 'severe', 'mild', 'strict', 'no',
  'none', 'na', 'n/a', 'nil', 'nothing', 'avoid', 'avoids', 'reaction',
  'sensitive', 'sensitivity', 'and', 'or', 'with', 'also', 'only',
  'all', 'any', 'my', 'is', 'in', 'of', 'for', 'but'
]);

export interface NormalizedAllergens {
  categories: string[];
  dbTokens: string[];
  unknownAllergens: string[];
}

/**
 * Normalizes free-form allergy and intolerance text notes.
 * Extracts recognized canonical categories, expands them into database query tokens,
 * and isolates any unknown or unverified allergen terms for conservative handling.
 */
export function normalizeAllergens(text?: string | null): NormalizedAllergens {
  if (!text || typeof text !== 'string') {
    return { categories: [], dbTokens: [], unknownAllergens: [] };
  }

  const raw = text.trim();
  if (!raw) {
    return { categories: [], dbTokens: [], unknownAllergens: [] };
  }

  const matchedCategories = new Set<string>();
  const dbTokens = new Set<string>();

  for (const rule of CANONICAL_ALLERGEN_RULES) {
    if (rule.pattern.test(raw)) {
      matchedCategories.add(rule.category);
      rule.dbTokens.forEach((t) => dbTokens.add(t));
    }
  }

  // Handle generic 'nut' / 'nuts' if not water chestnuts, butternut squash, or nutmeg
  if (/\bnuts?\b/i.test(raw) && !/\b(water\s+chestnuts?|butternut|nutmeg)\b/i.test(raw)) {
    matchedCategories.add('tree_nut');
    matchedCategories.add('peanut');
    ['peanut', 'peanuts', 'tree_nut', 'tree nuts', 'nut', 'nuts', 'almond', 'cashew', 'walnut', 'pistachio'].forEach((t) => dbTokens.add(t));
  }

  // Split into clauses to identify unknown allergy terms
  const clauses = raw
    .split(/[,;\n/]+|\band\b|\bwith\b/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const unknownAllergens: string[] = [];

  for (const clause of clauses) {
    let matchedInClause = false;
    for (const rule of CANONICAL_ALLERGEN_RULES) {
      if (rule.pattern.test(clause)) {
        matchedInClause = true;
        break;
      }
    }
    if (!matchedInClause && /\bnuts?\b/i.test(clause) && !/\b(water\s+chestnuts?|butternut|nutmeg)\b/i.test(clause)) {
      matchedInClause = true;
    }

    if (!matchedInClause) {
      const words = clause
        .toLowerCase()
        .replace(/[^\w\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

      if (words.length > 0) {
        const candidate = words.join(' ');
        if (!unknownAllergens.includes(candidate)) {
          unknownAllergens.push(candidate);
        }
      }
    }
  }

  return {
    categories: Array.from(matchedCategories),
    dbTokens: Array.from(dbTokens),
    unknownAllergens,
  };
}

// ── TIME & DATE HANDLING ─────────────────────────────────────────────────────
export function mealsRemainingToday(hour: number): number {
  if (hour < 10) return 4; // breakfast, lunch, snack, dinner
  if (hour < 14) return 3; // lunch, snack, dinner
  if (hour < 18) return 2; // snack, dinner
  return 1;                // dinner
}

export function inferMealType(hour: number): string {
  if (hour < 10) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

/**
 * Returns date and timing synchronized in local server timezone.
 * Avoids mixing UTC date strings with local server hour.
 */
export function getRecommendationTiming(
  referenceDate: Date = new Date(),
  explicitDate?: string
): { dateStr: string; hour: number; inferredMealType: string; mealsRemaining: number } {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(referenceDate.getDate()).padStart(2, '0');
  const systemDate = `${y}-${m}-${d}`;
  const systemHour = referenceDate.getHours();

  const isToday = !explicitDate || explicitDate === systemDate;
  const dateStr = explicitDate ?? systemDate;

  const inferredMealType = isToday ? inferMealType(systemHour) : 'breakfast';
  const mealsRemaining = isToday ? mealsRemainingToday(systemHour) : 4;

  return {
    dateStr,
    hour: systemHour,
    inferredMealType,
    mealsRemaining,
  };
}

// ── MONGODB FILTER BUILDER ───────────────────────────────────────────────────
export function buildMongoFilter(options: {
  dietType: string;
  userAllergenDbTokens: string[];
  unknownAllergens?: string[];
  mealType?: string;
  calLow?: number;
  calHigh?: number;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    archived: { $ne: true },
  };

  const dietRules = getDietaryRules(options.dietType);

  // 1. Dietary tags
  if (dietRules.allowedTags.length > 0) {
    if (dietRules.disallowedTags.length > 0) {
      filter.dietary_tags = {
        $in: dietRules.allowedTags,
        $nin: dietRules.disallowedTags,
      };
    } else {
      filter.dietary_tags = { $in: dietRules.allowedTags };
    }
  }

  // 2. Allergens (user allergens + inherent dietary exclusions)
  const allExcludedAllergens = Array.from(
    new Set([...dietRules.inherentExcludedAllergens, ...options.userAllergenDbTokens])
  );
  if (allExcludedAllergens.length > 0) {
    filter.allergens = { $nin: allExcludedAllergens };
  }

  // 3. Meal type filter
  if (options.mealType) {
    filter.meal_type = options.mealType;
  }

  // 4. Calorie filter (only if bounds are provided)
  if (options.calLow !== undefined && options.calHigh !== undefined) {
    filter['nutrition_per_serving.calories'] = {
      $gte: options.calLow,
      $lte: options.calHigh,
    };
  }

  // 5. Unknown allergy terms: conservative ingredient name and title exclusions
  if (options.unknownAllergens && options.unknownAllergens.length > 0) {
    const unknownExclusions: Array<Record<string, unknown>> = [];
    for (const term of options.unknownAllergens) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      unknownExclusions.push(
        { recipe_name: { $not: rx } },
        { 'ingredients.name': { $not: rx } }
      );
    }
    if (unknownExclusions.length > 0) {
      filter.$and = unknownExclusions;
    }
  }

  return filter;
}

// ── PURE RECIPE COMPATIBILITY CHECKER (FOR VERIFICATION) ────────────────────
export function isRecipeCompatible(
  recipe: RecipeDocument,
  profile: {
    diet_type: string;
    allergy_notes?: string | null;
    intolerance_notes?: string | null;
  }
): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const dietRules = getDietaryRules(profile.diet_type);

  // Check dietary tags
  const tags = (recipe.dietary_tags || []).map((t) => t.toLowerCase().trim());
  if (dietRules.allowedTags.length > 0) {
    const hasAllowed = dietRules.allowedTags.some((t) => tags.includes(t.toLowerCase()));
    if (!hasAllowed) {
      reasons.push(`Recipe tags [${tags.join(', ')}] missing required dietary tag for ${profile.diet_type}`);
    }
  }
  if (dietRules.disallowedTags.length > 0) {
    const hasDisallowed = dietRules.disallowedTags.some((t) => tags.includes(t.toLowerCase()));
    if (hasDisallowed) {
      reasons.push(`Recipe contains disallowed dietary tag for ${profile.diet_type}`);
    }
  }

  // Check allergens
  const recipeAllergens = (recipe.allergens || []).map((a) => a.toLowerCase().trim());
  const normalizedAllergies = normalizeAllergens(profile.allergy_notes);
  const normalizedIntolerances = normalizeAllergens(profile.intolerance_notes);
  const allExcluded = Array.from(
    new Set([
      ...normalizedAllergies.dbTokens,
      ...normalizedIntolerances.dbTokens,
      ...dietRules.inherentExcludedAllergens,
    ])
  );

  for (const excluded of allExcluded) {
    if (recipeAllergens.includes(excluded.toLowerCase())) {
      reasons.push(`Recipe contains excluded allergen: ${excluded}`);
    }
  }

  return {
    compatible: reasons.length === 0,
    reasons,
  };
}

export interface RecommendationResult {
  recipe: RecipeDocument;
  score: number;
  why: string;
  mongoFilter: object;
  mysqlContext: {
    goal_type: string | null;
    target_calories: number | null;
    today_calories: number;
    remaining_cal: number;
    budget_per_meal: number;
    diet_type: string;
    allergens: string[];
    unrecognized_allergens?: string[];
  };
}

// ── HYBRID RECOMMENDATION ENGINE ─────────────────────────────────────────────
export async function getRecommendations(
  userId: string,
  params: { meal_type?: string; date?: string }
): Promise<RecommendationResult[]> {
  const timing = getRecommendationTiming(new Date(), params.date);
  const today = timing.dateStr;

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

  const goal = goalRow as { goal_type: string; target_calories: number; target_protein_g: number } | undefined;
  const profile = profileRow as { diet_type: string; allergy_notes: string | null; intolerance_notes: string | null } | undefined;
  const todayCal = Number(logRow?.total_calories ?? 0);
  const targetCal = Number(goal?.target_calories ?? 2000);
  const remaining = Math.max(0, targetCal - todayCal);
  const mealsLeft = timing.mealsRemaining;
  const budget = Math.max(100, remaining / mealsLeft);

  const dietType = profile?.diet_type ?? 'other';

  const normAllergies = normalizeAllergens(profile?.allergy_notes);
  const normIntolerances = normalizeAllergens(profile?.intolerance_notes);

  const userAllergenCategories = Array.from(
    new Set([...normAllergies.categories, ...normIntolerances.categories])
  );
  const userAllergenDbTokens = Array.from(
    new Set([...normAllergies.dbTokens, ...normIntolerances.dbTokens])
  );
  const unknownAllergens = Array.from(
    new Set([...normAllergies.unknownAllergens, ...normIntolerances.unknownAllergens])
  );

  const mealType = params.meal_type ?? timing.inferredMealType;

  // 2. Build strict MongoDB filter (with ±20% calorie window)
  const calLow = budget * 0.80;
  const calHigh = budget * 1.20;

  const strictFilter = buildMongoFilter({
    dietType,
    userAllergenDbTokens,
    unknownAllergens,
    mealType,
    calLow,
    calHigh,
  });

  const db = await getDb();
  let isRelaxed = false;
  let activeFilter = strictFilter;

  let docs = await db.collection('recipes')
    .find(strictFilter as Filter<Document>)
    .limit(20)
    .toArray();

  // 3. Calorie relaxation: If strict query yields 0 results, relax ONLY the calorie window.
  // Safety guarantees: Dietary restrictions, allergen exclusions, archived flags, and meal types remain strictly active.
  if (docs.length === 0) {
    isRelaxed = true;
    const relaxedFilter = buildMongoFilter({
      dietType,
      userAllergenDbTokens,
      unknownAllergens,
      mealType,
      // calLow and calHigh omitted
    });
    activeFilter = relaxedFilter;

    docs = await db.collection('recipes')
      .find(relaxedFilter as Filter<Document>)
      .limit(20)
      .toArray();
  }

  const recipes = docs as unknown as RecipeDocument[];

  // 4. Rank candidates by proximity to calorie budget and protein density
  const targetProtein = Number(goal?.target_protein_g ?? 50);

  const scored = recipes.map((r) => {
    const cal = r.nutrition_per_serving?.calories ?? 0;
    const prot = r.nutrition_per_serving?.protein_g ?? 0;
    const calDiff = Math.abs(cal - budget);
    const protScore = (prot / Math.max(1, cal)) * 100;
    const score = 100 - (calDiff / Math.max(1, budget)) * 50 + protScore * 0.5;

    let why = `Calories ${cal} kcal is ${calDiff.toFixed(0)} kcal from your per-meal budget of ${budget.toFixed(0)} kcal. ` +
      `Protein ${prot}g supports your daily target of ${targetProtein}g. ` +
      `Matches your ${dietType} diet.`;

    if (isRelaxed) {
      why = `[Calorie Window Relaxed] ` + why;
    }
    if (unknownAllergens.length > 0) {
      why += ` (Note: Checked against unverified allergy note: "${unknownAllergens.join(', ')}")`;
    }

    return {
      recipe: r,
      score: Math.round(score * 10) / 10,
      why,
      mongoFilter: activeFilter,
      mysqlContext: {
        goal_type: goal?.goal_type ?? null,
        target_calories: targetCal,
        today_calories: todayCal,
        remaining_cal: remaining,
        budget_per_meal: Math.round(budget),
        diet_type: dietType,
        allergens: Array.from(new Set([...userAllergenCategories, ...unknownAllergens])),
        unrecognized_allergens: unknownAllergens.length > 0 ? unknownAllergens : undefined,
      },
    } satisfies RecommendationResult;
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 10);
}
