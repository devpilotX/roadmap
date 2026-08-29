/**
 * GET /api/calendar/:date | one day in full, for the calendar drawer.
 */

import { one, query } from '@/lib/db/pool';
import {
  getCalendarDays,
  getSundays,
  getWeekDays,
  getWeekLinks,
  getWeeks,
} from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { isEditableDate, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ date: isoDate });

export const GET = authedRoute<{ date: string }>(async ({ params, user }) => {
  const { date } = parseParams(params, paramsSchema);

  const [cal, weeks, weekDays, weekLinks, sundays] = await Promise.all([
    getCalendarDays(),
    getWeeks(),
    getWeekDays(),
    getWeekLinks(),
    getSundays(),
  ]);
  const day = cal.find((d) => d.cal_date === date);
  if (!day) throw notFound(`${date} is not one of the 150 roadmap days.`);

  const week = day.week_n ? weeks.find((w) => w.n === day.week_n) ?? null : null;
  const weekDay = weekDays.find((wd) => wd.cal_date === date) ?? null;
  const links = week ? weekLinks.filter((l) => l.week_n === week.n) : [];
  const linkIds = links.map((l) => l.id as number);

  const [log, linkProgress, pushRows, sessions, dayProgress] = await Promise.all([
    one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [user.id, date]),
    linkIds.length
      ? query(
          `SELECT week_link_id, status, minutes FROM week_link_progress
            WHERE user_id = ? AND week_link_id IN (${linkIds.map(() => '?').join(',')})`,
          [user.id, ...linkIds]
        )
      : Promise.resolve([]),
    query(
      `SELECT r.full_name AS repo, r.counts_to_target, p.commit_count, p.pushed_at, p.message_head, p.source
         FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
        WHERE p.user_id = ? AND p.push_date = ? ORDER BY p.pushed_at`,
      [user.id, date]
    ),
    query(
      `SELECT id, block, started_at, ended_at, minutes, source, auto_closed, resource_id, week_link_id
         FROM study_sessions WHERE user_id = ? AND session_date = ? ORDER BY started_at`,
      [user.id, date]
    ),
    weekDay
      ? one(
          'SELECT learn_done, build_done FROM week_day_progress WHERE user_id = ? AND week_day_id = ?',
          [user.id, weekDay.id]
        )
      : Promise.resolve(null),
  ]);

  const statusByLink = new Map(linkProgress.map((r) => [Number(r.week_link_id), r]));
  const editable = isEditableDate(date, todayInTz());

  return jsonOk({
    day,
    week: week
      ? {
          n: week.n,
          title: week.title,
          dates_label: week.dates_label,
          focus: week.focus,
          phase_code: week.phase_code,
          gate_no: week.gate_no,
        }
      : null,
    week_day: weekDay
      ? { ...weekDay, ...(dayProgress ?? { learn_done: 0, build_done: 0 }) }
      : null,
    sunday: sundays.find((s) => s.sunday_date === date) ?? null,
    links: links.map((l) => ({
      id: l.id,
      url: l.url,
      label: l.label,
      resource_id: l.resource_id,
      why: l.resource_why,
      cost: l.resource_cost,
      is_alive: Number(l.is_alive) === 1,
      last_checked: l.last_checked,
      status: statusByLink.get(Number(l.id))?.status ?? 'todo',
      minutes: Number(statusByLink.get(Number(l.id))?.minutes ?? 0),
    })),
    log: log ?? null,
    pushes: pushRows,
    sessions,
    editable: editable.ok,
    editable_reason: editable.reason,
  });
});
