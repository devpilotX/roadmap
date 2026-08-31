/**
 * POST /api/sessions/:id/stop
 *
 * Writes the elapsed minutes into the day log column for that block, then
 * repaints the day. Stopping an already stopped session is not an error.
 *
 * Two defects were fixed here, both found by audit rather than by use.
 *
 * 1. DOUBLE CREDIT. The `if (session.ended_at) return` guard read the row on the
 *    pool, outside the transaction, and the UPDATE was not qualified with
 *    `ended_at IS NULL`. Two concurrent stops — a double tap, or the offline
 *    queue replaying a request that had in fact succeeded — both passed the
 *    guard and both added the minutes. The close is now a claim: the UPDATE
 *    itself carries `AND ended_at IS NULL`, so exactly one caller can win it,
 *    and only the winner credits the day.
 *
 * 2. AN UNRECOVERABLE TIMER. Crediting the minutes inserts a day_logs row for
 *    the session's own date, and trg_day_logs_no_backdate_ins correctly refuses
 *    a day older than seven days. A timer left running over a holiday therefore
 *    failed at the INSERT, rolled the whole transaction back, left ended_at NULL
 *    — and POST /api/sessions/start refuses to start anything while a session is
 *    open. The timer was bricked with no route back except SQL. Now the date is
 *    checked first: a session outside the editable window is still closed, and
 *    closed as auto_closed, but its minutes are not written to a day the seven
 *    day rule has sealed. The response says so.
 */

import { one, transaction } from '@/lib/db/pool';
import { recomputeDay } from '@/lib/db/progress';
import { MINUTE_COLUMN } from '@/lib/db/sessions';
import { notFound } from '@/lib/errors';
import { isEditableDate, nowDateTime, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const POST = authedRoute<{ id: string }>(async ({ params, user }) => {
  const { id } = parseParams(params, paramsSchema);

  const existing = await one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
    id,
    user.id,
  ]);
  if (!existing) throw notFound('No such session.');
  // Already closed: report it as it stands. Idempotent, and not an error.
  if (existing.ended_at) return jsonOk({ ...existing, credited: false, already_stopped: true });

  const endedAt = nowDateTime();
  const today = todayInTz();

  const outcome = await transaction(async (tx) => {
    // The claim. `ended_at IS NULL` is what makes this safe under concurrency:
    // the second caller matches no rows and credits nothing.
    const claim = await tx.run(
      `UPDATE study_sessions
          SET ended_at = ?,
              minutes = GREATEST(0, TIMESTAMPDIFF(MINUTE, started_at, ?))
        WHERE id = ? AND user_id = ? AND ended_at IS NULL`,
      [endedAt, endedAt, id, user.id]
    );

    const row = await tx.one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
      id,
      user.id,
    ]);
    if (!row) return { row: null, credited: false, sealed: false };
    if (!claim.affectedRows) {
      // Another request closed it between the read above and this UPDATE.
      return { row, credited: false, sealed: false, already_stopped: true };
    }

    const sessionDate = row.session_date as string;
    const editable = isEditableDate(sessionDate, today);
    if (!editable.ok) {
      // Sealed by the seven day rule. Close it, do not touch the day log, and
      // record that the closure was not a person pressing stop.
      await tx.run('UPDATE study_sessions SET auto_closed = 1 WHERE id = ?', [id]);
      return { row: { ...row, auto_closed: 1 }, credited: false, sealed: true };
    }

    const column = MINUTE_COLUMN[row.block as string];
    if (column && Number(row.minutes) > 0) {
      await tx.run(
        'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
        [user.id, sessionDate]
      );
      await tx.run(
        `UPDATE day_logs SET ${column} = LEAST(1440, ${column} + ?) WHERE user_id = ? AND log_date = ?`,
        [Number(row.minutes), user.id, sessionDate]
      );
      return { row, credited: true, sealed: false };
    }
    return { row, credited: false, sealed: false };
  });

  if (!outcome.row) throw notFound('No such session.');
  if (outcome.credited) await recomputeDay(user.id, outcome.row.session_date as string);

  return jsonOk({
    ...outcome.row,
    credited: outcome.credited,
    // Present only when the seven day rule stopped the minutes being written, so
    // the interface can explain a closed timer that changed no total.
    ...(outcome.sealed
      ? {
          sealed: true,
          sealed_reason:
            'This session started outside the seven day editing window, so it was closed without changing that day.',
        }
      : {}),
  });
});
