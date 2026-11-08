import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Automatically load .env.local for standalone scripts (e.g. test & seed scripts)
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        val = val.replace(/^['"](.*)['"]$/, '$1').trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // ignore
}

export interface AuthPayload extends JWTPayload {
  userId: string;
  email:  string;
}

let hasWarnedDevSecret = false;
const DEV_FALLBACK_SECRET = 'dev-insecure-secret-key-32chars-min-change-in-production!';

/**
 * Retrieves the cryptographic secret key for signing and verifying JWTs.
 * Enforces production security: in production, JWT_SECRET MUST be set (min 32 chars).
 * In development, provides a fallback while emitting a warning.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret || secret.trim() === '') {
    if (isProduction) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing in production mode. Refusing to sign or verify tokens.'
      );
    }
    if (!hasWarnedDevSecret) {
      console.warn(
        '[Auth] Warning: JWT_SECRET is not configured in environment. Using insecure development fallback secret. Set JWT_SECRET in .env.local.'
      );
      hasWarnedDevSecret = true;
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }

  if (isProduction && secret.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET in production mode must be at least 32 characters long for HMAC-SHA256 security.'
    );
  }

  return new TextEncoder().encode(secret);
}

export async function signToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthPayload> {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);
  return payload as AuthPayload;
}

/**
 * Extracts and verifies the authenticated user from either:
 * 1. Authorization: Bearer <token> header
 * 2. NextRequest cookies
 * 3. Next.js server cookie store (cookies())
 */
export async function authenticateRequest(req?: Request | NextRequest): Promise<AuthPayload | null> {
  // 1. Check Authorization Bearer header
  if (req) {
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          return await verifyToken(token);
        } catch {
          return null;
        }
      }
    }

    // 2. Check NextRequest cookie helper if available
    if ('cookies' in req && typeof (req as NextRequest).cookies?.get === 'function') {
      const cookieToken = (req as NextRequest).cookies.get('auth_token')?.value;
      if (cookieToken) {
        try {
          return await verifyToken(cookieToken);
        } catch {
          return null;
        }
      }
    }

    // 3. Check raw Cookie header
    const rawCookie = req.headers.get('cookie');
    if (rawCookie) {
      const match = rawCookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
      if (match && match[1]) {
        try {
          return await verifyToken(decodeURIComponent(match[1]));
        } catch {
          return null;
        }
      }
    }
  }

  // 4. Fallback to Next.js cookies() helper
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (token) {
      return await verifyToken(token);
    }
  } catch {
    // Outside request context or cookies() threw
  }

  return null;
}

/**
 * Returns the currently authenticated user from cookies (backwards compatible).
 */
export async function getAuthUser(req?: Request | NextRequest): Promise<AuthPayload | null> {
  return authenticateRequest(req);
}

/**
 * Requires authentication, throwing an Error if unauthenticated (backwards compatible).
 */
export async function requireAuth(req?: Request | NextRequest): Promise<AuthPayload> {
  const user = await authenticateRequest(req);
  if (!user) throw new Error('Unauthorized');
  return user;
}

/**
 * Checks if Evaluation Mode is active.
 * STRICT CONDITION: Active ONLY when NODE_ENV is development (or unset in local scripts)
 * AND EVALUATION_MODE === 'true'.
 * NEVER active in production mode, regardless of EVALUATION_MODE value.
 */
export function isEvaluationModeActive(): boolean {
  const env = process.env.NODE_ENV || 'development';
  return (
    env === 'development' &&
    process.env.EVALUATION_MODE === 'true'
  );
}

/**
 * Enforces security policy for Review Console and Admin inspection/demo APIs:
 * - If in local development evaluation mode: grants access.
 * - Otherwise (production or evaluation mode disabled): requires a valid authenticated JWT session.
 *
 * Returns:
 *   { authorized: true, user?: AuthPayload } if permitted
 *   { authorized: false, response: NextResponse } with a 401 response if denied
 */
export async function requireReviewAccess(
  req?: Request | NextRequest
): Promise<
  | { authorized: true; user?: AuthPayload }
  | { authorized: false; response: NextResponse }
> {
  if (isEvaluationModeActive()) {
    // Permitted anonymously for local viva demonstration
    const user = await authenticateRequest(req);
    return { authorized: true, user: user ?? undefined };
  }

  // Authentication mandatory in production or when evaluation mode is off
  const user = await authenticateRequest(req);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized',
          message:
            process.env.NODE_ENV === 'production'
              ? 'Access denied: Valid authentication required in production environment.'
              : 'Access denied: Evaluation mode is disabled (set EVALUATION_MODE=true in .env.local for local faculty demonstration) or log in with valid credentials.',
        },
        { status: 401 }
      ),
    };
  }

  return { authorized: true, user };
}

/**
 * Sanitizes error messages to prevent leakage of database credentials,
 * connection URIs, sensitive tokens, or internal stack traces.
 */
export function sanitizeError(err: unknown, fallbackMessage = 'Internal server error'): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawMessage = err instanceof Error ? err.message : String(err);

  // Strip sensitive URI patterns, passwords, tokens
  const sanitized = rawMessage
    .replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2')
    .replace(/(mysql:\/\/[^:]+:)[^@]+(@)/gi, '$1***$2')
    .replace(/(password[:=\s]+)(?:'[^']*'|"[^"]*"|\S+)/gi, '$1***')
    .replace(/(secret[:=\s]+)(?:'[^']*'|"[^"]*"|\S+)/gi, '$1***')
    .replace(/(token[:=\s]+)(?:'[^']*'|"[^"]*"|\S+)/gi, '$1***');

  if (isProduction) {
    // In production, keep safe high-level messages or return generic fallback
    if (
      sanitized.includes('ECONNREFUSED') ||
      sanitized.includes('ETIMEDOUT') ||
      sanitized.includes('Access denied')
    ) {
      return 'Database connection or operation failed.';
    }
    // Return sanitized message if safe, or fallback
    return sanitized.length > 0 && !sanitized.includes('at ') ? sanitized : fallbackMessage;
  }

  return sanitized;
}
