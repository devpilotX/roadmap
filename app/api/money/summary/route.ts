/**
 * GET /api/money/summary | the whole money hour in one payload.
 *
 * Money received is counted from cash events, never from deal status, because a
 * deal marked paid with no dates is not money.
 */

import { one, query } from '@/lib/db/pool';
import {
  getLeadSources,
  getMoneyBuyback,
  getMoneyFirstHour,
  getMoneyGates,
  getMoneyHourShape,
  getMoneyLanes,
  getMoneyMonthTargets,
  getMoneyRefuse,
  getMoneyRules,
  getMoneyScripts,
  getMoneyWeekTargets,
  getOffers,
  getWeeks,
} from '@/lib/db/reference';
import {
  carePlanFloor,
  dealStats,
  offerLocked,
  rupeeEvents,
  sumByMonth,
  sumBetween,
  totalReceived,
  touchStats,
  touchTargetFromTask,
} from '@/lib/money';
import { MONTHS, monthKey, monthLabel, todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** "October 2026" back to "2026-10", so a month target can be matched to a sum. */
function monthKeyFromLabel(label: unknown): string {
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(String(label).trim());
  if (!m) return '';
  const idx = (MONTHS as readonly string[]).indexOf(m[1]);
  if (idx === -1) return '';
  return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

export const GET = authedRoute(async ({ user }) => {
  const today = todayInTz();

  const [
    weeks,
    weekTargets,
    monthTargets,
    offers,
    scripts,
    gates,
    rules,
    lanes,
    shape,
    refuse,
    buyback,
    firstHour,
    sources,
  ] = await Promise.all([
    getWeeks(),
    getMoneyWeekTargets(),
    getMoneyMonthTargets(),
    getOffers(),
    getMoneyScripts(),
    getMoneyGates(),
    getMoneyRules(),
    getMoneyLanes(),
    getMoneyHourShape(),
    getMoneyRefuse(),
    getMoneyBuyback(),
    getMoneyFirstHour(),
    getLeadSources(),
  ]);

  const week = weeks.find((w) => today >= w.start_date && today <= w.end_date) ?? null;

  const [events, care, touches, deals, gateResults, leadTally, calDay, versions] =
    await Promise.all([
      rupeeEvents(user.id),
      carePlanFloor(user.id),
      touchStats(user.id),
      dealStats(user.id),
      query(
        'SELECT money_gate_code, passed, passed_at, amount_received, notes FROM money_gate_results WHERE user_id = ?',
        [user.id]
      ),
      query(
        'SELECT status, COUNT(*) AS n FROM leads WHERE user_id = ? AND is_deleted = 0 GROUP BY status',
        [user.id]
      ),
      one('SELECT money_task FROM calendar_days WHERE cal_date = ?', [today]),
      query(
        'SELECT script_code, MAX(version) AS version FROM money_script_versions WHERE user_id = ? GROUP BY script_code',
        [user.id]
      ),
    ]);

  const monthNow = monthKey(today);
  const byMonth = sumByMonth(events);
  const total = totalReceived(events, today);
  const gateResultByCode = new Map(gateResults.map((g) => [g.money_gate_code as string, g]));
  const versionByCode = new Map(versions.map((v) => [v.script_code as string, Number(v.version)]));

  const monthTarget =
    monthTargets.find((m) => !m.is_total && monthLabel(monthNow) === m.month_label) ?? null;

  return jsonOk({
    today,
    week: week ? { n: week.n, title: week.title, dates_label: week.dates_label } : null,
    strip: {
      received_this_month: byMonth.get(monthNow) ?? 0,
      month_label: monthLabel(monthNow),
      month_target: monthTarget
        ? { low: monthTarget.target_low, high: monthTarget.target_high }
        : null,
      received_total: total,
      target_total: config.roadmap.moneyTargetRupees,
      care_plan_count: care.count,
      care_plan_monthly: care.monthly,
      care_plan_target: 5,
      days_since_last_touch: touches.last_touch
        ? Math.round(
            (new Date(`${today}T00:00:00Z`).getTime() -
              new Date(`${touches.last_touch}T00:00:00Z`).getTime()) /
              86400000
          )
        : null,
      days_since_last_rupee: events.length
        ? Math.round(
            (new Date(`${today}T00:00:00Z`).getTime() -
              new Date(`${events[events.length - 1].on}T00:00:00Z`).getTime()) /
              86400000
          )
        : null,
    },
    week_plan: weekTargets.map((t): Record<string, any> => ({
      ...t,
      actual: (() => {
        const w = weeks.find((x) => Number(x.n) === Number(t.week_n));
        return w ? sumBetween(events, config.roadmap.firstDay, w.end_date as string) : 0;
      })(),
      is_current: Number(week?.n) === Number(t.week_n),
    })),
    month_plan: monthTargets.map((m): Record<string, any> => ({
      ...m,
      actual: m.is_total ? total : byMonth.get(monthKeyFromLabel(m.month_label)) ?? 0,
    })),
    offers: offers.map((o): Record<string, any> => ({
      ...o,
      ...offerLocked(o as { code: string; unlocked_from_week?: number | null }, week?.n ?? 0),
    })),
    scripts: scripts.map((s): Record<string, any> => ({
      ...s,
      latest_version: versionByCode.get(s.code as string) ?? 1,
    })),
    money_gates: gates.map((g): Record<string, any> => {
      const r = gateResultByCode.get(g.code as string);
      return {
        ...g,
        passed: Number(r?.passed ?? 0) === 1,
        passed_at: r?.passed_at ?? null,
        amount_received: r?.amount_received ?? null,
        is_past: g.gate_date < today,
        show_if_it_fails: g.gate_date < today && Number(r?.passed ?? 0) !== 1,
      };
    }),
    rules,
    lanes,
    hour_shape: shape,
    refuse,
    buyback,
    first_hour: firstHour,
    lead_sources: sources,
    touches,
    deals,
    pipeline: Object.fromEntries(leadTally.map((r) => [r.status, Number(r.n)])),
    touch_target_today: touchTargetFromTask(calDay?.money_task),
    money_task_today: calDay?.money_task ?? null,
    received_by_month: [...byMonth.entries()].map(([k, v]) => ({
      month: k,
      label: monthLabel(k),
      amount: v,
    })),
    events,
  });
});
