/**
 * auth.ts | who is signed in.
 *
 * `currentUser` is safe in a server component: it only reads. `requireUser`
 * throws a 401 AppError, which the route wrapper turns into the standard
 * envelope. `requirePageUser` redirects to /login instead, which is what a
 * browser asking for HTML should get.
 */

import 'server-only';
import { redirect } from 'next/navigation';
import { one } from '../db/pool';
import { unauthorised } from '../errors';
import { readSession, type Session } from './session';

export interface CurrentUser {
  id: number;
  email: string;
  display_name: string;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

export interface AuthState {
  user: CurrentUser | null;
  session: Session | null;
}

/**
 * Loads the signed in user from the session. Never throws.
 *
 * A session whose user has been removed or deactivated resolves to null. The
 * row is not destroyed here, because a server component cannot write cookies;
 * the next write path will replace it.
 */
export async function auth(): Promise<AuthState> {
  const session = await readSession();
  const id = session?.data.userId;
  if (!session || !id) return { user: null, session };
  try {
    const user = await one<CurrentUser & import('../db/pool').Row>(
      'SELECT id, email, display_name, is_active, created_at, last_login_at FROM users WHERE id = ? AND is_active = 1',
      [Number(id)]
    );
    return { user: user ? (user as CurrentUser) : null, session };
  } catch {
    // The database is unreachable. Treat it as signed out rather than crashing
    // every page; /healthz is the place that reports why.
    return { user: null, session };
  }
}

/** The signed in user, or null. */
export async function currentUser(): Promise<CurrentUser | null> {
  return (await auth()).user;
}

/** The signed in user, or a 401 for the API. */
export async function requireUser(): Promise<{ user: CurrentUser; session: Session }> {
  const { user, session } = await auth();
  if (!user || !session) throw unauthorised('You need to sign in to do that.');
  return { user, session };
}

/**
 * The signed in user for a page, or a redirect to /login carrying the path so
 * signing in returns them to where they were going.
 */
export async function requirePageUser(nextPath?: string): Promise<CurrentUser> {
  const { user } = await auth();
  if (user) return user;
  const target = nextPath && nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : '';
  redirect(`/login${target}`);
}

/** Sends an already signed in visitor away from /login and /signup. */
export async function requireAnon(): Promise<void> {
  const { user } = await auth();
  if (user) redirect('/');
}
