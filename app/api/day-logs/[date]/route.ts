/**
 * PUT /api/day-logs/:date
 *
 * The two rules this endpoint exists to enforce:
 *   - a rest Sunday is not tickable, only annotatable
 *   - CLOSE cannot be marked done with any of its three fields empty
 *
 * day_colour, pushes and money_touches are never accepted from the client.
 */

import { one } from '@/lib/db/pool';
import { getCalendarDays } from '@/lib/db/reference';
import { writeDayLog } from '@/lib/db/progress';
import { notFound, ruleViolation } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import {
  boolish,
  isoDate,
  minutes,
  optionalText,
  parseBody,
  parseParams,
  smallCount,
  z,
} from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ date: isoDate });

const dayLogBody = z
  .object({
    dsa_solved: smallCount,
    dsa_minutes: minutes,
    learn_done: boolish,
    learn_minutes: minutes,
    build_done: boolish,
    build_minutes: minutes,
    close_done: boolish,
    close_log_line: optionalText(2000),
    close_tomorrow_dsa: optionalText(255),
    close_tomorrow_build: optionalText(255),
    money_done: boolish,
    money_minutes: minutes,
    night_anki_done: boolish,
    night_spoken_done: boolish,
    night_spoken_aloud: boolish,
    night_tomorrow_done: boolish,
    anki_overdue: smallCount,
    video_minutes: minutes,
    blocked_on: optionalText(2000),
    notes: optionalText(4000),
    dsa_increment: z.coerce.number().int().min(-20).max(20),
  })
  .partial();

export const PUT = authedRoute<{ date: string }>(async ({ request, params, user }) => {
  const { date } = parseParams(params, paramsSchema);
  const body = await parseBody(request, dayLogBody);

  const cal = await getCalendarDays();
  const day = cal.find((d) => d.cal_date === date);
  if (!day) throw notFound(`${date} is not one of the 150 roadmap days.`);

  if (day.kind === 'sunday_rest') {
    const touched = Object.keys(body).filter((k) => k !== 'notes');
    if (touched.length) {
      throw ruleViolation(
        'This is a rest Sunday. No code. No screens before noon. This is load bearing. Nothing is tickable except the note field.'
      );
    }
  }

  const patch: Record<string, unknown> = { ...body };

  if ('dsa_increment' in patch) {
    const current = await one('SELECT dsa_solved FROM day_logs WHERE user_id = ? AND log_date = ?', [
      user.id,
      date,
    ]);
    patch.dsa_solved = Math.max(
      0,
      Number(current?.dsa_solved ?? 0) + Number(patch.dsa_increment)
    );
    delete patch.dsa_increment;
  }

  // CLOSE cannot be marked done with an empty field.
  if (patch.close_done === true) {
    const current = await one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [
      user.id,
      date,
    ]);
    const line = patch.close_log_line ?? current?.close_log_line;
    const dsa = patch.close_tomorrow_dsa ?? current?.close_tomorrow_dsa;
    const build = patch.close_tomorrow_build ?? current?.close_tomorrow_build;
    if (!String(line ?? '').trim() || !String(dsa ?? '').trim() || !String(build ?? '').trim()) {
      throw ruleViolation(
        'Close needs all three: one log line, tomorrow first DSA problem, and tomorrow first build task. Tomorrow is decided before you stand up.'
      );
    }
  }

  const result = await writeDayLog(user.id, date, patch);
  return jsonOk({ log: result.log, colour: result.colour });
});
