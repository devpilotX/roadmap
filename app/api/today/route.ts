/**
 * GET /api/today | everything the Today screen needs, in one payload.
 */

import { buildToday } from '@/lib/db/today';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => jsonOk(await buildToday(user.id)));
