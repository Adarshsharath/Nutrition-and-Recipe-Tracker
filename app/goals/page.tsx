'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Goal {
  goal_id: string;
  goal_type: string;
  target_calories: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  start_date: string;
  end_date: string | null;
}

const emptyForm = {
  goal_type: 'maintenance',
  target_calories: 2000,
  target_protein_g: 150,
  target_carbs_g: 250,
  target_fat_g: 65,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function fetchGoals() {
    const res = await fetch('/api/goals');
    if (res.ok) setGoals(await res.json());
  }
  useEffect(() => { fetchGoals(); }, []);

  function isActive(g: Goal) {
    return g.start_date <= today && (!g.end_date || g.end_date >= today);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const body = { ...form, end_date: form.end_date || null };
    const url  = editing ? `/api/goals/${editing}` : '/api/goals';
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      setForm(emptyForm);
      setEditing(null);
      fetchGoals();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to save goal');
    }
  }

  async function deleteGoal(id: string) {
    if (!confirm('Are you sure you want to delete this nutrition goal?')) return;
    await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    fetchGoals();
  }

  function startEdit(g: Goal) {
    setEditing(g.goal_id);
    setForm({
      goal_type: g.goal_type,
      target_calories: g.target_calories,
      target_protein_g: g.target_protein_g,
      target_carbs_g: g.target_carbs_g,
      target_fat_g: g.target_fat_g,
      start_date: g.start_date.split('T')[0],
      end_date: g.end_date?.split('T')[0] ?? '',
    });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              MySQL `nutrition_goals`
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">Live Triggers Active</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            🎯 Nutrition & Macro Goals
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Set custom caloric and macronutrient targets guarded by `trg_nutrition_goals_overlap_check` to prevent overlapping active periods.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 hover:bg-white text-slate-700 font-medium text-sm border border-slate-200 shadow-sm transition-all hover:scale-105"
        >
          ← Back to Dashboard
        </Link>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Form Panel */}
        <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-white/60">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>{editing ? '✏️' : '✨'}</span>
              {editing ? 'Edit Nutrition Goal' : 'Define New Goal'}
            </h2>
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(null); setForm(emptyForm); }}
                className="text-xs text-slate-500 hover:text-slate-800 underline"
              >
                Cancel edit
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 rounded-2xl bg-rose-50/90 border border-rose-200 text-rose-800 text-xs">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <span>🛡️</span> Database Constraint Trigger
              </div>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Goal Type
              </label>
              <select
                value={form.goal_type}
                onChange={(e) => setForm({ ...form, goal_type: e.target.value })}
                className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border"
              >
                <option value="weight_loss">Weight Loss (Caloric Deficit)</option>
                <option value="weight_gain">Weight Gain (Caloric Surplus / Muscle)</option>
                <option value="maintenance">Maintenance</option>
                <option value="custom">Custom Goal</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Calories (kcal)
                </label>
                <input
                  type="number"
                  min="500"
                  max="10000"
                  required
                  value={form.target_calories}
                  onChange={(e) => setForm({ ...form, target_calories: Number(e.target.value) })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Protein (g)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  required
                  value={form.target_protein_g}
                  onChange={(e) => setForm({ ...form, target_protein_g: Number(e.target.value) })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  required
                  value={form.target_carbs_g}
                  onChange={(e) => setForm({ ...form, target_carbs_g: Number(e.target.value) })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fat (g)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  required
                  value={form.target_fat_g}
                  onChange={(e) => setForm({ ...form, target_fat_g: Number(e.target.value) })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2.5 text-sm text-slate-900 border"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2 text-sm text-slate-900 border"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  End Date <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full glass-input rounded-2xl px-3.5 py-2 text-sm text-slate-900 border"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
            >
              {loading ? 'Validating against triggers...' : editing ? 'Update Nutrition Goal' : 'Create Nutrition Goal'}
            </button>
          </form>
        </div>

        {/* Goals List Panel */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-4 rounded-3xl border border-white/60 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Your Goal History & Active Plans</h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {goals.length} {goals.length === 1 ? 'Goal' : 'Goals'}
            </span>
          </div>

          {goals.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 text-center text-slate-400 border border-white/60">
              <span className="text-4xl block mb-2">🎯</span>
              <p className="font-semibold text-slate-700">No nutrition goals defined yet.</p>
              <p className="text-xs text-slate-500 mt-1">Use the form on the left to set your first target plan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((g) => {
                const active = isActive(g);
                return (
                  <div
                    key={g.goal_id}
                    className={`glass-panel rounded-3xl p-5 border transition-all ${
                      active
                        ? 'border-emerald-300/80 shadow-md shadow-emerald-500/10 ring-2 ring-emerald-500/20'
                        : 'border-white/60 opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-base capitalize">
                            {g.goal_type.replace('_', ' ')}
                          </span>
                          {active ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                              Active Plan
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                              Archived / Future
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Period: {new Date(g.start_date).toLocaleDateString()} &rarr;{' '}
                          {g.end_date ? new Date(g.end_date).toLocaleDateString() : 'Ongoing'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(g)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white/80 hover:bg-white text-slate-700 border border-slate-200 shadow-xs transition-all hover:scale-105"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteGoal(g.goal_id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-xs transition-all hover:scale-105"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Macro target pills */}
                    <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-100">
                      <div className="p-2 rounded-2xl bg-orange-50/60 text-center border border-orange-100">
                        <span className="text-[10px] uppercase font-bold text-orange-600 block">Calories</span>
                        <span className="text-sm font-black text-slate-900">{Math.round(g.target_calories)}</span>
                        <span className="text-[10px] text-slate-400 block">kcal</span>
                      </div>
                      <div className="p-2 rounded-2xl bg-blue-50/60 text-center border border-blue-100">
                        <span className="text-[10px] uppercase font-bold text-blue-600 block">Protein</span>
                        <span className="text-sm font-black text-slate-900">{Math.round(g.target_protein_g)}</span>
                        <span className="text-[10px] text-slate-400 block">g</span>
                      </div>
                      <div className="p-2 rounded-2xl bg-emerald-50/60 text-center border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-600 block">Carbs</span>
                        <span className="text-sm font-black text-slate-900">{Math.round(g.target_carbs_g)}</span>
                        <span className="text-[10px] text-slate-400 block">g</span>
                      </div>
                      <div className="p-2 rounded-2xl bg-pink-50/60 text-center border border-pink-100">
                        <span className="text-[10px] uppercase font-bold text-pink-600 block">Fat</span>
                        <span className="text-sm font-black text-slate-900">{Math.round(g.target_fat_g)}</span>
                        <span className="text-[10px] text-slate-400 block">g</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
