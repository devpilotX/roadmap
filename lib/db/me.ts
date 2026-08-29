/**
 * me.ts | the signed in person's profile and settings.
 *
 * These two readers are used by the API and by the page shell, which needs the
 * theme before the first paint, so they live here rather than inside a route.
 *
 * The GitHub token is write only. Nothing here returns it or a masked version of
 * it, only a boolean saying whether one is set.
 */

import { one, run, type Row } from './pool';

export const PROFILE_FIELDS = [
  'full_name',
  'phone',
  'city',
  'github_user',
  'linkedin_url',
  'portfolio_url',
  'site_1',
  'site_2',
  'site_3',
  'upi_id',
  'target_role',
  'timezone',
  'bio',
  // The day this person actually starts. The 150 day window cannot move, because
  // final.md fixes every date in it, but the start date inside that window is
  // theirs to set. See lib/db/progress.ts startedOn().
  'roadmap_start',
] as const;

export interface Profile extends Row {
  user_id: number;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  github_user: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  site_1: string | null;
  site_2: string | null;
  site_3: string | null;
  upi_id: string | null;
  avatar_path: string | null;
  target_role: string | null;
  roadmap_start: string;
  roadmap_end: string;
  timezone: string;
  bio: string | null;
  has_github_token: boolean;
}

export async function loadProfile(userId: number): Promise<Profile | null> {
  const row = await one(
    `SELECT p.user_id, p.full_name, p.phone, p.city, p.github_user, p.linkedin_url,
            p.portfolio_url, p.site_1, p.site_2, p.site_3, p.upi_id, p.avatar_path,
            p.target_role, p.roadmap_start, p.roadmap_end, p.timezone, p.bio,
            (p.github_token IS NOT NULL) AS has_github_token
       FROM profiles p WHERE p.user_id = ?`,
    [userId]
  );
  if (!row) return null;
  return { ...row, has_github_token: Number(row.has_github_token) === 1 } as Profile;
}

export interface Settings extends Row {
  user_id: number;
  theme: 'system' | 'light' | 'dark';
  calendar_view: 'month' | 'week' | 'day';
  notify_blocks: string[];
  notify_gates: number;
  public_progress: number;
  public_slug: string | null;
  last_synced_at: string | null;
}

const SETTINGS_COLUMNS = `user_id, theme, calendar_view, notify_blocks_json, notify_gates,
            public_progress, public_slug, last_synced_at`;

export async function loadSettings(userId: number): Promise<Settings> {
  let row = await one(`SELECT ${SETTINGS_COLUMNS} FROM user_settings WHERE user_id = ?`, [userId]);
  if (!row) {
    await run('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);
    row = await one(`SELECT ${SETTINGS_COLUMNS} FROM user_settings WHERE user_id = ?`, [userId]);
  }
  let blocks: string[] | null = null;
  if (row?.notify_blocks_json) {
    try {
      blocks =
        typeof row.notify_blocks_json === 'string'
          ? JSON.parse(row.notify_blocks_json)
          : row.notify_blocks_json;
    } catch {
      blocks = null;
    }
  }
  return { ...(row ?? {}), notify_blocks: blocks ?? [] } as Settings;
}
