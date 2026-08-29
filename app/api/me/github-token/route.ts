/**
 * PUT /api/me/github-token
 *
 * The token is write only. This route never echoes it back, not even masked.
 * An empty string removes the stored token.
 */

import { run } from '@/lib/db/pool';
import { badRequest } from '@/lib/errors';
import { canEncrypt, encryptToken } from '@/lib/crypto';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const tokenBody = z.object({
  token: z.union([z.string().trim().min(8).max(500), z.literal('')]),
});

export const PUT = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, tokenBody);

  if (body.token === '') {
    await run('UPDATE profiles SET github_token = NULL WHERE user_id = ?', [user.id]);
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
       VALUES (?, 'profiles', ?, 'update', CAST(? AS JSON))`,
      [user.id, String(user.id), JSON.stringify({ github_token: 'removed' })]
    );
    return jsonOk({ has_github_token: false });
  }

  if (!canEncrypt()) {
    throw badRequest(
      'TOKEN_ENC_KEY is not configured, so a token cannot be stored safely. Set it in .env and restart.'
    );
  }

  const blob = encryptToken(body.token);
  await run('UPDATE profiles SET github_token = ? WHERE user_id = ?', [blob, user.id]);
  await run(
    `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
     VALUES (?, 'profiles', ?, 'update', CAST(? AS JSON))`,
    [user.id, String(user.id), JSON.stringify({ github_token: 'set' })]
  );
  return jsonOk({ has_github_token: true });
});
