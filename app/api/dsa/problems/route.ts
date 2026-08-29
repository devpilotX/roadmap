/**
 * GET /api/dsa/problems | the imported problem list, filtered.
 */

import { query, type SqlParam } from '@/lib/db/pool';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const problemQuery = z.object({
  topic: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  status: z.enum(['todo', 'solved', 'revisit', 'failed_twice']).optional(),
  q: z.string().max(120).optional(),
});

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
    params.push(`%${f.q}%`);
  }

  const rows = await query(
    `SELECT p.id, p.topic_id, p.ord, p.name, p.difficulty, p.url, t.name AS topic, t.ord AS topic_ord,
            COALESCE(g.status, 'todo') AS status, g.first_solved_at, g.last_solved_on,
            g.times_solved, g.times_failed, g.minutes_spent, g.notes
       FROM dsa_problems p
       JOIN dsa_topics t ON t.id = p.topic_id
       LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
      WHERE ${where.join(' AND ')}
      ORDER BY t.ord, p.ord`,
    params
  );
  return jsonOk({ problems: rows, count: rows.length });
});
