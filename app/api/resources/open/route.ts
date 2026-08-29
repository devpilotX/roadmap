/**
 * POST /api/resources/open
 *
 * Called by "open and start". Only a todo becomes reading; a done link stays done.
 */

import { one } from '@/lib/db/pool';
import { getWeekLinks } from '@/lib/db/reference';
import { writeLinkProgress } from '@/lib/db/links';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const openBody = z.object({
  resource_id: z.union([positiveId, z.null()]).optional(),
  week_link_id: z.union([positiveId, z.null()]).optional(),
});

export const POST = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, openBody);

  let resourceId = body.resource_id ?? null;
  const weekLinkId = body.week_link_id ?? null;

  if (!resourceId && weekLinkId) {
    const links = await getWeekLinks();
    const hit = links.find((l) => Number(l.id) === Number(weekLinkId));
    resourceId = hit?.resource_id ? Number(hit.resource_id) : null;
  }
  if (!resourceId && !weekLinkId) throw notFound('Nothing to open.');

  const current = resourceId
    ? await one('SELECT status FROM resource_progress WHERE user_id = ? AND resource_id = ?', [
        user.id,
        resourceId,
      ])
    : await one('SELECT status FROM week_link_progress WHERE user_id = ? AND week_link_id = ?', [
        user.id,
        weekLinkId,
      ]);
  const status = (!current || current.status === 'todo' ? 'reading' : current.status) as
    | 'todo'
    | 'reading'
    | 'done';

  await writeLinkProgress(user.id, { resourceId, weekLinkId, patch: { status } });
  return jsonOk({ resource_id: resourceId, week_link_id: weekLinkId, status });
});
