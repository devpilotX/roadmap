/**
 * PATCH /api/me/profile
 *
 * The start date has to sit inside the window from final.md. Moving it repaints
 * every day already on file, because day_colour is stored rather than derived on
 * read, and the days before the new start have to stop being red.
 */

import { transaction } from '@/lib/db/pool';
import { loadProfile, PROFILE_FIELDS } from '@/lib/db/me';
import { recomputeRange } from '@/lib/db/progress';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { optionalHttpUrl, optionalText, parseBody, z } from '@/lib/server/validate';
import type { SqlParam } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const profileBody = z
  .object({
    full_name: optionalText(160),
    phone: optionalText(32),
    city: optionalText(120),
    github_user: optionalText(120),
    linkedin_url: optionalHttpUrl,
    portfolio_url: optionalHttpUrl,
    site_1: optionalHttpUrl,
    site_2: optionalHttpUrl,
    site_3: optionalHttpUrl,
    upi_id: optionalText(120),
    target_role: optionalText(8),
    timezone: optionalText(64),
    bio: optionalText(2000),
    display_name: z.string().trim().min(1).max(120).optional(),
    /**
     * Refusing a date outside the window is not pedantry: a start after the last
     * day would mark all 150 days neutral and quietly turn the tracker off.
     */
    roadmap_start: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'The start date must be written as YYYY-MM-DD.')
      .refine((v) => v >= config.roadmap.firstDay && v <= config.roadmap.lastDay, {
        message:
          `The start date must fall between ${config.roadmap.firstDay} and ${config.roadmap.lastDay}. ` +
          'Those are the dates final.md fixes, and they cannot move.',
      })
      .optional(),
  })
  .partial();

export const PATCH = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, profileBody);
  const before = await loadProfile(user.id);

  const sets: string[] = [];
  const params: SqlParam[] = [];
  for (const f of PROFILE_FIELDS) {
    if (f in body) {
      sets.push(`${f} = ?`);
      params.push((body as Record<string, SqlParam>)[f]);
    }
  }

  await transaction(async (tx) => {
    if (sets.length) {
      params.push(user.id);
      await tx.run(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
    }
    if (body.display_name) {
      await tx.run('UPDATE users SET display_name = ? WHERE id = ?', [body.display_name, user.id]);
    }
    await tx.run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
       VALUES (?, 'profiles', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
      [user.id, String(user.id), JSON.stringify(before ?? {}), JSON.stringify(body)]
    );
  });

  // day_colour is stored, not derived on read, so moving the start date has to
  // repaint every day already on file. Without this the days before the new
  // start would stay red until each one was touched again.
  if (body.roadmap_start && body.roadmap_start !== before?.roadmap_start) {
    await recomputeRange(user.id, config.roadmap.firstDay, config.roadmap.lastDay);
  }

  return jsonOk(await loadProfile(user.id));
});
