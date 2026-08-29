/**
 * GET  /api/writeups | the three public write ups recruiters actually read.
 * POST /api/writeups | one new write up.
 */

import { one, query, run } from '@/lib/db/pool';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { httpUrl, isoDate, optionalText, parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const rows = await query(
    'SELECT * FROM writeups WHERE user_id = ? AND is_deleted = 0 ORDER BY published_on DESC, id DESC',
    [user.id]
  );
  return jsonOk({
    writeups: rows,
    total: rows.length,
    target: 3,
    note: 'Write three things publicly: one on the ITC Reclaim reconciliation logic, one on the Ragas numbers and what they revealed, one on the MCP server. These are what recruiters actually read.',
  });
});

const writeupBody = z.object({
  title: z.string().trim().min(1).max(255),
  url: httpUrl,
  published_on: isoDate,
  topic: optionalText(200),
});

export const POST = authedRoute(async ({ request, user }) => {
  const b = await parseBody(request, writeupBody);
  const result = await run(
    'INSERT INTO writeups (user_id, title, url, published_on, topic) VALUES (?, ?, ?, ?, ?)',
    [user.id, b.title, b.url, b.published_on, b.topic ?? null]
  );
  return jsonOk(await one('SELECT * FROM writeups WHERE id = ?', [result.insertId]), 201);
});
