/**
 * POST /api/me/password
 *
 * Changing the password ends every other session for this user. The session rows
 * are matched on sessions.user_id, which migration 005 added for exactly this.
 */

import { one, run } from '@/lib/db/pool';
import { unauthorised, unprocessable } from '@/lib/errors';
import { checkPassword, hashPassword, verifyPassword } from '@/lib/passwords';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const passwordBody = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(1).max(200),
});

export const POST = authedRoute(async ({ request, user, session }) => {
  const body = await parseBody(request, passwordBody);

  const row = await one('SELECT password_hash FROM users WHERE id = ?', [user.id]);
  if (!row) throw unauthorised();

  let valid = false;
  try {
    valid = await verifyPassword(row.password_hash, body.current_password);
  } catch {
    valid = false;
  }
  if (!valid) throw unauthorised('That is not your current password.');

  const check = checkPassword(body.new_password, {
    email: user.email,
    displayName: user.display_name,
  });
  if (!check.ok) throw unprocessable(check.reason!);
  if (body.new_password === body.current_password) {
    throw unprocessable('The new password is the same as the old one.');
  }

  const hash = await hashPassword(body.new_password);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);

  // Changing the password destroys every other session for this user.
  //
  // This used to be a LIKE over the session JSON, matching the substring
  // '"userId":12'. That pattern has no trailing delimiter, so it also matched the
  // session JSON of users 120, 123 and 1234: changing one person's password
  // signed a different account out. sessions gained a real user_id column in
  // migration 005 precisely so this query can say what it means.
  const result = await run(
    `DELETE FROM sessions
      WHERE session_id <> ?
        AND user_id = ?`,
    [session.id, user.id]
  );
  await run(
    `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
     VALUES (?, 'users', ?, 'update', CAST(? AS JSON))`,
    [user.id, String(user.id), JSON.stringify({ password_changed: true })]
  );

  return jsonOk({ changed: true, other_sessions_ended: result.affectedRows ?? 0 });
});
