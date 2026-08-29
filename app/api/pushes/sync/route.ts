/**
 * POST /api/pushes/sync
 *
 * Limited to six runs in five minutes, so the app can never hammer the GitHub
 * API. The sync itself stops at the first rate limit and reports why.
 */

import { syncUser } from '@/lib/github';
import { recomputeRange } from '@/lib/db/progress';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { limiters } from '@/lib/server/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = authedRoute(async ({ request, user }) => {
  limiters.githubSync(request, user.id);
  const report = await syncUser(user.id);
  if (report.pushes_written) {
    await recomputeRange(user.id, config.roadmap.firstDay, config.roadmap.lastDay);
  }
  return jsonOk(report);
});
