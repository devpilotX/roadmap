/**
 * POST /api/leads/import
 *
 * Matches leads.csv from Appendix B of final.md. A dry run reports what would be
 * written without writing anything, because thirty rows typed in a hurry is
 * exactly the moment you want to check before committing.
 */

import { one, run, type SqlParam } from '@/lib/db/pool';
import { badRequest } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { LEAD_STATUSES } from '@/lib/server/schemas';
import { parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const importBody = z.object({
  csv: z.string().min(1).max(2_000_000),
  dry_run: z.boolean().optional(),
});

/** The columns Appendix B names, in order. */
const LEAD_COLUMNS = [
  'name',
  'category',
  'area',
  'phone',
  'website',
  'mobile broken',
  'rating',
  'reviews',
  'status',
  'last touch date',
  'next touch date',
  'notes',
];

/** RFC 4180 CSV, including quoted cells and doubled quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

export const POST = authedRoute(async ({ request, user }) => {
  // A pasted CSV is the one body allowed past the 256 kB default. The schema caps
  // the text at 2,000,000 characters, so the byte ceiling is set to match rather
  // than leaving the two to disagree.
  const body = await parseBody(request, importBody, { maxBytes: 2_100_000 });

  const rows = parseCsv(body.csv);
  if (rows.length < 2) throw badRequest('That CSV has a header but no rows.');

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/_/g, ' '));
  const idx = (name: string): number => header.findIndex((h) => h === name || h.startsWith(name));
  const nameCol = idx('name');
  if (nameCol === -1) {
    throw badRequest(
      `That CSV has no name column. The expected columns, from Appendix B, are: ${LEAD_COLUMNS.join(
        ', '
      )}.`
    );
  }

  const report = {
    read: rows.length - 1,
    written: 0,
    skipped: 0,
    problems: [] as string[],
  };
  const seen = new Set<string>();
  const toWrite: SqlParam[][] = [];

  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i];
    const name = String(r[nameCol] ?? '').trim();
    if (!name) {
      report.skipped += 1;
      report.problems.push(`Row ${i + 1}: no name.`);
      continue;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      report.skipped += 1;
      report.problems.push(`Row ${i + 1}: "${name}" appears twice in the file.`);
      continue;
    }
    seen.add(key);

    const get = (col: string): string | null => {
      const at = idx(col);
      return at === -1 ? null : String(r[at] ?? '').trim() || null;
    };
    const yes = (v: unknown): boolean => /^(y|yes|true|1)$/i.test(String(v ?? '').trim());
    const statusRaw = String(get('status') ?? 'new').toLowerCase();
    const status = (LEAD_STATUSES as readonly string[]).includes(statusRaw) ? statusRaw : 'new';

    toWrite.push([
      user.id,
      name,
      get('category'),
      get('area'),
      get('phone'),
      (() => {
        const w = get('website');
        if (!w) return null;
        return /^https?:\/\//i.test(w) ? w.slice(0, 500) : `https://${w}`.slice(0, 500);
      })(),
      yes(get('mobile broken')) ? 1 : 0,
      (() => {
        const n = Number(get('rating'));
        return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
      })(),
      (() => {
        const n = Number(String(get('reviews') ?? '').replace(/\D/g, ''));
        return Number.isFinite(n) && n > 0 ? n : null;
      })(),
      status,
      /^\d{4}-\d{2}-\d{2}$/.test(get('last touch date') ?? '') ? get('last touch date') : null,
      /^\d{4}-\d{2}-\d{2}$/.test(get('next touch date') ?? '') ? get('next touch date') : null,
      get('notes'),
    ]);
  }

  if (body.dry_run) {
    return jsonOk({
      ...report,
      dry_run: true,
      would_write: toWrite.length,
      sample: toWrite.slice(0, 5).map((r) => r[1]),
    });
  }

  for (const values of toWrite) {
    const existing = await one(
      'SELECT id FROM leads WHERE user_id = ? AND name = ? AND is_deleted = 0',
      [values[0], values[1]]
    );
    if (existing) {
      report.skipped += 1;
      report.problems.push(`"${values[1]}" is already on the list.`);
      continue;
    }
    await run(
      `INSERT INTO leads (user_id, name, category, area, phone, website, mobile_broken, rating, reviews, status, last_touch_on, next_touch_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values
    );
    report.written += 1;
  }

  return jsonOk({ ...report, dry_run: false }, 201);
});
