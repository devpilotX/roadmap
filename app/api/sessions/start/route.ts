/**
 * POST /api/sessions/start
 *
 * Part 17.1 rule 1 is enforced here and by a database trigger: MONEY cannot
 * start before 16:30, and a study block cannot start inside the money hour.
 *
 * Two changes from the original, both about not getting stuck.
 *
 * 1. AN ABANDONED TIMER NO LONGER BLOCKS THE APP FOREVER. The rule "stop the
 *    running session before starting another" is right for a session started
 *    today and wrong for one left running last Tuesday, because the only way to
 *    stop that one was a route that could itself fail on the seven day rule. A
 *    session still open from an earlier date is now closed automatically, with
 *    auto_closed = 1 and zero minutes, because an abandoned timer did not measure
 *    anything anybody should be credited for. A session open from today still
 *    refuses, which is the behaviour that was actually wanted.
 *
 * 2. THE RACE IS SETTLED BY THE DATABASE. Checking for an open session and then
 *    inserting is a read-then-write race, and two taps produced two open timers
 *    that the stop route could then only ever close one of. Migration 005 adds
 *    uq_session_open_one, a unique key over a generated column holding the user
 *    id only while the row is open, so the second insert is refused by MySQL.
 *    The check below stays as the source of the good error message; the key is
 *    what makes it true.
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

/** mysql2 surfaces a unique key collision as this code. */
function isDuplicate(err: unknown): boolean {
  return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}

export const POST = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, startBody);

  const now = nowInTz();
  const allowed = blockAllowedAt(body.block, now.minutes);
  if (!allowed.ok) throw ruleViolation(allowed.message!);

  let autoClosed: { id: number; block: string; session_date: string } | null = null;

  const existing = await openSession(user.id);
  if (existing) {
    if ((existing.session_date as string) === now.date) {
      throw ruleViolation(
        `A ${existing.block} session is already running since ${existing.started_at}. Stop it before starting another.`
      );
    }
    // Left running on an earlier day. Close it rather than refusing every future
    // session. Zero minutes: nobody can say how long that timer was really used.
    await run(
      `UPDATE study_sessions
          SET ended_at = started_at, minutes = 0, auto_closed = 1
        WHERE id = ? AND user_id = ? AND ended_at IS NULL`,
      [existing.id, user.id]
    );
    autoClosed = {
      id: Number(existing.id),
      block: String(existing.block),
      session_date: String(existing.session_date),
    };
  }

  let insertId: number;
  try {
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
    insertId = result.insertId;
  } catch (err) {
    if (isDuplicate(err)) {
      // uq_session_open_one refused it: another request opened a session in the
      // moment between the check above and this insert.
      throw ruleViolation(
        'A session was started by another tab a moment ago. Stop it before starting another.'
      );
    }
    throw err;
  }

  const row = await one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
    insertId,
    user.id,
  ]);
  return jsonOk(autoClosed ? { ...row, auto_closed_previous: autoClosed } : row, 201);
});
