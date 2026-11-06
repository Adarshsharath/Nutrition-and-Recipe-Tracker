import Link from 'next/link';

interface Recipe {
  _id: string;
  recipe_name: string;
  cuisine?: string;
  meal_type?: string;
  dietary_tags?: string[];
  allergens?: string[];
  nutrition_per_serving?: { calories: number; protein_g: number; carbs_g?: number; fat_g?: number };
  preparation?: { prep_minutes: number; cook_minutes: number };
}

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const tagColors: Record<string, string> = {
    vegetarian:     'bg-emerald-500/15 text-emerald-800 border-emerald-300/50',
    vegan:          'bg-teal-500/15 text-teal-800 border-teal-300/50',
    'non_vegetarian':'bg-rose-500/15 text-rose-800 border-rose-300/50',
    eggetarian:     'bg-amber-500/15 text-amber-800 border-amber-300/50',
    pescatarian:    'bg-sky-500/15 text-sky-800 border-sky-300/50',
    'gluten-free':  'bg-purple-500/15 text-purple-800 border-purple-300/50',
    'high-protein': 'bg-indigo-500/15 text-indigo-800 border-indigo-300/50',
    'high-fiber':   'bg-orange-500/15 text-orange-800 border-orange-300/50',
    'low-calorie':  'bg-blue-500/15 text-blue-800 border-blue-300/50',
  };

  return (
    <div className="glass-panel glass-panel-hover rounded-3xl p-5 flex flex-col justify-between h-full group">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full inline-block mb-1.5">
              {recipe.cuisine || 'Global'}
            </span>
            <h3 className="font-extrabold text-slate-900 text-base leading-snug group-hover:text-emerald-700 transition-colors">
              {recipe.recipe_name}
            </h3>
          </div>
          {recipe.meal_type && (
            <span className="text-[11px] font-semibold text-slate-500 capitalize bg-slate-100/80 px-2 py-0.5 rounded-lg border border-slate-200/60 whitespace-nowrap">
              {recipe.meal_type}
            </span>
          )}
        </div>

        {/* Dietary Tags */}
        {recipe.dietary_tags && recipe.dietary_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {recipe.dietary_tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  tagColors[t] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Allergens warning */}
        {recipe.allergens && recipe.allergens.length > 0 && (
          <p className="text-[10px] text-rose-600 font-semibold mb-3 flex items-center gap-1">
            <span>⚠ Contains:</span>
            <span>{recipe.allergens.join(', ')}</span>
          </p>
        )}
      </div>

      <div>
        {/* Nutrition stats pill */}
        {recipe.nutrition_per_serving && (
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/50 text-xs mb-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Calories</span>
              <span className="font-bold text-slate-900">{recipe.nutrition_per_serving.calories} kcal</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Protein</span>
              <span className="font-bold text-emerald-700">{recipe.nutrition_per_serving.protein_g}g</span>
            </div>
          </div>
        )}

        {/* Action Link */}
        <Link
          href={`/recipes/${recipe._id}`}
          className="w-full block text-center py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm"
        >
          View Recipe Details →
        </Link>
      </div>
    </div>
  );
}
