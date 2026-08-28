/**
 * Configuration, read once at boot from .env with no external dependency.
 *
 * Missing or obviously wrong values stop the process here rather than surfacing
 * as a confusing runtime error three screens later.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(join(dirname(fileURLToPath(import.meta.url)), '..'));

/** Minimal .env reader: KEY=value, # comments, optional surrounding quotes. */
function loadDotEnv(path) {
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

loadDotEnv(join(ROOT, '.env'));

function str(key, fallback) {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback === undefined) throw new Error(`Missing required environment variable ${key}`);
    return fallback;
  }
  return v;
}

function int(key, fallback) {
  const v = str(key, fallback === undefined ? undefined : String(fallback));
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`Environment variable ${key} must be an integer, got "${v}"`);
  return n;
}

function hex32(key, { required }) {
  const v = process.env[key] ?? '';
  if (!/^[0-9a-fA-F]{64}$/.test(v)) {
    const message =
      `${key} must be exactly 64 hex characters, which is a 32 byte key. ` +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
    if (required) throw new Error(message);
    return null;
  }
  return Buffer.from(v, 'hex');
}

const NODE_ENV = str('NODE_ENV', 'development');
const isProd = NODE_ENV === 'production';

export const config = {
  env: NODE_ENV,
  isProd,
  isTest: NODE_ENV === 'test',
  host: str('HOST', '127.0.0.1'),
  port: int('PORT', 3000),
  publicOrigin: str('PUBLIC_ORIGIN', `http://127.0.0.1:${int('PORT', 3000)}`).replace(/\/+$/, ''),
  trustProxy: int('TRUST_PROXY', 0),
  timezone: str('TIMEZONE', 'Asia/Kolkata'),
  // A fixed date for the section 20.6 boundary tests. Empty means the real clock.
  fakeToday: (() => {
    const v = process.env.FAKE_TODAY ?? '';
    if (v === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`FAKE_TODAY must be YYYY-MM-DD, got "${v}"`);
    return v;
  })(),
  // A fixed wall clock time, for testing the six block windows.
  fakeTime: (() => {
    const v = process.env.FAKE_TIME ?? '';
    if (v === '') return null;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new Error(`FAKE_TIME must be HH:MM, got "${v}"`);
    return v;
  })(),
  db: {
    host: str('DB_HOST', '127.0.0.1'),
    port: int('DB_PORT', 3306),
    user: str('DB_USER'),
    password: str('DB_PASSWORD', ''),
    database: str('DB_NAME'),
    connectionLimit: int('DB_CONNECTION_LIMIT', 10),
  },
  sessionSecret: (() => {
    const v = process.env.SESSION_SECRET ?? '';
    if (v.length < 32) {
      throw new Error(
        'SESSION_SECRET must be at least 32 characters. Generate one with: ' +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return v;
  })(),
  // Required in production because a GitHub token cannot be stored without it.
  tokenEncKey: hex32('TOKEN_ENC_KEY', { required: isProd }),
  githubApi: str('GITHUB_API', 'https://api.github.com').replace(/\/+$/, ''),
  /**
   * Whether a stranger may create an account.
   *
   * This is a single person's tracker. Left unset it is "auto": signup is open
   * only while the database has no users, so the first run creates the account
   * and the door then closes by itself. That is the safe default for something
   * reachable from the internet, because `requireAnon` alone would let anyone who
   * finds /signup register on your server.
   *
   * ALLOW_SIGNUP=true forces it open, which is what you want if you ever have to
   * recreate the account. ALLOW_SIGNUP=false forces it shut even on an empty
   * database.
   */
  allowSignup: (() => {
    const v = String(process.env.ALLOW_SIGNUP ?? '').trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
    return 'auto';
  })(),
  backupDir: str('BACKUP_DIR', './backups'),
  backupKeepDays: int('BACKUP_KEEP_DAYS', 14),
  mysqldumpBin: str('MYSQLDUMP_BIN', 'mysqldump'),
  roadmap: {
    firstDay: '2026-08-28',
    lastDay: '2027-01-24',
    gate3Date: '2026-12-13',
    totalDays: 150,
    totalWeeks: 21,
    dsaTargetByEnd: 415,
    dsaSheetTotal: 474,
    moneyTargetRupees: 90000,
    gate4Applications: 100,
    realisticApplications: [200, 400],
    videoMinutesCap: 30,
    weeklyPushTarget: 6,
    week1CommitTarget: 15,
  },
};

export default config;
