import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const sp = req.nextUrl.searchParams;
    // Build filter from query params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};
    if (sp.get('cuisine'))   filter.cuisine   = sp.get('cuisine');
    if (sp.get('meal_type')) filter.meal_type  = sp.get('meal_type');
    if (sp.get('tag'))       filter.dietary_tags = sp.get('tag');
    
    const explained = await db.collection('recipes')
      .find(filter)
      .explain('executionStats');
    return NextResponse.json(explained);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
