import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getRecommendations } from '@/lib/recommend';
import { RecommendQuerySchema } from '@/lib/validators';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const sp = req.nextUrl.searchParams;
    const params = RecommendQuerySchema.parse({
      meal_type: sp.get('meal_type') ?? undefined,
      date:      sp.get('date')      ?? undefined,
    });
    const results = await getRecommendations(auth.userId, params);
    return NextResponse.json(results);
  } catch (err) {
    if (String(err).includes('Unauthorized')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
