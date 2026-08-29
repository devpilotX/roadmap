/**
 * GET  /api/care-plans | the recurring floor, and how far it is from five plans.
 * POST /api/care-plans | one new plan. O8 has a floor of Rs 1,200 a month.
 */

import { one, query, run } from '@/lib/db/pool';
import { carePlanFloor } from '@/lib/money';
import { ruleViolation } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { carePlanBody } from '@/lib/server/schemas';
import { parseBody } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const plans = await query(
    'SELECT * FROM care_plans WHERE user_id = ? AND is_deleted = 0 ORDER BY active DESC, started_on',
    [user.id]
  );
  return jsonOk({ care_plans: plans, floor: await carePlanFloor(user.id), target: 5 });
});

export const POST = authedRoute(async ({ request, user }) => {
  const b = await parseBody(request, carePlanBody);

  if (b.monthly_amount < 1200) {
    throw ruleViolation('O8 has a floor of Rs 1,200 a month. Never go under the floor.');
  }

  const result = await run(
    `INSERT INTO care_plans (user_id, client_name, monthly_amount, started_on, active, last_invoice_on, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      b.client_name,
      b.monthly_amount,
      b.started_on,
      b.active === false ? 0 : 1,
      b.last_invoice_on ?? null,
      b.notes ?? null,
    ]
  );
  return jsonOk(await one('SELECT * FROM care_plans WHERE id = ?', [result.insertId]), 201);
});
