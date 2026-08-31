/**
 * GET /api/sessions | every study session on a day.
 */

import { limitOffset, one, query } from '@/lib/db/pool';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The page size, and the ceiling a caller may ask for. The same numbers as the
 * other lists, deliberately: one bound to remember.
 *
 * A day holds six tracked blocks, so a real day is a handful of rows and 500 will
 * never be reached honestly. The limit is here because the query had none: the
 * timer writes a row per start and nothing constrains how many times a person can
 * start one, so a stuck client could fill a single day without any bound stopping
 * the response from growing with it.
 */
const LIST_LIMIT_DEFAULT = 500;
const LIST_LIMIT_MAX = 1000;

const sessionQuery = z.object({
  date: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const GET = authedRoute(async ({ request, user }) => {
  const q = parseQuery(request, sessionQuery);
  const date = q.date ?? todayInTz();
  const rows = await query(
    `SELECT id, block, session_date, started_at, ended_at, minutes, source, auto_closed, note, resource_id, week_link_id
       FROM study_sessions
      WHERE user_id = ? AND session_date = ?
      ORDER BY started_at
      ${limitOffset(q.limit, q.offset)}`,
    [user.id, date]
  );
  const total = Number(
    (await one(
      'SELECT COUNT(*) AS n FROM study_sessions WHERE user_id = ? AND session_date = ?',
      [user.id, date]
    ))?.n ?? 0
  );
  return jsonOk({ date, sessions: rows, total, limit: q.limit, offset: q.offset });
});
