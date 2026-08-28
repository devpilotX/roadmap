/**
 * /api/me | the signed in person, their profile, settings and password.
 *
 * The GitHub token is write only. No response in this file, or anywhere else,
 * returns it or a masked version of it. Only a boolean saying whether one is set.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, run, transaction } from '../../db/pool.mjs';
import { recomputeRange } from '../../db/progress.mjs';
import { ok, unauthorised, unprocessable, badRequest } from '../../lib/errors.mjs';
import { canEncrypt, encryptToken, randomSlug } from '../../lib/crypto.mjs';
import { checkPassword, hashPassword, verifyPassword } from '../../lib/passwords.mjs';
import { nowDateTime, todayInTz } from '../../lib/dates.mjs';
import { validate, optionalHttpUrl, optionalText } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

const PROFILE_FIELDS = [
  'full_name', 'phone', 'city', 'github_user', 'linkedin_url', 'portfolio_url',
  'site_1', 'site_2', 'site_3', 'upi_id', 'target_role', 'timezone', 'bio',
  // The day this person actually starts. The 150 day window cannot move, because
  // final.md fixes every date in it, but the start date inside that window is
  // theirs to set. See src/db/progress.mjs startedOn().
  'roadmap_start',
];

export async function loadProfile(userId) {
  const row = await one(
    `SELECT p.user_id, p.full_name, p.phone, p.city, p.github_user, p.linkedin_url,
            p.portfolio_url, p.site_1, p.site_2, p.site_3, p.upi_id, p.avatar_path,
            p.target_role, p.roadmap_start, p.roadmap_end, p.timezone, p.bio,
            (p.github_token IS NOT NULL) AS has_github_token
       FROM profiles p WHERE p.user_id = ?`,
    [userId]
  );
  if (!row) return null;
  return { ...row, has_github_token: Number(row.has_github_token) === 1 };
}

export async function loadSettings(userId) {
  let row = await one(
    `SELECT user_id, theme, calendar_view, notify_blocks_json, notify_gates,
            public_progress, public_slug, last_synced_at
       FROM user_settings WHERE user_id = ?`,
    [userId]
  );
  if (!row) {
    await run('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);
    row = await one(
      `SELECT user_id, theme, calendar_view, notify_blocks_json, notify_gates,
              public_progress, public_slug, last_synced_at
         FROM user_settings WHERE user_id = ?`,
      [userId]
    );
  }
  let blocks = null;
  if (row.notify_blocks_json) {
    try {
      blocks = typeof row.notify_blocks_json === 'string' ? JSON.parse(row.notify_blocks_json) : row.notify_blocks_json;
    } catch {
      blocks = null;
    }
  }
  return { ...row, notify_blocks: blocks ?? [] };
}

/* ---------------------------------------------------------------- GET /me */

