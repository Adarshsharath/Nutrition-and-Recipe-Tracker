import { NextResponse } from 'next/server';
import { syncCheck } from '@/lib/recipes-service';

export async function GET() {
  try {
    const result = await syncCheck();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
