/**
 * PATCH /api/resources/:id/progress | progress against a library row.
 */

import { getResources } from '@/lib/db/reference';
import { writeLinkProgress } from '@/lib/db/links';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { linkProgressBody } from '@/lib/server/schemas';
import { parseBody, parseParams, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, linkProgressBody);

  const resources = await getResources();
  const resource = resources.find((r) => Number(r.id) === Number(id));
  if (!resource) throw notFound('No such resource.');

  const row = await writeLinkProgress(user.id, {
    resourceId: Number(resource.id),
    patch: body,
  });
  return jsonOk(row);
});
