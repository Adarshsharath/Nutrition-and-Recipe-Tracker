'use client';
import { useState, useEffect } from 'react';
import RecipeCard from '@/components/RecipeCard';
import JsonViewer from '@/components/JsonViewer';
import Link from 'next/link';

interface Rec {
  recipe: Record<string, unknown>;
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
  };
}

export default function RecommendationsPage() {
  const [results, setResults] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [mealType, setMealType] = useState('');
  const [showDebug, setShowDebug] = useState(false);

  async function fetchRecs() {
    setLoading(true);
    const params = new URLSearchParams();
    if (mealType) params.set('meal_type', mealType);
    const res = await fetch(`/api/recommendations?${params}`);
    if (res.ok) setResults(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchRecs(); }, []);

  const firstCtx = results[0]?.mysqlContext;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              MySQL &harr; MongoDB Hybrid Engine
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500">Live Nutritional Matching</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            ✨ Intelligent Recipe Recommendations
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Combines MySQL user goal targets & daily deficit calculation with MongoDB multikey index filtering.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 hover:bg-white text-slate-700 font-medium text-sm border border-slate-200 shadow-sm transition-all hover:scale-105"
          >
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Control Bar */}
      <div className="glass-panel rounded-3xl p-5 border border-white/60 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border capitalize"
          >
            <option value="">Auto-detect by current time</option>
            {['breakfast', 'lunch', 'snack', 'dinner'].map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
          <button
            onClick={fetchRecs}
            className="px-5 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-105 transition-all"
          >
            Refresh Suggestions
          </button>
        </div>

        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
            showDebug
              ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
              : 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200'
          }`}
        >
          {showDebug ? 'Hide Pipeline Execution Details' : '🔍 Inspect Hybrid Retrieval Pipeline'}
        </button>
      </div>

      {/* Debug details panel */}
      {showDebug && firstCtx && (
        <div className="glass-panel rounded-3xl p-6 border border-purple-200/80 bg-gradient-to-br from-purple-500/10 via-white/50 to-indigo-500/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-purple-100">
            <div>
              <h2 className="text-base font-bold text-purple-900 flex items-center gap-2">
                <span>🔬</span> Hybrid Recommendation Algorithm Execution
              </h2>
              <p className="text-xs text-purple-600">Cross-database context extraction and query composition</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Live Pipeline
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/80 border border-purple-100 shadow-xs space-y-2 text-xs">
              <h3 className="font-bold text-purple-900 flex items-center gap-1.5 text-sm">
                <span>1.</span> MySQL User Context Extracted
              </h3>
              <div className="font-mono space-y-1.5 text-slate-700 text-[11px] pt-1">
                <p><strong>Goal Type:</strong> <span className="text-purple-700 font-bold">{firstCtx.goal_type ?? 'none'}</span></p>
                <p><strong>Target Calories:</strong> {firstCtx.target_calories ?? '—'} kcal</p>
                <p><strong>Logged Today:</strong> {firstCtx.today_calories} kcal</p>
                <p><strong>Remaining Budget:</strong> {firstCtx.remaining_cal} kcal</p>
                <p><strong>Target Per Meal:</strong> ~{firstCtx.budget_per_meal} kcal (±20% window)</p>
                <p><strong>Dietary Profile:</strong> {firstCtx.diet_type}</p>
                <p><strong>Excluded Allergens:</strong> {firstCtx.allergens.length > 0 ? firstCtx.allergens.join(', ') : 'none'}</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-purple-100 shadow-xs space-y-2">
              <h3 className="font-bold text-purple-900 flex items-center gap-1.5 text-sm">
                <span>2.</span> Generated MongoDB Query Filter
              </h3>
              <JsonViewer data={results[0]?.mongoFilter} maxHeight={200} />
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="glass-panel rounded-3xl p-16 text-center text-slate-400 border border-white/60">
          <div className="inline-block w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-semibold text-slate-700">Evaluating nutrient vectors & running MongoDB match query...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="glass-panel rounded-3xl p-16 text-center text-slate-400 border border-white/60 space-y-3">
          <span className="text-4xl block">🥗</span>
          <p className="text-lg font-bold text-slate-800">No matching recommendations found for current window.</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Ensure your dietary profile has preferences set and you have an active nutrition goal defined.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/profile"
              className="px-4 py-2 rounded-xl bg-white text-slate-700 border border-slate-200 text-xs font-semibold shadow-xs"
            >
              Update Dietary Profile
            </Link>
            <Link
              href="/goals"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-xs"
            >
              Define Active Goal
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {results.map((r, i) => (
            <div
              key={i}
              className="glass-panel rounded-3xl border border-white/60 overflow-hidden shadow-sm hover:shadow-md transition-all space-y-4 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xs font-black shadow-xs">
                    #{i + 1}
                  </span>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-3 py-1 rounded-full">
                    Match Score: {r.score}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 italic bg-white/70 px-3 py-1 rounded-xl border border-slate-200/60">
                  💡 {r.why}
                </p>
              </div>

              <RecipeCard recipe={r.recipe as any} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
