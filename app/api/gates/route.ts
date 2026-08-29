/**
 * GET /api/gates | the four gates and the four money gates.
 */

import { query } from '@/lib/db/pool';
import { getGates, getMoneyGates, getWeeks } from '@/lib/db/reference';
import { daysBetween, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [gates, moneyGates, weeks] = await Promise.all([getGates(), getMoneyGates(), getWeeks()]);
  const [results, moneyResults] = await Promise.all([
    query('SELECT gate_no, passed, passed_at, evidence_url, notes FROM gate_results WHERE user_id = ?', [
      user.id,
    ]),
    query(
      'SELECT money_gate_code, passed, passed_at, amount_received, notes FROM money_gate_results WHERE user_id = ?',
      [user.id]
    ),
  ]);
  const byNo = new Map(results.map((r) => [Number(r.gate_no), r]));
  const byCode = new Map(moneyResults.map((r) => [r.money_gate_code as string, r]));
  const today = todayInTz();

  return jsonOk({
    today,
    gates: gates.map((g) => {
      const r = byNo.get(Number(g.no));
      return {
        ...g,
        week_title: weeks.find((w) => w.n === g.week_n)?.title ?? null,
        days_remaining: daysBetween(today, g.gate_date as string),
        is_past: g.gate_date < today,
        passed: Number(r?.passed ?? 0) === 1,
        passed_at: r?.passed_at ?? null,
        evidence_url: r?.evidence_url ?? null,
        notes: r?.notes ?? '',
      };
    }),
    money_gates: moneyGates.map((g) => {
      const r = byCode.get(g.code as string);
      return {
        ...g,
        days_remaining: daysBetween(today, g.gate_date as string),
        is_past: g.gate_date < today,
        passed: Number(r?.passed ?? 0) === 1,
        passed_at: r?.passed_at ?? null,
        amount_received: r?.amount_received ?? null,
        notes: r?.notes ?? '',
        show_if_it_fails: g.gate_date < today && Number(r?.passed ?? 0) !== 1,
      };
    }),
  });
});
