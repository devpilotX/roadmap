/**
 * GET  /api/deals | every deal with its overdue state.
 * POST /api/deals | one new deal, checked against the Part 17 rules.
 */

import { one, query, run } from '@/lib/db/pool';
import { assertDealRules } from '@/lib/db/deals';
import { dealStats } from '@/lib/money';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { dealBody } from '@/lib/server/schemas';
import { parseBody } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const today = todayInTz();
  const deals = await query(
    `SELECT d.*, l.name AS lead_name, o.name AS offer_name, o.price_low, o.price_high
       FROM deals d
       LEFT JOIN leads l ON l.id = d.lead_id
       JOIN offers o ON o.code = d.offer_code
      WHERE d.user_id = ? AND d.is_deleted = 0
      ORDER BY d.created_at DESC`,
    [user.id]
  );

  return jsonOk({
    today,
    deals: deals.map((d): Record<string, any> => ({
      ...d,
      overdue:
        Boolean(d.delivery_due) &&
        d.delivery_due < today &&
        !['delivered', 'paid', 'dead', 'refunded'].includes(String(d.status)),
      days_to_delivery: d.delivery_due
        ? Math.round(
            (new Date(`${d.delivery_due}T00:00:00Z`).getTime() -
              new Date(`${today}T00:00:00Z`).getTime()) /
              86400000
          )
        : null,
    })),
    stats: await dealStats(user.id),
  });
});

export const POST = authedRoute(async ({ request, user }) => {
  const b = await parseBody(request, dealBody);
  await assertDealRules(b);

  const result = await run(
    `INSERT INTO deals (user_id, lead_id, client_name, offer_code, price, advance_amount, advance_on,
                        delivery_due, delivered_on, balance_amount, balance_on, status, referral_asked, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      b.lead_id ?? null,
      b.client_name,
      b.offer_code,
      b.price,
      b.advance_amount ?? null,
      b.advance_on ?? null,
      b.delivery_due ?? null,
      b.delivered_on ?? null,
      b.balance_amount ?? null,
      b.balance_on ?? null,
      b.status ?? 'quoted',
      b.referral_asked ? 1 : 0,
      b.notes ?? null,
    ]
  );
  return jsonOk(await one('SELECT * FROM deals WHERE id = ?', [result.insertId]), 201);
});
