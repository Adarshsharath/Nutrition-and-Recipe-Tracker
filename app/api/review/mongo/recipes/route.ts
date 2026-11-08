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
    const page  = Number(req.nextUrl.searchParams.get('page')  ?? 1);
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 10);
    const skip  = (page - 1) * limit;
    const docs = await db.collection('recipes').find({}).skip(skip).limit(limit).toArray();
    const total = await db.collection('recipes').countDocuments();
    return NextResponse.json({ docs, total, page, limit });
  } catch (err) {
    return NextResponse.json(
      { error: sanitizeError(err, 'Failed to fetch MongoDB recipes') },
      { status: 500 }
    );
  }
}
