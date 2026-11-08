import pool from './mysql';
import { getDb } from './mongo';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Filter, Document } from 'mongodb';

export interface RecipeDocument {
  _id: string;
  recipe_name: string;
  description?: string;
  cuisine?: string;
  meal_type?: string;
  dietary_tags: string[];
  allergens: string[];
  ingredients: Array<{ name: string; quantity: number; unit: string }>;
  instructions: Array<{ step: number; text: string }>;
  nutrition_per_serving: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
    sodium_mg?: number;
  };
  preparation?: { prep_minutes: number; cook_minutes: number };
  archived?: boolean;
  [key: string]: unknown;
}

export interface SyncLogEntry {
  step: number;
  timestamp: string;
  action: string;
  db: 'mongodb' | 'mysql';
  statement: string;
  success: boolean;
  error?: string;
}

export interface MetadataMismatch {
  recipe_id: string;
  field: 'recipe_name' | 'cuisine';
  mongodb_value: string | null;
  mysql_value: string | null;
}

export interface StatusMismatch {
  recipe_id: string;
  recipe_name: string;
  mongodb_archived: boolean;
  mysql_is_active: boolean;
  issue: string;
}

export interface SyncCheckResult {
  onlyInMongo: string[];
  onlyInMySQL: string[];
  metadataMismatches: MetadataMismatch[];
  statusMismatches: StatusMismatch[];
  isConsistent: boolean;
  totalChecked: number;
}

// ── CREATE (dual-write with compensation) ────────────────────────────────────
export async function createRecipe(
  data: Omit<RecipeDocument, '_id'> & { _id?: string }
): Promise<{ recipe_id: string; syncLog: SyncLogEntry[] }> {
  const recipe_id = data._id ?? crypto.randomUUID();
  const syncLog: SyncLogEntry[] = [];
  const db = await getDb();

  // Step 3 — Insert into MongoDB
  const mongoDoc = {
    ...data,
    _id: recipe_id,
    archived: false,
  };

  let mongoInserted = false;
  try {
    const mongoRes = await db.collection('recipes').insertOne(mongoDoc as unknown as Document);
    if (!mongoRes.acknowledged) {
      throw new Error(`MongoDB insert was not acknowledged for recipe ${recipe_id}`);
    }
    mongoInserted = true;
    syncLog.push({
      step: 3,
      timestamp: new Date().toISOString(),
      action: 'INSERT MongoDB',
      db: 'mongodb',
      statement: `db.recipes.insertOne({ _id: "${recipe_id}", recipe_name: "${data.recipe_name}", ... })`,
      success: true,
    });
  } catch (err) {
    syncLog.push({
      step: 3,
      timestamp: new Date().toISOString(),
      action: 'INSERT MongoDB FAILED',
      db: 'mongodb',
      statement: `db.recipes.insertOne({ _id: "${recipe_id}", ... })`,
      success: false,
      error: (err as Error).message,
    });
    throw err;
  }

  // Step 4 — Insert into MySQL recipe_catalog
  const sql = `INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active)
               VALUES (?, ?, ?, TRUE)`;
  const params = [
    String(recipe_id),
    String(data.recipe_name),
    data.cuisine ? String(data.cuisine) : null,
  ];

  try {
    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    if (result.affectedRows === 0) {
      throw new Error(`MySQL insert affected 0 rows for recipe ${recipe_id}`);
    }
    syncLog.push({
      step: 4,
      timestamp: new Date().toISOString(),
      action: 'INSERT MySQL recipe_catalog',
      db: 'mysql',
      statement: `INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active) VALUES ('${recipe_id}', '${data.recipe_name}', '${data.cuisine ?? null}', TRUE)`,
      success: true,
    });
  } catch (mysqlErr) {
    const origError = mysqlErr as Error;
    syncLog.push({
      step: 4,
      timestamp: new Date().toISOString(),
      action: 'INSERT MySQL FAILED — compensating',
      db: 'mysql',
      statement: sql,
      success: false,
      error: origError.message,
    });

    // Step 5 — Compensate by deleting the exact Mongo document created
    if (mongoInserted) {
      try {
        const compRes = await db.collection('recipes').deleteOne({ _id: recipe_id } as unknown as Filter<Document>);
        if (compRes.deletedCount === 1) {
          syncLog.push({
            step: 5,
            timestamp: new Date().toISOString(),
            action: 'COMPENSATION SUCCESS — MongoDB doc deleted',
            db: 'mongodb',
            statement: `db.recipes.deleteOne({ _id: "${recipe_id}" })`,
            success: true,
          });
        } else {
          syncLog.push({
            step: 5,
            timestamp: new Date().toISOString(),
            action: 'COMPENSATION FAILED — partial sync remains',
            db: 'mongodb',
            statement: `db.recipes.deleteOne({ _id: "${recipe_id}" })`,
            success: false,
            error: `Compensation failed: MongoDB document ${recipe_id} could not be cleaned up`,
          });
        }
      } catch (compErr) {
        syncLog.push({
          step: 5,
          timestamp: new Date().toISOString(),
          action: 'COMPENSATION FAILED — partial sync remains',
          db: 'mongodb',
          statement: `db.recipes.deleteOne({ _id: "${recipe_id}" })`,
          success: false,
          error: `Compensation error: ${(compErr as Error).message}`,
        });
      }
    }

    const enhancedError = new Error(`MySQL insert failed: ${origError.message}`);
    (enhancedError as Error & { syncLog?: SyncLogEntry[] }).syncLog = syncLog;
    throw enhancedError;
  }

  return { recipe_id, syncLog };
}

