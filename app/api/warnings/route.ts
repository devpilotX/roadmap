/**
 * GET /api/warnings | the active W1 to W10 warnings for this person, right now.
 */

import { warningsFor } from '@/lib/db/warnings';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const { warnings } = await warningsFor(user.id);
  return jsonOk({ warnings, count: warnings.length });
});
