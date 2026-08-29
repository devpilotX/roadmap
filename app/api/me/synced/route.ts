/**
 * POST /api/me/synced | records the heartbeat behind "last synced".
 */

import { run } from '@/lib/db/pool';
import { loadSettings } from '@/lib/db/me';
import { nowDateTime } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const POST = authedRoute(async ({ user }) => {
  await loadSettings(user.id);
  const at = nowDateTime();
  await run('UPDATE user_settings SET last_synced_at = ? WHERE user_id = ?', [at, user.id]);
  return jsonOk({ last_synced_at: at });
});