// ── READ ──────────────────────────────────────────────────────────────────────
export async function getRecipe(recipe_id: string): Promise<RecipeDocument | null> {
  const db = await getDb();
  const doc = await db.collection('recipes').findOne({ _id: recipe_id } as unknown as Filter<Document>);
  return doc as unknown as RecipeDocument | null;
}

// ── UPDATE (dual-write with compensation) ────────────────────────────────────
export async function updateRecipe(
  recipe_id: string,
  data: Partial<RecipeDocument>
): Promise<{ syncLog: SyncLogEntry[] }> {
  const syncLog: SyncLogEntry[] = [];
  const db = await getDb();

  // 1. Never permit changing _id
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...fieldsToUpdate } = data;

  // 2. Verify recipe exists in MongoDB
  const originalMongoDoc = await db.collection('recipes').findOne({ _id: recipe_id } as unknown as Filter<Document>);
  if (!originalMongoDoc) {
    const err = new Error(`Recipe ${recipe_id} not found in MongoDB`);
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  // 3. Verify recipe exists in MySQL
  const [mysqlRows] = await pool.execute<RowDataPacket[]>(
    'SELECT recipe_id, recipe_name, cuisine, is_active FROM recipe_catalog WHERE recipe_id = ?',
    [recipe_id]
  );
  if (mysqlRows.length === 0) {
    const err = new Error(`Recipe ${recipe_id} not found in MySQL catalog`);
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  // If no fields to update, return immediately
  if (Object.keys(fieldsToUpdate).length === 0) {
    return { syncLog };
  }

  // 4. Update MongoDB with only supplied fields
  try {
    const mongoRes = await db.collection('recipes').updateOne(
      { _id: recipe_id } as unknown as Filter<Document>,
      { $set: fieldsToUpdate }
    );
    if (mongoRes.matchedCount === 0) {
      throw new Error(`MongoDB document ${recipe_id} was not matched for update`);
    }
    syncLog.push({
      step: 1,
      timestamp: new Date().toISOString(),
      action: 'UPDATE MongoDB',
      db: 'mongodb',
      statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: { ${Object.keys(fieldsToUpdate).join(', ')} } })`,
      success: true,
    });
  } catch (mongoErr) {
    syncLog.push({
      step: 1,
      timestamp: new Date().toISOString(),
      action: 'UPDATE MongoDB FAILED',
      db: 'mongodb',
      statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, ...)`,
      success: false,
      error: (mongoErr as Error).message,
    });
    throw mongoErr;
  }

  // 5. Update MySQL only when required fields change
  const sqlSets: string[] = [];
  const sqlParams: (string | null)[] = [];

  if (fieldsToUpdate.recipe_name !== undefined) {
    sqlSets.push('recipe_name = ?');
    sqlParams.push(String(fieldsToUpdate.recipe_name));
  }
  if (fieldsToUpdate.cuisine !== undefined) {
    sqlSets.push('cuisine = ?');
    sqlParams.push(fieldsToUpdate.cuisine ? String(fieldsToUpdate.cuisine) : null);
  }

  if (sqlSets.length > 0) {
    sqlParams.push(recipe_id);
    const sql = `UPDATE recipe_catalog SET ${sqlSets.join(', ')} WHERE recipe_id = ?`;

    try {
      await pool.execute<ResultSetHeader>(sql, sqlParams);
      syncLog.push({
        step: 2,
        timestamp: new Date().toISOString(),
        action: 'UPDATE MySQL recipe_catalog',
        db: 'mysql',
        statement: `UPDATE recipe_catalog SET ${sqlSets.join(', ')} WHERE recipe_id = '${recipe_id}'`,
        success: true,
      });
    } catch (mysqlErr) {
      const origError = mysqlErr as Error;
      syncLog.push({
        step: 2,
        timestamp: new Date().toISOString(),
        action: 'UPDATE MySQL FAILED — compensating MongoDB',
        db: 'mysql',
        statement: sql,
        success: false,
        error: origError.message,
      });

      // Compensation: restore original MongoDB document values for the updated fields
      const restoreMongoFields: Record<string, unknown> = {};
      for (const key of Object.keys(fieldsToUpdate)) {
        restoreMongoFields[key] = (originalMongoDoc as Record<string, unknown>)[key] ?? null;
      }

      try {
        const compRes = await db.collection('recipes').updateOne(
          { _id: recipe_id } as unknown as Filter<Document>,
          { $set: restoreMongoFields }
        );
        if (compRes.matchedCount === 1) {
          syncLog.push({
            step: 3,
            timestamp: new Date().toISOString(),
            action: 'COMPENSATION SUCCESS — MongoDB restored',
            db: 'mongodb',
            statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: originalValues })`,
            success: true,
          });
        } else {
          syncLog.push({
            step: 3,
            timestamp: new Date().toISOString(),
            action: 'COMPENSATION FAILED — partial sync remains',
            db: 'mongodb',
            statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, ...)`,
            success: false,
            error: `Compensation failed: could not restore MongoDB fields for ${recipe_id}`,
          });
        }
      } catch (compErr) {
        syncLog.push({
          step: 3,
          timestamp: new Date().toISOString(),
          action: 'COMPENSATION FAILED — partial sync remains',
          db: 'mongodb',
          statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, ...)`,
          success: false,
          error: `Compensation error: ${(compErr as Error).message}`,
        });
      }

      const enhancedErr = new Error(`MySQL update failed: ${origError.message}`);
      (enhancedErr as Error & { syncLog?: SyncLogEntry[] }).syncLog = syncLog;
      throw enhancedErr;
    }
  }

  return { syncLog };
}

// ── ARCHIVE / SOFT DELETE (dual-write with compensation) ─────────────────────
export async function archiveRecipe(recipe_id: string): Promise<{ syncLog: SyncLogEntry[] }> {
  const syncLog: SyncLogEntry[] = [];
  const db = await getDb();

  // 1. Verify existence in MongoDB
  const originalMongoDoc = await db.collection('recipes').findOne({ _id: recipe_id } as unknown as Filter<Document>);
  if (!originalMongoDoc) {
    const err = new Error(`Recipe ${recipe_id} not found in MongoDB`);
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  // 2. Verify existence in MySQL
  const [mysqlRows] = await pool.execute<RowDataPacket[]>(
    'SELECT recipe_id, is_active FROM recipe_catalog WHERE recipe_id = ?',
    [recipe_id]
  );
  if (mysqlRows.length === 0) {
    const err = new Error(`Recipe ${recipe_id} not found in MySQL catalog`);
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const originalArchived = Boolean(originalMongoDoc.archived);

  // 3. Update MongoDB: archived = true
  try {
    const mongoRes = await db.collection('recipes').updateOne(
      { _id: recipe_id } as unknown as Filter<Document>,
      { $set: { archived: true } }
    );
    if (mongoRes.matchedCount === 0) {
      throw new Error(`MongoDB document ${recipe_id} was not matched for archiving`);
    }
    syncLog.push({
      step: 1,
      timestamp: new Date().toISOString(),
      action: 'ARCHIVE MongoDB (archived:true)',
      db: 'mongodb',
      statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: { archived: true } })`,
      success: true,
    });
  } catch (mongoErr) {
    syncLog.push({
      step: 1,
      timestamp: new Date().toISOString(),
      action: 'ARCHIVE MongoDB FAILED',
      db: 'mongodb',
      statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: { archived: true } })`,
      success: false,
      error: (mongoErr as Error).message,
    });
    throw mongoErr;
  }

  // 4. Update MySQL: is_active = FALSE
  const sql = 'UPDATE recipe_catalog SET is_active = FALSE WHERE recipe_id = ?';
  try {
    await pool.execute<ResultSetHeader>(sql, [recipe_id]);
    syncLog.push({
      step: 2,
      timestamp: new Date().toISOString(),
      action: 'SOFT DELETE MySQL (is_active=FALSE)',
      db: 'mysql',
      statement: `UPDATE recipe_catalog SET is_active = FALSE WHERE recipe_id = '${recipe_id}'`,
      success: true,
    });
  } catch (mysqlErr) {
    const origError = mysqlErr as Error;
    syncLog.push({
      step: 2,
      timestamp: new Date().toISOString(),
      action: 'SOFT DELETE MySQL FAILED — compensating MongoDB',
      db: 'mysql',
      statement: sql,
      success: false,
      error: origError.message,
    });

    // Compensate MongoDB: restore original archived state
    try {
      const compRes = await db.collection('recipes').updateOne(
        { _id: recipe_id } as unknown as Filter<Document>,
        { $set: { archived: originalArchived } }
      );
      if (compRes.matchedCount === 1) {
        syncLog.push({
          step: 3,
          timestamp: new Date().toISOString(),
          action: 'COMPENSATION SUCCESS — MongoDB archived state restored',
          db: 'mongodb',
          statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: { archived: ${originalArchived} } })`,
          success: true,
        });
      } else {
        syncLog.push({
          step: 3,
          timestamp: new Date().toISOString(),
          action: 'COMPENSATION FAILED — partial sync remains',
          db: 'mongodb',
          statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, ...)`,
          success: false,
          error: `Compensation failed: could not restore MongoDB archived state for ${recipe_id}`,
        });
      }
    } catch (compErr) {
      syncLog.push({
        step: 3,
        timestamp: new Date().toISOString(),
        action: 'COMPENSATION FAILED — partial sync remains',
        db: 'mongodb',
        statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, ...)`,
        success: false,
        error: `Compensation error: ${(compErr as Error).message}`,
      });
    }

    const enhancedErr = new Error(`MySQL archive failed: ${origError.message}`);
    (enhancedErr as Error & { syncLog?: SyncLogEntry[] }).syncLog = syncLog;
    throw enhancedErr;
  }

  return { syncLog };
}

