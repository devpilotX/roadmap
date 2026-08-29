/**
 * PATCH /api/gates/:no/result
 *
 * A gate is passed only with an evidence URL. A screenshot is not evidence, a
 * live URL is. The same rule is a CHECK constraint on the table.
 */

import { one, run } from '@/lib/db/pool';
import { getGates } from '@/lib/db/reference';
import { notFound, ruleViolation } from '@/lib/errors';
import { nowDateTime } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { httpUrl, optionalText, parseBody, parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ no: z.coerce.number().int().min(1).max(4) });

const gateBody = z.object({
  passed: z.boolean(),
  evidence_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  notes: optionalText(4000).optional(),
});

export const PATCH = authedRoute<{ no: string }>(async ({ request, params, user }) => {
  const { no } = parseParams(params, paramsSchema);
  const body = await parseBody(request, gateBody);

  const gates = await getGates();
  const gate = gates.find((g) => Number(g.no) === no);
  if (!gate) throw notFound('No such gate.');

  const evidence = body.evidence_url === '' ? null : body.evidence_url ?? null;
  if (body.passed && !evidence) {
    throw ruleViolation(
      'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.'
    );
  }

  await run(
    `INSERT INTO gate_results (user_id, gate_no, passed, passed_at, evidence_url, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE passed = VALUES(passed), passed_at = VALUES(passed_at),
       evidence_url = VALUES(evidence_url), notes = VALUES(notes)`,
    [
      user.id,
      gate.no,
      body.passed ? 1 : 0,
      body.passed ? nowDateTime() : null,
      evidence,
      body.notes ?? null,
    ]
  );

  const row = await one(
    'SELECT gate_no, passed, passed_at, evidence_url, notes FROM gate_results WHERE user_id = ? AND gate_no = ?',
    [user.id, gate.no]
  );
  return jsonOk(row);
});