router.get('/', async (req, res, next) => {
  try {
    const [profile, settings] = await Promise.all([loadProfile(req.user.id), loadSettings(req.user.id)]);
    return ok(res, {
      user: {
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.display_name,
        created_at: req.user.created_at,
        last_login_at: req.user.last_login_at,
      },
      profile,
      settings,
      today: todayInTz(),
      timezone: config.timezone,
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------- PATCH /me/profile */

const profileBody = z.object({
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
   * The start date has to sit inside the window from final.md. Refusing a date
   * outside it is not pedantry: a start after the last day would mark all 150
   * days neutral and quietly turn the tracker off.
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
}).partial();

router.patch('/profile', validate({ body: profileBody }), async (req, res, next) => {
  try {
    const before = await loadProfile(req.user.id);
    const sets = [];
    const params = [];
    for (const f of PROFILE_FIELDS) {
      if (f in req.body) {
        sets.push(`${f} = ?`);
        params.push(req.body[f]);
      }
    }
    await transaction(async (tx) => {
      if (sets.length) {
        params.push(req.user.id);
        await tx.run(`UPDATE profiles SET ${sets.join(', ')} WHERE user_id = ?`, params);
      }
      if (req.body.display_name) {
        await tx.run('UPDATE users SET display_name = ? WHERE id = ?', [req.body.display_name, req.user.id]);
      }
      await tx.run(
        `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
         VALUES (?, 'profiles', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
        [req.user.id, String(req.user.id), JSON.stringify(before ?? {}), JSON.stringify(req.body)]
      );
    });
    // day_colour is stored, not derived on read, so moving the start date has to
    // repaint every day already on file. Without this the days before the new
    // start would stay red until each one was touched again.
    if (req.body.roadmap_start && req.body.roadmap_start !== before?.roadmap_start) {
      await recomputeRange(req.user.id, config.roadmap.firstDay, config.roadmap.lastDay);
    }
    return ok(res, await loadProfile(req.user.id));
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------ PATCH /me/settings */

const settingsBody = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).optional(),
    calendar_view: z.enum(['month', 'week', 'day']).optional(),
    notify_blocks: z.array(z.enum(['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT'])).max(6).optional(),
    notify_gates: z.boolean().optional(),
    public_progress: z.boolean().optional(),
  })
  .partial();

router.patch('/settings', validate({ body: settingsBody }), async (req, res, next) => {
  try {
    await loadSettings(req.user.id);
    const sets = [];
    const params = [];
    if (req.body.theme) {
      sets.push('theme = ?');
      params.push(req.body.theme);
    }
    if (req.body.calendar_view) {
      sets.push('calendar_view = ?');
      params.push(req.body.calendar_view);
    }
    if (req.body.notify_blocks) {
      sets.push('notify_blocks_json = CAST(? AS JSON)');
      params.push(JSON.stringify(req.body.notify_blocks));
    }
    if (req.body.notify_gates !== undefined) {
      sets.push('notify_gates = ?');
      params.push(req.body.notify_gates ? 1 : 0);
    }
    if (req.body.public_progress !== undefined) {
      sets.push('public_progress = ?');
      params.push(req.body.public_progress ? 1 : 0);
      if (req.body.public_progress) {
        const current = await loadSettings(req.user.id);
        if (!current.public_slug) {
          sets.push('public_slug = ?');
          params.push(randomSlug(9));
        }
      }
    }
    if (sets.length) {
      params.push(req.user.id);
      await run(`UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = ?`, params);
    }
    return ok(res, await loadSettings(req.user.id));
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------------- POST /me/synced */

router.post('/synced', async (req, res, next) => {
  try {
    await loadSettings(req.user.id);
    const at = nowDateTime();
    await run('UPDATE user_settings SET last_synced_at = ? WHERE user_id = ?', [at, req.user.id]);
    return ok(res, { last_synced_at: at });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------- POST /me/password */

const passwordBody = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(1).max(200),
});

router.post('/password', validate({ body: passwordBody }), async (req, res, next) => {
  try {
    const row = await one('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!row) throw unauthorised();

    let valid = false;
    try {
      valid = await verifyPassword(row.password_hash, req.body.current_password);
    } catch {
      valid = false;
    }
    if (!valid) throw unauthorised('That is not your current password.');

    const check = checkPassword(req.body.new_password, {
      email: req.user.email,
      displayName: req.user.display_name,
    });
    if (!check.ok) throw unprocessable(check.reason);
    if (req.body.new_password === req.body.current_password) {
      throw unprocessable('The new password is the same as the old one.');
    }

    const hash = await hashPassword(req.body.new_password);
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    // Changing the password destroys every other session for this user.
    const keep = req.sessionID;
    const rows = await run(
      `DELETE FROM sessions
        WHERE session_id <> ?
          AND data LIKE ?`,
      [keep, `%"userId":${req.user.id}%`]
    );
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
       VALUES (?, 'users', ?, 'update', CAST(? AS JSON))`,
      [req.user.id, String(req.user.id), JSON.stringify({ password_changed: true })]
    );
    return ok(res, { changed: true, other_sessions_ended: rows.affectedRows ?? 0 });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------- PUT /me/github-token */

const tokenBody = z.object({
  token: z.union([z.string().trim().min(8).max(500), z.literal('')]),
});

router.put('/github-token', validate({ body: tokenBody }), async (req, res, next) => {
  try {
    if (req.body.token === '') {
      await run('UPDATE profiles SET github_token = NULL WHERE user_id = ?', [req.user.id]);
      await run(
        `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
         VALUES (?, 'profiles', ?, 'update', CAST(? AS JSON))`,
        [req.user.id, String(req.user.id), JSON.stringify({ github_token: 'removed' })]
      );
      return ok(res, { has_github_token: false });
    }
    if (!canEncrypt()) {
      throw badRequest(
        'TOKEN_ENC_KEY is not configured, so a token cannot be stored safely. Set it in .env and restart.'
      );
    }
    const blob = encryptToken(req.body.token);
    await run('UPDATE profiles SET github_token = ? WHERE user_id = ?', [blob, req.user.id]);
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
       VALUES (?, 'profiles', ?, 'update', CAST(? AS JSON))`,
      [req.user.id, String(req.user.id), JSON.stringify({ github_token: 'set' })]
    );
    // The token is never echoed back, not even masked.
    return ok(res, { has_github_token: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
