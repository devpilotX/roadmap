/**
 * GET /api/sessions | every study session on a day.
 */

import { query } from '@/lib/db/pool';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, parseQuery, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ request, user }) => {
  const q = parseQuery(request, z.object({ date: isoDate.optional() }));
  const date = q.date ?? todayInTz();
  const rows = await query(
    `SELECT id, block, session_date, started_at, ended_at, minutes, source, auto_closed, note, resource_id, week_link_id
       FROM study_sessions WHERE user_id = ? AND session_date = ? ORDER BY started_at`,
    [user.id, date]
  );
  return jsonOk({ date, sessions: rows });
});
