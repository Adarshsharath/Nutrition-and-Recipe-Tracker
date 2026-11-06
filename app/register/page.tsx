'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    date_of_birth: '',
    height_cm: '',
    weight_kg: '',
    activity_level: 'moderate',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const body = {
      ...form,
      height_cm: form.height_cm ? Number(form.height_cm) : undefined,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
      date_of_birth: form.date_of_birth || undefined,
    };
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      router.push('/dashboard');
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? 'Registration failed');
    }
  }

  const Field = ({ label, name, type = 'text', placeholder = '', required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) => (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">{label}</label>
      <input
        type={type}
        required={required}
        value={(form as Record<string,string>)[name]}
        placeholder={placeholder}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm glass-input font-medium text-slate-800 placeholder-slate-400"
      />
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] px-4 py-12">
      <div className="w-full max-w-lg glass-panel p-8 sm:p-10 rounded-3xl relative overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white text-3xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/30">
            🥗
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create Account</h2>
          <p className="text-xs text-slate-500 mt-1">
            Registers user in MySQL &amp; auto-triggers <code>dietary_profiles</code> creation
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50/80 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full Name *" name="full_name" placeholder="Adarsh Prakash" required />
          <Field label="Email Address *" name="email" type="email" placeholder="you@pes.edu" required />
          <Field label="Password *" name="password" type="password" placeholder="Min 8 characters" required />
          <Field label="Date of Birth" name="date_of_birth" type="date" />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Height (cm)" name="height_cm" type="number" placeholder="175" />
            <Field label="Weight (kg)" name="weight_kg" type="number" placeholder="70" />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Activity Baseline
            </label>
            <select
              value={form.activity_level}
              onChange={(e) => setForm({ ...form, activity_level: e.target.value })}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm glass-input font-medium text-slate-800"
            >
              <option value="sedentary">Sedentary (Desk work, no exercise)</option>
              <option value="light">Light (1-3 days exercise/week)</option>
              <option value="moderate">Moderate (3-5 days exercise/week)</option>
              <option value="active">Active (6-7 days exercise/week)</option>
              <option value="very_active">Very Active (Physical job / 2x training)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-xl hover:shadow-lg hover:shadow-emerald-600/30 disabled:opacity-50 font-bold text-sm transition-all"
          >
            {loading ? 'Creating Account…' : 'Complete Registration'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          Already registered?{' '}
          <Link href="/login" className="text-emerald-600 font-bold hover:underline">
            Sign In here
          </Link>
        </p>

      </div>
    </div>
  );
}
