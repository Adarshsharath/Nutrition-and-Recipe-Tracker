export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getAuthUser } from '@/lib/auth';
import Link from 'next/link';

export default async function HomePage() {
  const user = await getAuthUser();
  if (user) redirect('/dashboard');

  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12 overflow-hidden">
      <div className="w-full max-w-5xl mx-auto flex flex-col items-center text-center relative z-10">
        
        {/* Academic Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-xs font-semibold text-emerald-800 mb-8 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>DBMS Experiential Learning — Level 3</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">Prof. Deena Hajim</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
          Eat Smart. Track Goals.{' '}
          <span className="block shimmer-text">
            Personalized Recipes.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          A database-driven nutrition tracker combining <strong className="text-emerald-700 font-semibold">MySQL 8.0</strong> transactional integrity (goals, triggers, and daily logs) with <strong className="text-indigo-700 font-semibold">MongoDB</strong> polymorphic recipe documents.
        </p>

        {/* Glass Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
          <Link
            href="/login"
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Sign In with Demo Account
          </Link>
          <Link
            href="/register"
            className="px-7 py-3.5 rounded-2xl glass-panel text-slate-800 font-bold text-sm hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Create New Profile
          </Link>
          <Link
            href="/review"
            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-purple-600/20 hover:shadow-purple-600/35 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            🔬 Open Review-1 Console
          </Link>
        </div>

        {/* 3 Glass Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          
          {/* Card 1 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-3xl relative overflow-hidden group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🗄
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">MySQL Relational Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Maintains strict 3NF schema, non-overlapping goal constraints, and daily aggregate calculations exclusively managed through 7 database triggers.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
              <span>Atomic `sp_log_meal`</span>
              <span>•</span>
              <span>Zero client aggregates</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-3xl relative overflow-hidden group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🍃
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">MongoDB Document Store</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Flexible recipe documents with dynamic ingredient arrays, multikey allergen indexes, and full-text search across cuisines and instructions.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] font-semibold text-indigo-700">
              <span>Shared 36-char UUID</span>
              <span>•</span>
              <span>Compensating rollback</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel glass-panel-hover p-6 rounded-3xl relative overflow-hidden group">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              🎯
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Personalized Hybrid Engine</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Transforms active MySQL calorie deficits and allergen profiles into indexed MongoDB query filters, dynamically scoring recipes by macro targets.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-[11px] font-semibold text-amber-700">
              <span>Transparent pipeline</span>
              <span>•</span>
              <span>Dynamic ±20% window</span>
            </div>
          </div>

        </div>

        {/* Project Team Footer Banner */}
        <div className="mt-16 w-full glass-panel py-4 px-6 rounded-2xl flex flex-wrap items-center justify-between text-xs text-slate-500 gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">Team:</span>
            <span>Adarsh Prakash (PES2UG24CS027)</span>
            <span>•</span>
            <span>Abhirama H Y (PES2UG24CS023)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700">Section A</span>
            <span>•</span>
            <span className="text-slate-500">Dept. of Computer Science and Engineering</span>
          </div>
        </div>

      </div>
    </div>
  );
}
