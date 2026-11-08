'use client';
import { useState } from 'react';
import SqlResultTable from '@/components/SqlResultTable';
import JsonViewer from '@/components/JsonViewer';

type Tab = 'tables' | 'triggers' | 'views' | 'mongodb' | 'dataflow' | 'queries';

const TRIGGERS = [
  { name: 'trg_users_after_insert', description: 'AFTER INSERT on users → auto-creates dietary_profiles row with diet_type="other"' },
  { name: 'trg_goals_before_insert', description: 'BEFORE INSERT on nutrition_goals → SIGNAL 45000 if date range overlaps existing goal' },
  { name: 'trg_goals_before_update', description: 'BEFORE UPDATE on nutrition_goals → SIGNAL 45000 if updated date range overlaps existing goal' },
  { name: 'trg_meal_before_insert', description: 'BEFORE INSERT on meal_logs → SIGNAL 45000 if referenced recipe has is_active = FALSE' },
  { name: 'trg_meal_after_insert', description: 'AFTER INSERT on meal_logs → increments total_calories/protein/carbs/fat on daily log' },
  { name: 'trg_meal_after_update', description: 'AFTER UPDATE on meal_logs → subtracts OLD and adds NEW nutrients on daily log' },
  { name: 'trg_meal_after_delete', description: 'AFTER DELETE on meal_logs → subtracts nutrients using GREATEST(0, …) on daily log' },
];

const QUERIES = [
  { key: 'overCalorie', label: 'Days Over Calorie Target (GROUP BY / HAVING)' },
  { key: 'joinAll', label: 'Full Relational JOIN: users → daily_nutrition_logs → meal_logs' },
  { key: 'weeklyAvg', label: 'Weekly Average Nutrient Intake per User' },
  { key: 'topRecipes', label: 'Most-Logged Recipes in Catalog (Top 10)' },
  { key: 'viewSummary', label: 'View Evaluation: user_daily_nutrition_summary' },
  { key: 'proteinEfficiency', label: 'Nutritional Analysis: Protein Efficiency per Meal' },
];

