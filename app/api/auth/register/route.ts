import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/mysql';
import { signToken } from '@/lib/auth';
import { RegisterSchema } from '@/lib/validators';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = RegisterSchema.parse(body);

    // Check duplicate email
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT user_id FROM users WHERE email = ?',
      [data.email]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(data.password, 12);
    const user_id = crypto.randomUUID();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO users (user_id, full_name, email, password_hash, date_of_birth, height_cm, weight_kg, activity_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        data.full_name,
        data.email,
        password_hash,
        data.date_of_birth ?? null,
        data.height_cm ?? null,
        data.weight_kg ?? null,
        data.activity_level,
      ]
    );

    // The trigger trg_users_after_insert auto-creates dietary_profiles

    const token = await signToken({ userId: user_id, email: data.email });
    const response = NextResponse.json(
      { user_id, email: data.email, full_name: data.full_name },
      { status: 201 }
    );
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
    return NextResponse.json({ error: 'Registration failed', details: String(err) }, { status: 500 });
  }
}
