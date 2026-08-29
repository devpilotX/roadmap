/**
 * GET /api/export/all.json | everything, in one file you can read without this app.
 *
 * Declared as its own segment so the dynamic :name route below it cannot swallow
 * it. The table list lives in lib/exportTables.ts, shared with the CLI script, so
 * a table can never be exportable through the API and invisible to the backup.
 */

import { query } from '@/lib/db/pool';
import { EXPORTABLE } from '@/lib/exportTables';
import { authedRoute, fileResponse } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const out: {
    exported_at: string;
    user_id: number;
    tables: Record<string, Record<string, any>[]>;
  } = {
    exported_at: new Date().toISOString(),
    user_id: user.id,
    tables: {},
  };

  for (const [name, spec] of Object.entries(EXPORTABLE)) {
    out.tables[name] = spec.user
      ? await query(`SELECT * FROM \`${name}\` WHERE user_id = ?`, [user.id])
      : await query(`SELECT * FROM \`${name}\``);
  }

  return fileResponse(JSON.stringify(out, null, 2), {
    type: 'application/json; charset=utf-8',
    filename: 'roadmap-export.json',
  });
});
