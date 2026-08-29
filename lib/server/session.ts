/**
 * session.ts | a signed cookie session stored in the existing `sessions` table.
 *
 * The Express build used express-session with express-mysql-session. Neither
 * works inside a Next route handler, so this is the same behaviour written
 * directly against the same table and the same cookie name:
 *
 *   sessions.session_id  VARCHAR(128) primary key
 *   sessions.expires     INT UNSIGNED, seconds since the epoch
 *   sessions.data        MEDIUMTEXT, the session object as JSON
 *
 * The stored JSON keeps the key `userId`, because POST /api/me/password ends
 * every other session for a user with `data LIKE '%"userId":123%'` and that
 * query has to keep working.
 *
 * The cookie value keeps the `s:<id>.<signature>` shape that cookie-signature
 * writes, so a session created by the old build is still readable by this one.
 */

import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { config } from '../config';
import { one, run } from '../db/pool';

export const SESSION_COOKIE = 'roadmap.sid';
/**
 * The readable CSRF cookie, named here as well as in csrf.ts.
 *
 * The name is duplicated rather than imported, because csrf.ts imports this
 * module for saveSession and importing back would be a cycle. There is one test
 * holding the two in step.
 */
export const CSRF_COOKIE = 'csrf_token';
/** Rolling 30 days, exactly as the Express build had it. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
/**
 * How long a session row may go without having its expiry pushed forward.
 *
 * express-session with `rolling: true` re-set the cookie and touched the store on
 * every single request. Doing one UPDATE per request here would be wasteful, so the
 * window is extended when it has not been extended for a day. The effect is the
 * same: somebody who uses the tracker daily is never signed out.
 */
const TOUCH_AFTER_SECONDS = 24 * 60 * 60;

export interface SessionData {
  userId?: number;
  startedAt?: number;
  csrfToken?: string;
  [key: string]: unknown;
}

export interface Session {
  id: string;
  data: SessionData;
  /** True when this session has no row in the table yet. */
  isNew: boolean;
  /** The row's `expires` value, in seconds since the epoch. Null for a new one. */
  expires?: number | null;
}

/* --------------------------------------------------------------- signing */

function sign(value: string): string {
  const mac = createHmac('sha256', config.sessionSecret)
    .update(value)
    .digest('base64')
    .replace(/=+$/, '');
  return `s:${value}.${mac}`;
}

