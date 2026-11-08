import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { RecipeUpdateSchema } from '@/lib/validators';
import { getRecipe, updateRecipe, archiveRecipe } from '@/lib/recipes-service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const recipe = await getRecipe(id);
    if (!recipe) {
      return NextResponse.json({ error: `Recipe ${id} not found` }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to retrieve recipe', details: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const data = RecipeUpdateSchema.parse(body);
    const { syncLog } = await updateRecipe(id, data as Record<string, unknown>);
    return NextResponse.json({ success: true, syncLog });
  } catch (err) {
    if (String(err).includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const e = err as Error & { issues?: unknown; statusCode?: number; syncLog?: unknown };
    if (e.issues) {
      return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    }
    if (e.statusCode === 404 || e.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: e.message || 'Failed to update recipe', syncLog: e.syncLog },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const { syncLog } = await archiveRecipe(id);
    return NextResponse.json({ success: true, syncLog });
  } catch (err) {
    if (String(err).includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const e = err as Error & { statusCode?: number; syncLog?: unknown };
    if (e.statusCode === 404 || e.message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: e.message || 'Failed to archive recipe', syncLog: e.syncLog },
      { status: 500 }
    );
  }
}
