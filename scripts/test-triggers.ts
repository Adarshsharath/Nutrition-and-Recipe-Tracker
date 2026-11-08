#!/usr/bin/env tsx
import pool from '../lib/mysql';
import { POST } from '../app/api/review/triggers/[name]/demo/route';
import { NextRequest } from 'next/server';
import type { RowDataPacket } from 'mysql2';

const TRIGGERS = [
  'trg_users_after_insert',
  'trg_goals_before_insert',
  'trg_goals_before_update',
  'trg_meal_before_insert',
  'trg_meal_after_insert',
  'trg_meal_after_update',
  'trg_meal_after_delete',
];

async function getCounts() {
  const [users] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM users');
  const [profiles] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM dietary_profiles');
  const [goals] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM nutrition_goals');
  const [recipes] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM recipe_catalog');
  const [logs] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM daily_nutrition_logs');
  const [meals] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) as c FROM meal_logs');
  return {
    users: users[0].c,
    profiles: profiles[0].c,
    goals: goals[0].c,
    recipes: recipes[0].c,
    logs: logs[0].c,
    meals: meals[0].c,
  };
}

async function main() {
  console.log('Testing all 7 trigger demonstrations against MySQL 8...\n');

  const initialCounts = await getCounts();
  console.log('Initial Database Counts:', initialCounts);

  let allPassed = true;

  for (const name of TRIGGERS) {
    console.log(`\n==================================================`);
    console.log(`Testing Trigger: ${name}`);
    console.log(`==================================================`);

    // Run each demonstration 3 times to verify repeatability and zero side-effects
    for (let run = 1; run <= 3; run++) {
      const countsBeforeRun = await getCounts();

      const req = new NextRequest(`http://localhost:3000/api/review/triggers/${name}/demo`, { method: 'POST' });
      const res = await POST(req, { params: Promise.resolve({ name }) });
      const json = await res.json();

      if (res.status !== 200 || !json.verified) {
        console.error(`  [Run ${run}] ✗ FAILED:`, json);
        allPassed = false;
      } else {
        console.log(`  [Run ${run}] ✓ PASSED:`, JSON.stringify(json));
      }

      const countsAfterRun = await getCounts();

      // Verify counts did not change
      const countDiff = JSON.stringify(countsBeforeRun) !== JSON.stringify(countsAfterRun);
      if (countDiff) {
        console.error(`  [Run ${run}] ✗ ERROR: Database row counts changed after demonstration!`);
        console.error('    Before:', countsBeforeRun);
        console.error('    After: ', countsAfterRun);
        allPassed = false;
      } else {
        console.log(`  [Run ${run}] ✓ Database state perfectly preserved (0 records leaked).`);
      }
    }
  }

  const finalCounts = await getCounts();
  console.log('\n==================================================');
  console.log('Final Database Counts:', finalCounts);
  const totalDiff = JSON.stringify(initialCounts) !== JSON.stringify(finalCounts);
  if (totalDiff) {
    console.error('✗ Total database state changed during tests!');
    allPassed = false;
  } else {
    console.log('✓ Initial counts match final counts exactly!');
  }

  await pool.end();

  if (!allPassed) {
    console.error('\n❌ Some trigger demonstrations failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All 7 trigger demonstrations passed 3 consecutive iterations with perfect cleanup!');
  }
}

main().catch((err) => {
  console.error('Test runner encountered error:', err);
  process.exit(1);
});

