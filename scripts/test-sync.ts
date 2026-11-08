#!/usr/bin/env tsx
/**
 * Automated End-to-End Verification of MySQL and MongoDB Synchronization (Issue #5).
 * Tests:
 *  1. Create recipe dual-write consistency
 *  2. Partial update consistency across both DBs
 *  3. Archive / soft-delete consistency
 *  4. Missing recipe update returns 404
 *  5. Missing recipe archive returns 404
 *  6. Cross-database synchronization checker (detects missing, metadata mismatch, status mismatch)
 *  7. Failure compensation handling (MongoDB rollback on MySQL failure)
 *  8. Seeding idempotency and preservation of archived records
 *
 * Run: npx tsx scripts/test-sync.ts
 */

import pool from '../lib/mysql';
import client, { getDb } from '../lib/mongo';
import {
  createRecipe,
  updateRecipe,
  archiveRecipe,
  syncCheck,
  getRecipe,
} from '../lib/recipes-service';
import type { RowDataPacket } from 'mysql2';
import type { Filter, Document } from 'mongodb';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING RECIPE CROSS-DATABASE SYNCHRONIZATION TESTS');
  console.log('====================================================\n');

  const db = await getDb();
  const testId = '99999999-test-4000-8000-000000000001';

  try {
    // Clean up any stale test record before starting
    await db.collection('recipes').deleteOne({ _id: testId } as unknown as Filter<Document>);
    await pool.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [testId]);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 1: CREATE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('TEST 1: Dual-Write Recipe Creation');
    const created = await createRecipe({
      _id: testId,
      recipe_name: 'Test Quinoa Salad',
      cuisine: 'Mediterranean',
      meal_type: 'lunch',
      dietary_tags: ['vegan', 'gluten-free'],
      allergens: [],
      ingredients: [{ name: 'Quinoa', quantity: 100, unit: 'g' }],
      instructions: [{ step: 1, text: 'Mix ingredients.' }],
      nutrition_per_serving: { calories: 350, protein_g: 12, carbs_g: 50, fat_g: 8 },
    });

    assert(created.recipe_id === testId, `Returned recipe_id matches expected (${testId})`);
    assert(created.syncLog.length === 2, `SyncLog recorded 2 steps (Mongo insert and MySQL insert)`);

    const mongoDoc = await getRecipe(testId);
    assert(mongoDoc !== null, 'Recipe document exists in MongoDB');
    assert(mongoDoc?.recipe_name === 'Test Quinoa Salad', 'MongoDB recipe_name matches');
    assert(mongoDoc?.cuisine === 'Mediterranean', 'MongoDB cuisine matches');
    assert(mongoDoc?.archived === false, 'MongoDB archived is false');

    const [mysqlRows] = await pool.execute<RowDataPacket[]>(
      'SELECT recipe_id, recipe_name, cuisine, is_active FROM recipe_catalog WHERE recipe_id = ?',
      [testId]
    );
    assert(mysqlRows.length === 1, 'Recipe row exists in MySQL recipe_catalog');
    assert(mysqlRows[0].recipe_id === testId, 'MySQL recipe_id matches');
    assert(mysqlRows[0].recipe_name === 'Test Quinoa Salad', 'MySQL recipe_name matches');
    assert(mysqlRows[0].cuisine === 'Mediterranean', 'MySQL cuisine matches');
    assert(Boolean(mysqlRows[0].is_active) === true, 'MySQL is_active is true');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 2: UPDATE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 2: Partial Update Synchronization');
    const updateRes = await updateRecipe(testId, {
      recipe_name: 'Updated Mediterranean Salad',
      cuisine: 'Fusion',
    });

    assert(updateRes.syncLog.length === 2, 'SyncLog recorded 2 steps for update');

    const updatedMongo = await getRecipe(testId);
    assert(updatedMongo?.recipe_name === 'Updated Mediterranean Salad', 'MongoDB has updated recipe_name');
    assert(updatedMongo?.cuisine === 'Fusion', 'MongoDB has updated cuisine');

    const [updatedMysql] = await pool.execute<RowDataPacket[]>(
      'SELECT recipe_name, cuisine FROM recipe_catalog WHERE recipe_id = ?',
      [testId]
    );
    assert(updatedMysql[0].recipe_name === 'Updated Mediterranean Salad', 'MySQL has updated recipe_name');
    assert(updatedMysql[0].cuisine === 'Fusion', 'MySQL has updated cuisine');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 3: ARCHIVE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 3: Soft-Delete (Archive) Synchronization');
    const archiveRes = await archiveRecipe(testId);
    assert(archiveRes.syncLog.length === 2, 'SyncLog recorded 2 steps for archive');

    const archivedMongo = await getRecipe(testId);
    assert(archivedMongo?.archived === true, 'MongoDB archived flag set to true');

    const [archivedMysql] = await pool.execute<RowDataPacket[]>(
      'SELECT is_active FROM recipe_catalog WHERE recipe_id = ?',
      [testId]
    );
    assert(Boolean(archivedMysql[0].is_active) === false, 'MySQL is_active flag set to false');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 4: MISSING RECIPE UPDATE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 4: Update Nonexistent Recipe (Expected: 404)');
    let missingUpdateThrew404 = false;
    try {
      await updateRecipe('00000000-0000-0000-0000-000000000000', { recipe_name: 'Ghost' });
    } catch (err: unknown) {
      const errorWithStatus = err as Error & { statusCode?: number };
      if (errorWithStatus.statusCode === 404 || errorWithStatus.message.includes('not found')) {
        missingUpdateThrew404 = true;
      }
    }
    assert(missingUpdateThrew404, 'updateRecipe correctly rejected missing recipe with 404');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 5: MISSING RECIPE ARCHIVE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 5: Archive Nonexistent Recipe (Expected: 404)');
    let missingArchiveThrew404 = false;
    try {
      await archiveRecipe('00000000-0000-0000-0000-000000000000');
    } catch (err: unknown) {
      const errorWithStatus = err as Error & { statusCode?: number };
      if (errorWithStatus.statusCode === 404 || errorWithStatus.message.includes('not found')) {
        missingArchiveThrew404 = true;
      }
    }
    assert(missingArchiveThrew404, 'archiveRecipe correctly rejected missing recipe with 404');

    // Clean up test 1-3 recipe before test 6
    await db.collection('recipes').deleteOne({ _id: testId } as unknown as Filter<Document>);
    await pool.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [testId]);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 6: SYNCHRONIZATION CHECK (Detects all inconsistency classes)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 6: Cross-Database Synchronization Audit');

    // 6a: MongoDB only
    const idMongoOnly = '88888888-test-4000-8000-000000000001';
    await db.collection('recipes').insertOne({
      _id: idMongoOnly,
      recipe_name: 'Orphan Mongo Recipe',
      dietary_tags: [],
      allergens: [],
      ingredients: [],
      instructions: [],
      nutrition_per_serving: { calories: 100, protein_g: 2, carbs_g: 10, fat_g: 1 },
      archived: false,
    } as unknown as Document);

    let audit = await syncCheck();
    assert(audit.onlyInMongo.includes(idMongoOnly), 'Detected recipe existing only in MongoDB');
    await db.collection('recipes').deleteOne({ _id: idMongoOnly } as unknown as Filter<Document>);

    // 6b: MySQL only
    const idMysqlOnly = '88888888-test-4000-8000-000000000002';
    await pool.execute(
      'INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active) VALUES (?, ?, ?, TRUE)',
      [idMysqlOnly, 'Orphan MySQL Recipe', 'Test']
    );

    audit = await syncCheck();
    assert(audit.onlyInMySQL.includes(idMysqlOnly), 'Detected recipe existing only in MySQL');
    await pool.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [idMysqlOnly]);

    // 6c: Metadata mismatch (name)
    const idMismatchName = '88888888-test-4000-8000-000000000003';
    await db.collection('recipes').insertOne({
      _id: idMismatchName,
      recipe_name: 'Mongo Name',
      cuisine: 'Indian',
      dietary_tags: [],
      allergens: [],
      ingredients: [],
      instructions: [],
      nutrition_per_serving: { calories: 100, protein_g: 2, carbs_g: 10, fat_g: 1 },
      archived: false,
    } as unknown as Document);
    await pool.execute(
      'INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active) VALUES (?, ?, ?, TRUE)',
      [idMismatchName, 'MySQL Name', 'Indian']
    );

    audit = await syncCheck();
    const nameMismatch = audit.metadataMismatches.find((m) => m.recipe_id === idMismatchName);
    assert(nameMismatch !== undefined && nameMismatch.field === 'recipe_name', 'Detected recipe_name metadata mismatch');

    // 6d: Metadata mismatch (cuisine)
    await pool.execute('UPDATE recipe_catalog SET recipe_name = ? WHERE recipe_id = ?', ['Mongo Name', idMismatchName]);
    await pool.execute('UPDATE recipe_catalog SET cuisine = ? WHERE recipe_id = ?', ['Italian', idMismatchName]);

    audit = await syncCheck();
    const cuisineMismatch = audit.metadataMismatches.find((m) => m.recipe_id === idMismatchName);
    assert(cuisineMismatch !== undefined && cuisineMismatch.field === 'cuisine', 'Detected cuisine metadata mismatch');

    // 6e: Status mismatch (archived in Mongo, active in MySQL)
    await pool.execute('UPDATE recipe_catalog SET cuisine = ? WHERE recipe_id = ?', ['Indian', idMismatchName]);
    await db.collection('recipes').updateOne(
      { _id: idMismatchName } as unknown as Filter<Document>,
      { $set: { archived: true } }
    );

    audit = await syncCheck();
    const statusMismatch1 = audit.statusMismatches.find((s) => s.recipe_id === idMismatchName);
    assert(statusMismatch1 !== undefined && statusMismatch1.mongodb_archived === true && statusMismatch1.mysql_is_active === true,
      'Detected status mismatch: archived in Mongo but active in MySQL');

    // 6f: Status mismatch (active in Mongo, inactive in MySQL)
    await db.collection('recipes').updateOne(
      { _id: idMismatchName } as unknown as Filter<Document>,
      { $set: { archived: false } }
    );
    await pool.execute('UPDATE recipe_catalog SET is_active = FALSE WHERE recipe_id = ?', [idMismatchName]);

    audit = await syncCheck();
    const statusMismatch2 = audit.statusMismatches.find((s) => s.recipe_id === idMismatchName);
    assert(statusMismatch2 !== undefined && statusMismatch2.mongodb_archived === false && statusMismatch2.mysql_is_active === false,
      'Detected status mismatch: active in Mongo but inactive in MySQL');

    // Clean up test 6 records
    await db.collection('recipes').deleteOne({ _id: idMismatchName } as unknown as Filter<Document>);
    await pool.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [idMismatchName]);

    // Verify system is fully consistent again
    audit = await syncCheck();
    assert(audit.isConsistent, 'System is fully consistent following test record cleanup');

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 7: COMPENSATION ON FAILURE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 7: Dual-Write Failure Compensation');

    // 7a: Create compensation: MongoDB doc is deleted if MySQL insert fails
    const failCreateId = '77777777-fail-4000-8000-000000000001';
    // Pre-insert into MySQL so MySQL insert in createRecipe causes duplicate key failure
    await pool.execute(
      'INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active) VALUES (?, ?, ?, TRUE)',
      [failCreateId, 'Pre-existing MySQL row', 'Test']
    );

    let createFailedAndCompensated = false;
    try {
      await createRecipe({
        _id: failCreateId,
        recipe_name: 'Should Be Compensated',
        dietary_tags: [],
        allergens: [],
        ingredients: [],
        instructions: [],
        nutrition_per_serving: { calories: 100, protein_g: 2, carbs_g: 10, fat_g: 1 },
      });
    } catch (err: unknown) {
      const errorWithLog = err as Error & { syncLog?: Array<{ action: string; success: boolean }> };
      const compStep = errorWithLog.syncLog?.find((s) => s.action.includes('COMPENSATION SUCCESS'));
      if (compStep) {
        createFailedAndCompensated = true;
      }
    }
    assert(createFailedAndCompensated, 'createRecipe compensated by rolling back MongoDB insert when MySQL failed');

    // Verify MongoDB document was deleted by compensation
    const mongoAfterCompensation = await getRecipe(failCreateId);
    assert(mongoAfterCompensation === null, 'MongoDB document was cleaned up by compensation');

    // Clean up MySQL row
    await pool.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [failCreateId]);

    // 7b: Update compensation: MongoDB fields restored if MySQL update fails
    const compUpdateId = '77777777-fail-4000-8000-000000000002';
    await createRecipe({
      _id: compUpdateId,
      recipe_name: 'Original Safe Name',
      cuisine: 'Mexican',
      dietary_tags: [],
      allergens: [],
      ingredients: [],
      instructions: [],
      nutrition_per_serving: { calories: 200, protein_g: 5, carbs_g: 20, fat_g: 3 },
    });

    let updateFailedAndCompensated = false;
    try {
      // Name exceeding VARCHAR(150) triggers MySQL ER_DATA_TOO_LONG
      await updateRecipe(compUpdateId, {
        recipe_name: 'A'.repeat(300),
      });
    } catch (err: unknown) {
      const errorWithLog = err as Error & { syncLog?: Array<{ action: string; success: boolean }> };
      const compStep = errorWithLog.syncLog?.find((s) => s.action.includes('COMPENSATION SUCCESS'));
      if (compStep) {
        updateFailedAndCompensated = true;
      }
    }
    assert(updateFailedAndCompensated, 'updateRecipe compensated by reverting MongoDB fields when MySQL failed');

    const mongoAfterUpdateComp = await getRecipe(compUpdateId);
    assert(mongoAfterUpdateComp?.recipe_name === 'Original Safe Name', 'MongoDB field restored to original value');

    // Clean up
    await db.collection('recipes').deleteOne({ _id: compUpdateId } as unknown as Filter<Document>);
    await pool.execute('DELETE FROM recipe_catalog WHERE recipe_id = ?', [compUpdateId]);

    // ──────────────────────────────────────────────────────────────────────────
    // TEST 8: SEEDING IDEMPOTENCY & ARCHIVED STATE PRESERVATION
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\nTEST 8: Seeding Idempotency & Archive State Preservation');
    // Archive one of the official seed recipes (e.g. 11111111-aaaa-4000-8000-000000000001 Paneer Quinoa Bowl)
    const seedRecipeToTest = '11111111-aaaa-4000-8000-000000000001';
    await archiveRecipe(seedRecipeToTest);

    // Verify it is archived
    const seedArchivedMongo = await getRecipe(seedRecipeToTest);
    assert(seedArchivedMongo?.archived === true, 'Seed recipe archived in MongoDB');

    // Run seed script logic
    const { execSync } = await import('child_process');
    console.log('  Running npm run db:mongo (run 1)...');
    execSync('npx tsx scripts/seed-recipes.ts', { stdio: 'pipe' });

    // Verify it stayed archived
    const seedStillArchivedMongo = await getRecipe(seedRecipeToTest);
    assert(seedStillArchivedMongo?.archived === true, 'Archived recipe was NOT reactivated by seed run 1');

    console.log('  Running npm run db:mongo (run 2)...');
    execSync('npx tsx scripts/seed-recipes.ts', { stdio: 'pipe' });

    const seedStillArchivedMongo2 = await getRecipe(seedRecipeToTest);
    assert(seedStillArchivedMongo2?.archived === true, 'Archived recipe was NOT reactivated by seed run 2');

    // Re-activate the seed recipe to leave database in original state
    await db.collection('recipes').updateOne(
      { _id: seedRecipeToTest } as unknown as Filter<Document>,
      { $set: { archived: false } }
    );
    await pool.execute('UPDATE recipe_catalog SET is_active = TRUE WHERE recipe_id = ?', [seedRecipeToTest]);

    // Check final counts and consistency
    const finalAudit = await syncCheck();
    assert(finalAudit.totalChecked === 25, `Total recipes checked equals 25 (found ${finalAudit.totalChecked})`);
    assert(finalAudit.isConsistent, 'Both databases are completely consistent and clean at completion');

    console.log('\n====================================================');
    console.log(`ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY!`);
    console.log(`Tests Passed: ${testsPassed} | Tests Failed: ${testsFailed}`);
    console.log('====================================================\n');
  } finally {
    await pool.end();
    await client.close();
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED WITH ERROR:', err);
  process.exit(1);
});
