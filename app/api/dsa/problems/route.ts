/**
 * GET /api/dsa/problems | the imported problem list, filtered and paged.
 */

import { limitOffset, one, query, type SqlParam } from '@/lib/db/pool';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The page size, and the ceiling a caller may ask for. The same numbers as the
 * lead list, deliberately: one bound to remember rather than one per endpoint.
 *
 * 500 clears the 474 problems Appendix D lists, so an unfiltered request still
 * returns the whole catalogue and the screen that groups by topic is unaffected.
 * The point of the limit is that the response stops growing if a longer list is
 * ever imported, not that it truncates the one in front of us today.
 */
const LIST_LIMIT_DEFAULT = 500;
const LIST_LIMIT_MAX = 1000;

const problemQuery = z.object({
  topic: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  status: z.enum(['todo', 'solved', 'revisit', 'failed_twice']).optional(),
  q: z.string().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

/**
 * Escapes the LIKE wildcards, and the escape character itself, in a search term.
 *
 * A search for "50%" reached MySQL as LIKE '%50%%', where the trailing per cent
 * is a wildcard rather than a character, so it matched every problem containing
 * 50 instead of the one that was asked for. Underscore is the same problem one
 * character wide. Backslash is MySQL's default LIKE escape character, so there is
 * no ESCAPE clause to add; the backslash itself has to be escaped first, or a name
 * containing one would break the pattern.
 */
function likeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * The joins, written once and used twice.
 *
 * The count has to carry them because the status filter reads dsa_progress, so a
 * count over dsa_problems alone would describe a different set from the page.
 */
const FROM_AND_JOINS = `FROM dsa_problems p
       JOIN dsa_topics t ON t.id = p.topic_id
       LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?`;

export const GET = authedRoute(async ({ request, user }) => {
  const f = parseQuery(request, problemQuery);

  const where = ['1 = 1'];
  const params: SqlParam[] = [user.id];
  if (f.topic) {
    where.push('p.topic_id = ?');
    params.push(f.topic);
  }
  if (f.difficulty) {
    where.push('p.difficulty = ?');
    params.push(f.difficulty);
  }
  if (f.status) {
    where.push("COALESCE(g.status, 'todo') = ?");
    params.push(f.status);
  }
  if (f.q) {
    where.push('p.name LIKE ?');
    params.push(`%${likeLiteral(f.q)}%`);
  }
  const whereSql = where.join(' AND ');

  const rows = await query(
    `SELECT p.id, p.topic_id, p.ord, p.name, p.difficulty, p.url, t.name AS topic, t.ord AS topic_ord,
            COALESCE(g.status, 'todo') AS status, g.first_solved_at, g.last_solved_on,
            g.times_solved, g.times_failed, g.minutes_spent, g.notes
       ${FROM_AND_JOINS}
      WHERE ${whereSql}
      ORDER BY t.ord, p.ord
      ${limitOffset(f.limit, f.offset)}`,
    [...params]
  );
  const total = Number(
    (await one(`SELECT COUNT(*) AS n ${FROM_AND_JOINS} WHERE ${whereSql}`, params))?.n ?? 0
  );

  // count stays the number of rows in this response, which is what it always
  // meant and what the client already reads. total, limit and offset are added.
  return jsonOk({ problems: rows, count: rows.length, total, limit: f.limit, offset: f.offset });
});
