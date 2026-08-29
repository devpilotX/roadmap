/**
 * PATCH /api/after/:id/progress | tick one continuation row.
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
  done: z.boolean().optional(),
  notes: optionalText(2000).optional(),
});

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, bodySchema);

  const row = await one('SELECT id FROM continuation WHERE id = ?', [id]);
  if (!row) throw notFound('No such row.');

  await run(
    'INSERT INTO continuation_progress (user_id, continuation_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE continuation_id = VALUES(continuation_id)',
    [user.id, row.id]
  );

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  if ('done' in body) {
    sets.push('done = ?', 'completed_on = ?');
    setParams.push(body.done ? 1 : 0, body.done ? todayInTz() : null);
  }
  if ('notes' in body) {
    sets.push('notes = ?');
    setParams.push(body.notes ?? null);
  }
  if (sets.length) {
    setParams.push(user.id, row.id);
    await run(
      `UPDATE continuation_progress SET ${sets.join(', ')} WHERE user_id = ? AND continuation_id = ?`,
      setParams
    );
  }

  return jsonOk(
    await one(
      'SELECT continuation_id, done, completed_on, notes FROM continuation_progress WHERE user_id = ? AND continuation_id = ?',
      [user.id, row.id]
    )
  );
});
