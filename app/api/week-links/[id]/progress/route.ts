/**
 * PATCH /api/week-links/:id/progress
 *
 * A week link that maps to a library row writes both, so /weeks and /library can
 * never disagree.
 */

import { getWeekLinks } from '@/lib/db/reference';
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

  const links = await getWeekLinks();
  const link = links.find((l) => Number(l.id) === Number(id));
  if (!link) throw notFound('No such week link.');

  const row = await writeLinkProgress(user.id, {
    weekLinkId: Number(link.id),
    resourceId: link.resource_id ? Number(link.resource_id) : null,
    patch: body,
  });
  return jsonOk(row);
});
