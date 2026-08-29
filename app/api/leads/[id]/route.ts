/**
 * PATCH  /api/leads/:id | edit a lead.
 * DELETE /api/leads/:id | soft delete only. Nothing is ever hard deleted.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { LEAD_FIELDS, leadBody } from '@/lib/server/schemas';
import { parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, leadBody.partial());

  const lead = await one('SELECT * FROM leads WHERE id = ? AND user_id = ? AND is_deleted = 0', [
    id,
    user.id,
  ]);
  if (!lead) throw notFound('No such lead.');

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  for (const key of LEAD_FIELDS) {
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      sets.push(`${key} = ?`);
      setParams.push((key === 'mobile_broken' ? (value ? 1 : 0) : value) as SqlParam);
    }
  }

  if (sets.length) {
    setParams.push(user.id, lead.id);
    await run(`UPDATE leads SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, setParams);
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
       VALUES (?, 'leads', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
      [user.id, String(lead.id), JSON.stringify(lead), JSON.stringify(body)]
    );
  }

  return jsonOk(await one('SELECT * FROM leads WHERE id = ?', [lead.id]));
});

export const DELETE = authedRoute<{ id: string }>(async ({ params, user }) => {
  const { id } = parseParams(params, paramsSchema);

  const lead = await one('SELECT id FROM leads WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!lead) throw notFound('No such lead.');

  await run('UPDATE leads SET is_deleted = 1 WHERE id = ? AND user_id = ?', [lead.id, user.id]);
  await run(
    `INSERT INTO audit_log (user_id, table_name, row_pk, action) VALUES (?, 'leads', ?, 'soft_delete')`,
    [user.id, String(lead.id)]
  );
  return jsonOk({ id: Number(lead.id), soft_deleted: true });
});
