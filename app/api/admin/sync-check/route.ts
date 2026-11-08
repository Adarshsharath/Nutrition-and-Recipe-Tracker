import { NextResponse } from 'next/server';
import { syncCheck } from '@/lib/recipes-service';

export async function GET() {
  try {
    const result = await syncCheck();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to execute cross-database synchronization check', details: (err as Error).message },
      { status: 500 }
    );
  }
}
