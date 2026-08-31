/**
 * GET /api/day-logs | the raw day log rows for a range.
 */

import { getDayLogs } from '@/lib/db/progress';
import { config } from '@/lib/config';
import { daysBetween } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The longest range this endpoint will answer, counted inclusively.
 *
 * The roadmap is 150 days, 28 August 2026 to 24 January 2027, and Appendix C
 * lists every one of them. So 150 is not an arbitrary safety number, it is the
 * whole data set: a request for more than that is asking for days the tracker
 * does not have, and the only thing a larger range can do is read rows nobody
 * will look at.
 */
const MAX_RANGE_DAYS = 150;

/**
 * The defaults live in the schema rather than after it, because the two checks
 * below have to run against the dates that will actually be queried. Applied
 * afterwards, an omitted `from` with a `to` in September would have skipped the
 * ordering check entirely.
 *
 * from after to used to be accepted and passed straight to BETWEEN, which matches
 * nothing, so a reversed range answered 200 with an empty list and looked like a
 * person with no history rather than a malformed request.
 */
const rangeQuery = z
  .object({
    from: isoDate.default(config.roadmap.firstDay),
    to: isoDate.default(config.roadmap.lastDay),
  })
  .refine((v) => v.from <= v.to, {
    path: ['to'],
    message: 'The end of the range cannot be before the start of it.',
  })
  .refine((v) => daysBetween(v.from, v.to) < MAX_RANGE_DAYS, {
    path: ['to'],
    message: `A range covers at most ${MAX_RANGE_DAYS} days, which is the whole roadmap.`,
  });

export const GET = authedRoute(async ({ request, user }) => {
  const { from, to } = parseQuery(request, rangeQuery);
  const logs = await getDayLogs(user.id, from, to);
  return jsonOk({ from, to, logs });
});
