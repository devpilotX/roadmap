/**
 * POST /api/auth/signup
 *
 * Rules from build prompt section 5, implemented exactly:
 *   - password minimum 12 characters, checked against a local blocklist
 *   - Argon2id at m=19456, t=2, p=1
 *   - the profiles row is created in the same transaction as the user
 *   - the session id is regenerated so a planted id carries no authority
 */

import { one, transaction } from '@/lib/db/pool';
import { conflict, unprocessable } from '@/lib/errors';
import { checkPassword, hashPassword } from '@/lib/passwords';
import { nowDateTime } from '@/lib/dates';
import { config } from '@/lib/config';
import { jsonOk, publicRoute } from '@/lib/server/route';
import { emailSchema } from '@/lib/server/schemas';
import { parseBody, z } from '@/lib/server/validate';
import { limiters } from '@/lib/server/rateLimit';
import { assertSignupOpen, resetSignupCache } from '@/lib/server/signup';
import { regenerateSession } from '@/lib/server/session';
import { rotateCsrfToken } from '@/lib/server/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const signupBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  display_name: z.string().trim().min(1, 'Your name cannot be blank.').max(120),
});

export const POST = publicRoute(async ({ request, session }) => {
  limiters.signup(request);
  await assertSignupOpen();

  const body = await parseBody(request, signupBody);
  const { email, password, display_name: displayName } = body;

  const strength = checkPassword(password, { email, displayName });
  if (!strength.ok) throw unprocessable(strength.reason!);

  const existing = await one('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    // Signup is the one place where saying so is unavoidable and acceptable:
    // the person is choosing an identifier, not probing for one.
    throw conflict('An account with that email already exists. Sign in instead.');
  }

  const hash = await hashPassword(password);

  const userId = await transaction(async (tx) => {
    const result = await tx.run(
      'INSERT INTO users (email, password_hash, display_name, last_login_at) VALUES (?, ?, ?, ?)',
      [email, hash, displayName, nowDateTime()]
    );
    const id = result.insertId;
    await tx.run(
      `INSERT INTO profiles (user_id, full_name, roadmap_start, roadmap_end, timezone)
       VALUES (?, ?, ?, ?, ?)`,
      // roadmap_start is defaultStartDay, not firstDay. The window still runs from
      // 28 August, but scoring starts on the first study day, so the three launch
      // days are neutral instead of three red days nobody earned. Changeable on
      // /profile. roadmap_end stays lastDay, which final.md fixes.
      [id, displayName, config.roadmap.defaultStartDay, config.roadmap.lastDay, config.timezone]
    );
    await tx.run('INSERT INTO user_settings (user_id) VALUES (?)', [id]);
    await tx.run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
       VALUES (?, 'users', ?, 'insert', CAST(? AS JSON))`,
      [id, String(id), JSON.stringify({ email, display_name: displayName })]
    );
    return id;
  });

  const fresh = await regenerateSession(session, { userId, startedAt: Date.now() });
  const csrf = await rotateCsrfToken(fresh);

  // The door closes behind them: with an account on file, the first-run window
  // is over and the cached answer must not outlive it.
  resetSignupCache();

  return jsonOk(
    { id: userId, email, display_name: displayName, csrf, next: '/' },
    201
  );
});
