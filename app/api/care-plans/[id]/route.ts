/**
 * PATCH /api/care-plans/:id | edit a care plan.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { CARE_PLAN_FIELDS, carePlanBody } from '@/lib/server/schemas';
import { parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, carePlanBody.partial());

  const plan = await one(
    'SELECT * FROM care_plans WHERE id = ? AND user_id = ? AND is_deleted = 0',
    [id, user.id]
  );
  if (!plan) throw notFound('No such care plan.');

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  for (const key of CARE_PLAN_FIELDS) {
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      sets.push(`${key} = ?`);
      setParams.push((key === 'active' ? (value ? 1 : 0) : value) as SqlParam);
    }
  }

  if (sets.length) {
    setParams.push(user.id, plan.id);
    await run(`UPDATE care_plans SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, setParams);
  }

  return jsonOk(await one('SELECT * FROM care_plans WHERE id = ?', [plan.id]));
});
