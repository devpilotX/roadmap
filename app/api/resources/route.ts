/**
 * GET /api/resources | the Part 7 library, filtered.
 */

import { query } from '@/lib/db/pool';
import { getResourceCategories, getResources } from '@/lib/db/reference';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseQuery, weekNumber, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const resourceQuery = z.object({
  category: z.coerce.number().int().min(1).max(20).optional(),
  week: weekNumber.optional(),
  cost: z.string().max(40).optional(),
  status: z.enum(['todo', 'reading', 'done']).optional(),
  q: z.string().max(120).optional(),
});

export const GET = authedRoute(async ({ request, user }) => {
  const f = parseQuery(request, resourceQuery);

  const [categories, resources, progress] = await Promise.all([
    getResourceCategories(),
    getResources(),
    query(
      'SELECT resource_id, status, minutes, rating, notes, completed_at FROM resource_progress WHERE user_id = ?',
      [user.id]
    ),
  ]);
  const byId = new Map(progress.map((p) => [Number(p.resource_id), p]));

  /** A library row with this person's progress folded in. */
  type LibraryRow = Record<string, any> & {
    weeks: number[];
    status: 'todo' | 'reading' | 'done';
  };

  let rows: LibraryRow[] = resources.map(
    (r): LibraryRow => ({
      ...r,
      is_alive: Number(r.is_alive) === 1,
      weeks: r.weeks_csv ? String(r.weeks_csv).split(',').map(Number) : [],
      status: (byId.get(Number(r.id))?.status ?? 'todo') as 'todo' | 'reading' | 'done',
      minutes: Number(byId.get(Number(r.id))?.minutes ?? 0),
      rating: byId.get(Number(r.id))?.rating ?? null,
      notes: byId.get(Number(r.id))?.notes ?? '',
    })
  );

  if (f.category) rows = rows.filter((r) => Number(r.category_no) === f.category);
  if (f.week) rows = rows.filter((r) => r.weeks.includes(f.week!));
  if (f.cost) rows = rows.filter((r) => String(r.cost).toLowerCase().includes(f.cost!.toLowerCase()));
  if (f.status) rows = rows.filter((r) => r.status === f.status);
  if (f.q) {
    const q = f.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        String(r.label).toLowerCase().includes(q) ||
        String(r.why).toLowerCase().includes(q) ||
        String(r.category_name).toLowerCase().includes(q)
    );
  }

  const tally = { todo: 0, reading: 0, done: 0 };
  for (const r of rows) tally[r.status] += 1;

  return jsonOk({
    categories,
    resources: rows,
    total: resources.length,
    shown: rows.length,
    tally,
    dead: resources.filter((r) => Number(r.is_alive) === 0).length,
  });
});
