import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { RecipeSchema } from '@/lib/validators';
import { createRecipe, searchRecipes } from '@/lib/recipes-service';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const filter = {
      q:              sp.get('q')              ?? undefined,
      cuisine:        sp.get('cuisine')        ?? undefined,
      meal_type:      sp.get('meal_type')      ?? undefined,
      tag:            sp.get('tag')            ?? undefined,
      excludeAllergen: sp.get('excludeAllergen') ?? undefined,
      minCal:         sp.has('minCal') ? Number(sp.get('minCal')) : undefined,
      maxCal:         sp.has('maxCal') ? Number(sp.get('maxCal')) : undefined,
      page:           sp.has('page')  ? Number(sp.get('page'))  : 1,
    };
    const recipes = await searchRecipes(filter);
    return NextResponse.json(recipes);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const data = RecipeSchema.parse(body);
    const { recipe_id, syncLog } = await createRecipe(data as Parameters<typeof createRecipe>[0]);
    return NextResponse.json({ recipe_id, syncLog }, { status: 201 });
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const e = err as Error & { issues?: unknown };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
