import { notFound } from 'next/navigation';
import { getRecipe } from '@/lib/recipes-service';
import pool from '@/lib/mysql';
import type { RowDataPacket } from 'mysql2';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) return notFound();

  const [mysqlRows] = await pool.execute<RowDataPacket[]>(
    'SELECT * FROM recipe_catalog WHERE recipe_id = ?', [id]
  );
  const mysqlRow = mysqlRows[0];

  const tagColors: Record<string, string> = {
    vegetarian: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    vegan:      'bg-teal-50 text-teal-700 border-teal-200',
    'gluten-free': 'bg-purple-50 text-purple-700 border-purple-200',
    'high-protein': 'bg-orange-50 text-orange-700 border-orange-200',
    pescatarian: 'bg-blue-50 text-blue-700 border-blue-200',
    non_vegetarian: 'bg-rose-50 text-rose-700 border-rose-200',
    eggetarian: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const extra = Object.entries(recipe).filter(([k]) =>
    !['_id', 'recipe_name', 'description', 'cuisine', 'meal_type', 'dietary_tags', 'allergens',
      'ingredients', 'instructions', 'nutrition_per_serving', 'preparation', 'archived', 'servings'].includes(k)
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Navigation breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/recipes"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          ← Back to Recipe Catalog
        </Link>
        <span className="text-xs text-slate-400">UUID: {id}</span>
      </div>

      {/* Main Glass Panel */}
      <div className="glass-panel rounded-3xl p-6 sm:p-10 border border-white/60 space-y-8">
        {/* Header Title & Prep Time */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                {recipe.cuisine || 'Global'}
              </span>
              <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                {recipe.meal_type || 'meal'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
              {recipe.recipe_name}
            </h1>
            {recipe.description && (
              <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                {recipe.description}
              </p>
            )}
          </div>

          {recipe.preparation && (
            <div className="flex sm:flex-col gap-3 p-4 rounded-2xl bg-white/70 border border-slate-200/80 shadow-xs text-xs text-slate-600 min-w-[140px]">
              <div className="flex items-center gap-2">
                <span className="text-base">⏱️</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Prep Time</span>
                  <span className="font-bold text-slate-900 text-sm">{recipe.preparation.prep_minutes} min</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base">🍳</span>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cook Time</span>
                  <span className="font-bold text-slate-900 text-sm">{recipe.preparation.cook_minutes} min</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dietary Tags & Allergens */}
        <div className="flex flex-wrap items-center gap-2">
          {(recipe.dietary_tags ?? []).map((t) => (
            <span
              key={t}
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                tagColors[t] ?? 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              #{t}
            </span>
          ))}

          {(recipe.allergens ?? []).map((a) => (
            <span
              key={a}
              className="px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1"
            >
              <span>⚠ Contains:</span> {a}
            </span>
          ))}
        </div>

        {/* Per-Serving Nutrition Matrix */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <span>📊</span> Nutrition Per Serving ({String(recipe.servings ?? 1)} Servings)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {Object.entries(recipe.nutrition_per_serving).map(([k, v]) => (
              <div
                key={k}
                className="p-3 rounded-2xl bg-white/80 border border-slate-200/80 text-center shadow-xs"
              >
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block truncate">
                  {k.replace('_', ' ').replace('per serving', '')}
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2-Column: Ingredients & Instructions */}
        <div className="grid md:grid-cols-12 gap-8 items-start pt-4 border-t border-slate-100">
          {/* Ingredients list */}
          <div className="md:col-span-5 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🛒</span> Ingredients ({recipe.ingredients.length})
            </h2>
            <div className="space-y-2.5">
              {recipe.ingredients.map((ing, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-white/70 border border-slate-200/70 text-sm shadow-xs hover:bg-white transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="font-semibold text-slate-900 flex-1">{ing.name}</span>
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                    {ing.quantity} {ing.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="md:col-span-7 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>👨‍🍳</span> Step-by-Step Instructions
            </h2>
            <div className="space-y-3">
              {recipe.instructions.map((ins) => (
                <div
                  key={ins.step}
                  className="flex gap-4 p-4 rounded-2xl bg-white/70 border border-slate-200/70 text-sm shadow-xs hover:bg-white transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black flex items-center justify-center text-xs shadow-sm shadow-emerald-500/20">
                    {ins.step}
                  </span>
                  <p className="text-slate-700 leading-relaxed pt-0.5">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MongoDB Polymorphic Extra Fields */}
        {extra.length > 0 && (
          <div className="pt-6 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>📑</span> Flexible MongoDB Document Schema Fields
              </h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                Polymorphic attributes
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {extra.map(([k, v]) => (
                <div key={k} className="p-3 rounded-2xl bg-white/60 border border-slate-200/60 text-xs">
                  <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                    {k.replace('_', ' ')}
                  </span>
                  <span className="text-slate-800 font-semibold mt-0.5 block">
                    {Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cross-Database Synchronization Reference */}
        {mysqlRow && (
          <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 border border-blue-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <span>🔗</span> Cross-Database Dual-Write Identity Sync
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                UUID Parity 100%
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div className="p-2.5 rounded-xl bg-white/90 border border-blue-200">
                <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">MySQL recipe_catalog.recipe_id</span>
                <span className="text-blue-700 font-bold text-[11px] truncate block">{String(mysqlRow.recipe_id)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/90 border border-blue-200">
                <span className="text-[10px] text-slate-400 font-sans block uppercase font-bold">MongoDB recipe._id</span>
                <span className="text-teal-700 font-bold text-[11px] truncate block">{recipe._id}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 pt-1">
              Relational transactions in MySQL link meal entries to this catalog UUID, while MongoDB stores the variable ingredient lists and document embeddings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
