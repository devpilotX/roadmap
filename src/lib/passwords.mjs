/**
 * passwords.mjs
 *
 * Argon2id at the OWASP Password Storage Cheat Sheet parameters, which final.md
 * confirms in correction C15: m=19456 (19 MiB), t=2, p=1. That exact
 * configuration, because it is also the interview answer.
 */

import argon2 from 'argon2';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../config.mjs';

export const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

export const MIN_PASSWORD_LENGTH = 12;

/** A small local blocklist. No network call, no third party service. */
const blocklist = (() => {
  try {
    const text = readFileSync(join(ROOT, 'data', 'common-passwords.txt'), 'utf8');
    return new Set(
      text
        .split(/\r?\n/)
        .map((l) => l.trim().toLowerCase())
        .filter((l) => l && !l.startsWith('#'))
    );
  } catch {
    return new Set();
  }
})();

export function blocklistSize() {
  return blocklist.size;
}

/**
 * Returns { ok, reason }. The reason is written to be shown to a person.
 * Length is the only hard rule beyond the blocklist, because arbitrary character
 * class requirements make passwords worse, not better.
 */
export function checkPassword(password, { email = '', displayName = '' } = {}) {
  const p = String(password ?? '');
  if (p.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at least ${MIN_PASSWORD_LENGTH} characters. Length beats symbols.` };
  }
  if (p.length > 200) {
    return { ok: false, reason: 'That is longer than 200 characters, which is longer than useful.' };
  }
  const lower = p.toLowerCase();
  if (blocklist.has(lower)) {
    return { ok: false, reason: 'That password appears on a list of the most commonly used ones. Pick another.' };
  }
  if (/^(.)\1+$/.test(p)) {
    return { ok: false, reason: 'That is one character repeated. Pick something else.' };
  }
  const localPart = String(email).split('@')[0].toLowerCase();
  if (localPart.length >= 4 && lower.includes(localPart)) {
    return { ok: false, reason: 'Do not put your email address inside your password.' };
  }
  const name = String(displayName).trim().toLowerCase();
  if (name.length >= 4 && lower.includes(name)) {
    return { ok: false, reason: 'Do not put your own name inside your password.' };
  }
  return { ok: true, reason: null };
}

/** A 0 to 4 score, used only to draw the strength meter. Never a gate. */
export function strengthScore(password) {
  const p = String(password ?? '');
  if (!p) return 0;
  let score = 0;
  if (p.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (p.length >= 16) score += 1;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes >= 2) score += 1;
  if (classes >= 3 && p.length >= 14) score += 1;
  if (blocklist.has(p.toLowerCase())) return 0;
  return Math.min(4, score);
}

export function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(hash, password) {
  return argon2.verify(hash, password, ARGON2_OPTIONS);
}

/**
 * A hash of a throwaway value, used to spend the same time verifying an unknown
 * email as a known one. Without this, response timing leaks whether an account
 * exists, which is exactly the account enumeration Week 11 teaches.
 */
let dummyHash = null;

export async function dummyVerify(password) {
  if (!dummyHash) {
    dummyHash = await hashPassword('this-is-not-a-real-account-placeholder');
  }
  try {
    await verifyPassword(dummyHash, String(password ?? ''));
  } catch {
    // Always false. The point is the elapsed time, not the answer.
  }
  return false;
}
