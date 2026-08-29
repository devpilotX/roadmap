/**
 * PATCH /api/me/settings | theme, calendar view, notifications, public progress.
 */

import { run, type SqlParam } from '@/lib/db/pool';
import { loadSettings } from '@/lib/db/me';
import { randomSlug } from '@/lib/crypto';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const settingsBody = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    calendar_view: z.enum(['month', 'week', 'day']).optional(),
    notify_blocks: z
      .array(z.enum(['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT']))
      .max(6)
      .optional(),
    notify_gates: z.boolean().optional(),
    public_progress: z.boolean().optional(),
  })
  .partial();

export const PATCH = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, settingsBody);
  await loadSettings(user.id);

  const sets: string[] = [];
  const params: SqlParam[] = [];

  if (body.theme) {
    sets.push('theme = ?');
    params.push(body.theme);
  }
  if (body.calendar_view) {
    sets.push('calendar_view = ?');
    params.push(body.calendar_view);
  }
  if (body.notify_blocks) {
    sets.push('notify_blocks_json = CAST(? AS JSON)');
    params.push(JSON.stringify(body.notify_blocks));
  }
  if (body.notify_gates !== undefined) {
    sets.push('notify_gates = ?');
    params.push(body.notify_gates ? 1 : 0);
  }
  if (body.public_progress !== undefined) {
    sets.push('public_progress = ?');
    params.push(body.public_progress ? 1 : 0);
    if (body.public_progress) {
      const current = await loadSettings(user.id);
      if (!current.public_slug) {
        sets.push('public_slug = ?');
        params.push(randomSlug(9));
      }
    }
  }

  if (sets.length) {
    params.push(user.id);
    await run(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = ?`, params);
  }

  return jsonOk(await loadSettings(user.id));
});
