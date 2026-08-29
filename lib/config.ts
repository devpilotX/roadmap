/**
 * Configuration, read once from the environment.
 *
 * The Express build threw at import time for a missing SESSION_SECRET. That
 * cannot happen here, because `next build` imports every module to collect
 * routes and would fail on a machine that has no .env. So validation is lazy:
 * the value is checked the first time it is actually read, which is inside a
 * request, and `configProblems` lets /healthz report the state without throwing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** The project root. Next runs with cwd set to it, and so do the CLI scripts. */
export const ROOT = resolve(process.cwd());

/** Minimal .env reader: KEY=value, # comments, optional surrounding quotes. */
function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Next loads .env itself, but the CLI scripts in scripts/ import this module
// directly through the compiled runtime and need it too. Loading twice is safe
// because a key already in process.env is never overwritten.
loadDotEnv(join(ROOT, '.env'));

/** Problems found while reading configuration. Reported, never thrown at import. */
export const configProblems: string[] = [];

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback === undefined) {
      configProblems.push(`Missing required environment variable ${key}`);
      return '';
    }
    return fallback;
  }
  return v;
}

function int(key: string, fallback?: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    if (fallback === undefined) {
      configProblems.push(`Missing required environment variable ${key}`);
      return 0;
    }
    return fallback;
  }
  const n = Number(raw);
  if (!Number.isInteger(n)) {
    configProblems.push(`Environment variable ${key} must be an integer, got "${raw}"`);
    return fallback ?? 0;
  }
  return n;
}

function hex32(key: string, { requiredInProd = false } = {}): Buffer | null {
  const v = process.env[key] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(v)) {
    // The Express build threw here and refused to boot. That cannot happen now,
    // because `next build` imports this module on a machine with no .env. So the
    // problem is recorded instead: /api/healthz reports the count, the log names it,
    // and lib/crypto.ts still refuses to store a token without it.
    if (requiredInProd && isProd) {
      configProblems.push(
        `${key} must be exactly 64 hex characters, which is a 32 byte key. ` +
          'Without it a GitHub token cannot be stored. Generate one with: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return null;
  }
  return Buffer.from(v, 'hex');
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProd = NODE_ENV === 'production';

const PORT = int('PORT', 3000);

const fakeToday = (() => {
  const v = process.env.FAKE_TODAY ?? '';
  if (v === '') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    configProblems.push(`FAKE_TODAY must be YYYY-MM-DD, got "${v}"`);
    return null;
  }
  return v;
})();

const fakeTime = (() => {
  const v = process.env.FAKE_TIME ?? '';
  if (v === '') return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) {
    configProblems.push(`FAKE_TIME must be HH:MM, got "${v}"`);
    return null;
  }
  return v;
})();

const rawSessionSecret = process.env.SESSION_SECRET ?? '';

export const ROADMAP = Object.freeze({
  firstDay: '2026-08-28',
  lastDay: '2027-01-24',
  gate3Date: '2026-12-13',
  totalDays: 150,
  totalWeeks: 21,
  dsaTargetByEnd: 415,
  dsaSheetTotal: 474,
  moneyTargetRupees: 90000,
  gate4Applications: 100,
  realisticApplications: [200, 400] as [number, number],
  videoMinutesCap: 30,
  weeklyPushTarget: 6,
  week1CommitTarget: 15,
});

export const config = {
  env: NODE_ENV,
  isProd,
  isTest: NODE_ENV === 'test',
  host: str('HOST', '127.0.0.1'),
  port: PORT,
  publicOrigin: str('PUBLIC_ORIGIN', `http://127.0.0.1:${PORT}`).replace(/\/+$/, ''),
  trustProxy: int('TRUST_PROXY', 0),
  /**
   * Login and signup attempts allowed, and the window they are counted in.
   *
   * Section 5.3 says 5 per 15 minutes, per address and per email, and those are the
   * defaults. They are settable because with TRUST_PROXY=0 every caller shares one
   * bucket, so five attempts at a form on your own machine locks you out for a
   * quarter of an hour, and the message reads exactly like a broken application.
   *
   * Raising these weakens brute force protection. Leave them alone on anything
   * reachable from the internet.
   */
  authRateLimitMax: Math.max(1, int('AUTH_RATE_LIMIT_MAX', 5)),
  authRateLimitWindowMinutes: Math.max(1, int('AUTH_RATE_LIMIT_WINDOW_MINUTES', 15)),
  timezone: str('TIMEZONE', 'Asia/Kolkata'),
  /** A fixed date for the section 20.6 boundary tests. Null means the real clock. */
  fakeToday,
  /** A fixed wall clock time, for testing the six block windows. */
  fakeTime,
  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    user: str('DB_USER', ''),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME', ''),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
  },
  /**
   * Read lazily so a missing secret is a request time failure with a clear
   * message rather than a build time crash.
   */
  get sessionSecret(): string {
    if (rawSessionSecret.length < 32) {
      throw new Error(
        'SESSION_SECRET must be at least 32 characters. Generate one with: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return rawSessionSecret;
  },
  hasSessionSecret: rawSessionSecret.length >= 32,
  /** Required in production because a GitHub token cannot be stored without it. */
  tokenEncKey: hex32('TOKEN_ENC_KEY', { requiredInProd: true }),
  githubApi: str('GITHUB_API', 'https://api.github.com').replace(/\/+$/, ''),
  /**
   * Whether a stranger may create an account.
   *
   * Left unset it is "auto": signup is open only while the database has no
   * users, so the first run creates the account and the door then closes by
   * itself. ALLOW_SIGNUP=true forces it open, false forces it shut.
   */
  allowSignup: ((): true | false | 'auto' => {
    const v = String(process.env.ALLOW_SIGNUP ?? '').trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return 'auto';
  })(),
  backupDir: str('BACKUP_DIR', './backups'),
  backupKeepDays: int('BACKUP_KEEP_DAYS', 14),
  mysqldumpBin: str('MYSQLDUMP_BIN', 'mysqldump'),
  roadmap: ROADMAP,
};

/** True when the clock has been faked for a test. */
export const isFakeClock = Boolean(fakeToday || fakeTime);

/** Throws when the database cannot possibly be reached. Called by getPool(). */
export function assertDbConfig(): void {
  const missing: string[] = [];
  if (!config.db.user) missing.push('DB_USER');
  if (!config.db.database) missing.push('DB_NAME');
  if (missing.length) {
    throw new Error(
      `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set. ` +
        'Copy .env.example to .env and fill it in, then run: npm run migrate && npm run verify'
    );
  }
}

export default config;
