/**
 * GET /api/sundays | the 21 Sundays: working, gate audit and rest.
 */

import { query } from '@/lib/db/pool';
import { getSundays, getWeeks } from '@/lib/db/reference';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [sundays, weeks] = await Promise.all([getSundays(), getWeeks()]);
  const logs = await query(
    'SELECT week_n, completed, hours, notes FROM sunday_logs WHERE user_id = ?',
    [user.id]
  );
  const byWeek = new Map(logs.map((l) => [Number(l.week_n), l]));
  const today = todayInTz();

  return jsonOk({
    today,
    sundays: sundays.map((s) => {
      const l = byWeek.get(Number(s.week_n));
      return {
        ...s,
        week_title: weeks.find((w) => w.n === s.week_n)?.title ?? null,
        completed: Number(l?.completed ?? 0) === 1,
        hours_logged: Number(l?.hours ?? 0),
        notes: l?.notes ?? '',
        is_today: s.sunday_date === today,
        is_past: s.sunday_date < today,
      };
    }),
    totals: {
      working: sundays.filter((s) => s.kind === 'working').length,
      gate: sundays.filter((s) => s.kind === 'gate').length,
      rest: sundays.filter((s) => s.kind === 'rest').length,
    },
  });
});
