/**
 * GET /api/ops
 *
 * The operational record: when the scripts last ran and what they found.
 *
 * link_check_runs, backup_log and dsa_imports are written by the CLI scripts.
 * This is the read side, so "when was the last backup" has an answer that comes
 * from the row a script actually wrote.
 */

import { query } from '@/lib/db/pool';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async () => {
  const [links, backups, imports, deadResources, deadWeekLinks] = await Promise.all([
    query(
      'SELECT id, started_at, finished_at, checked_count, dead_count, notes FROM link_check_runs ORDER BY id DESC LIMIT 10'
    ),
    query(
      'SELECT id, ran_at, kind, file_name, bytes, ok, message FROM backup_log ORDER BY id DESC LIMIT 15'
    ),
    query(
      `SELECT id, source_name, rows_read, rows_written, easy_count, medium_count, hard_count,
              dry_run, report, created_at
         FROM dsa_imports ORDER BY id DESC LIMIT 10`
    ),
    query(
      'SELECT category_no, ord, label, url, last_status, last_checked FROM resources WHERE is_alive = 0 ORDER BY category_no, ord'
    ),
    query(
      'SELECT week_n, ord, label, url, last_status, last_checked FROM week_links WHERE is_alive = 0 ORDER BY week_n, ord'
    ),
  ]);

  const lastOf = (rows: Record<string, any>[], kind: string) =>
    rows.find((r) => r.kind === kind) ?? null;

  return jsonOk({
    link_check: {
      runs: links,
      last: links[0] ?? null,
      dead_resources: deadResources,
      dead_week_links: deadWeekLinks,
      dead_total: deadResources.length + deadWeekLinks.length,
      note: 'A dead link is flagged, never deleted. Cross reference Appendix A for the replacement.',
    },
    backups: {
      rows: backups,
      last_dump: lastOf(backups, 'dump'),
      last_export: lastOf(backups, 'export'),
      note: 'A dump is mysqldump. An export is the CSV and JSON copy you can read without this application.',
    },
    dsa_imports: {
      rows: imports,
      last: imports[0] ?? null,
      note:
        'final.md does not contain the 474 problem names. They only ever arrive through ' +
        'scripts/import-dsa.mjs from a real tracker export.',
    },
    commands: [
      { label: 'Check every link', command: 'npm run check-links' },
      { label: 'Back up the database', command: 'npm run backup' },
      { label: 'Export everything to disk', command: 'npm run export-all' },
      { label: 'Import a DSA export', command: 'npm run import-dsa -- export.csv' },
      { label: 'Sync GitHub pushes', command: 'npm run sync-github' },
      { label: 'Write the Saturday digest', command: 'npm run digest' },
    ],
  });
});
