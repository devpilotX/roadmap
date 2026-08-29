/**
 * GET  /api/mocks | mock interviews, against the Week 20 target of ten.
 * POST /api/mocks | one new mock.
 */

import { one, query, run } from '@/lib/db/pool';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, optionalText, parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const rows = await query(
    'SELECT * FROM mock_interviews WHERE user_id = ? AND is_deleted = 0 ORDER BY held_on DESC, id DESC',
    [user.id]
  );
  const byKind: Record<string, number> = {};
  for (const r of rows) byKind[String(r.kind)] = (byKind[String(r.kind)] ?? 0) + 1;

  return jsonOk({
    mocks: rows,
    total: rows.length,
    by_kind: byKind,
    week20_target: 10,
    case_study_target: 4,
    from_february_target: 2,
    note: 'Ten mocks in Week 20, four of them case studies rather than coding mocks. Two a week from February.',
  });
});

const mockBody = z.object({
  held_on: isoDate,
  platform: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(200),
  kind: z.enum(['coding', 'system_design', 'case_study', 'rag_design', 'behavioural']).optional(),
  score: z.union([z.coerce.number().int().min(0).max(10), z.null()]).optional(),
  what_broke: optionalText(4000),
});

export const POST = authedRoute(async ({ request, user }) => {
  const b = await parseBody(request, mockBody);
  const result = await run(
    'INSERT INTO mock_interviews (user_id, held_on, platform, topic, kind, score, what_broke) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user.id, b.held_on, b.platform, b.topic, b.kind ?? 'coding', b.score ?? null, b.what_broke ?? null]
  );
  return jsonOk(await one('SELECT * FROM mock_interviews WHERE id = ?', [result.insertId]), 201);
});
