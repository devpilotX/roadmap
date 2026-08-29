/**
 * GET /api/calendar.ics | the 150 days as a subscribable calendar.
 */

import { getCalendarDays } from '@/lib/db/reference';
import { buildIcs, type IcsDay } from '@/lib/ics';
import { config } from '@/lib/config';
import { authedRoute, fileResponse } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const cal = await getCalendarDays();
  const ics = buildIcs({
    days: cal as unknown as IcsDay[],
    origin: config.publicOrigin,
    timezone: config.timezone,
    userLabel: user.display_name,
  });
  return fileResponse(ics, {
    type: 'text/calendar; charset=utf-8',
    filename: 'roadmap-2026-2027.ics',
  });
});
