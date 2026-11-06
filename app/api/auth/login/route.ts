import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/mysql';
import { signToken } from '@/lib/auth';
import { LoginSchema } from '@/lib/validators';
import type { RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = LoginSchema.parse(body);

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id, full_name, email, password_hash FROM users WHERE email = ?',
      [data.email]
    );
    const user = rows[0] as { user_id: string; full_name: string; email: string; password_hash: string } | undefined;
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signToken({ userId: user.user_id, email: user.email });
    const response = NextResponse.json({ user_id: user.user_id, email: user.email, full_name: user.full_name });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return response;
  } catch (err: unknown) {
    const e = err as Error & { issues?: unknown };
    if (e.issues) return NextResponse.json({ error: 'Validation error', details: e.issues }, { status: 400 });
    return NextResponse.json({ error: 'Login failed', details: String(err) }, { status: 500 });
  }
}
