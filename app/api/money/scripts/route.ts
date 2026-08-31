/**
 * GET /api/money/scripts | the eight scripts from Part 17.7 and any edits.
 *
 * Editing a script creates a new version. The original is never overwritten.
 */

import { limitOffset, one, query } from '@/lib/db/pool';
import { getMoneyScripts } from '@/lib/db/reference';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The page size, and the ceiling a caller may ask for. The same numbers as the
 * other lists, deliberately: one bound to remember.
 *
 * The eight scripts are fixed, but money_script_versions gains a row every time
 * one of them is edited and nothing ever deletes from it, so this is the list in
 * the response that actually grows. The newest versions are the ones worth having,
 * which is why the order is now descending: a page from the front of a growing
 * list is more useful than a page from the far end of it.
 */
const LIST_LIMIT_DEFAULT = 500;
const LIST_LIMIT_MAX = 1000;

const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const GET = authedRoute(async ({ request, user }) => {
  const f = parseQuery(request, listQuery);

  const [scripts, versions, versionCount, profile] = await Promise.all([
    getMoneyScripts(),
    query(
      `SELECT id, script_code, version, title, body, created_at
         FROM money_script_versions
        WHERE user_id = ?
        ORDER BY script_code, version DESC
        ${limitOffset(f.limit, f.offset)}`,
      [user.id]
    ),
    one('SELECT COUNT(*) AS n FROM money_script_versions WHERE user_id = ?', [user.id]),
    one('SELECT upi_id, phone, site_1, site_2 FROM profiles WHERE user_id = ?', [user.id]),
  ]);

  return jsonOk({
    scripts,
    versions,
    total: Number(versionCount?.n ?? 0),
    limit: f.limit,
    offset: f.offset,
    substitutions: {
      '{{business}}': 'the business name',
      '{{price}}': 'the quoted price',
      '[upi id]': profile?.upi_id ?? 'set your UPI id on /profile',
      '[url]': 'the live URL you are delivering',
    },
    note: 'Editing a script creates a new version. The original from Part 17.7 is never overwritten.',
  });
});
