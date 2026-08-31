/**
 * GET /api/export/:name | one table as RFC 4180 CSV.
 *
 * The name is looked up in a fixed map, never interpolated from user input, so
 * this cannot be turned into a way to read an arbitrary table.
 */

import { query } from '@/lib/db/pool';
import { EXPORTABLE, toCsv } from '@/lib/exportTables';
import { notFound } from '@/lib/errors';
import { authedRoute, fileResponse } from '@/lib/server/route';
import { parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ name: z.string().max(80) });

export const GET = authedRoute<{ name: string }>(async ({ params, user }) => {
  const parsed = parseParams(params, paramsSchema);
  const name = parsed.name.replace(/\.csv$/i, '');

  // Object.hasOwn, not a truthiness test on the lookup. `EXPORTABLE['constructor']`
  // and `EXPORTABLE['toString']` inherit a function from Object.prototype, which is
  // truthy, so the guard passed and the query below ran with an impossible table
  // name and returned 500 instead of the 404 this is meant to give.
  const spec = Object.hasOwn(EXPORTABLE, name) ? EXPORTABLE[name] : undefined;
  if (!spec) {
    throw notFound(
      `${name} is not exportable. Try one of: ${Object.keys(EXPORTABLE).sort().join(', ')}`
    );
  }

  const rows = spec.user
    ? await query(`SELECT * FROM \`${name}\` WHERE user_id = ?`, [user.id])
    : await query(`SELECT * FROM \`${name}\``);

  return fileResponse(toCsv(rows), {
    type: 'text/csv; charset=utf-8',
    filename: `${name}.csv`,
  });
});
