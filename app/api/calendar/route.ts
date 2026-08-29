/**
 * GET /api/calendar | the 150 days with their colours, for the calendar screen.
 */

import { getCalendarDays, getSundays, getWeeks } from '@/lib/db/reference';
import { getDayLogs, pushesByDate, streakState } from '@/lib/db/progress';
import { badRequest } from '@/lib/errors';
import { todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const rangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const GET = authedRoute(async ({ request, user }) => {
  const q = parseQuery(request, rangeQuery);
  const from = q.from ?? config.roadmap.firstDay;
  const to = q.to ?? config.roadmap.lastDay;
  if (from > to) throw badRequest('from must not be after to.');

  const [cal, weeks, sundays, logs, pushes, streak] = await Promise.all([
    getCalendarDays(),
    getWeeks(),
    getSundays(),
    getDayLogs(user.id, from, to),
    pushesByDate(user.id, from, to),
    streakState(user.id, todayInTz()),
  ]);

  const logByDate = new Map(logs.map((l) => [l.log_date as string, l]));
  const sundayByDate = new Map(sundays.map((s) => [s.sunday_date as string, s]));

  const days = cal
    .filter((d) => d.cal_date >= from && d.cal_date <= to)
    .map((d) => {
      const log = logByDate.get(d.cal_date as string) ?? null;
      const push = pushes.get(d.cal_date as string) ?? null;
      const colour = streak.byDate.get(d.cal_date as string)?.colour ?? null;
      return {
        cal_date: d.cal_date,
        week_n: d.week_n,
        day_label: d.day_label,
        kind: d.kind,
        dsa_target: d.dsa_target,
        dsa_solved: log ? Number(log.dsa_solved) : 0,
        day_colour: colour,
        logged: Boolean(log),
        pushes: push ? push.pushes : 0,
        commits: push ? push.commits : 0,
        sunday_kind: sundayByDate.get(d.cal_date as string)?.kind ?? null,
      };
    });

  return jsonOk({
    from,
    to,
    today: todayInTz(),
    first_day: config.roadmap.firstDay,
    last_day: config.roadmap.lastDay,
    weeks: weeks.map((w) => ({
      n: w.n,
      start_date: w.start_date,
      end_date: w.end_date,
      title: w.title,
      dates_label: w.dates_label,
      phase_code: w.phase_code,
      gate_no: w.gate_no,
    })),
    days,
    streak: streak.current,
  });
});
