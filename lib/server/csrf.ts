/**
 * csrf.ts | double submit cookie, hardened with a server side copy.
 *
 * A random token is issued in a readable cookie and mirrored into the session.
 * Every state changing request must echo it in the X-CSRF-Token header. The two
 * are compared in constant time, and both must match the value held in the
 * session, so a token cannot simply be planted in the cookie by an attacker who
 * can write cookies but cannot read the session.
 *
 * The Origin header is checked as well. SameSite=Lax already blocks the
 * cross site form post, and this closes the same door from the other side.
 */

import 'server-only';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { config } from '../config';
import { forbidden } from '../errors';
import { saveSession, type Session } from './session';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function newToken(): string {
  return randomBytes(32).toString('base64url');
}

function sameToken(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

const cookieOptions = () =>
  ({
    // The browser script has to read it to echo it back, so this one is not
    // httpOnly. It carries no authority on its own.
    httpOnly: false,
    sameSite: 'lax' as const,
    secure: config.isProd,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

/**
 * Issues a token when there is not one and makes sure the cookie matches the
 * session. Returns the token so a page can hand it to the client.
 *
 * Safe to call from a route handler or a server action. A server component cannot
 * write a cookie, which is why GET /api/csrf exists: the browser asks for the token
 * once, and lib/client/api.ts asks again if the cookie is ever refused.
 */
export async function issueCsrfToken(session: Session): Promise<string> {
  if (!session.data.csrfToken) session.data.csrfToken = newToken();
  const token = session.data.csrfToken;
  const jar = await cookies();
  if (jar.get(CSRF_COOKIE)?.value !== token) {
    jar.set(CSRF_COOKIE, token, cookieOptions());
  }
  return token;
}

/** Rotates the token. Called on login and on logout to prevent fixation. */
export async function rotateCsrfToken(session: Session): Promise<string> {
  session.data.csrfToken = newToken();
  await saveSession(session);
  const jar = await cookies();
  jar.set(CSRF_COOKIE, session.data.csrfToken, cookieOptions());
  return session.data.csrfToken;
}

/**
 * Throws when a state changing request cannot be verified.
 *
 * @param request the incoming request, for the method, headers and origin
 * @param session the session holding the expected token, or null
 */
export async function assertCsrf(request: Request, session: Session | null): Promise<void> {
  if (SAFE_METHODS.has(request.method)) return;

  // The Origin check. A same origin request either omits Origin or sends ours.
  const origin = request.headers.get('origin');
  if (origin) {
    let ok = false;
    try {
      const sent = new URL(origin);
      const host = request.headers.get('host');
      ok = sent.host === host || origin === config.publicOrigin;
    } catch {
      ok = false;
    }
    if (!ok) {
      throw forbidden('That request came from another site, so it was refused.');
    }
  }

  const expected = session?.data.csrfToken;
  const sent = request.headers.get(CSRF_HEADER) ?? '';
  const jar = await cookies();
  const cookie = jar.get(CSRF_COOKIE)?.value ?? '';

  if (!expected || !sameToken(sent, expected) || !sameToken(cookie, expected)) {
    throw forbidden('That request could not be verified. Reload the page and try again.');
  }
}
