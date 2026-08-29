/**
 * GET  /api/repos | the repositories on this person's list.
 * POST /api/repos | add or reclassify one. A client repo never counts towards
 *                   the study push target.
 */

import { one, run } from '@/lib/db/pool';
import { ensureRepos } from '@/lib/github';
import { recomputeRange } from '@/lib/db/progress';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const repos = await ensureRepos(user.id);
  return jsonOk({ repos });
});

const repoBody = z.object({
  full_name: z.string().trim().min(1).max(200),
  kind: z.enum(['project', 'tracker', 'client', 'other']),
});

export const POST = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, repoBody);

  const counts = body.kind === 'project' || body.kind === 'tracker' ? 1 : 0;
  // This is an upsert on (user_id, full_name), so it can also reclassify a
  // repository that already carries pushes. Whether those pushes count is being
  // changed, so the window has to be repainted for the same reason PATCH does
  // it. Read the previous value first, so the recompute only runs when the
  // answer actually moved.
  const previous = await one(
    'SELECT counts_to_target FROM github_repos WHERE user_id = ? AND full_name = ?',
    [user.id, body.full_name]
  );

  await run(
    `INSERT INTO github_repos (user_id, full_name, kind, counts_to_target)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE kind = VALUES(kind), counts_to_target = VALUES(counts_to_target)`,
    [user.id, body.full_name, body.kind, counts]
  );

  if (previous && Number(previous.counts_to_target) !== counts) {
    await recomputeRange(user.id, config.roadmap.firstDay, config.roadmap.lastDay);
  }

  const row = await one(
    'SELECT id, full_name, kind, counts_to_target FROM github_repos WHERE user_id = ? AND full_name = ?',
    [user.id, body.full_name]
  );
  return jsonOk(row, 201);
});
