/**
 * PATCH /api/dsa/topics/:id/progress
 *
 * Topic level progress, which is the only level available before a real problem
 * list has been imported.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { getDsaTopics } from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { optionalText, parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

const topicBody = z.object({
  solved: z.coerce.number().int().min(0).max(500).optional(),
  minutes: z.coerce.number().int().min(0).max(100000).optional(),
  notes: optionalText(4000).optional(),
});

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, topicBody);

  const topics = await getDsaTopics();
  const topic = topics.find((t) => Number(t.id) === Number(id));
  if (!topic) throw notFound('No such topic.');

  await run(
    'INSERT INTO dsa_topic_progress (user_id, topic_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE topic_id = VALUES(topic_id)',
    [user.id, topic.id]
  );

  const sets: string[] = [];
  const setParams: SqlParam[] = [];
  for (const key of ['solved', 'minutes', 'notes'] as const) {
    if (key in body) {
      sets.push(`${key} = ?`);
      setParams.push((body as Record<string, unknown>)[key] as SqlParam);
    }
  }
  if (sets.length) {
    setParams.push(user.id, topic.id);
    await run(
      `UPDATE dsa_topic_progress SET ${sets.join(', ')} WHERE user_id = ? AND topic_id = ?`,
      setParams
    );
  }

  const row = await one(
    'SELECT topic_id, solved, minutes, notes FROM dsa_topic_progress WHERE user_id = ? AND topic_id = ?',
    [user.id, topic.id]
  );
  return jsonOk(row);
});
