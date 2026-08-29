/**
 * PATCH /api/sundays/:week/log
 *
 * A rest Sunday is not tickable. Only the note field is writable, because the
 * rest is load bearing and the tracker is not going to help anybody skip it.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { getSundays } from '@/lib/db/reference';
import { recomputeDay } from '@/lib/db/progress';
import { notFound, ruleViolation } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { optionalText, parseBody, parseParams, weekNumber, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ week: weekNumber });

const sundayBody = z.object({
  completed: z.boolean().optional(),
  hours: z.coerce.number().min(0).max(24).optional(),
  notes: optionalText(4000).optional(),
});

export const PATCH = authedRoute<{ week: string }>(async ({ request, params, user }) => {
  const { week } = parseParams(params, paramsSchema);
  const body = await parseBody(request, sundayBody);

  const sundays = await getSundays();
  const sunday = sundays.find((s) => Number(s.week_n) === week);
  if (!sunday) throw notFound('No such Sunday.');

  if (sunday.kind === 'rest' && (body.completed || body.hours)) {
    throw ruleViolation(
      'This is a rest Sunday. No code. No screens before noon. This is load bearing. Only the note field is writable.'
    );
  }

  await run(
    'INSERT INTO sunday_logs (user_id, week_n) VALUES (?, ?) ON DUPLICATE KEY UPDATE week_n = VALUES(week_n)',
    [user.id, sunday.week_n]
  );

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  if ('completed' in body) {
    sets.push('completed = ?');
    setParams.push(body.completed ? 1 : 0);
  }
  if ('hours' in body) {
    sets.push('hours = ?');
    setParams.push(body.hours as number);
  }
  if ('notes' in body) {
    sets.push('notes = ?');
    setParams.push(body.notes ?? null);
  }
  if (sets.length) {
    setParams.push(user.id, sunday.week_n);
    await run(
      `UPDATE sunday_logs SET ${sets.join(', ')} WHERE user_id = ? AND week_n = ?`,
      setParams
    );
  }

  await recomputeDay(user.id, sunday.sunday_date as string);
  const row = await one(
    'SELECT week_n, completed, hours, notes FROM sunday_logs WHERE user_id = ? AND week_n = ?',
    [user.id, sunday.week_n]
  );
  return jsonOk(row);
});
