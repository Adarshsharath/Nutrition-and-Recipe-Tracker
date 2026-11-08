import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { requireReviewAccess, sanitizeError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authCheck = await requireReviewAccess(req);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const db = await getDb();
    const indexes = await db.collection('recipes').indexes();
    return NextResponse.json(indexes);
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to fetch MongoDB index definitions') },
      { status: 500 }
    );
  }
}
