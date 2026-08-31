/**
 * POST /api/warnings/:code/snooze
 *
 * An orange warning can be snoozed for 24 hours, once a day. Red cannot.
 *
 * snoozeWarning throws for the two conditions that are not rule violations: an
 * unknown code is 404 and a warning already snoozed today is 409. The only
 * failure it returns is the red means red rule, which is shown verbatim as 422
 * because a rule from final.md is what the caller has run into.
 */

import { snoozeWarning } from '@/lib/db/warnings';
import { ruleViolation } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ code: z.string().regex(/^W([1-9]|10)$/) });

export const POST = authedRoute<{ code: string }>(async ({ params, user }) => {
  const { code } = parseParams(params, paramsSchema);
  const result = await snoozeWarning(user.id, code);
  if (!result.ok) throw ruleViolation(result.reason!);
  return jsonOk({ snoozed: true, code });
});
