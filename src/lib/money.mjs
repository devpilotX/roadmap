/**
 * money.mjs | the arithmetic of Part 17.
 *
 * Money received is counted from cash events, not from deal status, because a
 * deal marked paid with no dates is not money. An advance counts on its advance
 * date, a balance counts on its balance date, and a care plan counts once a
 * month from the month it started.
 */

import { query, one } from '../db/pool.mjs';
import { monthKey } from './dates.mjs';

/**
 * Every rupee event for a user, as { on, amount, kind, label }.
 * kind is 'advance', 'balance' or 'care_plan'.
 */
export async function rupeeEvents(userId) {
  const [deals, plans] = await Promise.all([
    query(
      `SELECT id, client_name, offer_code, price, advance_amount, advance_on,
              balance_amount, balance_on, status
         FROM deals WHERE user_id = ? AND is_deleted = 0 AND status <> 'refunded'`,
      [userId]
    ),
    query(
      `SELECT id, client_name, monthly_amount, started_on, active, last_invoice_on
         FROM care_plans WHERE user_id = ? AND is_deleted = 0`,
      [userId]
    ),
  ]);

  const events = [];
  for (const d of deals) {
    if (d.advance_on && Number(d.advance_amount) > 0) {
      events.push({
        on: d.advance_on,
        amount: Number(d.advance_amount),
        kind: 'advance',
        label: `${d.client_name} advance, ${d.offer_code}`,
        deal_id: d.id,
      });
    }
    if (d.balance_on && Number(d.balance_amount) > 0) {
      events.push({
        on: d.balance_on,
        amount: Number(d.balance_amount),
        kind: 'balance',
        label: `${d.client_name} balance, ${d.offer_code}`,
        deal_id: d.id,
      });
    }
  }
  // A care plan bills monthly from the month it started, up to the last invoice.
  for (const p of plans) {
    if (!p.last_invoice_on) continue;
    let cursor = p.started_on.slice(0, 8) + '01';
    const last = p.last_invoice_on;
    let guard = 0;
    while (cursor <= last && guard < 60) {
      events.push({
        on: cursor,
        amount: Number(p.monthly_amount),
        kind: 'care_plan',
        label: `${p.client_name} care plan`,
        care_plan_id: p.id,
      });
      const d = new Date(`${cursor}T00:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + 1);
      cursor = d.toISOString().slice(0, 10);
      guard += 1;
    }
  }
  return events.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
}

export function sumBetween(events, from, to) {
  return events.filter((e) => e.on >= from && e.on <= to).reduce((a, e) => a + e.amount, 0);
}

export function sumByMonth(events) {
  const map = new Map();
  for (const e of events) {
    const k = monthKey(e.on);
    map.set(k, (map.get(k) ?? 0) + e.amount);
  }
  return map;
}

export function totalReceived(events, upTo = null) {
  return events.filter((e) => (upTo ? e.on <= upTo : true)).reduce((a, e) => a + e.amount, 0);
}

/**
 * The daily touch target, read from the money task text rather than hardcoded.
 * Appendix C writes "15 first touches", "10 first touches", "Delivery only" and
 * so on, so the number the roadmap actually states is the number used.
 */
export function touchTargetFromTask(moneyTask) {
  const text = String(moneyTask ?? '');
  const m = /(\d+)\s+first touches/i.exec(text);
  if (m) return Number(m[1]);
  if (/^rest\b/i.test(text.trim())) return 0;
  return 0;
}

/** Active care plans and their monthly total, the recurring floor. */
export async function carePlanFloor(userId) {
  const row = await one(
    `SELECT COUNT(*) AS n, COALESCE(SUM(monthly_amount), 0) AS monthly
       FROM care_plans WHERE user_id = ? AND is_deleted = 0 AND active = 1`,
    [userId]
  );
  return { count: Number(row?.n ?? 0), monthly: Number(row?.monthly ?? 0) };
}

export async function touchStats(userId) {
  const [totals, replies, byWeek] = await Promise.all([
    one('SELECT COUNT(*) AS n, MAX(touched_on) AS last_touch FROM lead_touches WHERE user_id = ?', [userId]),
    one('SELECT COUNT(*) AS n FROM lead_touches WHERE user_id = ? AND reply = 1', [userId]),
    query(
      `SELECT c.week_n, COUNT(*) AS n, SUM(t.reply) AS replies
         FROM lead_touches t JOIN calendar_days c ON c.cal_date = t.touched_on
        WHERE t.user_id = ? AND c.week_n IS NOT NULL
        GROUP BY c.week_n ORDER BY c.week_n`,
      [userId]
    ),
  ]);
  const touches = Number(totals?.n ?? 0);
  const replied = Number(replies?.n ?? 0);
  return {
    touches,
    replies: replied,
    reply_rate: touches ? Math.round((replied / touches) * 1000) / 10 : 0,
    last_touch: totals?.last_touch ?? null,
    by_week: byWeek.map((r) => ({ week_n: Number(r.week_n), touches: Number(r.n), replies: Number(r.replies) })),
  };
}

export async function dealStats(userId) {
  const rows = await query(
    `SELECT status, COUNT(*) AS n, COALESCE(SUM(price), 0) AS value
       FROM deals WHERE user_id = ? AND is_deleted = 0 GROUP BY status`,
    [userId]
  );
  const byStatus = Object.fromEntries(rows.map((r) => [r.status, { count: Number(r.n), value: Number(r.value) }]));
  const quoted = rows.reduce((a, r) => a + Number(r.n), 0);
  const won = (byStatus.paid?.count ?? 0) + (byStatus.delivered?.count ?? 0) + (byStatus.in_delivery?.count ?? 0) + (byStatus.advance_paid?.count ?? 0);
  return {
    by_status: byStatus,
    quoted,
    won,
    win_rate: quoted ? Math.round((won / quoted) * 1000) / 10 : 0,
  };
}

/** O7 is locked until week 17. Enforced server side when a deal is created. */
export function offerLocked(offer, currentWeek) {
  if (!offer.unlocked_from_week) return { locked: false, reason: null };
  const week = Number(currentWeek ?? 0);
  if (week >= Number(offer.unlocked_from_week)) return { locked: false, reason: null };
  return {
    locked: true,
    reason:
      `${offer.code} is locked until week ${offer.unlocked_from_week}. ` +
      'Do not sell retrieval before you have built it once in Project 4. Selling something you have not built once is how you lose a week of study time repaying a mistake.',
  };
}
