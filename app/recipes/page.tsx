'use client';
import { useState, useEffect } from 'react';
import RecipeCard from '@/components/RecipeCard';
import Link from 'next/link';

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    q: '',
    cuisine: '',
    meal_type: '',
    tag: '',
    excludeAllergen: '',
    minCal: '',
    maxCal: '',
  });

  async function search() {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await fetch(`/api/recipes?${params}`);
    if (res.ok) setRecipes(await res.json());
    setLoading(false);
  }

  useEffect(() => { search(); }, []);

  function handleTagClick(t: string) {
    setFilters((prev) => ({ ...prev, tag: prev.tag === t ? '' : t }));
  }

  useEffect(() => {
    search();
  }, [filters.tag, filters.meal_type]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              MongoDB Flexible Documents
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500">Cross-Referenced with MySQL Catalog</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            🥗 Recipe Discovery Catalog
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Multikey indexes on dietary tags & allergens, compound indexes on cuisine & calories, text index on ingredients.
          </p>
        </div>

        <Link
          href="/recipes/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105 transition-all"
        >
          <span>+</span> Create Dual-Write Recipe
        </Link>
      </div>

      {/* Floating Filter Bar */}
      <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <span>🔍</span> Filter & Query Engine
          </span>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {recipes.length} {recipes.length === 1 ? 'Recipe found' : 'Recipes found'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            placeholder="Text search (name, ingredients)…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
          />
          <input
            placeholder="Cuisine (e.g. Indian, Mediterranean)"
            value={filters.cuisine}
            onChange={(e) => setFilters({ ...filters, cuisine: e.target.value })}
            className="glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
          />
          <select
            value={filters.meal_type}
            onChange={(e) => setFilters({ ...filters, meal_type: e.target.value })}
            className="glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border capitalize"
          >
            <option value="">All meal types</option>
            {['breakfast', 'lunch', 'snack', 'dinner', 'other'].map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
          <input
            placeholder="Exclude allergen (e.g. peanuts, dairy)"
            value={filters.excludeAllergen}
            onChange={(e) => setFilters({ ...filters, excludeAllergen: e.target.value })}
            className="glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <input
            placeholder="Min calories (kcal)"
            type="number"
            value={filters.minCal}
            onChange={(e) => setFilters({ ...filters, minCal: e.target.value })}
            className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border placeholder:text-slate-400"
          />
          <input
            placeholder="Max calories (kcal)"
            type="number"
            value={filters.maxCal}
            onChange={(e) => setFilters({ ...filters, maxCal: e.target.value })}
            className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border placeholder:text-slate-400"
          />
          <button
            onClick={search}
            className="py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Execute MongoDB Search
          </button>
        </div>

        {/* Quick Tag Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-500">Quick Tags:</span>
          {['vegetarian', 'vegan', 'high-protein', 'gluten-free', 'high-fiber', 'pescatarian', 'keto-friendly'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTagClick(tag)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filters.tag === tag
                  ? 'bg-emerald-600 text-white shadow-sm scale-105'
                  : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200'
              }`}
            >
              #{tag}
            </button>
          ))}
          {filters.tag && (
            <button
              type="button"
              onClick={() => setFilters({ ...filters, tag: '' })}
              className="text-[11px] text-rose-600 hover:underline font-semibold ml-2"
            >
              Clear tag
            </button>
          )}
        </div>
      </div>

      {/* Grid of recipe cards */}
      {loading ? (
        <div className="glass-panel rounded-3xl p-16 text-center text-slate-400 border border-white/60">
          <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-semibold text-slate-700">Querying MongoDB documents...</p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center text-slate-400 border border-white/60">
          <span className="text-4xl block mb-2">🔍</span>
          <p className="font-semibold text-slate-700 text-base">No recipes matched your search criteria.</p>
          <p className="text-xs text-slate-500 mt-1">Try clearing some filters or searching for ingredients.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {recipes.map((r) => (
            <RecipeCard key={r._id as string} recipe={r as any} />
          ))}
        </div>
      )}
    </div>
  );
}
