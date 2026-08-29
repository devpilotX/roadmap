/**
 * PATCH /api/week-days/:id/progress
 *
 * The LEARN and BUILD ticks for one of the 126 week days. The same tick shows on
 * Today, so the day log mirrors it inside the same transaction and the two can
 * never disagree.
 */

import { transaction, type SqlParam } from '@/lib/db/pool';
import { getWeekDays } from '@/lib/db/reference';
import { recomputeDay } from '@/lib/db/progress';
import { notFound, ruleViolation } from '@/lib/errors';
import { isEditableDate, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { boolish, parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

const weekDayBody = z.object({
  learn_done: boolish.optional(),
  build_done: boolish.optional(),
});

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, weekDayBody);

  const weekDays = await getWeekDays();
  const wd = weekDays.find((w) => Number(w.id) === Number(id));
  if (!wd) throw notFound('No such week day.');

  const today = todayInTz();
  const editable = isEditableDate(wd.cal_date as string, today);
  if (!editable.ok) throw ruleViolation(`${wd.cal_date}: ${editable.reason}`);

  const result = await transaction(async (tx) => {
    await tx.run(
      `INSERT INTO week_day_progress (user_id, week_day_id, learn_done, build_done, completed_at)
       VALUES (?, ?, 0, 0, NULL)
       ON DUPLICATE KEY UPDATE week_day_id = VALUES(week_day_id)`,
      [user.id, wd.id]
    );

    const sets: string[] = [];
    const setParams: SqlParam[] = [];
    if ('learn_done' in body) {
      sets.push('learn_done = ?');
      setParams.push(body.learn_done ? 1 : 0);
    }
    if ('build_done' in body) {
      sets.push('build_done = ?');
      setParams.push(body.build_done ? 1 : 0);
    }
    if (sets.length) {
      sets.push(
        'completed_at = CASE WHEN learn_done = 1 AND build_done = 1 THEN COALESCE(completed_at, NOW()) ELSE NULL END'
      );
      setParams.push(user.id, wd.id);
      await tx.run(
        `UPDATE week_day_progress SET ${sets.join(', ')} WHERE user_id = ? AND week_day_id = ?`,
        setParams
      );
    }

    // The same tick shows on Today, so the day log mirrors it.
    const mirror: string[] = [];
    const mirrorParams: SqlParam[] = [];
    if ('learn_done' in body) {
      mirror.push('learn_done = ?');
      mirrorParams.push(body.learn_done ? 1 : 0);
    }
    if ('build_done' in body) {
      mirror.push('build_done = ?');
      mirrorParams.push(body.build_done ? 1 : 0);
    }
    await tx.run(
      'INSERT INTO day_logs (user_id, log_date, week_n) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE week_n = VALUES(week_n)',
      [user.id, wd.cal_date, wd.week_n]
    );
    if (mirror.length) {
      mirrorParams.push(user.id, wd.cal_date);
      await tx.run(
        `UPDATE day_logs SET ${mirror.join(', ')} WHERE user_id = ? AND log_date = ?`,
        mirrorParams
      );
    }

    return tx.one(
      'SELECT learn_done, build_done, completed_at FROM week_day_progress WHERE user_id = ? AND week_day_id = ?',
      [user.id, wd.id]
    );
  });

  const colour = await recomputeDay(user.id, wd.cal_date as string);
  return jsonOk({
    week_day_id: Number(wd.id),
    cal_date: wd.cal_date,
    progress: result,
    colour,
  });
});
