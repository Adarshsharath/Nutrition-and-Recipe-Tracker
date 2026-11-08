#!/usr/bin/env tsx
/**
 * Test Suite: Dietary Recommendation Filters and Allergen Matching (Issue #6).
 *
 * Verifies:
 *  1. Dietary compatibility rules (vegan, vegetarian, eggetarian, pescatarian, non_vegetarian)
 *  2. Canonical allergen normalization and alias expansion
 *  3. Word-boundary precision (e.g. nutmeg, water chestnuts, donut)
 *  4. Unknown / unverified allergy note detection and conservative handling
 *  5. Calorie relaxation preservation of safety filters
 *  6. Synchronized date and meal timing
 *  7. End-to-end recommendation query execution against local databases
 *
 * Run: npx tsx scripts/test-recommendations.ts
 */

import pool from '../lib/mysql';
import client from '../lib/mongo';
import type { RowDataPacket } from 'mysql2';
import {
  getDietaryRules,
  normalizeAllergens,
  mealsRemainingToday,
  inferMealType,
  getRecommendationTiming,
  buildMongoFilter,
  isRecipeCompatible,
  getRecommendations,
} from '../lib/recommend';
import type { RecipeDocument } from '../lib/recipes-service';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock recipe builder
function createMockRecipe(overrides: Partial<RecipeDocument>): RecipeDocument {
  return {
    _id: 'mock-0000-0000-0000-000000000000',
    recipe_name: 'Mock Recipe',
    dietary_tags: ['vegetarian'],
    allergens: [],
    ingredients: [{ name: 'Ingredient 1', quantity: 100, unit: 'g' }],
    instructions: [{ step: 1, text: 'Cook' }],
    nutrition_per_serving: { calories: 350, protein_g: 15, carbs_g: 40, fat_g: 10 },
    ...overrides,
  };
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: DIETARY RECOMMENDATION FILTERS & ALLERGEN MATCHING');
  console.log('================================================================\n');

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 1: DIETARY COMPATIBILITY RULES
  // ──────────────────────────────────────────────────────────────────────────
  console.log('SECTION 1: Dietary Compatibility Rules');

  // Verify getDietaryRules structure
  const veganRules = getDietaryRules('vegan');
  assert(veganRules.allowedTags.includes('vegan'), 'Vegan rules allow "vegan" tag');
  assert(veganRules.disallowedTags.includes('eggetarian'), 'Vegan rules disallow "eggetarian" tag');
  assert(veganRules.inherentExcludedAllergens.includes('milk'), 'Vegan rules exclude dairy/milk inherently');

  const vegRules = getDietaryRules('vegetarian');
  assert(vegRules.allowedTags.includes('vegetarian') && vegRules.allowedTags.includes('vegan'), 'Vegetarian rules allow vegetarian and vegan tags');
  assert(vegRules.disallowedTags.includes('non_vegetarian'), 'Vegetarian rules disallow non-vegetarian tag');

  const veganRecipe = createMockRecipe({
    recipe_name: 'Vegan Chana Bowl',
    dietary_tags: ['vegan', 'high-protein'],
    allergens: [],
  });

  const vegDairyRecipe = createMockRecipe({
    recipe_name: 'Paneer Quinoa',
    dietary_tags: ['vegetarian'],
    allergens: ['milk'],
  });

  const eggetarianRecipe = createMockRecipe({
    recipe_name: 'Egg Bhurji',
    dietary_tags: ['eggetarian'],
    allergens: ['egg'],
  });

  const pescatarianRecipe = createMockRecipe({
    recipe_name: 'Grilled Salmon',
    dietary_tags: ['pescatarian'],
    allergens: ['fish'],
  });

  const nonVegRecipe = createMockRecipe({
    recipe_name: 'Chicken Tikka',
    dietary_tags: ['non_vegetarian'],
    allergens: ['milk'],
  });

  // 1.1 Vegetarian
  const vegProfile = { diet_type: 'vegetarian' };
  assert(isRecipeCompatible(vegDairyRecipe, vegProfile).compatible, 'Vegetarian profile allows vegetarian recipe');
  assert(isRecipeCompatible(veganRecipe, vegProfile).compatible, 'Vegetarian profile allows vegan recipe');
  assert(!isRecipeCompatible(eggetarianRecipe, vegProfile).compatible, 'Vegetarian profile rejects eggetarian recipe');
  assert(!isRecipeCompatible(nonVegRecipe, vegProfile).compatible, 'Vegetarian profile rejects non-vegetarian recipe');
  assert(!isRecipeCompatible(pescatarianRecipe, vegProfile).compatible, 'Vegetarian profile rejects fish/pescatarian recipe');

  // 1.2 Vegan
  const veganProfile = { diet_type: 'vegan' };
  assert(isRecipeCompatible(veganRecipe, veganProfile).compatible, 'Vegan profile allows vegan recipe');
  assert(!isRecipeCompatible(vegDairyRecipe, veganProfile).compatible, 'Vegan profile rejects vegetarian recipe containing dairy');
  assert(!isRecipeCompatible(eggetarianRecipe, veganProfile).compatible, 'Vegan profile rejects eggetarian recipe');
  assert(!isRecipeCompatible(pescatarianRecipe, veganProfile).compatible, 'Vegan profile rejects pescatarian recipe');
  assert(!isRecipeCompatible(nonVegRecipe, veganProfile).compatible, 'Vegan profile rejects non-vegetarian recipe');

  // 1.3 Eggetarian
  const eggetarianProfile = { diet_type: 'eggetarian' };
  assert(isRecipeCompatible(eggetarianRecipe, eggetarianProfile).compatible, 'Eggetarian profile allows egg recipe');
  assert(isRecipeCompatible(vegDairyRecipe, eggetarianProfile).compatible, 'Eggetarian profile allows vegetarian recipe');
  assert(isRecipeCompatible(veganRecipe, eggetarianProfile).compatible, 'Eggetarian profile allows vegan recipe');
  assert(!isRecipeCompatible(nonVegRecipe, eggetarianProfile).compatible, 'Eggetarian profile rejects meat recipe');
  assert(!isRecipeCompatible(pescatarianRecipe, eggetarianProfile).compatible, 'Eggetarian profile rejects fish recipe');

  // 1.4 Pescatarian
  const pescatarianProfile = { diet_type: 'pescatarian' };
  assert(isRecipeCompatible(pescatarianRecipe, pescatarianProfile).compatible, 'Pescatarian profile allows fish recipe');
  assert(isRecipeCompatible(eggetarianRecipe, pescatarianProfile).compatible, 'Pescatarian profile allows egg recipe');
  assert(isRecipeCompatible(vegDairyRecipe, pescatarianProfile).compatible, 'Pescatarian profile allows vegetarian recipe');
  assert(isRecipeCompatible(veganRecipe, pescatarianProfile).compatible, 'Pescatarian profile allows vegan recipe');
  assert(!isRecipeCompatible(nonVegRecipe, pescatarianProfile).compatible, 'Pescatarian profile rejects chicken/meat recipe');

  // 1.5 Non-Vegetarian & Other
  const nonVegProfile = { diet_type: 'non_vegetarian' };
  assert(isRecipeCompatible(nonVegRecipe, nonVegProfile).compatible, 'Non-vegetarian profile allows non-vegetarian recipe');
  assert(isRecipeCompatible(pescatarianRecipe, nonVegProfile).compatible, 'Non-vegetarian profile allows fish recipe');
  assert(isRecipeCompatible(vegDairyRecipe, nonVegProfile).compatible, 'Non-vegetarian profile allows vegetarian recipe');

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 2: CANONICAL ALLERGEN NORMALIZATION & WORD BOUNDARIES
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nSECTION 2: Allergen Normalization and Precision');

  // 2.1 Peanut
  const peanutNorm = normalizeAllergens('Peanuts allergy, groundnuts');
  assert(peanutNorm.categories.includes('peanut'), 'Matches peanut category');
  assert(peanutNorm.dbTokens.includes('peanut'), 'Includes peanut dbToken');

  // 2.2 Tree nuts & specific nut aliases
  const cashewNorm = normalizeAllergens('Allergic to cashews and almonds');
  assert(cashewNorm.categories.includes('cashew'), 'Identifies cashew');
  assert(cashewNorm.categories.includes('almond'), 'Identifies almond');
  assert(cashewNorm.dbTokens.includes('cashew') && cashewNorm.dbTokens.includes('tree_nut'), 'Includes cashew & tree_nut tokens');

  const walnutNorm = normalizeAllergens('walnut, pistachio');
  assert(walnutNorm.categories.includes('walnut'), 'Identifies walnut');
  assert(walnutNorm.categories.includes('pistachio'), 'Identifies pistachio');

  // 2.3 Dairy & Milk
  const dairyNorm = normalizeAllergens('Lactose intolerance, severe dairy allergy');
  assert(dairyNorm.categories.includes('milk'), 'Normalizes dairy & lactose to milk category');
  assert(dairyNorm.dbTokens.includes('milk') && dairyNorm.dbTokens.includes('dairy'), 'Includes both milk and dairy dbTokens');

  // 2.4 Egg
  const eggNorm = normalizeAllergens('eggs, mayonnaise');
  assert(eggNorm.categories.includes('egg'), 'Matches egg category from eggs & mayonnaise');

  // 2.5 Gluten & Wheat
  const wheatNorm = normalizeAllergens('wheat flour allergy');
  assert(wheatNorm.categories.includes('gluten'), 'Normalizes wheat and flour to gluten category');
  assert(wheatNorm.dbTokens.includes('gluten') && wheatNorm.dbTokens.includes('wheat'), 'Includes gluten and wheat dbTokens');

  // 2.6 Soy, Fish, Shellfish, Sesame, Mustard
  const otherAllergensNorm = normalizeAllergens('soy, salmon, shrimp, tahini, dijon mustard');
  assert(otherAllergensNorm.categories.includes('soy'), 'Identifies soy');
  assert(otherAllergensNorm.categories.includes('fish'), 'Identifies fish from salmon');
  assert(otherAllergensNorm.categories.includes('shellfish'), 'Identifies shellfish from shrimp');
  assert(otherAllergensNorm.categories.includes('sesame'), 'Identifies sesame from tahini');
  assert(otherAllergensNorm.categories.includes('mustard'), 'Identifies mustard from dijon mustard');

  // 2.7 False-positive protection (word boundaries)
  const nutmegNorm = normalizeAllergens('I love nutmeg');
  assert(!nutmegNorm.categories.includes('peanut') && !nutmegNorm.categories.includes('tree_nut'), 'Nutmeg is NOT treated as a nut');

  const donutNorm = normalizeAllergens('donut');
  assert(!donutNorm.categories.includes('peanut') && !donutNorm.categories.includes('tree_nut'), 'Donut is NOT treated as a nut');

  const waterChestnutNorm = normalizeAllergens('water chestnuts');
  assert(!waterChestnutNorm.categories.includes('tree_nut'), 'Water chestnuts is NOT treated as a tree nut');

  const butternutNorm = normalizeAllergens('butternut squash');
  assert(!butternutNorm.categories.includes('milk') && !butternutNorm.categories.includes('tree_nut'), 'Butternut is NOT treated as butter or nut');

  // 2.8 Casing and whitespace
  const mixedCaseNorm = normalizeAllergens('   MILK   ,   GlUTeN   ');
  assert(mixedCaseNorm.categories.includes('milk') && mixedCaseNorm.categories.includes('gluten'), 'Handles mixed casing and padding whitespace');

  // 2.9 Empty / negative declarations
  assert(normalizeAllergens('').categories.length === 0, 'Empty string returns empty categories');
  assert(normalizeAllergens(null).categories.length === 0, 'Null returns empty categories');
  assert(normalizeAllergens('None').categories.length === 0, '"None" returns empty categories without false matches');
  assert(normalizeAllergens('No allergies').categories.length === 0, '"No allergies" returns empty categories');
  assert(normalizeAllergens('N/A').categories.length === 0, '"N/A" returns empty categories');

  // 2.10 Unknown allergen terms
  const unknownNorm = normalizeAllergens('Severe allergy to kiwi and strawberries');
  assert(unknownNorm.unknownAllergens.includes('kiwi'), 'Extracts unrecognized allergy: kiwi');
  assert(unknownNorm.unknownAllergens.includes('strawberries'), 'Extracts unrecognized allergy: strawberries');

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 3: CALORIE RELAXATION PRESERVES SAFETY FILTERS
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nSECTION 3: Calorie Relaxation Safety Guarantees');

  const strictFilter = buildMongoFilter({
    dietType: 'vegetarian',
    userAllergenDbTokens: ['peanut', 'peanuts'],
    unknownAllergens: ['kiwi'],
    mealType: 'lunch',
    calLow: 400,
    calHigh: 600,
  });

  const relaxedFilter = buildMongoFilter({
    dietType: 'vegetarian',
    userAllergenDbTokens: ['peanut', 'peanuts'],
    unknownAllergens: ['kiwi'],
    mealType: 'lunch',
    // No calorie bounds
  });

  assert(strictFilter['nutrition_per_serving.calories'] !== undefined, 'Strict filter includes calorie range');
  assert(relaxedFilter['nutrition_per_serving.calories'] === undefined, 'Relaxed filter removes calorie range');

  // In both filters, all safety rules must be identical
  assert(JSON.stringify(strictFilter.dietary_tags) === JSON.stringify(relaxedFilter.dietary_tags),
    'Dietary tags filter is identical in strict and relaxed modes');
  assert(JSON.stringify(strictFilter.allergens) === JSON.stringify(relaxedFilter.allergens),
    'Allergen exclusion filter is identical in strict and relaxed modes');
  assert(strictFilter.archived !== undefined && JSON.stringify(strictFilter.archived) === JSON.stringify(relaxedFilter.archived),
    'Archived recipe exclusion is preserved in relaxed mode');
  assert(strictFilter.meal_type === relaxedFilter.meal_type,
    'Meal type filter is preserved in relaxed mode');
  assert(JSON.stringify(strictFilter.$and) === JSON.stringify(relaxedFilter.$and),
    'Unknown allergen exclusions are preserved in relaxed mode');

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 4: DATE & TIME HANDLING
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nSECTION 4: Date and Time Synchronization');

  // 4.1 Meal timing and meals remaining
  assert(mealsRemainingToday(7) === 4, '7 AM has 4 meals remaining');
  assert(mealsRemainingToday(12) === 3, '12 PM has 3 meals remaining');
  assert(mealsRemainingToday(15) === 2, '3 PM has 2 meals remaining');
  assert(mealsRemainingToday(20) === 1, '8 PM has 1 meal remaining');

  assert(inferMealType(8) === 'breakfast', '8 AM infers breakfast');
  assert(inferMealType(12) === 'lunch', '12 PM infers lunch');
  assert(inferMealType(16) === 'snack', '4 PM infers snack');
  assert(inferMealType(20) === 'dinner', '8 PM infers dinner');

  // 4.2 Midnight boundary synchronization
  const beforeMidnight = new Date('2026-11-08T23:59:59');
  const afterMidnight  = new Date('2026-11-09T00:00:01');

  const timingBefore = getRecommendationTiming(beforeMidnight);
  const timingAfter  = getRecommendationTiming(afterMidnight);

  assert(timingBefore.dateStr === '2026-11-08', 'Date before midnight matches day 1');
  assert(timingBefore.inferredMealType === 'dinner', 'Hour before midnight infers dinner');

  assert(timingAfter.dateStr === '2026-11-09', 'Date after midnight matches day 2');
  assert(timingAfter.inferredMealType === 'breakfast', 'Hour after midnight infers breakfast');
  assert(timingAfter.mealsRemaining === 4, 'Day 2 starts with 4 meals remaining');

  // 4.3 Explicit date preserved
  const explicitTiming = getRecommendationTiming(beforeMidnight, '2026-12-25');
  assert(explicitTiming.dateStr === '2026-12-25', 'Explicit date is preserved exactly');
  assert(explicitTiming.mealsRemaining === 4, 'Explicit date defaults to full day budget');

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 5: LIVE DATABASE RECOMMENDATIONS INTEGRATION
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\nSECTION 5: End-to-End Database Recommendation Verification');

  // Fetch a real user from MySQL to test live recommendations
  const [userRows] = await pool.execute<RowDataPacket[]>(
    'SELECT user_id FROM users LIMIT 1'
  );

  if (userRows.length > 0) {
    const testUserId = String(userRows[0].user_id);

    // Test recommendations for this user
    const recs = await getRecommendations(testUserId, {});
    assert(Array.isArray(recs), 'getRecommendations returned an array');

    if (recs.length > 0) {
      const first = recs[0];
      assert(typeof first.score === 'number', 'Recommendation includes numeric score');
      assert(typeof first.why === 'string' && first.why.length > 0, 'Recommendation includes non-empty "why" justification');
      assert(first.mysqlContext !== undefined, 'Recommendation includes mysqlContext');
      assert(first.mongoFilter !== undefined, 'Recommendation includes mongoFilter');
      assert(first.recipe !== undefined && typeof first.recipe.recipe_name === 'string', 'Recommendation includes complete recipe document');

      // Verify that every returned recipe satisfies the active user's dietary profile
      const [pRows] = await pool.execute<RowDataPacket[]>(
        'SELECT diet_type, allergy_notes, intolerance_notes FROM dietary_profiles WHERE user_id = ?',
        [testUserId]
      );
      if (pRows.length > 0) {
        const prof = {
          diet_type: String(pRows[0].diet_type),
          allergy_notes: pRows[0].allergy_notes ? String(pRows[0].allergy_notes) : null,
          intolerance_notes: pRows[0].intolerance_notes ? String(pRows[0].intolerance_notes) : null,
        };
        for (const r of recs) {
          const comp = isRecipeCompatible(r.recipe, prof);
          assert(comp.compatible, `Returned recipe "${r.recipe.recipe_name}" strictly matches user's ${prof.diet_type} diet and allergies`);
        }
      }
    } else {
      console.log('  ℹ (No recipes matched current window; filter relaxation verified via pure unit tests)');
    }
  } else {
    console.log('  ℹ (No users found in database; integration query skipped)');
  }

  console.log('\n================================================================');
  console.log('ALL RECOMMENDATION FILTER TESTS COMPLETED SUCCESSFULLY!');
  console.log(`Passed: ${passed} | Failed: ${failed}`);
  console.log('================================================================\n');
}

runTestSuite()
  .then(async () => {
    await pool.end();
    await client.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE ENCOUNTERED UNEXPECTED ERROR:', err);
    process.exit(1);
  });

