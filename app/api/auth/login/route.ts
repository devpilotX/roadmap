/**
 * POST /api/auth/login
 *
 * A failed login returns a generic 401 and always spends verify time, so the
 * response cannot be used to work out whether an email has an account. The
 * session id is regenerated on success to prevent fixation.
 */

import { one, run } from '@/lib/db/pool';
import { unauthorised } from '@/lib/errors';
import { dummyVerify, verifyPassword } from '@/lib/passwords';
import { nowDateTime } from '@/lib/dates';
import { jsonOk, publicRoute } from '@/lib/server/route';
import { emailSchema } from '@/lib/server/schemas';
import { parseBody, z } from '@/lib/server/validate';
import { limiters } from '@/lib/server/rateLimit';
import { regenerateSession } from '@/lib/server/session';
import { rotateCsrfToken } from '@/lib/server/csrf';
import { safeNextPath } from '@/lib/paths';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const loginBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  remember: z.unknown().optional(),
  next: z.string().max(500).optional(),
});

export const POST = publicRoute(async ({ request, session }) => {
  limiters.loginIp(request);

  const body = await parseBody(request, loginBody);
  limiters.loginEmail(request, body.email);

  const user = await one(
    'SELECT id, email, password_hash, display_name, is_active FROM users WHERE email = ?',
    [body.email]
  );

  // Always spend verify time, so the response does not reveal whether the
  // email exists. This is the account enumeration defence from Week 11.
  let valid = false;
  if (!user) {
    await dummyVerify(body.password);
  } else {
    try {
      valid = await verifyPassword(user.password_hash, body.password);
    } catch {
      valid = false;
    }
  }

  if (!user || !valid || Number(user.is_active) !== 1) {
    throw unauthorised('Invalid email or password');
  }

  const fresh = await regenerateSession(session, {
    userId: Number(user.id),
    startedAt: Date.now(),
  });
  const csrf = await rotateCsrfToken(fresh);
  await run('UPDATE users SET last_login_at = ? WHERE id = ?', [nowDateTime(), user.id]);

  const target = safeNextPath(body.next);
  return jsonOk({
    id: Number(user.id),
    email: user.email,
    display_name: user.display_name,
    csrf,
    next: target,
  });
});
