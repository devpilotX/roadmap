/**
 * PATCH /api/money-gates/:code/result | M1 to M4 from Part 17.12.
 */

import { one, run } from '@/lib/db/pool';
import { getMoneyGates } from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { nowDateTime } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { optionalText, parseBody, parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ code: z.string().regex(/^M[1-4]$/) });

const moneyGateBody = z.object({
  passed: z.boolean(),
  amount_received: z.union([z.coerce.number().int().min(0).max(100000000), z.null()]).optional(),
  notes: optionalText(4000).optional(),
});

export const PATCH = authedRoute<{ code: string }>(async ({ request, params, user }) => {
  const { code } = parseParams(params, paramsSchema);
  const body = await parseBody(request, moneyGateBody);

  const gates = await getMoneyGates();
  const gate = gates.find((g) => g.code === code);
  if (!gate) throw notFound('No such money gate.');

  await run(
    `INSERT INTO money_gate_results (user_id, money_gate_code, passed, passed_at, amount_received, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE passed = VALUES(passed), passed_at = VALUES(passed_at),
       amount_received = VALUES(amount_received), notes = VALUES(notes)`,
    [
      user.id,
      gate.code,
      body.passed ? 1 : 0,
      body.passed ? nowDateTime() : null,
      body.amount_received ?? null,
      body.notes ?? null,
    ]
  );

  const row = await one(
    'SELECT money_gate_code, passed, passed_at, amount_received, notes FROM money_gate_results WHERE user_id = ? AND money_gate_code = ?',
    [user.id, gate.code]
  );
  return jsonOk(row);
});
