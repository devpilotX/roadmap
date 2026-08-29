/**
 * GET  /api/leads | the lead list, filtered, plus the next fifteen due.
 * POST /api/leads | one new lead.
 */

import { one, query, run, type SqlParam } from '@/lib/db/pool';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { leadBody, LEAD_STATUSES } from '@/lib/server/schemas';
import { parseBody, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NEXT_15 = `SELECT id, name, category, area, phone, website, mobile_broken, rating, reviews, status,
              last_touch_on, next_touch_on
         FROM leads
        WHERE user_id = ? AND is_deleted = 0 AND status NOT IN ('won','lost','dead')
        ORDER BY (next_touch_on IS NULL) DESC, next_touch_on ASC, last_touch_on IS NULL DESC, id ASC
        LIMIT 15`;

const leadQuery = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  due: z.enum(['today', 'overdue', 'never']).optional(),
  q: z.string().max(120).optional(),
});

export const GET = authedRoute(async ({ request, user }) => {
  const f = parseQuery(request, leadQuery);
  const today = todayInTz();

  const where = ['user_id = ?', 'is_deleted = 0'];
  const params: SqlParam[] = [user.id];

  if (f.status) {
    where.push('status = ?');
    params.push(f.status);
  }
  if (f.due === 'today') {
    where.push('next_touch_on = ?');
    params.push(today);
  } else if (f.due === 'overdue') {
    where.push('next_touch_on < ?');
    params.push(today);
  } else if (f.due === 'never') {
    where.push('last_touch_on IS NULL');
  }
  if (f.q) {
    where.push('(name LIKE ? OR category LIKE ? OR area LIKE ?)');
    params.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
  }

  const leads = await query(
    `SELECT id, name, category, area, phone, website, mobile_broken, rating, reviews,
            status, last_touch_on, next_touch_on, notes,
            (SELECT COUNT(*) FROM lead_touches t WHERE t.lead_id = leads.id) AS touch_count
       FROM leads WHERE ${where.join(' AND ')}
      ORDER BY (next_touch_on IS NULL) DESC, next_touch_on ASC, last_touch_on IS NULL DESC, id ASC`,
    params
  );
  const next15 = await query(NEXT_15, [user.id]);

  return jsonOk({ leads, next_15: next15, count: leads.length, today });
});

export const POST = authedRoute(async ({ request, user }) => {
  const b = await parseBody(request, leadBody);

  const result = await run(
    `INSERT INTO leads (user_id, name, category, area, phone, website, mobile_broken, rating, reviews, status, next_touch_on, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
      b.name,
      b.category ?? null,
      b.area ?? null,
      b.phone ?? null,
      b.website ?? null,
      b.mobile_broken ? 1 : 0,
      b.rating ?? null,
      b.reviews ?? null,
      b.status ?? 'new',
      b.next_touch_on ?? null,
      b.notes ?? null,
    ]
  );
  const row = await one('SELECT * FROM leads WHERE id = ? AND user_id = ?', [
    result.insertId,
    user.id,
  ]);
  return jsonOk(row, 201);
});