// ── SEARCH / FILTER ───────────────────────────────────────────────────────────
export interface RecipeFilter {
  q?: string;
  cuisine?: string;
  meal_type?: string;
  tag?: string;
  excludeAllergen?: string;
  minCal?: number;
  maxCal?: number;
  page?: number;
  limit?: number;
}

export async function searchRecipes(filter: RecipeFilter): Promise<RecipeDocument[]> {
  const db = await getDb();
  const query: Record<string, unknown> = { archived: { $ne: true } };

  if (filter.q) {
    query.$text = { $search: filter.q };
  }
  if (filter.cuisine) query.cuisine = filter.cuisine;
  if (filter.meal_type) query.meal_type = filter.meal_type;
  if (filter.tag) query.dietary_tags = filter.tag;
  if (filter.excludeAllergen) query.allergens = { $nin: [filter.excludeAllergen] };
  if (filter.minCal !== undefined) query['nutrition_per_serving.calories'] = { $gte: filter.minCal };
  if (filter.maxCal !== undefined) {
    const existing = (query['nutrition_per_serving.calories'] as Record<string, unknown>) ?? {};
    query['nutrition_per_serving.calories'] = {
      ...existing,
      $lte: filter.maxCal,
    };
  }

  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const skip = (page - 1) * limit;

  const docs = await db.collection('recipes')
    .find(query as Filter<Document>)
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs as unknown as RecipeDocument[];
}

