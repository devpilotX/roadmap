/**
 * GET  /api/leads | the lead list, filtered and paged, plus the next fifteen due.
 * POST /api/leads | one new lead.
 */

import { limitOffset, one, query, run, type SqlParam } from '@/lib/db/pool';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { leadBody, LEAD_STATUSES } from '@/lib/server/schemas';
import { parseBody, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The page size, and the ceiling a caller may ask for.
 *
 * Part 17.13 puts thirty rows a day from Google Maps into this table, so over 150
 * days the list is thousands of leads long and a response with no LIMIT grows
 * without bound. 500 is the default because it is more than any single day's work
 * and more than the whole seed CSV, so nothing a person is looking at today is
 * cut off; 1000 is the hard ceiling because a caller asking for more than that is
 * asking for a data export, and /api/export exists for exactly that.
 */
const LIST_LIMIT_DEFAULT = 500;
const LIST_LIMIT_MAX = 1000;

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
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

/**
 * Escapes the LIKE wildcards, and the escape character itself, in a search term.
 *
 * A search for "50%" reached MySQL as LIKE '%50%%', where the trailing per cent
 * is a wildcard rather than a character, so it matched every lead containing 50
 * and the person searching was quietly given the wrong answer. Underscore is the
 * same problem one character wide. Backslash is MySQL's default LIKE escape
 * character, so there is no ESCAPE clause to add; the backslash itself has to be
 * escaped first or a name containing one would break the pattern.
 */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export const GET = authedRoute(async ({ request, user }) => {
  const f = parseQuery(request, leadQuery);
  const today = todayInTz();

  // Every column is qualified because the touch count is now a join, and leads
  // and lead_touches share user_id and notes.
  const where = ['l.user_id = ?', 'l.is_deleted = 0'];
  const params: SqlParam[] = [user.id];

  if (f.status) {
    where.push('l.status = ?');
    params.push(f.status);
  }
  if (f.due === 'today') {
    where.push('l.next_touch_on = ?');
    params.push(today);
  } else if (f.due === 'overdue') {
    where.push('l.next_touch_on < ?');
    params.push(today);
  } else if (f.due === 'never') {
    where.push('l.last_touch_on IS NULL');
  }
  if (f.q) {
    const needle = `%${likeLiteral(f.q)}%`;
    where.push('(l.name LIKE ? OR l.category LIKE ? OR l.area LIKE ?)');
    params.push(needle, needle, needle);
  }
  const whereSql = where.join(' AND ');

  // touch_count came from a correlated subquery, so the number of COUNT(*) scans
  // over lead_touches was the number of rows returned. One LEFT JOIN and a GROUP
  // BY gets the same figure in a single pass. leads.id is the primary key, so
  // every other selected column is functionally dependent on the grouping column
  // and ONLY_FULL_GROUP_BY has nothing to object to even where it is enabled.
  const leads = await query(
    `SELECT l.id, l.name, l.category, l.area, l.phone, l.website, l.mobile_broken, l.rating,
            l.reviews, l.status, l.last_touch_on, l.next_touch_on, l.notes,
            COUNT(t.id) AS touch_count
       FROM leads l
       LEFT JOIN lead_touches t ON t.lead_id = l.id
      WHERE ${whereSql}
      GROUP BY l.id
      ORDER BY (l.next_touch_on IS NULL) DESC, l.next_touch_on ASC, l.last_touch_on IS NULL DESC, l.id ASC
      ${limitOffset(f.limit, f.offset)}`,
    [...params]
  );
  // How many rows the filter actually matches, so the client can tell a full page
  // from the end of the list. One aggregate against idx_lead_user_status, which is
  // cheaper than the per row subquery this replaced.
  const total = Number(
    (await one(`SELECT COUNT(*) AS n FROM leads l WHERE ${whereSql}`, params))?.n ?? 0
  );
  const next15 = await query(NEXT_15, [user.id]);

  // count stays the number of rows in this response, which is what it always
  // meant and what the client already reads. total, limit and offset are added.
  return jsonOk({
    leads,
    next_15: next15,
    count: leads.length,
    today,
    total,
    limit: f.limit,
    offset: f.offset,
  });
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
