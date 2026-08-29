/**
 * GET /api/weeks | the 21 weeks with their phase, gate, Sunday and progress.
 */

import {
  getGates,
  getPhases,
  getSundays,
  getWeekLinks,
  getWeeks,
} from '@/lib/db/reference';
import { completedWeeks } from '@/lib/db/progress';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [weeks, phases, gates, sundays, progress, links] = await Promise.all([
    getWeeks(),
    getPhases(),
    getGates(),
    getSundays(),
    completedWeeks(user.id),
    getWeekLinks(),
  ]);

  const byWeek = new Map(progress.perWeek.map((p) => [p.week_n, p]));
  const linkCount = new Map<number, number>();
  for (const l of links) {
    linkCount.set(Number(l.week_n), (linkCount.get(Number(l.week_n)) ?? 0) + 1);
  }
  const today = todayInTz();

  return jsonOk({
    today,
    phases,
    gates,
    weeks: weeks.map((w) => ({
      ...w,
      progress:
        byWeek.get(Number(w.n)) ??
        { week_n: Number(w.n), percent: 0, learn_done: 0, build_done: 0, day_rows: 6, complete: false },
      link_count: linkCount.get(Number(w.n)) ?? 0,
      sunday: sundays.find((s) => s.week_n === w.n) ?? null,
      is_current: today >= w.start_date && today <= w.end_date,
      is_past: w.end_date < today,
    })),
  });
});
