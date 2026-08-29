/**
 * signup.ts | whether the front door is open.
 *
 * The Roadmap Tracker is one person's tracker. Keeping a signed in visitor away
 * from /signup does nothing about a stranger. Deployed to the internet with
 * nothing else in front of it, anybody who found the URL could register an
 * account on the server and start using it.
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

import { scalar } from '../db/pool';
import { config } from '../config';
import { AppError } from '../errors';

export interface SignupState {
  open: boolean;
  mode: string;
  reason: string;
}

/**
 * The whole policy, as a pure function.
 *
 * @param allowSignup true, false or 'auto'
 * @param userCount null means the count could not be read
 */
export function decide(
  allowSignup: true | false | 'auto',
  userCount: number | null
): SignupState {
  if (allowSignup === true) {
    return {
      open: true,
      mode: 'forced-open',
      reason: 'ALLOW_SIGNUP is set to true on this server.',
    };
  }
  if (allowSignup === false) {
    return {
      open: false,
      mode: 'forced-shut',
      reason: 'Account creation is switched off on this server.',
    };
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
declare global {
  var __roadmapSignupCache: { count: number | null; at: number } | undefined;
}

const TTL = 60_000;

/** Clears the cache. Called after a successful signup so the door shuts at once. */
export function resetSignupCache(): void {
  globalThis.__roadmapSignupCache = { count: null, at: 0 };
}

async function userCount(): Promise<number | null> {
  const cache = globalThis.__roadmapSignupCache ?? { count: null, at: 0 };
  if (cache.count !== null && Date.now() - cache.at < TTL) return cache.count;
  try {
    const n = Number(await scalar('SELECT COUNT(*) AS c FROM users'));
    globalThis.__roadmapSignupCache = {
      count: Number.isFinite(n) ? n : null,
      at: Date.now(),
    };
  } catch {
    globalThis.__roadmapSignupCache = { count: null, at: Date.now() };
  }
  return globalThis.__roadmapSignupCache.count;
}

export async function signupState(): Promise<SignupState> {
  // The count is only needed in auto mode, so a forced setting costs no query.
  if (config.allowSignup !== 'auto') return decide(config.allowSignup, 0);
  return decide('auto', await userCount());
}

/* ---------------------------------------------------------------- the guard */

/** Throws a 403 SIGNUP_CLOSED when the door is shut. */
export async function assertSignupOpen(): Promise<void> {
  const state = await signupState();
  if (state.open) return;
  throw new AppError(403, 'SIGNUP_CLOSED', state.reason);
}
