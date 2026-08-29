/**
 * PATCH  /api/applications/:id | edit one. Changing the status stamps the date.
 * DELETE /api/applications/:id | soft delete only.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { notFound } from '@/lib/errors';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { APPLICATION_FIELDS, applicationBody } from '@/lib/server/schemas';
import { parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, applicationBody.partial());

  const row = await one(
    'SELECT * FROM applications WHERE id = ? AND user_id = ? AND is_deleted = 0',
    [id, user.id]
  );
  if (!row) throw notFound('No such application.');

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  for (const key of APPLICATION_FIELDS) {
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      sets.push(`${key} = ?`);
      setParams.push(
        (key === 'referral' ? (value ? 1 : 0) : value === '' ? null : value) as SqlParam
      );
    }
  }
  // A status change without an explicit date is stamped today, so the funnel can
  // always answer "how long has this been sitting here".
  if (!('last_update' in body) && 'status' in body) {
    sets.push('last_update = ?');
    setParams.push(todayInTz());
  }

  if (sets.length) {
    setParams.push(user.id, row.id);
    await run(`UPDATE applications SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, setParams);
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
       VALUES (?, 'applications', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
      [user.id, String(row.id), JSON.stringify(row), JSON.stringify(body)]
    );
  }

  return jsonOk(await one('SELECT * FROM applications WHERE id = ?', [row.id]));
});

export const DELETE = authedRoute<{ id: string }>(async ({ params, user }) => {
  const { id } = parseParams(params, paramsSchema);

  const row = await one('SELECT id FROM applications WHERE id = ? AND user_id = ?', [id, user.id]);
  if (!row) throw notFound('No such application.');

  await run('UPDATE applications SET is_deleted = 1 WHERE id = ? AND user_id = ?', [
    row.id,
    user.id,
  ]);
  await run(
    `INSERT INTO audit_log (user_id, table_name, row_pk, action) VALUES (?, 'applications', ?, 'soft_delete')`,
    [user.id, String(row.id)]
  );
  return jsonOk({ id: Number(row.id), soft_deleted: true });
});
