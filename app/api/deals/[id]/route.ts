/**
 * PATCH /api/deals/:id | edit a deal, re-checked against the Part 17 rules.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { assertDealRules } from '@/lib/db/deals';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { DEAL_FIELDS, dealBody } from '@/lib/server/schemas';
import { parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, dealBody.partial());

  const deal = await one('SELECT * FROM deals WHERE id = ? AND user_id = ? AND is_deleted = 0', [
    id,
    user.id,
  ]);
  if (!deal) throw notFound('No such deal.');

  await assertDealRules(body, deal);

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  for (const key of DEAL_FIELDS) {
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      sets.push(`${key} = ?`);
      setParams.push((key === 'referral_asked' ? (value ? 1 : 0) : value) as SqlParam);
    }
  }

  if (sets.length) {
    setParams.push(user.id, deal.id);
    await run(`UPDATE deals SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, setParams);
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
       VALUES (?, 'deals', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
      [user.id, String(deal.id), JSON.stringify(deal), JSON.stringify(body)]
    );
  }

  return jsonOk(await one('SELECT * FROM deals WHERE id = ?', [deal.id]));
});
