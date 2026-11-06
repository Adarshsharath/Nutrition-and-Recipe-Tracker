'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Ingredient { name: string; quantity: number; unit: string }
interface Instruction { step: number; text: string }
interface ExtraField { key: string; value: string }

export default function NewRecipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [mealType, setMealType] = useState('dinner');
  const [dietaryTags, setDietaryTags] = useState<string[]>(['vegetarian']);
  const [allergens, setAllergens] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: 100, unit: 'g' }]);
  const [instructions, setInstructions] = useState<Instruction[]>([{ step: 1, text: '' }]);
  const [nutrition, setNutrition] = useState({ calories: 350, protein_g: 15, carbs_g: 45, fat_g: 10, fiber_g: 5, sodium_mg: 300 });
  const [prepMin, setPrepMin] = useState(15);
  const [cookMin, setCookMin] = useState(25);
  const [extras, setExtras] = useState<ExtraField[]>([]);

  const availTags = ['vegetarian', 'vegan', 'eggetarian', 'pescatarian', 'non_vegetarian', 'gluten-free', 'high-protein', 'high-fiber', 'low-calorie'];

  function toggleTag(t: string) {
    setDietaryTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function addIngredient() { setIngredients([...ingredients, { name: '', quantity: 100, unit: 'g' }]); }
  function removeIngredient(i: number) { setIngredients(ingredients.filter((_, idx) => idx !== i)); }
  function updateIngredient(i: number, field: keyof Ingredient, v: string | number) {
    setIngredients(ingredients.map((ing, idx) => idx === i ? { ...ing, [field]: v } : ing));
  }

  function addInstruction() { setInstructions([...instructions, { step: instructions.length + 1, text: '' }]); }
  function removeInstruction(i: number) {
    setInstructions(instructions.filter((_, idx) => idx !== i).map((ins, idx) => ({ ...ins, step: idx + 1 })));
  }
  function updateInstruction(i: number, text: string) {
    setInstructions(instructions.map((ins, idx) => idx === i ? { ...ins, text } : ins));
  }

  function addExtra() { setExtras([...extras, { key: '', value: '' }]); }
  function removeExtra(i: number) { setExtras(extras.filter((_, idx) => idx !== i)); }
  function updateExtra(i: number, field: 'key' | 'value', v: string) {
    setExtras(extras.map((e, idx) => idx === i ? { ...e, [field]: v } : e));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const extraFields: Record<string, string> = {};
    extras.forEach(({ key, value }) => { if (key.trim()) extraFields[key.trim()] = value; });

    const body = {
      recipe_name: name,
      description,
      cuisine,
      meal_type: mealType,
      dietary_tags: dietaryTags,
      allergens: allergens.split(',').map((a) => a.trim()).filter(Boolean),
      ingredients,
      instructions,
      nutrition_per_serving: nutrition,
      preparation: { prep_minutes: prepMin, cook_minutes: cookMin },
      ...extraFields,
    };

    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (res.ok) {
      const { recipe_id } = await res.json();
      router.push(`/recipes/${recipe_id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? 'Failed to create recipe');
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-white/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block px-3 py-0.5 text-xs font-semibold rounded-full bg-emerald-100/80 text-emerald-800 border border-emerald-200">
              Cross-DB Dual-Write Pattern
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500">Atomic UUID Parity</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            ➕ Create New Recipe Document
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Writes to MySQL `recipe_catalog` and MongoDB `recipes` atomically with compensation rollback.
          </p>
        </div>

        <Link
          href="/recipes"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/80 hover:bg-white text-slate-700 font-medium text-sm border border-slate-200 shadow-sm transition-all hover:scale-105"
        >
          ← Cancel
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <span className="font-bold">Dual-Write Error: </span>{error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <span>🥗</span> Basic Recipe Metadata
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Recipe Title *
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Avocado Chickpea Salad"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Cuisine
              </label>
              <input
                type="text"
                placeholder="e.g. Mediterranean, Indian, Mexican"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Meal Slot
              </label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border capitalize"
              >
                {['breakfast', 'lunch', 'snack', 'dinner', 'other'].map((t) => (
                  <option key={t} value={t} className="capitalize">{t}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Summary Description
              </label>
              <textarea
                rows={2}
                placeholder="Brief summary of flavour profile and nutritional balance..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full glass-input rounded-2xl px-4 py-2 text-sm text-slate-900 border placeholder:text-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Dietary Tags & Allergens */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <span>🏷️</span> Dietary Tags & Allergens
          </h2>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2">
              Dietary Tags (MongoDB Multikey Index)
            </label>
            <div className="flex flex-wrap gap-2">
              {availTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    dietaryTags.includes(tag)
                      ? 'bg-emerald-600 text-white shadow-sm scale-105'
                      : 'bg-white/80 hover:bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Allergens (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. dairy, peanuts, soy"
              value={allergens}
              onChange={(e) => setAllergens(e.target.value)}
              className="w-full glass-input rounded-2xl px-4 py-2.5 text-sm text-slate-900 border placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Nutrition Per Serving */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <span>📊</span> Nutrition Per Serving
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: 'calories', label: 'Calories', unit: 'kcal' },
              { key: 'protein_g', label: 'Protein', unit: 'g' },
              { key: 'carbs_g', label: 'Carbs', unit: 'g' },
              { key: 'fat_g', label: 'Fat', unit: 'g' },
              { key: 'fiber_g', label: 'Fiber', unit: 'g' },
              { key: 'sodium_mg', label: 'Sodium', unit: 'mg' },
            ].map(({ key, label, unit }) => (
              <div key={key}>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label} ({unit})</label>
                <input
                  type="number"
                  min="0"
                  value={(nutrition as Record<string, number>)[key]}
                  onChange={(e) => setNutrition({ ...nutrition, [key]: Number(e.target.value) })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm font-bold text-slate-900 border"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">⏱️ Prep Time (minutes)</label>
              <input
                type="number"
                min="0"
                value={prepMin}
                onChange={(e) => setPrepMin(Number(e.target.value))}
                className="w-full glass-input rounded-2xl px-3 py-2 text-sm text-slate-900 border"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">🍳 Cook Time (minutes)</label>
              <input
                type="number"
                min="0"
                value={cookMin}
                onChange={(e) => setCookMin(Number(e.target.value))}
                className="w-full glass-input rounded-2xl px-3 py-2 text-sm text-slate-900 border"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Ingredients */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>🛒</span> Ingredients ({ingredients.length})
            </h2>
            <button
              type="button"
              onClick={addIngredient}
              className="px-3 py-1 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
            >
              + Add Ingredient
            </button>
          </div>

          <div className="space-y-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  placeholder="Ingredient name (e.g. Rolled oats)"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-slate-900 border"
                />
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(i, 'quantity', Number(e.target.value))}
                  className="w-20 glass-input rounded-xl px-3 py-2 text-sm text-slate-900 border"
                />
                <input
                  placeholder="unit"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                  className="w-20 glass-input rounded-xl px-3 py-2 text-sm text-slate-900 border"
                />
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIngredient(i)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Instructions */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>👨‍🍳</span> Step-by-Step Instructions ({instructions.length})
            </h2>
            <button
              type="button"
              onClick={addInstruction}
              className="px-3 py-1 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
            >
              + Add Step
            </button>
          </div>

          <div className="space-y-2">
            {instructions.map((ins, i) => (
              <div key={i} className="flex gap-3 items-center">
                <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {ins.step}
                </span>
                <input
                  placeholder={`Step ${ins.step} instructions...`}
                  value={ins.text}
                  onChange={(e) => updateInstruction(i, e.target.value)}
                  className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-slate-900 border"
                />
                {instructions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeInstruction(i)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic Extra MongoDB Fields */}
        <div className="glass-panel rounded-3xl p-6 border border-white/60 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>📑</span> Flexible Document Fields (MongoDB Only)
              </h2>
              <p className="text-xs text-slate-500">Demonstrates schema flexibility without requiring MySQL DDL migrations</p>
            </div>
            <button
              type="button"
              onClick={addExtra}
              className="px-3 py-1 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors"
            >
              + Add Custom Field
            </button>
          </div>

          {extras.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No custom fields added yet (e.g. `equipment`, `chef_notes`, `spice_level`).</p>
          ) : (
            <div className="space-y-2">
              {extras.map((ex, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    placeholder="Field key (e.g. equipment)"
                    value={ex.key}
                    onChange={(e) => updateExtra(i, 'key', e.target.value)}
                    className="w-1/3 glass-input rounded-xl px-3 py-2 text-sm text-slate-900 border"
                  />
                  <input
                    placeholder="Field value (e.g. Air Fryer, Blender)"
                    value={ex.value}
                    onChange={(e) => updateExtra(i, 'value', e.target.value)}
                    className="flex-1 glass-input rounded-xl px-3 py-2 text-sm text-slate-900 border"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtra(i)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
        >
          {loading ? 'Executing Dual-Write (MySQL & MongoDB)...' : '🚀 Publish Recipe (Atomic Dual-Write)'}
        </button>
      </form>
    </div>
  );
}
