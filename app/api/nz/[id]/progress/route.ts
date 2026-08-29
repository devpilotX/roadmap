/**
 * PATCH /api/nz/:id/progress | move one New Zealand milestone along.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { notFound } from '@/lib/errors';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { optionalText, parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

const bodySchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'done']).optional(),
  notes: optionalText(2000).optional(),
});

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, bodySchema);

  const row = await one('SELECT id FROM nz_milestones WHERE id = ?', [id]);
  if (!row) throw notFound('No such milestone.');

  await run(
    'INSERT INTO nz_progress (user_id, nz_milestone_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE nz_milestone_id = VALUES(nz_milestone_id)',
    [user.id, row.id]
  );

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  if ('status' in body) {
    sets.push('status = ?', 'completed_on = ?');
    setParams.push(body.status as string, body.status === 'done' ? todayInTz() : null);
  }
  if ('notes' in body) {
    sets.push('notes = ?');
    setParams.push(body.notes ?? null);
  }
  if (sets.length) {
    setParams.push(user.id, row.id);
    await run(
      `UPDATE nz_progress SET ${sets.join(', ')} WHERE user_id = ? AND nz_milestone_id = ?`,
      setParams
    );
  }

  return jsonOk(
    await one(
      'SELECT nz_milestone_id, status, completed_on, notes FROM nz_progress WHERE user_id = ? AND nz_milestone_id = ?',
      [user.id, row.id]
    )
  );
});
