/**
 * GET /api/weeks/:n | one week in full: its six days, its links and its lists.
 */

import { query } from '@/lib/db/pool';
import {
  getGates,
  getPhases,
  getSundays,
  getWeekDays,
  getWeekLinks,
  getWeekLists,
  getWeeks,
} from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { isEditableDate, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseParams, weekNumber, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ n: weekNumber });

export const GET = authedRoute<{ n: string }>(async ({ params, user }) => {
  const { n } = parseParams(params, paramsSchema);

  const [weeks, phases, weekDays, links, lists, sundays, gates] = await Promise.all([
    getWeeks(),
    getPhases(),
    getWeekDays(),
    getWeekLinks(),
    getWeekLists(),
    getSundays(),
    getGates(),
  ]);
  const week = weeks.find((w) => Number(w.n) === n);
  if (!week) throw notFound(`There is no week ${n}. The roadmap has 21.`);

  const days = weekDays.filter((d) => Number(d.week_n) === n);
  const dayIds = days.map((d) => d.id as number);
  const weekLinks = links.filter((l) => Number(l.week_n) === n);
  const linkIds = weekLinks.map((l) => l.id as number);

  const [dayProgress, linkProgress, logs] = await Promise.all([
    dayIds.length
      ? query(
          `SELECT week_day_id, learn_done, build_done, completed_at FROM week_day_progress
            WHERE user_id = ? AND week_day_id IN (${dayIds.map(() => '?').join(',')})`,
          [user.id, ...dayIds]
        )
      : Promise.resolve([]),
    linkIds.length
      ? query(
          `SELECT week_link_id, status, minutes, notes FROM week_link_progress
            WHERE user_id = ? AND week_link_id IN (${linkIds.map(() => '?').join(',')})`,
          [user.id, ...linkIds]
        )
      : Promise.resolve([]),
    query(
      'SELECT log_date, dsa_solved, day_colour, pushes FROM day_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?',
      [user.id, week.start_date, week.end_date]
    ),
  ]);

  const dp = new Map(dayProgress.map((r) => [Number(r.week_day_id), r]));
  const lp = new Map(linkProgress.map((r) => [Number(r.week_link_id), r]));
  const logByDate = new Map(logs.map((l) => [l.log_date as string, l]));
  const today = todayInTz();

  return jsonOk({
    week,
    phase: phases.find((p) => p.code === week.phase_code) ?? null,
    gate: week.gate_no ? gates.find((g) => Number(g.no) === Number(week.gate_no)) ?? null : null,
    sunday: sundays.find((s) => Number(s.week_n) === n) ?? null,
    learn: lists.learn.filter((r) => Number(r.week_n) === n),
    build: lists.build.filter((r) => Number(r.week_n) === n),
    ships: lists.ships.filter((r) => Number(r.week_n) === n),
    trap: lists.traps.find((r) => Number(r.week_n) === n)?.text ?? null,
    note: lists.notes.find((r) => Number(r.week_n) === n)?.text ?? null,
    days: days.map((d) => ({
      ...d,
      learn_done: Number(dp.get(Number(d.id))?.learn_done ?? 0) === 1,
      build_done: Number(dp.get(Number(d.id))?.build_done ?? 0) === 1,
      completed_at: dp.get(Number(d.id))?.completed_at ?? null,
      dsa_solved: Number(logByDate.get(d.cal_date as string)?.dsa_solved ?? 0),
      day_colour: logByDate.get(d.cal_date as string)?.day_colour ?? null,
      pushes: Number(logByDate.get(d.cal_date as string)?.pushes ?? 0),
      editable: isEditableDate(d.cal_date as string, today).ok,
    })),
    links: weekLinks.map((l) => ({
      id: l.id,
      url: l.url,
      label: l.label,
      resource_id: l.resource_id,
      why: l.resource_why,
      cost: l.resource_cost,
      is_alive: Number(l.is_alive) === 1,
      last_checked: l.last_checked,
      status: lp.get(Number(l.id))?.status ?? 'todo',
      minutes: Number(lp.get(Number(l.id))?.minutes ?? 0),
      notes: lp.get(Number(l.id))?.notes ?? '',
    })),
    neighbours: { prev: n > 1 ? n - 1 : null, next: n < 21 ? n + 1 : null },
  });
});
