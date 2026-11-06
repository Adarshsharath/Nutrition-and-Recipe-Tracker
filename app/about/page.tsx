export default function AboutPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      {/* Academic Header */}
      <div className="glass-panel p-8 rounded-3xl border border-white/60 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
            Level 3 Experiential Learning
          </span>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
            Course: Database Management Systems
          </span>
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 border border-purple-200">
            Section A
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
          Personalized Nutrition &amp; Recipe Tracker
        </h1>
        <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-3xl">
          Hybrid relational-document system architecture solving impedance mismatch between strictly normalized transactional tracking and polymorphic recipe documents.
        </p>
        <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-6 text-xs text-slate-500">
          <div>
            <span className="font-bold text-slate-700">Course Instructor: </span>Prof. Deena Hajim
          </div>
          <div>
            <span className="font-bold text-slate-700">Student Team: </span>
            Adarsh Prakash (PES2UG24CS027) &middot; Abhirama H Y (PES2UG24CS023)
          </div>
        </div>
      </div>

      {/* Problem statement */}
      <div className="glass-panel rounded-3xl p-8 border border-white/60 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🎯</span> Problem Statement &amp; Architectural Objectives
          </h2>
          <p className="text-xs text-slate-500 mt-1">Bridging relational integrity with flexible document retrieval</p>
        </div>
        <p className="text-slate-700 leading-relaxed text-sm">
          A database-driven application tracking daily meals and nutrition intake while suggesting recipes aligned with user dietary profiles and health goals. It combines structured transactional data (users, goals, daily logs, meal records) with flexible recipe data (ingredients, instructions, dietary tags, allergens, per-serving nutrition).
        </p>
        <div className="grid md:grid-cols-2 gap-3 pt-2">
          {[
            'Consistent, normalized user, dietary-profile, goal and nutrition-log data in 3NF.',
            'Track meals and their exact nutritional contribution per user per day.',
            'Store rich recipe documents whose structure varies recipe to recipe without schema migrations.',
            'Personalized recipe filtering by dietary preference, allergens, meal type, and nutrition targets.',
            'MySQL for integrity-critical relationships and transactions; MongoDB for flexible recipe documents.',
            'Cross-database synchronization with dual-write semantics and compensating transactions.',
          ].map((o, i) => (
            <div key={i} className="flex gap-3 text-xs text-slate-700 items-start p-3 rounded-2xl bg-white/70 border border-slate-200/70 shadow-xs">
              <span className="text-emerald-600 font-black text-sm flex-shrink-0">✓</span>
              <span>{o}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DB split */}
      <div className="glass-panel rounded-3xl p-8 border border-white/60 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>⚖️</span> Database Split &amp; Storage Justification
          </h2>
          <p className="text-xs text-slate-500 mt-1">Clear boundary separation between integrity-critical and polymorphic data</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700">
                <th className="text-left p-3.5 rounded-l-2xl font-bold">Data Entity</th>
                <th className="text-left p-3.5 font-bold">Database Engine</th>
                <th className="text-left p-3.5 rounded-r-2xl font-bold">Architectural Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['Users, auth data, profiles', 'MySQL 8.0', 'Strong consistency, unique email constraint, bcrypt password isolation'],
                ['Nutrition goals, daily totals', 'MySQL 8.0', 'Structured numeric data, check constraints, non-overlapping date triggers'],
                ['Meal logs', 'MySQL 8.0', 'Foreign-key relationships, transactional consistency with daily summaries'],
                ['Recipe identity / catalog metadata', 'MySQL 8.0', 'Stable relational key for meal references (ON DELETE SET NULL)'],
                ['Full recipe documents', 'MongoDB 6+', 'Document-shaped, evolving schemas (equipment, substitutions, notes)'],
                ['Recipe search / filter metadata', 'MongoDB 6+', 'Compound multi-key indexes, text search indexes, zero-join filtering'],
              ].map(([d, db, r], i) => (
                <tr key={i} className="hover:bg-white/60 transition-colors">
                  <td className="p-3.5 font-semibold text-slate-900">{d}</td>
                  <td className="p-3.5">
                    <span className={`inline-block px-2.5 py-1 rounded-full font-bold ${
                      db.includes('MySQL') ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {db}
                    </span>
                  </td>
                  <td className="p-3.5 text-slate-600 leading-normal">{r}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Why MySQL vs MongoDB */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-3xl p-6 border border-blue-200/80 bg-gradient-to-br from-blue-500/10 via-white/50 to-indigo-500/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
            <span className="text-2xl">🐬</span>
            <h2 className="text-base font-bold text-blue-900">Why MySQL for Transactional Data?</h2>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-700">
            {[
              'Structured entities with 1:N relationships (1 user → many goals/daily logs/meal logs)',
              'Primary key / foreign key enforcement guarantees meals belong to valid daily logs and users',
              'UNIQUE, CHECK, and NOT NULL constraints enforced strictly at the database engine level',
              'JOIN, GROUP BY, and HAVING aggregate analysis for weekly averages and over-target days',
              'Transactions ensure atomic writes (sp_log_meal uses START TRANSACTION with ROLLBACK handler)',
              'Triggers maintain daily nutritional totals automatically — application code never touches aggregates',
            ].map((r, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-blue-600 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-white/50 to-teal-500/10 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-emerald-100">
            <span className="text-2xl">🍃</span>
            <h2 className="text-base font-bold text-emerald-900">Why MongoDB for Recipe Documents?</h2>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-700">
            {[
              'A recipe is naturally hierarchical: ingredients array, instructions array, nutrition subdocument',
              'Variable numbers of ingredients and steps without complex table joins or schema migrations',
              'Metadata evolves dynamically (equipment lists, substitutions, regional tags, chef notes)',
              'Text indexes provide full-text search across recipe name, description, and ingredients',
              'Multikey array indexes for fast filtering by cuisine, meal_type, dietary_tags, and allergens',
              'Justified by data shape (varies per recipe) and access pattern (document retrieval + indexing)',
            ].map((r, i) => (
              <li key={i} className="flex gap-2 items-start">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ER relationships */}
      <div className="glass-panel rounded-3xl p-8 border border-white/60 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🔗</span> Entity-Relationship Cardinalities &amp; Invariants
          </h2>
          <p className="text-xs text-slate-500 mt-1">Cross-table and cross-database relational schema</p>
        </div>
        <div className="space-y-3 text-xs">
          {[
            ['Users → Dietary Profiles', '1:1', 'At most one current dietary profile per user (uq_dietary_profiles_user)'],
            ['Users → Nutrition Goals', '1:N', 'Multiple goals over time; non-overlapping date ranges enforced by triggers'],
            ['Users → Daily Nutrition Logs', '1:N', 'One aggregate log per tracked date (uq_daily_logs_user_date)'],
            ['Daily Nutrition Logs → Meal Logs', '1:N', 'Zero or more meals per day; triggers automatically update daily totals'],
            ['Recipe Catalog → Meal Logs', '1:N (optional)', 'recipe_id is nullable in meal_logs; manual meals have no recipe reference'],
            ['Recipe Catalog (MySQL) ↔ Recipes (MongoDB)', '1:1', 'Explicit cross-database link: MySQL recipe_id = MongoDB _id (UUID)'],
          ].map(([from, card, desc], i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2 sm:gap-4 p-4 rounded-2xl bg-white/70 border border-slate-200/70 shadow-xs items-center">
              <span className="font-bold text-slate-900 min-w-[260px]">{from}</span>
              <span className="text-emerald-700 font-mono font-black min-w-[100px] bg-emerald-50 px-2 py-1 rounded-xl text-center border border-emerald-200">
                {card}
              </span>
              <span className="text-slate-600 flex-1">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data dictionary */}
      <div className="glass-panel rounded-3xl p-8 border border-white/60 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>📖</span> Relational Data Dictionary
          </h2>
          <p className="text-xs text-slate-500 mt-1">Field-level integrity constraints and business rules</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 text-slate-700">
                <th className="text-left p-3.5 rounded-l-2xl font-bold">Table</th>
                <th className="text-left p-3.5 font-bold">Entity Purpose</th>
                <th className="text-left p-3.5 rounded-r-2xl font-bold">Integrity &amp; Constraint Rules</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                ['users', 'Account credentials, body baseline metrics, activity level', 'user_id CHAR(36) PK; email UNIQUE; password_hash bcrypt (never plaintext); CHECK height/weight > 0; CHECK activity_level in enum'],
                ['dietary_profiles', 'Current dietary preference and allergy notes', 'profile_id CHAR(36) PK; user_id UNIQUE FK (CASCADE); CHECK diet_type in enum; auto-created by trg_users_after_insert'],
                ['nutrition_goals', 'Historical and active nutrition targets', 'goal_id CHAR(36) PK; user_id FK (CASCADE); targets >= 0; end_date >= start_date; overlap prevented by trigger'],
                ['recipe_catalog', 'Stable relational anchor for recipes', 'recipe_id CHAR(36) PK; recipe_name NOT NULL; is_active soft delete flag; referenced by meal_logs (SET NULL)'],
                ['daily_nutrition_logs', 'Daily aggregates per user per date', 'log_id CHAR(36) PK; user_id FK (CASCADE); UNIQUE(user_id, log_date); CHECK totals >= 0; maintained by triggers only'],
                ['meal_logs', 'Individual meal entries with nutrient snapshot', 'meal_log_id CHAR(36) PK; log_id FK (CASCADE); recipe_id FK (SET NULL); servings > 0; nutrients >= 0; meal_type enum'],
              ].map(([t, p, c], i) => (
                <tr key={i} className="hover:bg-white/60 transition-colors">
                  <td className="p-3.5 font-mono text-blue-700 font-bold whitespace-nowrap">{t}</td>
                  <td className="p-3.5 text-slate-800 font-medium">{p}</td>
                  <td className="p-3.5 text-slate-600 font-mono text-[11px] leading-relaxed">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
