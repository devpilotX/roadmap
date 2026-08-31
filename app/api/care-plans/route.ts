/**
 * GET  /api/care-plans | the recurring floor, and how far it is from five plans.
 * POST /api/care-plans | one new plan. O8 has a floor of Rs 1,200 a month.
 */

import { limitOffset, one, query, run } from '@/lib/db/pool';
import { carePlanFloor } from '@/lib/money';
import { ruleViolation } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { carePlanBody } from '@/lib/server/schemas';
import { parseBody, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The page size, and the ceiling a caller may ask for. The same numbers as the
 * lead and problem lists, deliberately: one bound to remember.
 *
 * The target is five care plans, so 500 will not be reached by anyone using this
 * as intended. It is here because the query had no ceiling at all, and a table
 * that only ever grows will eventually be read in full by something.
 */
const LIST_LIMIT_DEFAULT = 500;
const LIST_LIMIT_MAX = 1000;

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const GET = authedRoute(async ({ request, user }) => {
  const f = parseQuery(request, listQuery);
  const plans = await query(
    `SELECT * FROM care_plans
      WHERE user_id = ? AND is_deleted = 0
      ORDER BY active DESC, started_on
      ${limitOffset(f.limit, f.offset)}`,
    [user.id]
  );
  const total = Number(
    (await one('SELECT COUNT(*) AS n FROM care_plans WHERE user_id = ? AND is_deleted = 0', [
      user.id,
    ]))?.n ?? 0
  );
  return jsonOk({
    care_plans: plans,
    floor: await carePlanFloor(user.id),
    target: 5,
    total,
    limit: f.limit,
    offset: f.offset,
  });
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
