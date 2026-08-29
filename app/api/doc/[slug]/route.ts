/**
 * GET /api/doc/:slug | any level 2 or 3 section of final.md, verbatim.
 */

import { getDocSections } from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ slug: z.string().max(160) });

export const GET = authedRoute<{ slug: string }>(async ({ params }) => {
  const { slug } = parseParams(params, paramsSchema);
  const sections = await getDocSections();
  const hit = sections.find((s) => s.slug === slug);
  if (!hit) throw notFound('No such section of final.md.');
  return jsonOk(hit);
});
