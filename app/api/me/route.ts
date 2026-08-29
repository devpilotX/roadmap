/**
 * GET /api/me | the signed in person, their profile and their settings.
 */

import { loadProfile, loadSettings } from '@/lib/db/me';
import { todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [profile, settings] = await Promise.all([loadProfile(user.id), loadSettings(user.id)]);
  return jsonOk({
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    },
    profile,
    settings,
    today: todayInTz(),
    timezone: config.timezone,
  });
});
