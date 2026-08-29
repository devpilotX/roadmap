/**
 * GET /api/csrf
 *
 * Issues the CSRF token and makes sure the readable cookie matches the copy held
 * in the session.
 *
 * The Express build did this in middleware on every request. A Next server
 * component cannot write a cookie, so the browser asks for the token once, and
 * the API client calls this itself whenever the cookie is missing before a write.
 *
 * A session row is created for an anonymous visitor, because /login has to post
 * a verifiable form before anybody is signed in.
 */

import { issueCsrfToken } from '@/lib/server/csrf';
import { jsonOk, publicRoute } from '@/lib/server/route';
import { getOrCreateSession, saveSession } from '@/lib/server/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = publicRoute(
  async () => {
    const session = await getOrCreateSession();
    const token = await issueCsrfToken(session);
    // Persist, so the token survives the next request. This is the only reason an
    // anonymous visitor gets a session row at all.
    await saveSession(session);
    return jsonOk({ csrf: token });
  },
  { csrf: false }
);
