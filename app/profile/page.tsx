'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [dietary, setDietary] = useState<Record<string, unknown>>({});
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/profile').then((r) => r.json()).then(setProfile);
    fetch('/api/dietary-profile').then((r) => r.json()).then(setDietary);
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:      profile.full_name,
        date_of_birth:  profile.date_of_birth ?? null,
        height_cm:      profile.height_cm ? Number(profile.height_cm) : null,
        weight_kg:      profile.weight_kg ? Number(profile.weight_kg) : null,
        activity_level: profile.activity_level,
      }),
    });
    setLoading(false);
    setSaved(res.ok ? 'Personal metrics updated successfully!' : 'Error updating profile');
    setTimeout(() => setSaved(''), 3000);
  }

  async function saveDietary(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/dietary-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dietary),
    });
    setLoading(false);
    setSaved(res.ok ? 'Dietary profile & allergy exclusions updated!' : 'Error updating dietary profile');
    setTimeout(() => setSaved(''), 3000);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              MySQL `users` &amp; `dietary_profiles`
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500">1:1 Entity Integrity</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            👤 User &amp; Dietary Profile
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage your baseline body metrics, activity multiplier, and allergy restrictions.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 hover:bg-white text-slate-700 font-medium text-sm border border-slate-200 shadow-sm transition-all hover:scale-105"
        >
          ← Dashboard
        </Link>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2">
          <span>✅</span> {saved}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Personal Metrics Form */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>⚖️</span> Personal Body Metrics
            </h2>
            <p className="text-xs text-slate-500">Stored in MySQL `users` table</p>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={String(profile.full_name ?? '')}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address <span className="text-slate-400 font-normal">(Primary Key / Unique)</span>
              </label>
              <input
                type="email"
                disabled
                value={String(profile.email ?? '')}
                className="w-full rounded-2xl px-4 py-2.5 text-sm text-slate-400 bg-slate-100/80 border border-slate-200 cursor-not-allowed font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Date of Birth
              </label>
              <input
                type="date"
                value={String(profile.date_of_birth ?? '').split('T')[0]}
                onChange={(e) => setProfile({ ...profile, date_of_birth: e.target.value })}
                className="w-full glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Height (cm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="50"
                  max="300"
                  value={String(profile.height_cm ?? '')}
                  onChange={(e) => setProfile({ ...profile, height_cm: e.target.value })}
                  className="w-full glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="20"
                  max="500"
                  value={String(profile.weight_kg ?? '')}
                  onChange={(e) => setProfile({ ...profile, weight_kg: e.target.value })}
                  className="w-full glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Activity Level
              </label>
              <select
                value={String(profile.activity_level ?? 'moderate')}
                onChange={(e) => setProfile({ ...profile, activity_level: e.target.value })}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border capitalize"
              >
                <option value="sedentary">Sedentary (Little to no exercise)</option>
                <option value="light">Light (Exercise 1-3 days/week)</option>
                <option value="moderate">Moderate (Exercise 3-5 days/week)</option>
                <option value="active">Active (Exercise 6-7 days/week)</option>
                <option value="very_active">Very Active (Hard exercise daily)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Saving...' : '💾 Update Personal Metrics'}
            </button>
          </form>
        </div>

        {/* Dietary Preferences Form */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🥗</span> Dietary Profile &amp; Exclusions
            </h2>
            <p className="text-xs text-slate-500">Stored in MySQL `dietary_profiles` (auto-created by trigger)</p>
          </div>

          <form onSubmit={saveDietary} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Diet Classification
              </label>
              <select
                value={String(dietary.diet_type ?? 'other')}
                onChange={(e) => setDietary({ ...dietary, diet_type: e.target.value })}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border capitalize"
              >
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="non_vegetarian">Non-Vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="pescatarian">Pescatarian</option>
                <option value="other">Other / Flexible</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Allergy Notes <span className="text-slate-400 font-normal">(Comma-separated keywords)</span>
              </label>
              <textarea
                value={String(dietary.allergy_notes ?? '')}
                onChange={(e) => setDietary({ ...dietary, allergy_notes: e.target.value })}
                placeholder="e.g. peanuts, dairy, shellfish, sesame"
                rows={3}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400 resize-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Recommendation engine converts these into MongoDB <code>allergens: &#123; $nin: [...] &#125;</code> filters.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Intolerance &amp; Dietary Notes
              </label>
              <textarea
                value={String(dietary.intolerance_notes ?? '')}
                onChange={(e) => setDietary({ ...dietary, intolerance_notes: e.target.value })}
                placeholder="e.g. lactose intolerance, mild gluten sensitivity"
                rows={3}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Saving...' : '💾 Update Dietary Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
