import pool from './mysql';
import { getDb } from './mongo';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

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

// ── CREATE (dual-write) ───────────────────────────────────────────────────────
export async function createRecipe(
  data: Omit<RecipeDocument, '_id'> & { _id?: string }
): Promise<{ recipe_id: string; syncLog: SyncLogEntry[] }> {
  const recipe_id = data._id ?? crypto.randomUUID();
  const syncLog: SyncLogEntry[] = [];
  const db = await getDb();

  // Step 3 — Insert into MongoDB
  const mongoDoc = { ...data, _id: recipe_id };
  try {
    await db.collection('recipes').insertOne(mongoDoc as any);
    syncLog.push({
      step: 3, timestamp: new Date().toISOString(), action: 'INSERT MongoDB',
      db: 'mongodb',
      statement: `db.recipes.insertOne({ _id: "${recipe_id}", recipe_name: "${data.recipe_name}", ... })`,
      success: true,
    });
  } catch (err) {
    syncLog.push({
      step: 3, timestamp: new Date().toISOString(), action: 'INSERT MongoDB FAILED',
      db: 'mongodb', statement: 'db.recipes.insertOne(...)', success: false,
      error: String(err),
    });
    throw err;
  }

  // Step 4 — Insert into MySQL recipe_catalog
  const sql = `INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active)
               VALUES (?, ?, ?, TRUE)`;
  const params: any[] = [recipe_id, data.recipe_name, data.cuisine ?? null];
  try {
    await pool.execute<ResultSetHeader>(sql, params);
    syncLog.push({
      step: 4, timestamp: new Date().toISOString(), action: 'INSERT MySQL recipe_catalog',
      db: 'mysql',
      statement: `INSERT INTO recipe_catalog (recipe_id, recipe_name, cuisine, is_active) VALUES ('${recipe_id}', '${data.recipe_name}', '${data.cuisine ?? null}', TRUE)`,
      success: true,
    });
  } catch (err) {
    syncLog.push({
      step: 4, timestamp: new Date().toISOString(), action: 'INSERT MySQL FAILED — compensating',
      db: 'mysql', statement: sql, success: false, error: String(err),
    });
    // Step 5 — Compensate: delete Mongo doc
    await db.collection('recipes').deleteOne({ _id: recipe_id } as any);
    throw err;
  }

  return { recipe_id, syncLog };
}

// ── READ ──────────────────────────────────────────────────────────────────────
export async function getRecipe(recipe_id: string): Promise<RecipeDocument | null> {
  const db = await getDb();
  const doc = await db.collection('recipes').findOne({ _id: recipe_id } as any);
  return doc as unknown as RecipeDocument | null;
}

// ── UPDATE (dual-write) ───────────────────────────────────────────────────────
export async function updateRecipe(
  recipe_id: string,
  data: Partial<RecipeDocument>
): Promise<{ syncLog: SyncLogEntry[] }> {
  const syncLog: SyncLogEntry[] = [];
  const db = await getDb();

  // Update MongoDB
  await db.collection('recipes').updateOne(
    { _id: recipe_id } as any,
    { $set: data }
  );
  syncLog.push({
    step: 1, timestamp: new Date().toISOString(), action: 'UPDATE MongoDB',
    db: 'mongodb', statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: { ... } })`,
    success: true,
  });

  // Sync name and cuisine to MySQL
  const fields: string[] = [];
  const values: any[] = [];
  if (data.recipe_name) { fields.push('recipe_name = ?'); values.push(data.recipe_name); }
  if (data.cuisine !== undefined) { fields.push('cuisine = ?'); values.push(data.cuisine ?? null); }
  if (fields.length > 0) {
    values.push(recipe_id);
    await pool.execute(`UPDATE recipe_catalog SET ${fields.join(', ')} WHERE recipe_id = ?`, values);
    syncLog.push({
      step: 2, timestamp: new Date().toISOString(), action: 'UPDATE MySQL recipe_catalog',
      db: 'mysql', statement: `UPDATE recipe_catalog SET ${fields.join(', ')} WHERE recipe_id = '${recipe_id}'`,
      success: true,
    });
  }

  return { syncLog };
}

// ── SOFT DELETE (dual-write) ──────────────────────────────────────────────────
export async function archiveRecipe(recipe_id: string): Promise<{ syncLog: SyncLogEntry[] }> {
  const syncLog: SyncLogEntry[] = [];
  const db = await getDb();

  // Mongo: set archived = true
  await db.collection('recipes').updateOne({ _id: recipe_id } as any, { $set: { archived: true } });
  syncLog.push({
    step: 1, timestamp: new Date().toISOString(), action: 'ARCHIVE MongoDB (archived:true)',
    db: 'mongodb', statement: `db.recipes.updateOne({ _id: "${recipe_id}" }, { $set: { archived: true } })`,
    success: true,
  });

  // MySQL: is_active = FALSE
  await pool.execute('UPDATE recipe_catalog SET is_active = FALSE WHERE recipe_id = ?', [recipe_id]);
  syncLog.push({
    step: 2, timestamp: new Date().toISOString(), action: 'SOFT DELETE MySQL (is_active=FALSE)',
    db: 'mysql', statement: `UPDATE recipe_catalog SET is_active = FALSE WHERE recipe_id = '${recipe_id}'`,
    success: true,
  });

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
  const query: Record<string, any> = { archived: { $ne: true } };

  if (filter.q) {
    query.$text = { $search: filter.q };
  }
  if (filter.cuisine) query.cuisine = filter.cuisine;
  if (filter.meal_type) query.meal_type = filter.meal_type;
  if (filter.tag) query.dietary_tags = filter.tag;
  if (filter.excludeAllergen) query.allergens = { $nin: [filter.excludeAllergen] };
  if (filter.minCal !== undefined) query['nutrition_per_serving.calories'] = { $gte: filter.minCal };
  if (filter.maxCal !== undefined) {
    query['nutrition_per_serving.calories'] = {
      ...(query['nutrition_per_serving.calories'] ?? {}),
      $lte: filter.maxCal,
    };
  }

  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const skip = (page - 1) * limit;

  const docs = await db.collection('recipes')
    .find(query)
    .skip(skip)
    .limit(limit)
    .toArray();

  return docs as unknown as RecipeDocument[];
}

// ── CONSISTENCY CHECK ─────────────────────────────────────────────────────────
export async function syncCheck(): Promise<{
  onlyInMongo: string[];
  onlyInMySQL: string[];
}> {
  const db = await getDb();

  const mongoDocs = await db.collection('recipes').find({}, { projection: { _id: 1 } }).toArray();
  const mongoIds = new Set(mongoDocs.map((d: any) => String(d._id)));

  const [mysqlRows] = await pool.execute<RowDataPacket[]>('SELECT recipe_id FROM recipe_catalog', []);
  const mysqlIds = new Set(mysqlRows.map((r: any) => String(r.recipe_id)));

  const onlyInMongo = [...mongoIds].filter((id) => !mysqlIds.has(id));
  const onlyInMySQL = [...mysqlIds].filter((id) => !mongoIds.has(id));

  return { onlyInMongo, onlyInMySQL };
}
