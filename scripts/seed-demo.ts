#!/usr/bin/env tsx
/**
 * Seeds 14 days of daily logs and meals for demo users via sp_log_meal.
 * Run: npx tsx scripts/seed-demo.ts
 */
import pool from '../lib/mysql';

const DEMO_USER  = 'aaaaaaaa-0000-4000-a000-000000000001';
const PRIYA_USER = 'bbbbbbbb-0000-4000-b000-000000000002';
const ROHAN_USER = 'cccccccc-0000-4000-c000-000000000003';

// Pre-seeded recipe IDs (matches seed-recipes.ts)
const RECIPE_IDS = {
  paneerQuinoa:    '11111111-aaaa-4000-8000-000000000001',
  masalaOats:      '11111111-aaaa-4000-8000-000000000002',
  chana:           '11111111-aaaa-4000-8000-000000000003',
  eggBhurji:       '11111111-aaaa-4000-8000-000000000004',
  salmon:          '11111111-aaaa-4000-8000-000000000005',
  chickenTikka:    '11111111-aaaa-4000-8000-000000000006',
  greekSalad:      '11111111-aaaa-4000-8000-000000000007',
  dalTadka:        '11111111-aaaa-4000-8000-000000000008',
  overnightOats:   '11111111-aaaa-4000-8000-000000000009',
  tofuStirFry:     '11111111-aaaa-4000-8000-000000000010',
  avocadoToast:    '11111111-aaaa-4000-8000-000000000011',
  rajmaChawal:     '11111111-aaaa-4000-8000-000000000012',
};

type Meal = [string | null, string, number, number, number, number, number, string | null];

interface DayPlan {
  date: string;
  user: string;
  meals: Meal[];
}

async function logMeal(
  userId: string, date: string,
  recipeId: string | null, mealType: string,
  servings: number, cal: number, prot: number, carbs: number, fat: number,
  notes: string | null = null
) {
  await pool.execute('CALL sp_log_meal(?,?,?,?,?,?,?,?,?,?)', [
    userId, date, recipeId, mealType, servings, cal, prot, carbs, fat, notes
  ]);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

async function main() {
  console.log('Seeding 14 days of meals for demo users…');

  const days: DayPlan[] = [];

  for (let i = 13; i >= 0; i--) {
    const date = daysAgo(i);
    days.push({
      date,
      user: DEMO_USER,
      meals: [
        [RECIPE_IDS.masalaOats,    'breakfast', 1,   220,  8, 38,  5, null],
        [RECIPE_IDS.dalTadka,      'lunch',     1.5, 280, 16, 42,  6, 'Extra servings'],
        [RECIPE_IDS.paneerQuinoa,  'dinner',    1,   420, 25, 45, 15, null],
        [null,                     'snack',     1,   150,  5, 25,  3, 'Fruit salad (manual)'],
      ],
    });
    days.push({
      date,
      user: PRIYA_USER,
      meals: [
        [RECIPE_IDS.overnightOats, 'breakfast', 1, 310, 15, 45,  8, null],
        [RECIPE_IDS.greekSalad,    'lunch',     1, 190,  7, 10, 14, null],
        [RECIPE_IDS.chana,         'dinner',    1, 310, 15, 48,  6, null],
      ],
    });
    days.push({
      date,
      user: ROHAN_USER,
      meals: [
        [RECIPE_IDS.avocadoToast,  'breakfast', 1,   350, 14, 30, 20, null],
        [RECIPE_IDS.rajmaChawal,   'lunch',     1,   460, 18, 82,  5, null],
        [RECIPE_IDS.chickenTikka,  'dinner',    1.5, 300, 38,  5, 13, 'Post-workout meal'],
      ],
    });
  }

  for (const day of days) {
    for (const [rid, mtype, srv, cal, prot, carbs, fat, notes] of day.meals) {
      try {
        await logMeal(day.user, day.date, rid, mtype, srv, cal / srv, prot / srv, carbs / srv, fat / srv, notes as string | null);
      } catch (err) {
        console.warn(`  ⚠ Skipped ${day.date}/${mtype}: ${(err as Error).message}`);
      }
    }
    console.log(`  ✓ ${day.date} (${day.user.slice(0,8)}…)`);
  }

  await pool.end();
  console.log('\n✅ Demo seed complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });

