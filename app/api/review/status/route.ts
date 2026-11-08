import { NextRequest, NextResponse } from 'next/server';
import { isEvaluationModeActive, authenticateRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const isEval = isEvaluationModeActive();
  const user = await authenticateRequest(req);

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    evaluationModeEnv: process.env.EVALUATION_MODE === 'true',
    evaluationModeActive: isEval,
    authenticated: !!user,
    user: user ? { userId: user.userId, email: user.email } : null,
  });
}

