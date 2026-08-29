/**
 * POST /api/sessions/:id/stop
 *
 * Writes the elapsed minutes into the day log column for that block, then
 * repaints the day. Stopping an already stopped session is not an error.
 */

import { one, transaction } from '@/lib/db/pool';
import { recomputeDay } from '@/lib/db/progress';
import { MINUTE_COLUMN } from '@/lib/db/sessions';
import { notFound } from '@/lib/errors';
import { nowDateTime } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const POST = authedRoute<{ id: string }>(async ({ params, user }) => {
  const { id } = parseParams(params, paramsSchema);

  const session = await one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
    id,
    user.id,
  ]);
  if (!session) throw notFound('No such session.');
  if (session.ended_at) return jsonOk(session);

  const endedAt = nowDateTime();
  const result = await transaction(async (tx) => {
    await tx.run(
      'UPDATE study_sessions SET ended_at = ?, minutes = GREATEST(0, TIMESTAMPDIFF(MINUTE, started_at, ?)) WHERE id = ? AND user_id = ?',
      [endedAt, endedAt, session.id, user.id]
    );
    const row = await tx.one('SELECT * FROM study_sessions WHERE id = ?', [session.id]);
    const column = row ? MINUTE_COLUMN[row.block as string] : undefined;
    if (row && column && Number(row.minutes) > 0) {
      await tx.run(
        'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
        [user.id, row.session_date]
      );
      await tx.run(
        `UPDATE day_logs SET ${column} = LEAST(1440, ${column} + ?) WHERE user_id = ? AND log_date = ?`,
        [Number(row.minutes), user.id, row.session_date]
      );
    }
    return row;
  });

  if (result) await recomputeDay(user.id, result.session_date as string);
  return jsonOk(result);
});
