/**
 * GET /api/sessions/open | the running session, or null.
 *
 * The timer chip reconciles against this after a navigation, so a session the
 * server has already closed does not leave a chip counting nothing.
 */

import { openSession } from '@/lib/db/progress';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => jsonOk(await openSession(user.id)));
