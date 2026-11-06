'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: 'demo@nutrition.test', password: 'Demo@1234' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Login failed');
    }
  }

  function fillCreds(email: string) {
    setForm({ email, password: 'Demo@1234' });
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="w-full max-w-md glass-panel p-8 sm:p-10 rounded-3xl relative overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white text-3xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
            🥗
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Welcome Back</h2>
          <p className="text-xs text-slate-500 mt-1">Sign in to your personalized nutrition dashboard</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50/80 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm glass-input font-medium text-slate-800 placeholder-slate-400"
              placeholder="demo@nutrition.test"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm glass-input font-medium text-slate-800 placeholder-slate-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-600/30 disabled:opacity-50 font-bold text-sm transition-all"
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        {/* Quick Demo Logins */}
        <div className="mt-6 pt-6 border-t border-slate-200/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-2.5">
            Quick One-Click Demo Profiles
          </p>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => fillCreds('demo@nutrition.test')}
              className="p-2 rounded-xl glass-panel text-slate-700 font-semibold hover:border-emerald-500 hover:text-emerald-700 text-center transition-all"
            >
              Demo User
            </button>
            <button
              type="button"
              onClick={() => fillCreds('priya@example.com')}
              className="p-2 rounded-xl glass-panel text-slate-700 font-semibold hover:border-emerald-500 hover:text-emerald-700 text-center transition-all"
            >
              Priya (Veg)
            </button>
            <button
              type="button"
              onClick={() => fillCreds('rohan@example.com')}
              className="p-2 rounded-xl glass-panel text-slate-700 font-semibold hover:border-emerald-500 hover:text-emerald-700 text-center transition-all"
            >
              Rohan (Gym)
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-emerald-600 font-bold hover:underline">
            Register here
          </Link>
        </p>

      </div>
    </div>
  );
}
