/**
 * POST /api/warnings/:code/snooze
 *
 * An orange warning can be snoozed for 24 hours, once a day. Red cannot.
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
