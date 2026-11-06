'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Meal {
  meal_log_id: string;
  meal_type: string;
  calories: number;
  protein_g: number;
  carbs_g?: number;
  fat_g?: number;
  recipe_name: string;
  servings?: number;
  notes: string | null;
}

interface DailyLog {
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  water_ml: number;
}

export default function LogPage() {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const [log, setLog] = useState<DailyLog | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [recipes, setRecipes] = useState<Array<{
    _id: string;
    recipe_name: string;
    nutrition_per_serving: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    meal_type: string;
  }>>([]);
  const [form, setForm] = useState({
    recipe_id: '',
    meal_type: 'lunch',
    servings: 1,
    cal_per_serving: 0,
    protein_per_serving: 0,
    carbs_per_serving: 0,
    fat_per_serving: 0,
    notes: '',
  });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchLog() {
    const res = await fetch(`/api/logs?date=${date}`);
    if (res.ok) {
      const data = await res.json();
      setLog(data.log);
      setMeals(data.meals ?? []);
    }
  }

  useEffect(() => { fetchLog(); }, [date]);

  useEffect(() => {
    if (search.length < 2) { setRecipes([]); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/recipes?q=${encodeURIComponent(search)}&limit=8`);
      if (res.ok) setRecipes(await res.json());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  function selectRecipe(r: typeof recipes[0]) {
    setForm({
      ...form,
      recipe_id: r._id,
      meal_type: r.meal_type || 'lunch',
      cal_per_serving: r.nutrition_per_serving.calories,
      protein_per_serving: r.nutrition_per_serving.protein_g,
      carbs_per_serving: r.nutrition_per_serving.carbs_g,
      fat_per_serving: r.nutrition_per_serving.fat_g,
    });
    setSearch(r.recipe_name);
    setRecipes([]);
  }

  async function logMeal(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, log_date: date, recipe_id: form.recipe_id || null }),
    });
    setLoading(false);
    if (res.ok) {
      setForm({
        recipe_id: '',
        meal_type: 'lunch',
        servings: 1,
        cal_per_serving: 0,
        protein_per_serving: 0,
        carbs_per_serving: 0,
        fat_per_serving: 0,
        notes: '',
      });
      setSearch('');
      fetchLog();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to log meal');
    }
  }

  async function deleteMeal(id: string) {
    if (!confirm('Delete this meal entry? MySQL triggers will automatically recalculate daily totals.')) return;
    await fetch(`/api/meals/${id}`, { method: 'DELETE' });
    fetchLog();
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              `sp_log_meal` & Triggers
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500">Atomic Daily Sync</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            📝 Meal & Intake Logger
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Log meals directly from MongoDB recipe documents or record custom nutrition into MySQL `meal_logs`.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-600">Track Date:</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 font-medium border"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <div className="lg:col-span-6 glass-panel rounded-3xl p-6 border border-white/60">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🍽️</span> Record a Meal Entry
            </h2>
            <p className="text-xs text-slate-500">Links recipe catalog to daily transactional records</p>
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs">
              <span className="font-bold">Error: </span>{error}
            </div>
          )}

          <form onSubmit={logMeal} className="space-y-4">
            {/* Search Recipe dropdown */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Search MongoDB Recipe <span className="text-slate-400 font-normal">(or type custom below)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  placeholder="e.g. Quinoa, Paneer, Oats, Salmon..."
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); setRecipes([]); }}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {recipes.length > 0 && (
                <div className="absolute z-20 w-full mt-2 glass-panel rounded-2xl border border-white/80 shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {recipes.map((r) => (
                    <button
                      key={r._id}
                      type="button"
                      onClick={() => selectRecipe(r)}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50/60 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700">{r.recipe_name}</p>
                        <p className="text-xs text-slate-500 capitalize">{r.meal_type} · {r.nutrition_per_serving?.protein_g ?? 0}g protein</p>
                      </div>
                      <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-xl">
                        {r.nutrition_per_serving?.calories ?? 0} kcal
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Meal Slot
                </label>
                <select
                  value={form.meal_type}
                  onChange={(e) => setForm({ ...form, meal_type: e.target.value })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border capitalize"
                >
                  {['breakfast', 'lunch', 'snack', 'dinner', 'other'].map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Servings Count
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={form.servings}
                  onChange={(e) => setForm({ ...form, servings: Number(e.target.value) })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border"
                />
              </div>
            </div>

            {/* Nutrients Per Serving */}
            <div className="p-4 rounded-2xl bg-white/50 border border-slate-200/60 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Nutrient Profile (Per Serving)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'cal_per_serving', label: 'Calories (kcal)', icon: '🔥' },
                  { key: 'protein_per_serving', label: 'Protein (g)', icon: '🥩' },
                  { key: 'carbs_per_serving', label: 'Carbs (g)', icon: '🌾' },
                  { key: 'fat_per_serving', label: 'Fat (g)', icon: '🥑' },
                ].map(({ key, label, icon }) => (
                  <div key={key}>
                    <label className="block text-[10px] font-semibold text-slate-600 mb-1">{icon} {label}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={(form as Record<string, unknown>)[key] as number}
                      onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                      className="w-full glass-input rounded-xl px-2.5 py-1.5 text-xs text-slate-900 font-bold border"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Optional Notes
              </label>
              <input
                type="text"
                value={form.notes}
                placeholder="e.g. Post-workout snack with extra chia seeds"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full glass-input rounded-2xl px-3.5 py-2 text-sm text-slate-900 border placeholder:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Executing Transaction & Triggers...' : '💾 Save Meal to Database'}
            </button>
          </form>
        </div>

        {/* Aggregates & Meals List */}
        <div className="lg:col-span-6 space-y-6">
          {/* Live Trigger Aggregate Card */}
          {log && (
            <div className="glass-panel rounded-3xl p-6 border border-white/60 bg-gradient-to-br from-emerald-500/10 via-white/40 to-teal-500/10">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>⚡</span> Live DB Aggregates for {date}
                  </h3>
                  <p className="text-[11px] text-slate-500">Maintained automatically in `daily_nutrition_logs`</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Trigger Managed
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-white/80 border border-orange-100 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-orange-600 uppercase block">Calories</span>
                  <span className="text-xl font-black text-slate-900">{Math.round(Number(log.total_calories))}</span>
                  <span className="text-[10px] text-slate-400 block">kcal</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/80 border border-blue-100 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">Protein</span>
                  <span className="text-xl font-black text-slate-900">{Math.round(Number(log.total_protein_g))}</span>
                  <span className="text-[10px] text-slate-400 block">grams</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/80 border border-emerald-100 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Carbs</span>
                  <span className="text-xl font-black text-slate-900">{Math.round(Number(log.total_carbs_g))}</span>
                  <span className="text-[10px] text-slate-400 block">grams</span>
                </div>
                <div className="p-3 rounded-2xl bg-white/80 border border-pink-100 text-center shadow-xs">
                  <span className="text-[10px] font-bold text-pink-600 uppercase block">Fat</span>
                  <span className="text-xl font-black text-slate-900">{Math.round(Number(log.total_fat_g))}</span>
                  <span className="text-[10px] text-slate-400 block">grams</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span>Triggers: `trg_meal_after_insert` & `trg_meal_after_delete`</span>
                <span className="font-semibold text-blue-600">💧 {log.water_ml ?? 0} ml</span>
              </p>
            </div>
          )}

          {/* Meals list for date */}
          <div className="glass-panel rounded-3xl p-6 border border-white/60">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>📋</span> Meals Logged ({meals.length})
              </h3>
              <span className="text-xs text-slate-400 font-medium">{date}</span>
            </div>

            {meals.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <span className="text-3xl block mb-2">🍽️</span>
                <p className="text-sm font-semibold text-slate-700">No meals logged for this date.</p>
                <p className="text-xs text-slate-500 mt-1">Select a recipe or input nutrition on the left to add one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meals.map((m) => (
                  <div
                    key={m.meal_log_id}
                    className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {m.meal_type}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm truncate">{m.recipe_name}</h4>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-orange-600">{Math.round(m.calories)} kcal</span>
                        <span>·</span>
                        <span>{Math.round(m.protein_g)}g protein</span>
                        {m.notes && (
                          <>
                            <span>·</span>
                            <span className="italic text-slate-400 truncate max-w-[150px]">{m.notes}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => deleteMeal(m.meal_log_id)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
