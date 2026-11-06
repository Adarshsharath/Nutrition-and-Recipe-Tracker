import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1);
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10);
    const skip  = (page - 1) * limit;
    const docs = await db.collection('recipes').find({}).skip(skip).limit(limit).toArray();
    const total = await db.collection('recipes').countDocuments();
    return NextResponse.json({ docs, total, page, limit });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
