import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

export async function GET() {
  try {
    const db = await getDb();
    const indexes = await db.collection('recipes').indexes();
    return NextResponse.json(indexes);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
