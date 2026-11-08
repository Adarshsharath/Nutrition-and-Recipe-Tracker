import { NextRequest, NextResponse } from 'next/server';
import { syncCheck } from '@/lib/recipes-service';
import { requireReviewAccess, sanitizeError } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authCheck = await requireReviewAccess(req);
  if (!authCheck.authorized) {
    return authCheck.response;
  }

  try {
    const result = await syncCheck();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Failed to execute cross-database synchronization check',
        details: sanitizeError(err, 'An error occurred during sync check'),
      },
      { status: 500 }
    );
  }
}