// ── COMPREHENSIVE CONSISTENCY CHECK ──────────────────────────────────────────
export async function syncCheck(): Promise<SyncCheckResult> {
  const db = await getDb();

  // 1. Fetch all documents from MongoDB
  const mongoDocs = await db.collection('recipes').find(
    {},
    { projection: { _id: 1, recipe_name: 1, cuisine: 1, archived: 1 } }
  ).toArray();

  const mongoMap = new Map<string, { recipe_name: string; cuisine: string | null; archived: boolean }>();
  for (const doc of mongoDocs) {
    mongoMap.set(String(doc._id), {
      recipe_name: String(doc.recipe_name ?? ''),
      cuisine: doc.cuisine ? String(doc.cuisine) : null,
      archived: Boolean(doc.archived),
    });
  }

  // 2. Fetch all rows from MySQL
  const [mysqlRows] = await pool.execute<RowDataPacket[]>(
    'SELECT recipe_id, recipe_name, cuisine, is_active FROM recipe_catalog'
  );

  const mysqlMap = new Map<string, { recipe_name: string; cuisine: string | null; is_active: boolean }>();
  for (const row of mysqlRows) {
    mysqlMap.set(String(row.recipe_id), {
      recipe_name: String(row.recipe_name ?? ''),
      cuisine: row.cuisine ? String(row.cuisine) : null,
      is_active: Boolean(row.is_active),
    });
  }

  // 3. Detect recipes existing only in one database
  const onlyInMongo: string[] = [];
  for (const id of mongoMap.keys()) {
    if (!mysqlMap.has(id)) {
      onlyInMongo.push(id);
    }
  }

  const onlyInMySQL: string[] = [];
  for (const id of mysqlMap.keys()) {
    if (!mongoMap.has(id)) {
      onlyInMySQL.push(id);
    }
  }

  // 4. Detect metadata and status mismatches for shared records
  const metadataMismatches: MetadataMismatch[] = [];
  const statusMismatches: StatusMismatch[] = [];

  for (const [id, mDoc] of mongoMap.entries()) {
    const sRow = mysqlMap.get(id);
    if (!sRow) continue;

    // Check recipe_name mismatch
    if (mDoc.recipe_name.trim() !== sRow.recipe_name.trim()) {
      metadataMismatches.push({
        recipe_id: id,
        field: 'recipe_name',
        mongodb_value: mDoc.recipe_name,
        mysql_value: sRow.recipe_name,
      });
    }

    // Check cuisine mismatch
    const mCuisine = mDoc.cuisine ? mDoc.cuisine.trim().toLowerCase() : null;
    const sCuisine = sRow.cuisine ? sRow.cuisine.trim().toLowerCase() : null;
    if (mCuisine !== sCuisine) {
      metadataMismatches.push({
        recipe_id: id,
        field: 'cuisine',
        mongodb_value: mDoc.cuisine,
        mysql_value: sRow.cuisine,
      });
    }

    // Check archive / active status mismatch
    // Consistent state: (archived === true AND is_active === false) OR (archived === false AND is_active === true)
    const mongoArchived = mDoc.archived;
    const mysqlActive = sRow.is_active;

    if (mongoArchived && mysqlActive) {
      statusMismatches.push({
        recipe_id: id,
        recipe_name: mDoc.recipe_name || sRow.recipe_name,
        mongodb_archived: true,
        mysql_is_active: true,
        issue: 'Recipe is archived (true) in MongoDB but active (true) in MySQL',
      });
    } else if (!mongoArchived && !mysqlActive) {
      statusMismatches.push({
        recipe_id: id,
        recipe_name: mDoc.recipe_name || sRow.recipe_name,
        mongodb_archived: false,
        mysql_is_active: false,
        issue: 'Recipe is active (archived:false) in MongoDB but inactive (is_active:false) in MySQL',
      });
    }
  }

  const isConsistent =
    onlyInMongo.length === 0 &&
    onlyInMySQL.length === 0 &&
    metadataMismatches.length === 0 &&
    statusMismatches.length === 0;

  return {
    onlyInMongo,
    onlyInMySQL,
    metadataMismatches,
    statusMismatches,
    isConsistent,
    totalChecked: mongoMap.size,
  };
}