function unsign(signed: string): string | null {
  if (!signed.startsWith('s:')) return null;
  const body = signed.slice(2);
  const dot = body.lastIndexOf('.');
  if (dot === -1) return null;
  const value = body.slice(0, dot);
  const mac = body.slice(dot + 1);
  const expected = createHmac('sha256', config.sessionSecret)
    .update(value)
    .digest('base64')
    .replace(/=+$/, '');
  const a = Buffer.from(mac, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? value : null;
}

function newSessionId(): string {
  // 24 bytes base64url is 32 characters, well inside VARCHAR(128).
  return randomBytes(24).toString('base64url');
}

function expiryStamp(): number {
  return Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
}

/* ----------------------------------------------------------------- store */

async function readRow(id: string): Promise<{ data: SessionData; expires: number } | null> {
  const row = await one('SELECT data, expires FROM sessions WHERE session_id = ?', [id]);
  if (!row) return null;
  if (Number(row.expires) <= Math.floor(Date.now() / 1000)) {
    // Expired. Clean it up rather than leaving it to the sweeper.
    await run('DELETE FROM sessions WHERE session_id = ?', [id]).catch(() => {});
    return null;
  }
  if (!row.data) return { data: {}, expires: Number(row.expires) };
  try {
    const parsed = JSON.parse(String(row.data));
    return {
      data: parsed && typeof parsed === 'object' ? (parsed as SessionData) : {},
      expires: Number(row.expires),
    };
  } catch {
    return { data: {}, expires: Number(row.expires) };
  }
}

async function writeRow(id: string, data: SessionData): Promise<void> {
  await run(
    `INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
    [id, expiryStamp(), JSON.stringify(data)]
  );
}

export async function destroySessionRow(id: string): Promise<void> {
  await run('DELETE FROM sessions WHERE session_id = ?', [id]).catch(() => {});
}

/** Drops every expired row. Called opportunistically, never on the hot path. */
export async function sweepExpiredSessions(): Promise<number> {
  const result = await run('DELETE FROM sessions WHERE expires <= ?', [
    Math.floor(Date.now() / 1000),
  ]);
  return result.affectedRows ?? 0;
}

/* --------------------------------------------------------------- reading */

/**
 * The session for this request, read from the cookie. Never creates a row and
 * never writes a cookie, so it is safe to call from a server component.
 */
export async function readSession(): Promise<Session | null> {
  if (!config.hasSessionSecret) return null;
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const id = unsign(raw);
  if (!id) return null;
  const row = await readRow(id);
  if (!row) return null;
  return { id, data: row.data, isNew: false, expires: row.expires };
}

/**
 * Pushes the 30 day window forward, cookie and row together.
 *
 * This is what `rolling: true` did in express-session. It only writes when the
 * window has not been extended for a day, so a busy screen does not cost an UPDATE
 * per request. Callable only from a route handler, because a server component
 * cannot set a cookie, which is why the route wrapper is the one that calls it.
 */
export async function refreshSessionWindow(session: Session): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const issuedAgo = session.expires ? SESSION_TTL_SECONDS - (session.expires - now) : Infinity;
  if (issuedAgo < TOUCH_AFTER_SECONDS) return;

  const expires = expiryStamp();
  await run('UPDATE sessions SET expires = ? WHERE session_id = ?', [expires, session.id]).catch(
    () => {}
  );
  session.expires = expires;

  const jar = await cookies();
  jar.set(SESSION_COOKIE, sign(session.id), cookieOptions());

  // A good moment to take the rubbish out: it is at most once a day per session,
  // and never on a request that is already doing a write.
  void sweepExpiredSessionsOccasionally();
}

/**
 * Sweeps expired rows at most once an hour per process.
 *
 * express-mysql-session ran a timer for this. There is no place to keep a timer in
 * a serverless-shaped runtime, so it rides along with the rolling refresh instead.
 * Without it, every anonymous visitor who asks for a CSRF token leaves a row behind
 * for thirty days.
 */
declare global {
  var __roadmapLastSweep: number | undefined;
}

async function sweepExpiredSessionsOccasionally(): Promise<void> {
  const now = Date.now();
  if (globalThis.__roadmapLastSweep && now - globalThis.__roadmapLastSweep < 3600_000) return;
  globalThis.__roadmapLastSweep = now;
  await sweepExpiredSessions().catch(() => {});
}

/* --------------------------------------------------------------- writing */

const cookieOptions = () =>
  ({
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.isProd,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

/**
 * Persists the session and refreshes the cookie, which is the rolling window.
 * Only callable from a route handler or a server action.
 */
export async function saveSession(session: Session): Promise<void> {
  await writeRow(session.id, session.data);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sign(session.id), cookieOptions());
}

/**
 * Creates a brand new session id and stores the data under it.
 *
 * This is the session fixation defence: signing in always issues a new id and
 * deletes the old row, so a session id an attacker planted before the login
 * carries no authority after it.
 */
export async function regenerateSession(
  previous: Session | null,
  data: SessionData
): Promise<Session> {
  if (previous) await destroySessionRow(previous.id);
  const session: Session = { id: newSessionId(), data, isNew: true };
  await saveSession(session);
  return session;
}

/**
 * Ends the session and clears both cookies.
 *
 * The CSRF cookie has to go with it. It is not authority on its own, but it is
 * only meaningful next to the copy held in the session row, and that row is being
 * deleted. Leaving it behind is what caused a real lock out: the next sign in
 * found a token in the cookie, sent it, and the server had nothing to compare it
 * against, so every attempt was refused for as long as the cookie lived.
 */
export async function destroySession(session: Session | null): Promise<void> {
  if (session) await destroySessionRow(session.id);
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: '/' });
  jar.delete({ name: CSRF_COOKIE, path: '/' });
}

/**
 * The session for a write path, created in memory when there is not one yet.
 * Nothing is stored until saveSession is called.
 */
export async function getOrCreateSession(): Promise<Session> {
  const existing = await readSession();
  if (existing) return existing;
  return { id: newSessionId(), data: {}, isNew: true };
}
