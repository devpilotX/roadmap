/**
 * signup.mjs | whether the front door is open.
 *
 * The Roadmap Tracker is one person's tracker. `requireAnon` only keeps a signed
 * in visitor away from /signup; it does nothing about a stranger. Deployed to the
 * internet with nothing else in front of it, anybody who found the URL could
 * register an account on the server and start using it.
 *
 * So the rule is:
 *
 *   ALLOW_SIGNUP unset   signup is open only while there are no users at all, so
 *                        the first run creates the account and the door then
 *                        closes by itself. This is the default.
 *   ALLOW_SIGNUP=true    forced open, for recreating a lost account.
 *   ALLOW_SIGNUP=false   forced shut, even on an empty database.
 *
 * The decision is a pure function of those two facts, which is why `decide` takes
 * them as arguments rather than reading them. Everything that could go wrong here
 * is a policy mistake, and a policy you cannot test without setting environment
 * variables is a policy nobody tests.
 */

import { scalar } from '../db/pool.mjs';
import { config } from '../config.mjs';

/**
 * The whole policy, as a pure function.
 *
 * @param {true|false|'auto'} allowSignup
 * @param {number|null} userCount  null means the count could not be read
 * @returns {{ open: boolean, mode: string, reason: string }}
 */
export function decide(allowSignup, userCount) {
  if (allowSignup === true) {
    return { open: true, mode: 'forced-open', reason: 'ALLOW_SIGNUP is set to true on this server.' };
  }
  if (allowSignup === false) {
    return { open: false, mode: 'forced-shut', reason: 'Account creation is switched off on this server.' };
  }
  // Auto. A count that could not be read is treated as "an account exists",
  // because failing closed is the only safe direction for a door.
  if (userCount === null) {
    return {
      open: false,
      mode: 'unknown-fails-closed',
      reason: 'Account creation is unavailable at the moment. Try signing in.',
    };
  }
  if (userCount === 0) {
    return {
      open: true,
      mode: 'first-run',
      reason: 'There is no account on this tracker yet, so the first one can be created.',
    };
  }
  return {
    open: false,
    mode: 'closed-after-first',
    reason:
      'This tracker already has its account. Account creation closes after the first one, ' +
      'because it is built for one person. Sign in instead.',
  };
}

/* --------------------------------------------------------------- the reader */

// Signup is not a hot path, but /login renders on every failed attempt, so the
// count is cached for a minute rather than read every time.
let cache = { count: null, at: 0 };
const TTL = 60_000;

/** Clears the cache. Called after a successful signup so the door shuts at once. */
export function resetSignupCache() {
  cache = { count: null, at: 0 };
}

async function userCount() {
  if (cache.count !== null && Date.now() - cache.at < TTL) return cache.count;
  try {
    const n = Number(await scalar('SELECT COUNT(*) AS c FROM users'));
    cache = { count: Number.isFinite(n) ? n : null, at: Date.now() };
  } catch {
    cache = { count: null, at: Date.now() };
  }
  return cache.count;
}

/** @returns {Promise<{open: boolean, mode: string, reason: string}>} */
export async function signupState() {
  // The count is only needed in auto mode, so a forced setting costs no query.
  if (config.allowSignup !== 'auto') return decide(config.allowSignup, 0);
  return decide('auto', await userCount());
}

/* ---------------------------------------------------------------- the guard */

/** Express guard for the signup page and the signup endpoint. */
export async function requireSignupOpen(req, res, next) {
  try {
    const state = await signupState();
    if (state.open) return next();

    if (String(req.path ?? '').startsWith('/api/')) {
      return res.status(403).json({
        ok: false,
        error: { code: 'SIGNUP_CLOSED', message: state.reason },
      });
    }
    return res.status(403).render('screens/error', {
      title: 'Account creation is closed',
      status: 403,
      heading: 'Account creation is closed',
      message: state.reason,
    });
  } catch (err) {
    return next(err);
  }
}
