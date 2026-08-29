/**
 * GET /api/after | Part 15, what happens after January 2027.
 */

import { query } from '@/lib/db/pool';
import { getContinuation } from '@/lib/db/reference';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [rows, progress] = await Promise.all([
    getContinuation(),
    query(
      'SELECT continuation_id, done, completed_on, notes FROM continuation_progress WHERE user_id = ?',
      [user.id]
    ),
  ]);
  const byId = new Map(progress.map((p) => [Number(p.continuation_id), p]));

  const withProgress = rows.map((r): Record<string, any> => ({
    ...r,
    done: Number(byId.get(Number(r.id))?.done ?? 0) === 1,
    completed_on: byId.get(Number(r.id))?.completed_on ?? null,
    notes: byId.get(Number(r.id))?.notes ?? '',
  }));

  const grouped: Record<string, Record<string, any>[]> = {};
  for (const r of withProgress) {
    const kind = String(r.kind);
    grouped[kind] = grouped[kind] ?? [];
    grouped[kind].push(r);
  }

  const checkable = withProgress.filter((r) =>
    ['bridge', 'quarter', 'year_detail'].includes(String(r.kind))
  );

  return jsonOk({
    rows: withProgress,
    grouped,
    done_count: checkable.filter((r) => r.done).length,
    total_count: checkable.length,
  });
});
