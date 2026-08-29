/**
 * GET /api/ladder | the Part 13 unlock ladder.
 *
 * DSA alone unlocks no role. The count gets you past a screen, the projects get
 * you the offer.
 */

import { query } from '@/lib/db/pool';
import {
  getDsaThresholds,
  getResumeStages,
  getRoleUnlocks,
  getRoles,
} from '@/lib/db/reference';
import { completedWeeks, dsaSolvedTotal } from '@/lib/db/progress';
import { daysBetween, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const today = todayInTz();
  const [unlocks, thresholds, stages, roles, solvedRow, weekState] = await Promise.all([
    getRoleUnlocks(),
    getDsaThresholds(),
    getResumeStages(),
    getRoles(),
    dsaSolvedTotal(user.id),
    completedWeeks(user.id),
  ]);
  const gateResults = await query('SELECT gate_no, passed FROM gate_results WHERE user_id = ?', [
    user.id,
  ]);
  const passed = new Set(
    gateResults.filter((g) => Number(g.passed) === 1).map((g) => Number(g.gate_no))
  );
  const solved = solvedRow.total;
  const done = new Set(weekState.complete);

  return jsonOk({
    today,
    solved,
    milestones: unlocks.map((m): Record<string, any> => {
      const gateMatch = /GATE\s+(\d)/i.exec(String(m.milestone));
      const weekMatch = /Week\s+(\d+)/i.exec(String(m.milestone));
      const unlocked = gateMatch
        ? passed.has(Number(gateMatch[1]))
        : weekMatch
          ? done.has(Number(weekMatch[1]))
          : m.unlock_date <= today && solved >= 6;
      return {
        ...m,
        is_gate: Boolean(gateMatch),
        gate_no: gateMatch ? Number(gateMatch[1]) : null,
        week_n: weekMatch ? Number(weekMatch[1]) : null,
        unlocked,
        days_away: daysBetween(today, m.unlock_date as string),
        roles: m.roles_csv ? String(m.roles_csv).split(',') : [],
      };
    }),
    thresholds: thresholds.map((t): Record<string, any> => ({
      ...t,
      cumulative: Number(t.cumulative),
      reached: solved >= Number(t.cumulative),
      is_current:
        solved >= Number(t.cumulative) &&
        !thresholds.some(
          (o) => Number(o.cumulative) > Number(t.cumulative) && solved >= Number(o.cumulative)
        ),
    })),
    resume_stages: stages.map((s): Record<string, any> => ({
      ...s,
      available: (() => {
        const m = /Gate\s+(\d)/i.exec(String(s.stage));
        return m ? passed.has(Number(m[1])) : false;
      })(),
    })),
    roles: roles.map((r) => ({ code: r.code, name: r.short_name, entry_band: r.entry_band })),
    callout:
      'DSA alone unlocks no role. The count gets you past a screen. The projects get you the offer.',
    applications_note:
      'Applications begin at Gate 3 on 13 December 2026, not at Gate 4. Waiting for Gate 4 costs six weeks of pipeline and lands your first replies inside the Indian hiring slowdown, which runs roughly 21 to 27 December.',
  });
});
