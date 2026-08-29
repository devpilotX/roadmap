/**
 * POST /api/auth/logout
 *
 * Destroys the session row and clears the cookie. Signing out of a session that
 * has already ended is not an error, so this always answers 200.
 */

import { jsonOk, publicRoute } from '@/lib/server/route';
import { destroySession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = publicRoute(async ({ session }) => {
  await destroySession(session);
  return jsonOk({ signed_out: true });
});
