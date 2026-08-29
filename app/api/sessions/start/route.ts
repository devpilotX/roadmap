/**
 * POST /api/sessions/start
 *
 * Part 17.1 rule 1 is enforced here and by a database trigger: MONEY cannot
 * start before 16:30, and a study block cannot start inside the money hour.
 */

import { one, run } from '@/lib/db/pool';
import { openSession } from '@/lib/db/progress';
import { SESSION_BLOCKS } from '@/lib/db/sessions';
import { ruleViolation } from '@/lib/errors';
import { blockAllowedAt, nowDateTime, nowInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, positiveId, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const startBody = z.object({
  block: z.enum(SESSION_BLOCKS),
  resource_id: z.union([positiveId, z.null()]).optional(),
  week_link_id: z.union([positiveId, z.null()]).optional(),
});

export const POST = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, startBody);

  const now = nowInTz();
  const allowed = blockAllowedAt(body.block, now.minutes);
  if (!allowed.ok) throw ruleViolation(allowed.message!);

  const existing = await openSession(user.id);
  if (existing) {
    throw ruleViolation(
      `A ${existing.block} session is already running since ${existing.started_at}. Stop it before starting another.`
    );
  }

  const result = await run(
    `INSERT INTO study_sessions (user_id, block, session_date, resource_id, week_link_id, started_at, source)
     VALUES (?, ?, ?, ?, ?, ?, 'timer')`,
    [
      user.id,
      body.block,
      now.date,
      body.resource_id ?? null,
      body.week_link_id ?? null,
      nowDateTime(),
    ]
  );
  const row = await one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
    result.insertId,
    user.id,
  ]);
  return jsonOk(row, 201);
});
