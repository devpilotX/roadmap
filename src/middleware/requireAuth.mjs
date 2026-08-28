/**
 * Authentication guards.
 *
 * requireAuth protects every /api route except the auth routes.
 * requirePage redirects an unauthenticated HTML request to /login.
 */

import { unauthorised } from '../lib/errors.mjs';
import { one } from '../db/pool.mjs';

/** Loads the signed in user onto req.user, or leaves it null. Never throws. */
export async function loadUser(req, _res, next) {
  req.user = null;
  const id = req.session?.userId;
  if (!id) return next();
  try {
    const user = await one(
      'SELECT id, email, display_name, is_active, created_at, last_login_at FROM users WHERE id = ? AND is_active = 1',
      [id]
    );
    if (!user) {
      // The account was removed or deactivated while the session was alive.
      req.session.destroy(() => {});
      return next();
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function requireAuth(req, _res, next) {
  if (req.user) return next();
  return next(unauthorised('You need to sign in to do that.'));
}

export function requirePage(req, res, next) {
  if (req.user) return next();
  const target = req.originalUrl && req.originalUrl !== '/' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
  return res.redirect(302, `/login${target}`);
}

/** Sends an already signed in visitor away from /login and /signup. */
export function requireAnon(req, res, next) {
  if (req.user) return res.redirect(302, '/');
  return next();
}
