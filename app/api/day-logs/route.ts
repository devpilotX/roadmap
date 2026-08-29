/**
 * GET /api/day-logs | the raw day log rows for a range.
 */

import { getDayLogs } from '@/lib/db/progress';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const rangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const GET = authedRoute(async ({ request, user }) => {
  const q = parseQuery(request, rangeQuery);
  const from = q.from ?? config.roadmap.firstDay;
  const to = q.to ?? config.roadmap.lastDay;
  const logs = await getDayLogs(user.id, from, to);
  return jsonOk({ from, to, logs });
});
