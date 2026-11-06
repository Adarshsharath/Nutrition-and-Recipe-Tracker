'use client';
import { useState } from 'react';
import Link from 'next/link';
import MacroBars from '@/components/MacroBars';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

interface DashboardProps {
  fullName: string;
  todayLog: Record<string, unknown>;
  activeGoal: Record<string, unknown> | null;
  chartData: Array<Record<string, unknown>>;
  recentMeals: Array<Record<string, unknown>>;
  today: string;
}

export default function DashboardClient({ fullName, todayLog, activeGoal, chartData, recentMeals, today }: DashboardProps) {
  const [water, setWater] = useState(Number(todayLog.water_ml ?? 0));
  const [addingWater, setAddingWater] = useState(false);

  const cal   = Number(todayLog.total_calories ?? 0);
  const prot  = Number(todayLog.total_protein_g ?? 0);
  const carbs = Number(todayLog.total_carbs_g ?? 0);
  const fat   = Number(todayLog.total_fat_g ?? 0);

  const targetCal   = Number(activeGoal?.target_calories ?? 2000);
  const targetProt  = Number(activeGoal?.target_protein_g ?? 50);
  const targetCarbs = Number(activeGoal?.target_carbs_g ?? 250);
  const targetFat   = Number(activeGoal?.target_fat_g ?? 65);

  async function addWater(amount: number = 250) {
    setAddingWater(true);
    try {
      const res = await fetch('/api/logs/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: today, add_ml: amount }),
      });
      if (res.ok) {
        const data = await res.json();
        setWater(data.water_ml);
      }
    } finally {
      setAddingWater(false);
    }
  }

  const goalPct = targetCal > 0 ? Math.round((cal / targetCal) * 100) : 0;
  const waterPct = Math.min(Math.round((water / 2500) * 100), 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header section with greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              Live Dashboard
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-500">
              {new Date(today).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome back, <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{fullName.split(' ')[0]}</span> 👋
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track daily nutrition metrics synced automatically via MySQL triggers & MongoDB recipe documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/log"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all hover:scale-105"
          >
            <span>+</span> Log Meal
          </Link>
          <Link
            href="/recommendations"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-700 font-medium border border-slate-200 shadow-sm transition-all hover:scale-105"
          >
            <span>✨</span> Suggestions
          </Link>
        </div>
      </div>

      {/* 4 Glassy KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Calories Intake',
            val: Math.round(cal),
            unit: 'kcal',
            target: targetCal,
            icon: '🔥',
            color: 'from-amber-500/20 to-orange-500/10 border-orange-200/60 text-orange-600',
            barColor: 'bg-orange-500',
          },
          {
            label: 'Protein Target',
            val: Math.round(prot),
            unit: 'g',
            target: targetProt,
            icon: '🥩',
            color: 'from-blue-500/20 to-cyan-500/10 border-blue-200/60 text-blue-600',
            barColor: 'bg-blue-500',
          },
          {
            label: 'Carbohydrates',
            val: Math.round(carbs),
            unit: 'g',
            target: targetCarbs,
            icon: '🌾',
            color: 'from-emerald-500/20 to-teal-500/10 border-emerald-200/60 text-emerald-600',
            barColor: 'bg-emerald-500',
          },
          {
            label: 'Healthy Fats',
            val: Math.round(fat),
            unit: 'g',
            target: targetFat,
            icon: '🥑',
            color: 'from-pink-500/20 to-rose-500/10 border-pink-200/60 text-pink-600',
            barColor: 'bg-pink-500',
          },
        ].map((item) => (
          <div
            key={item.label}
            className={`glass-panel glass-panel-hover rounded-3xl p-5 border bg-gradient-to-br ${item.color} flex flex-col justify-between`}
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl p-2 rounded-2xl bg-white/70 shadow-sm">{item.icon}</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 text-slate-600 shadow-xs">
                {Math.round((item.val / (item.target || 1)) * 100)}%
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-600 tracking-wide uppercase">{item.label}</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{item.val}</span>
                <span className="text-xs font-medium text-slate-500">/ {item.target} {item.unit}</span>
              </div>
            </div>
            <div className="h-1.5 w-full bg-white/60 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full ${item.barColor}`}
                style={{ width: `${Math.min((item.val / (item.target || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Macro Progress + Water Glass Tracker */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Macro bars panel */}
        <div className="md:col-span-2 glass-panel rounded-3xl p-6 border border-white/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>📊</span> Today&apos;s Macronutrient Goals
                </h2>
                <p className="text-xs text-slate-500">Calculated directly via MySQL Trigger `trg_meal_logs_after_insert`</p>
              </div>
              {activeGoal ? (
                <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {String(activeGoal.goal_type).replace('_', ' ').toUpperCase()} · {goalPct}% Met
                </span>
              ) : (
                <Link
                  href="/goals"
                  className="text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full hover:bg-amber-100"
                >
                  ⚠ Set Active Goal
                </Link>
              )}
            </div>

            <MacroBars
              calories={cal} targetCal={targetCal}
              protein={prot} targetProt={targetProt}
              carbs={carbs} targetCarbs={targetCarbs}
              fat={fat} targetFat={targetFat}
            />
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500">
            <span>Aggregated automatically into `daily_nutrition_logs`</span>
            <Link href="/review" className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline">
              Inspect Triggers in Review Console →
            </Link>
          </div>
        </div>

        {/* Glass Water Tracker */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <span>💧</span> Hydration
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Goal: 2,500 ml
            </span>
          </div>

          {/* Animated Water Ring */}
          <div className="relative w-36 h-36 my-4">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="rgba(224, 242, 254, 0.8)"
                strokeWidth="3.2"
              />
              <circle
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke="url(#waterGrad)"
                strokeWidth="3.2"
                strokeDasharray={`${waterPct} 100`}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#2563eb" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-900 tracking-tight">{water}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">milliliters</span>
              <span className="text-xs font-bold text-blue-600 mt-0.5">{waterPct}%</span>
            </div>
          </div>

          <div className="w-full space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => addWater(250)}
                disabled={addingWater}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium text-xs shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-102 active:scale-98 transition-all disabled:opacity-50"
              >
                + 250 ml Glass
              </button>
              <button
                onClick={() => addWater(500)}
                disabled={addingWater}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-white/80 hover:bg-white text-blue-700 font-medium text-xs border border-blue-200 shadow-xs hover:scale-102 transition-all disabled:opacity-50"
              >
                + 500 ml Bottle
              </button>
            </div>
            <p className="text-[11px] text-center text-slate-400">Updates `daily_nutrition_logs.water_ml`</p>
          </div>
        </div>
      </div>

      {/* 7-Day Trend Chart Glass Panel */}
      <div className="glass-panel rounded-3xl p-6 border border-white/60">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📈</span> 7-Day Nutrition Trend
            </h2>
            <p className="text-xs text-slate-500">Querying historical logs from MySQL `daily_nutrition_logs`</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
            7 Days Logged
          </span>
        </div>

        {chartData.length > 0 ? (
          <div className="pt-2">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="log_date"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '1rem',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Line
                  type="monotone"
                  dataKey="total_calories"
                  stroke="#f97316"
                  strokeWidth={3}
                  name="Calories (kcal)"
                  dot={{ r: 4, fill: '#f97316' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="total_protein_g"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  name="Protein (g)"
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm">No historical log data yet.</p>
            <Link href="/log" className="mt-2 inline-block text-xs font-semibold text-emerald-600 underline">
              Log today&apos;s first meal
            </Link>
          </div>
        )}
      </div>

      {/* Today's Meals Section */}
      <div className="glass-panel rounded-3xl p-6 border border-white/60">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>🍽️</span> Today&apos;s Logged Meals
            </h2>
            <p className="text-xs text-slate-500">Live entries in MySQL `meal_logs`</p>
          </div>
          <Link
            href="/log"
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
          >
            + Add Another Meal
          </Link>
        </div>

        {recentMeals.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentMeals.map((m, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-white/70 hover:bg-white border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {String(m.meal_type)}
                    </span>
                    <h3 className="font-semibold text-slate-900 text-sm mt-1 line-clamp-1">
                      {String(m.recipe_name ?? 'Custom Meal')}
                    </h3>
                  </div>
                  <span className="text-xs font-extrabold text-orange-600 bg-orange-50 px-2 py-1 rounded-xl">
                    {Math.round(Number(m.calories))} kcal
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-2 border-t border-slate-100">
                  <span>P: {Math.round(Number(m.protein_g))}g · C: {Math.round(Number(m.carbs_g))}g · F: {Math.round(Number(m.fat_g))}g</span>
                  <span className="text-[10px] text-slate-400">{String(m.servings)} serv</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-slate-400">
            <p className="text-sm">No meals logged for today yet.</p>
            <Link
              href="/log"
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-sm hover:bg-emerald-700"
            >
              <span>+</span> Log Meal Now
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
