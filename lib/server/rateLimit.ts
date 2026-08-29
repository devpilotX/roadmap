/**
 * rateLimit.ts | fixed window counters held in process memory.
 *
 * Section 5.3: login and signup are limited to 5 attempts per 15 minutes per IP
 * and per email. Two limiters run in series so exhausting either one blocks.
 *
 * express-rate-limit kept its counters in process memory too, so this is the
 * same guarantee, not a weaker one: it holds for a single Node process and is
 * reset by a restart. The map lives on globalThis so a development reload does
 * not hand an attacker a fresh allowance on every file save.
 */

import { tooMany } from '../errors';
import { config } from '../config';

interface Bucket {
  count: number;
  resetAt: number;
}

declare global {
  var __roadmapRateBuckets: Map<string, Bucket> | undefined;
}

function buckets(): Map<string, Bucket> {
  if (!globalThis.__roadmapRateBuckets) globalThis.__roadmapRateBuckets = new Map();
  return globalThis.__roadmapRateBuckets;
}

/** Drops entries whose window has closed, so the map cannot grow without bound. */
function sweep(now: number): void {
  const map = buckets();
  if (map.size < 500) return;
  for (const [key, bucket] of map) {
    if (bucket.resetAt <= now) map.delete(key);
  }
}

export interface LimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/** Counts one hit against a key. Does not throw. */
export function hit(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  sweep(now);
  const map = buckets();
  let bucket = map.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    map.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return {
    ok: bucket.count <= limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Counts one hit and throws a 429 with the given message when it is over. */
export function enforce(key: string, limit: number, windowMs: number, message: string): void {
  const result = hit(key, limit, windowMs);
  if (!result.ok) throw tooMany(message);
}

/** Clears every counter. Used by the tests. */
export function resetRateLimits(): void {
  buckets().clear();
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * The client address.
 *
 * TRUST_PROXY says how many proxies sit in front. With none, a forwarded header is
 * ignored, because an attacker could otherwise send a different one on every
 * request and never reach a limit.
 *
 * Next does not expose the socket address to a route handler, so with TRUST_PROXY=0
 * every caller shares one bucket. That limits more than it should rather than less,
 * which is the safe direction, and it is why the shipped configuration, the compose
 * file and the runbook all set TRUST_PROXY=1 behind nginx.
 */
export function clientIp(request: Request): string {
  if (config.trustProxy > 0) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
      // Count in from the right by the number of proxies we actually trust.
      const index = Math.max(0, parts.length - config.trustProxy);
      if (parts[index]) return parts[index];
      if (parts.length) return parts[parts.length - 1];
    }
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  // Next does not expose the socket address to a route handler, so a direct
  // deployment falls back to a single shared bucket. That is the safe direction:
  // it limits more, never less.
  return 'local';
}

export const limiters = {
  loginIp: (request: Request) =>
    enforce(
      `login:ip:${clientIp(request)}`,
      5,
      FIFTEEN_MINUTES,
      'Too many attempts from this address. Try again in 15 minutes.'
    ),

  loginEmail: (request: Request, email: string) =>
    enforce(
      `login:email:${String(email ?? '').trim().toLowerCase() || clientIp(request)}`,
      5,
      FIFTEEN_MINUTES,
      'Too many attempts for that email. Try again in 15 minutes.'
    ),

  signup: (request: Request) =>
    enforce(
      `signup:${clientIp(request)}`,
      5,
      FIFTEEN_MINUTES,
      'Too many sign up attempts from this address. Try again in 15 minutes.'
    ),

  /** The GitHub sync is limited so the app can never hammer the GitHub API. */
  githubSync: (request: Request, userId: number | null) =>
    enforce(
      `sync:${userId ?? clientIp(request)}`,
      6,
      5 * 60 * 1000,
      'The GitHub sync can run six times in five minutes. Wait, then try again.'
    ),

  /** A wide limit on everything else, so a runaway script cannot take the app down. */
  generalApi: (request: Request, userId: number | null) =>
    enforce(
      `api:${userId ?? clientIp(request)}`,
      config.isProd ? 300 : 3000,
      60 * 1000,
      'Slow down. Too many requests in one minute.'
    ),
};
