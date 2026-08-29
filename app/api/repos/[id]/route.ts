/**
 * PATCH /api/repos/:id
 *
 * Reclassifying a repository changes whether its pushes count, so the whole
 * window is repainted afterwards.
 */

import { one, run } from '@/lib/db/pool';
import { recomputeRange } from '@/lib/db/progress';
import { notFound } from '@/lib/errors';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });
const bodySchema = z.object({ kind: z.enum(['project', 'tracker', 'client', 'other']) });

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, bodySchema);

  const repo = await one('SELECT id, kind FROM github_repos WHERE id = ? AND user_id = ?', [
    id,
    user.id,
  ]);
  if (!repo) throw notFound('No such repository.');

  const counts = body.kind === 'project' || body.kind === 'tracker' ? 1 : 0;
  await run('UPDATE github_repos SET kind = ?, counts_to_target = ? WHERE id = ? AND user_id = ?', [
    body.kind,
    counts,
    repo.id,
    user.id,
  ]);
  await recomputeRange(user.id, config.roadmap.firstDay, config.roadmap.lastDay);

  const row = await one(
    'SELECT id, full_name, kind, counts_to_target FROM github_repos WHERE id = ?',
    [repo.id]
  );
  return jsonOk(row);
});
