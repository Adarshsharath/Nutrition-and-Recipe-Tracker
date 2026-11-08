#!/usr/bin/env tsx
/**
 * Creates MongoDB indexes for the recipes collection.
 * Run: npx tsx scripts/mongo-indexes.ts
 */
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

// Automatically load .env.local for standalone script execution
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        const val = (match[2] || '').trim().replace(/^['"](.*)['"]$/, '$1').trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // ignore
}

const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB ?? 'nutrition_tracker';

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const col = db.collection('recipes');

  console.log('Creating MongoDB indexes on "recipes" collection…');

  // Text index for full-text search across name, description, ingredients, and instructions
  await col.createIndex(
    {
      recipe_name: 'text',
      description: 'text',
      'ingredients.name': 'text',
      'instructions.text': 'text'
    },
    { name: 'idx_recipes_text_search' }
  );

  // Single-field and multikey array indexes
  await col.createIndex({ cuisine: 1 }, { name: 'idx_cuisine' });
  await col.createIndex({ meal_type: 1 }, { name: 'idx_meal_type' });
  await col.createIndex({ dietary_tags: 1 }, { name: 'idx_dietary_tags' });
  await col.createIndex({ allergens: 1 }, { name: 'idx_allergens' });
  await col.createIndex({ 'nutrition_per_serving.calories': 1 }, { name: 'idx_calories' });

  console.log('✓ MongoDB indexes created successfully');

  await client.close();
  console.log('✅ MongoDB indexing complete.');
}

main().catch((err) => {
  console.error('MongoDB indexing failed:', err);
  process.exit(1);
});
