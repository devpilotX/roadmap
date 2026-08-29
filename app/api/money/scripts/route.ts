/**
 * GET /api/money/scripts | the eight scripts from Part 17.7 and any edits.
 *
 * Editing a script creates a new version. The original is never overwritten.
 */

import { one, query } from '@/lib/db/pool';
import { getMoneyScripts } from '@/lib/db/reference';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [scripts, versions, profile] = await Promise.all([
    getMoneyScripts(),
    query(
      'SELECT id, script_code, version, title, body, created_at FROM money_script_versions WHERE user_id = ? ORDER BY script_code, version',
      [user.id]
    ),
    one('SELECT upi_id, phone, site_1, site_2 FROM profiles WHERE user_id = ?', [user.id]),
  ]);

  return jsonOk({
    scripts,
    versions,
    substitutions: {
      '{{business}}': 'the business name',
      '{{price}}': 'the quoted price',
      '[upi id]': profile?.upi_id ?? 'set your UPI id on /profile',
      '[url]': 'the live URL you are delivering',
    },
    note: 'Editing a script creates a new version. The original from Part 17.7 is never overwritten.',
  });
});
