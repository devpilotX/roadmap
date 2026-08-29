/**
 * PATCH /api/projects/:id/progress | status, URLs, README ticks and notes.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { getProjects } from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import {
  httpUrl,
  optionalText,
  parseBody,
  parseParams,
  positiveId,
  z,
} from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

const projectBody = z.object({
  status: z.enum(['not_started', 'in_progress', 'shipped', 'live']).optional(),
  live_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  repo_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  readme_done: z.array(z.coerce.number().int().min(1).max(50)).max(50).optional(),
  notes: optionalText(4000).optional(),
});

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, projectBody);

  const projects = await getProjects();
  const project = projects.find((p) => Number(p.id) === Number(id));
  if (!project) throw notFound('No such project.');

  await run(
    'INSERT INTO project_progress (user_id, project_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE project_id = VALUES(project_id)',
    [user.id, project.id]
  );

  const sets: string[] = [];
  const params2: SqlParam[] = [];
  for (const key of ['status', 'live_url', 'repo_url', 'notes'] as const) {
    if (key in body) {
      const value = (body as Record<string, unknown>)[key];
      sets.push(`${key} = ?`);
      params2.push((value === '' ? null : value) as SqlParam);
    }
  }
  if (body.readme_done) {
    const unique = [...new Set(body.readme_done)].sort((a, b) => a - b);
    sets.push('readme_done_json = CAST(? AS JSON)');
    params2.push(JSON.stringify(unique));
  }
  if (sets.length) {
    params2.push(user.id, project.id);
    await run(
      `UPDATE project_progress SET ${sets.join(', ')} WHERE user_id = ? AND project_id = ?`,
      params2
    );
  }

  const row = await one(
    'SELECT project_id, status, live_url, repo_url, readme_done_json, notes FROM project_progress WHERE user_id = ? AND project_id = ?',
    [user.id, project.id]
  );
  return jsonOk(row);
});
