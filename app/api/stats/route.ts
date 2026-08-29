/**
 * GET /api/stats | the numbers, drawn from what actually happened.
 */

import { query } from '@/lib/db/pool';
import { getWeeks } from '@/lib/db/reference';
import { dsaSolvedTotal, streakState } from '@/lib/db/progress';
import { carePlanFloor, dealStats, rupeeEvents, sumByMonth, touchStats } from '@/lib/money';
import { colourTally } from '@/lib/streaks';
import { monthLabel, todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const today = todayInTz();
  const weeks = await getWeeks();

  const [
    blockMinutes,
    dsaByWeek,
    streak,
    phaseRows,
    appFunnel,
    events,
    touches,
    deals,
    care,
    videoRows,
    solved,
  ] = await Promise.all([
    query(
      `SELECT c.week_n, s.block, SUM(s.minutes) AS minutes
         FROM study_sessions s JOIN calendar_days c ON c.cal_date = s.session_date
        WHERE s.user_id = ? AND c.week_n IS NOT NULL
        GROUP BY c.week_n, s.block ORDER BY c.week_n`,
      [user.id]
    ),
    query(
      `SELECT c.week_n, COALESCE(SUM(l.dsa_solved), 0) AS solved,
              COALESCE(SUM(l.dsa_minutes), 0) AS minutes
         FROM calendar_days c LEFT JOIN day_logs l ON l.log_date = c.cal_date AND l.user_id = ?
        WHERE c.week_n IS NOT NULL GROUP BY c.week_n ORDER BY c.week_n`,
      [user.id]
    ),
    streakState(user.id, today),
    query(
      `SELECT w.phase_code,
              COUNT(DISTINCT d.id) AS day_rows,
              SUM(CASE WHEN p.learn_done = 1 THEN 1 ELSE 0 END) AS learn_done,
              SUM(CASE WHEN p.build_done = 1 THEN 1 ELSE 0 END) AS build_done
         FROM week_days d
         JOIN weeks w ON w.n = d.week_n
         LEFT JOIN week_day_progress p ON p.week_day_id = d.id AND p.user_id = ?
        GROUP BY w.phase_code ORDER BY w.phase_code`,
      [user.id]
    ),
    query(
      'SELECT status, COUNT(*) AS n FROM applications WHERE user_id = ? AND is_deleted = 0 GROUP BY status',
      [user.id]
    ),
    rupeeEvents(user.id),
    touchStats(user.id),
    dealStats(user.id),
    carePlanFloor(user.id),
    query(
      'SELECT log_date, video_minutes FROM day_logs WHERE user_id = ? AND video_minutes > 0 ORDER BY log_date',
      [user.id]
    ),
    dsaSolvedTotal(user.id),
  ]);

  const hoursByWeek = new Map<number, Record<string, number>>();
  for (const r of blockMinutes) {
    const w = Number(r.week_n);
    if (!hoursByWeek.has(w)) hoursByWeek.set(w, {});
    hoursByWeek.get(w)![String(r.block)] = Number(r.minutes);
  }

  let cumulative = 0;
  const dsaCurve = weeks.map((w) => {
    const row = dsaByWeek.find((r) => Number(r.week_n) === Number(w.n));
    cumulative += Number(row?.solved ?? 0);
    return {
      week_n: Number(w.n),
      end_date: w.end_date,
      plan: w.dsa_cumulative,
      actual: w.end_date <= today ? cumulative : null,
      minutes: Number(row?.minutes ?? 0),
    };
  });

  const byMonth = sumByMonth(events);

  return jsonOk({
    today,
    hours_by_block_by_week: weeks.map((w) => ({
      week_n: Number(w.n),
      dates_label: w.dates_label,
      blocks: hoursByWeek.get(Number(w.n)) ?? {},
      total_minutes: Object.values(hoursByWeek.get(Number(w.n)) ?? {}).reduce((a, b) => a + b, 0),
    })),
    dsa_curve: dsaCurve,
    dsa_solved: solved.total,
    dsa_target: config.roadmap.dsaTargetByEnd,
    colours: colourTally(streak.days),
    streak: { current: streak.current, longest: streak.longest },
    day_history: streak.days.map((d) => ({
      date: d.cal_date,
      colour: d.colour,
      met: d.met,
      total: d.total,
    })),
    phases: phaseRows.map((p) => ({
      phase_code: p.phase_code,
      day_rows: Number(p.day_rows),
      learn_done: Number(p.learn_done),
      build_done: Number(p.build_done),
      percent: Math.round(
        ((Number(p.learn_done) + Number(p.build_done)) / (Number(p.day_rows) * 2)) * 100
      ),
    })),
    applications: (() => {
      const byStatus = Object.fromEntries(appFunnel.map((r) => [r.status, Number(r.n)])) as Record<
        string,
        number
      >;
      const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
      return {
        by_status: byStatus,
        total,
        target: config.roadmap.gate4Applications,
        conversion: {
          to_screen: total ? Math.round(((byStatus.screen ?? 0) / total) * 1000) / 10 : 0,
          to_offer: total ? Math.round(((byStatus.offer ?? 0) / total) * 1000) / 10 : 0,
        },
      };
    })(),
    money: {
      by_month: [...byMonth.entries()].map(([k, v]) => ({
        month: k,
        label: monthLabel(k),
        amount: v,
      })),
      total: events.reduce((a, e) => a + e.amount, 0),
      target: config.roadmap.moneyTargetRupees,
      touches,
      deals,
      care_plans: care,
    },
    video: {
      days_over_cap: videoRows.filter(
        (r) => Number(r.video_minutes) > config.roadmap.videoMinutesCap
      ).length,
      cap: config.roadmap.videoMinutesCap,
      rows: videoRows,
      total_minutes: videoRows.reduce((a, r) => a + Number(r.video_minutes), 0),
    },
  });
});