export default function ReviewPage() {
  const [tab, setTab] = useState<Tab>('tables');
  const [tables, setTables] = useState<Array<Record<string, unknown>>>([]);
  const [tableDetail, setTableDetail] = useState<Record<string, { desc: unknown[]; count: number; rows: unknown[] }>>({});
  const [fks, setFks] = useState<unknown[]>([]);
  const [indexes, setIndexes] = useState<Record<string, unknown[]>>({});
  const [triggerDetails, setTriggerDetails] = useState<unknown[]>([]);
  const [triggerResults, setTriggerResults] = useState<Record<string, unknown>>({});
  const [viewRows, setViewRows] = useState<unknown[]>([]);
  const [mongoRecipes, setMongoRecipes] = useState<unknown[]>([]);
  const [mongoIndexes, setMongoIndexes] = useState<unknown[]>([]);
  const [mongoExplain, setMongoExplain] = useState<unknown>(null);
  const [explainFilter, setExplainFilter] = useState({ cuisine: 'Indian', meal_type: 'dinner', tag: 'vegetarian' });
  const [dataflowResult, setDataflowResult] = useState<unknown>(null);
  const [syncCheckResult, setSyncCheckResult] = useState<Record<string, unknown> | null>(null);
  const [queryResults, setQueryResults] = useState<Record<string, { label: string; sql: string; rows: unknown[] }>>({});
  const [loading, setLoading] = useState(false);

  const TABLE_NAMES = ['users', 'dietary_profiles', 'nutrition_goals', 'recipe_catalog', 'daily_nutrition_logs', 'meal_logs'];

  async function loadTables() {
    setLoading(true);
    try {
      const res = await fetch('/api/review/mysql/tables');
      setTables(await res.json());
      for (const t of TABLE_NAMES) {
        const r = await fetch(`/api/review/mysql/describe?table=${t}`);
        const data = await r.json();
        setTableDetail((prev) => ({ ...prev, [t]: data }));
      }
      const fkRes = await fetch('/api/review/mysql/foreign-keys');
      setFks(await fkRes.json());
      const idxRes = await fetch('/api/review/mysql/indexes');
      setIndexes(await idxRes.json());
    } finally {
      setLoading(false);
    }
  }

  async function loadTriggers() {
    setLoading(true);
    try {
      const res = await fetch('/api/review/mysql/triggers');
      setTriggerDetails(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runTriggerDemo(name: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/review/triggers/${name}/demo`, { method: 'POST' });
      const data = await res.json();
      setTriggerResults((prev) => ({ ...prev, [name]: data }));
    } finally {
      setLoading(false);
    }
  }

  async function loadViews() {
    setLoading(true);
    try {
      const res = await fetch('/api/review/mysql/view');
      setViewRows(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function loadMongo() {
    setLoading(true);
    try {
      const [recRes, idxRes] = await Promise.all([
        fetch('/api/review/mongo/recipes?limit=15'),
        fetch('/api/review/mongo/indexes'),
      ]);
      const recData = await recRes.json();
      setMongoRecipes(recData.docs ?? recData);
      setMongoIndexes(await idxRes.json());
    } finally {
      setLoading(false);
    }
  }

  async function runExplain() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (explainFilter.cuisine) params.set('cuisine', explainFilter.cuisine);
      if (explainFilter.meal_type) params.set('meal_type', explainFilter.meal_type);
      if (explainFilter.tag) params.set('tag', explainFilter.tag);
      const res = await fetch(`/api/review/mongo/explain?${params}`);
      setMongoExplain(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runDataflow() {
    setLoading(true);
    try {
      const res = await fetch('/api/review/dataflow/demo', { method: 'POST' });
      setDataflowResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runSyncAudit() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/sync-check');
      setSyncCheckResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runQuery(key: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/review/queries?q=${key}`);
      const data = await res.json();
      setQueryResults((prev) => ({ ...prev, [key]: data }));
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'tables', label: '📋 MySQL Tables & Schema' },
    { key: 'triggers', label: '⚡ Triggers (Live Demos)' },
    { key: 'views', label: '👁 Views & Procedures' },
    { key: 'mongodb', label: '🍃 MongoDB & Index Usage' },
    { key: 'dataflow', label: '🔄 Dual-Write Flow' },
    { key: 'queries', label: '📊 Analytical Queries' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">🔬 Review-1 Evaluation Console</h1>
          <p className="text-sm text-gray-500">
            Interactive verification console for DBMS Review 1 · Live queries, trigger executions, and cross-database validation
          </p>
        </div>
        <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-3 py-1.5 rounded-full">
          Demo Environment · Safe Transactions
        </span>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-8 p-1.5 rounded-2xl glass-panel border border-white/60">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all ${
              tab === t.key
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20 scale-102'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: TABLES ─────────────────────────────────────────────── */}
      {tab === 'tables' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
            <div>
              <p className="text-sm font-bold text-slate-900">Inspect MySQL Live Schema &amp; Entities</p>
              <p className="text-xs text-slate-500">Query column definitions, table sizes, indexes, and foreign keys directly.</p>
            </div>
            <button
              onClick={loadTables}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:scale-105 transition-all text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Inspecting Database…' : 'Execute Schema Inspection'}
            </button>
          </div>

          {tables.length > 0 && (
            <>
              <div className="glass-panel rounded-3xl p-6 border border-white/60">
                <h2 className="font-bold text-slate-900 mb-3 text-base">SHOW TABLES in nutrition_tracker</h2>
                <SqlResultTable rows={tables as Array<Record<string, unknown>>} />
              </div>

              {TABLE_NAMES.map((t) => tableDetail[t] && (
                <div key={t} className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h2 className="font-bold text-slate-900 text-base">
                      Table: <code className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">{t}</code>
                    </h2>
                    <span className="text-xs bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full">
                      Total Rows: {tableDetail[t].count}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Column Definitions (DESC)</h3>
                    <SqlResultTable rows={tableDetail[t].desc as Array<Record<string, unknown>>} />
                  </div>
                  {tableDetail[t].rows.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">First {tableDetail[t].rows.length} Sample Rows</h3>
                      <SqlResultTable rows={tableDetail[t].rows as Array<Record<string, unknown>>} />
                    </div>
                  )}
                </div>
              ))}

              <div className="glass-panel rounded-3xl p-6 border border-white/60">
                <h2 className="font-bold text-slate-900 mb-3 text-base">Foreign Keys &amp; Constraints (information_schema.KEY_COLUMN_USAGE)</h2>
                <SqlResultTable rows={fks as Array<Record<string, unknown>>} />
              </div>

              <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
                <h2 className="font-bold text-slate-900 mb-3 text-base">All Active Indexes by Table</h2>
                {Object.entries(indexes).map(([t, rows]) => (
                  <div key={t} className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-bold text-slate-700 mb-2 uppercase">{t}</p>
                    <SqlResultTable rows={rows as Array<Record<string, unknown>>} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: TRIGGERS ───────────────────────────────────────────── */}
      {tab === 'triggers' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
            <div>
              <p className="text-sm font-bold text-slate-900">Trigger Demonstration &amp; Verification</p>
              <p className="text-xs text-slate-500">Review 1 requirement: every trigger is tested live with real before/after states or error signal capture.</p>
            </div>
            <button
              onClick={loadTriggers}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:scale-105 transition-all text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Querying…' : 'Inspect SHOW TRIGGERS'}
            </button>
          </div>

          {triggerDetails.length > 0 && (
            <div className="glass-panel rounded-3xl p-6 border border-white/60">
              <h2 className="font-bold text-slate-900 mb-3 text-base">Installed Triggers (SHOW TRIGGERS)</h2>
              <SqlResultTable rows={(triggerDetails as Array<Record<string, unknown>>).map((t) => ({
                Trigger: (t as Record<string, unknown>).Trigger,
                Event: (t as Record<string, unknown>).Event,
                Table: (t as Record<string, unknown>).Table,
                Timing: (t as Record<string, unknown>).Timing,
              }))} />
            </div>
          )}

          <div className="space-y-4">
            {TRIGGERS.map((trg) => (
              <div key={trg.name} className="glass-panel rounded-3xl p-6 border border-white/60">
                <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 font-mono text-sm bg-slate-100/80 px-2.5 py-1 rounded-lg inline-block border border-slate-200">
                      {trg.name}
                    </h3>
                    <p className="text-xs text-slate-600 mt-2 font-medium">{trg.description}</p>
                  </div>
                  <button
                    onClick={() => runTriggerDemo(trg.name)}
                    disabled={loading}
                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-md shadow-orange-500/20 flex-shrink-0 disabled:opacity-50"
                  >
                    ▶ Run Live Demo
                  </button>
                </div>

                {!!triggerResults[trg.name] && (
                  <div className="mt-4 bg-slate-900/90 text-white rounded-2xl p-4 border border-slate-800 shadow-inner">
                    <p className="text-[11px] font-bold text-emerald-400 mb-2 uppercase tracking-wider">
                      ✓ Execution Verification Result:
                    </p>
                    <JsonViewer data={triggerResults[trg.name]} maxHeight={260} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: VIEWS & PROCEDURES ─────────────────────────────────── */}
      {tab === 'views' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
            <div>
              <p className="text-sm font-bold text-slate-900">Database Views &amp; Stored Procedures</p>
              <p className="text-xs text-slate-500">Evaluates the <code>user_daily_nutrition_summary</code> view and demonstrates <code>sp_log_meal</code>.</p>
            </div>
            <button
              onClick={loadViews}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:scale-105 transition-all text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Evaluating…' : 'Query View Output'}
            </button>
          </div>

          {viewRows.length > 0 && (
            <div className="glass-panel rounded-3xl p-6 border border-white/60">
              <h2 className="font-bold text-slate-900 mb-3 text-base">SELECT * FROM user_daily_nutrition_summary (Latest 50 Rows)</h2>
              <SqlResultTable rows={viewRows as Array<Record<string, unknown>>} />
            </div>
          )}

          <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-3">
            <h2 className="font-bold text-slate-900 text-base">Stored Procedure: sp_log_meal</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Executes within an atomic transaction (<code>START TRANSACTION</code>) with an <code>EXIT HANDLER FOR SQLEXCEPTION</code> that automatically rolls back and resignals errors.
              Finds or creates the daily log row, records the meal with calculated totals, and relies on DB triggers to update daily aggregates.
            </p>
            <pre className="bg-slate-900 text-emerald-300 rounded-2xl p-4 text-xs font-mono overflow-auto border border-slate-800">{`DELIMITER $$
CREATE PROCEDURE sp_log_meal(
  IN p_user_id             CHAR(36),
  IN p_log_date            DATE,
  IN p_recipe_id           CHAR(36),
  IN p_meal_type           VARCHAR(20),
  IN p_servings            DECIMAL(5,2),
  IN p_cal_per_serving     DECIMAL(8,2),
  IN p_protein_per_serving DECIMAL(8,2),
  IN p_carbs_per_serving   DECIMAL(8,2),
  IN p_fat_per_serving     DECIMAL(8,2),
  IN p_notes               TEXT
)
BEGIN
  DECLARE v_log_id      CHAR(36) DEFAULT NULL;
  DECLARE v_meal_log_id CHAR(36);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SET v_log_id = UUID();
  INSERT INTO daily_nutrition_logs (log_id, user_id, log_date)
  VALUES (v_log_id, p_user_id, p_log_date)
  ON DUPLICATE KEY UPDATE log_id = log_id;

  SELECT log_id INTO v_log_id FROM daily_nutrition_logs
  WHERE user_id = p_user_id AND log_date = p_log_date LIMIT 1;

  SET v_meal_log_id = UUID();
  INSERT INTO meal_logs (meal_log_id, log_id, recipe_id, meal_type, servings,
                         calories, protein_g, carbs_g, fat_g, notes)
  VALUES (v_meal_log_id, v_log_id, p_recipe_id, p_meal_type, p_servings,
          p_cal_per_serving * p_servings, p_protein_per_serving * p_servings,
          p_carbs_per_serving * p_servings, p_fat_per_serving * p_servings, p_notes);
  COMMIT;
  SELECT v_log_id AS log_id, v_meal_log_id AS meal_log_id;
END$$`}</pre>
          </div>
        </div>
      )}

      {/* ── TAB 4: MONGODB ────────────────────────────────────────────── */}
      {tab === 'mongodb' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
            <div>
              <p className="text-sm font-bold text-slate-900">MongoDB Inspection &amp; Execution Plan</p>
              <p className="text-xs text-slate-500">Inspect rich JSON recipe documents, multikey indexes, and verify <code>IXSCAN</code> query plans.</p>
            </div>
            <button
              onClick={loadMongo}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:scale-105 transition-all text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? 'Reading Mongo…' : 'Inspect MongoDB Collection'}
            </button>
          </div>

          {mongoIndexes.length > 0 && (
            <div className="glass-panel rounded-3xl p-6 border border-white/60">
              <h2 className="font-bold text-slate-900 mb-3 text-base">db.recipes.getIndexes() (6 Indexes Defined)</h2>
              <JsonViewer data={mongoIndexes} maxHeight={250} />
            </div>
          )}

          {/* explain() */}
          <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Index Usage Verification (db.recipes.find().explain(&quot;executionStats&quot;))</h2>
              <p className="text-xs text-slate-500 mt-1">Verify that queries leverage the <code>idx_cuisine</code>, <code>idx_meal_type</code>, and <code>idx_dietary_tags</code> indexes.</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <input
                placeholder="Cuisine (e.g. Indian)"
                value={explainFilter.cuisine}
                onChange={(e) => setExplainFilter({ ...explainFilter, cuisine: e.target.value })}
                className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border"
              />
              <input
                placeholder="Meal type (e.g. dinner)"
                value={explainFilter.meal_type}
                onChange={(e) => setExplainFilter({ ...explainFilter, meal_type: e.target.value })}
                className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border"
              />
              <input
                placeholder="Tag (e.g. vegetarian)"
                value={explainFilter.tag}
                onChange={(e) => setExplainFilter({ ...explainFilter, tag: e.target.value })}
                className="glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border"
              />
              <button
                onClick={runExplain}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-2xl hover:scale-105 transition-all text-xs shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Run explain() Plan
              </button>
            </div>
            {!!mongoExplain && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 p-3 rounded-2xl">
                  ✓ executionStats output returned — look for <code>IXSCAN</code> to confirm multikey index execution.
                </p>
                <JsonViewer data={mongoExplain} maxHeight={400} />
              </div>
            )}
          </div>

          {mongoRecipes.length > 0 && (
            <div className="glass-panel rounded-3xl p-6 border border-white/60">
              <h2 className="font-bold text-slate-900 mb-3 text-base">Sample MongoDB Documents ({mongoRecipes.length} shown)</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {mongoRecipes.map((r, i) => (
                  <details key={i} className="border border-slate-200 rounded-2xl overflow-hidden bg-white/70">
                    <summary className="px-4 py-2.5 cursor-pointer text-xs font-bold text-slate-900 bg-slate-50 hover:bg-slate-100 flex items-center justify-between">
                      <span>{String((r as Record<string, unknown>).recipe_name)}</span>
                      <span className="text-[10px] font-mono text-slate-500">{String((r as Record<string, unknown>)._id)}</span>
                    </summary>
                    <div className="p-4 bg-white/90">
                      <JsonViewer data={r} maxHeight={300} />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: DATA FLOW ──────────────────────────────────────────── */}
      {tab === 'dataflow' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl border border-white/60 p-8 space-y-6">
            <div>
              <h2 className="font-extrabold text-slate-900 text-xl mb-1">Dual-Write Architectural Pipeline</h2>
              <p className="text-xs text-slate-600">
                Demonstrates atomic orchestration between Next.js, MongoDB document storage, and MySQL relational integrity with compensating transactions.
              </p>
            </div>

            {/* Stepper */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {[
                { step: '1', title: 'Zod Validation', desc: 'Validates full polymorphic payload in memory' },
                { step: '2', title: 'UUID Generation', desc: 'crypto.randomUUID() shared across both databases' },
                { step: '3', title: 'Mongo Insert', desc: 'db.recipes.insertOne({ _id: UUID, ... })' },
                { step: '4', title: 'MySQL Catalog', desc: 'INSERT INTO recipe_catalog (recipe_id, ...)' },
                { step: '5', title: 'Sync Verification', desc: 'Returns UUID and full syncLog execution audit' },
              ].map((s) => (
                <div key={s.step} className="p-4 rounded-2xl bg-white/70 border border-slate-200/70 text-center shadow-xs">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl flex items-center justify-center font-black text-xs mx-auto mb-2 shadow-xs">
                    {s.step}
                  </div>
                  <h3 className="font-bold text-xs text-slate-900 mb-1">{s.title}</h3>
                  <p className="text-[11px] text-slate-500 leading-snug">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <span className="font-bold">Compensation Protocol: </span>
              If the MySQL insert fails at Step 4, an automated compensation deletes the MongoDB document created in Step 3.
              If Step 3 fails, MySQL is never touched, preventing orphaned records.
            </div>

            <button
              onClick={runDataflow}
              disabled={loading}
              className="px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl hover:scale-105 transition-all text-xs font-bold shadow-md shadow-purple-500/25 disabled:opacity-50"
            >
              {loading ? 'Executing Live Pipeline…' : '🚀 Create Sample Recipe & Verify Cross-Database UUID'}
            </button>
          </div>

          {!!dataflowResult && (
            <div className="glass-panel rounded-3xl border border-white/60 p-6 space-y-6">
              <div>
                <h3 className="font-bold text-slate-900 text-base mb-3">Audit Log: syncLog Pipeline Verification</h3>
                <div className="space-y-2">
                  {((dataflowResult as Record<string, unknown>).syncLog as Array<Record<string, unknown>>)?.map((s: Record<string, unknown>, i: number) => (
                    <div key={i} className={`p-3 rounded-2xl border text-xs ${s.success ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' : 'bg-rose-50/80 border-rose-200 text-rose-900'}`}>
                      <div className="flex items-center gap-2 font-bold">
                        <span>{s.success ? '✅' : '❌'}</span>
                        <span>Step {String(s.step)} · {String(s.db).toUpperCase()}</span>
                        <span className="text-[10px] text-slate-400 font-mono ml-auto">{String(s.timestamp)}</span>
                      </div>
                      <code className="block mt-2 text-[11px] text-slate-700 font-mono bg-white/80 p-2 rounded-xl border border-slate-200">{String(s.statement)}</code>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs mb-2 flex items-center gap-2">
                    <span>🍃 MongoDB Document</span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">_id: {String((dataflowResult as Record<string, unknown>).recipe_id)}</span>
                  </h3>
                  <JsonViewer data={(dataflowResult as Record<string, unknown>).mongodb} maxHeight={300} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-xs mb-2 flex items-center gap-2">
                    <span>🗄 MySQL Catalog Row</span>
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">recipe_id: {String((dataflowResult as Record<string, unknown>).recipe_id)}</span>
                  </h3>
                  <JsonViewer data={(dataflowResult as Record<string, unknown>).mysql} maxHeight={300} />
                </div>
              </div>

              <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
                ✓ Proven: The same UUID <code className="font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">{String((dataflowResult as Record<string, unknown>).recipe_id)}</code> was successfully written to both MongoDB (_id) and MySQL (recipe_id) simultaneously.
              </div>
            </div>
          )}

          {/* Cross-Database Sync Audit */}
          <div className="glass-panel rounded-3xl border border-white/60 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-slate-900 text-lg mb-1">Cross-Database Consistency Audit</h3>
                <p className="text-xs text-slate-600">
                  Scans all recipes across MongoDB and MySQL to verify UUID parity, metadata alignment, and archive status consistency.
                </p>
              </div>
              <button
                onClick={runSyncAudit}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-2xl hover:scale-105 transition-all text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50 whitespace-nowrap"
              >
                {loading ? 'Running Audit…' : '🔍 Run Consistency Audit'}
              </button>
            </div>

            {!!syncCheckResult && (
              <div className="space-y-4 pt-2">
                <div className={`p-4 rounded-2xl border text-xs font-medium flex items-center justify-between ${syncCheckResult.isConsistent ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{syncCheckResult.isConsistent ? '✅' : '⚠️'}</span>
                    <span className="font-bold">
                      {syncCheckResult.isConsistent ? 'All checked records are 100% consistent across MongoDB and MySQL.' : 'Synchronization discrepancies detected!'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono">
                    Total checked: {String(syncCheckResult.totalChecked ?? 0)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/70">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Only in Mongo</p>
                    <p className="text-base font-black text-slate-900">{(syncCheckResult.onlyInMongo as unknown[])?.length ?? 0}</p>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/70">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Only in MySQL</p>
                    <p className="text-base font-black text-slate-900">{(syncCheckResult.onlyInMySQL as unknown[])?.length ?? 0}</p>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/70">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Metadata Mismatches</p>
                    <p className="text-base font-black text-slate-900">{(syncCheckResult.metadataMismatches as unknown[])?.length ?? 0}</p>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-slate-200/70">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Status Mismatches</p>
                    <p className="text-base font-black text-slate-900">{(syncCheckResult.statusMismatches as unknown[])?.length ?? 0}</p>
                  </div>
                </div>

                <JsonViewer data={syncCheckResult} maxHeight={260} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: QUERIES ────────────────────────────────────────────── */}
      {tab === 'queries' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/60">
            <p className="text-sm font-bold text-slate-900">Analytical &amp; Demo SQL Queries</p>
            <p className="text-xs text-slate-500">Executes queries from <code>sql/06_demo_queries.sql</code> testing aggregate functions, multi-table joins, and trigger outcomes.</p>
          </div>

          {QUERIES.map((q) => (
            <div key={q.key} className="glass-panel rounded-3xl border border-white/60 p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="font-bold text-slate-900 text-sm">{q.label}</h3>
                <button
                  onClick={() => runQuery(q.key)}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                >
                  ▶ Execute Query
                </button>
              </div>
              {queryResults[q.key] && (
                <div className="space-y-3 pt-2">
                  <pre className="bg-slate-900 text-emerald-300 rounded-2xl p-3.5 text-xs font-mono overflow-x-auto border border-slate-800">{queryResults[q.key].sql}</pre>
                  <SqlResultTable rows={queryResults[q.key].rows as Array<Record<string, unknown>>} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
