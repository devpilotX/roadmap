/**
 * GET /api/projects | the four projects, their README sections and this week's pushes.
 */

import { query } from '@/lib/db/pool';
import { getProjects, getReadmeSections, getWeeks } from '@/lib/db/reference';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [projects, sections, weeks] = await Promise.all([
    getProjects(),
    getReadmeSections(),
    getWeeks(),
  ]);
  const progress = await query(
    'SELECT project_id, status, live_url, repo_url, readme_done_json, notes FROM project_progress WHERE user_id = ?',
    [user.id]
  );
  const byId = new Map(progress.map((p) => [Number(p.project_id), p]));
  const today = todayInTz();
  const currentWeek =
    weeks.find((w) => today >= w.start_date && today <= w.end_date)?.n ?? null;

  const pushRows = await query(
    `SELECT r.project_id, COUNT(*) AS pushes, COALESCE(SUM(p.commit_count),0) AS commits
       FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
      WHERE p.user_id = ? AND r.project_id IS NOT NULL
        AND p.push_date >= DATE_SUB(?, INTERVAL WEEKDAY(?) DAY)
      GROUP BY r.project_id`,
    [user.id, today, today]
  );
  const pushByProject = new Map(pushRows.map((r) => [Number(r.project_id), r]));

  return jsonOk({
    readme_sections: sections,
    current_week: currentWeek,
    projects: projects.map((p) => {
      const row = byId.get(Number(p.id));
      let done: number[] = [];
      if (row?.readme_done_json) {
        try {
          done =
            typeof row.readme_done_json === 'string'
              ? JSON.parse(row.readme_done_json)
              : row.readme_done_json;
        } catch {
          done = [];
        }
      }
      return {
        ...p,
        status: row?.status ?? 'not_started',
        live_url: row?.live_url ?? null,
        repo_url: row?.repo_url ?? null,
        notes: row?.notes ?? '',
        readme_done: Array.isArray(done) ? done : [],
        readme_percent: Math.round(
          ((Array.isArray(done) ? done.length : 0) / sections.length) * 100
        ),
        is_active:
          currentWeek !== null && Number(currentWeek) >= p.week_from && Number(currentWeek) <= p.week_to,
        pushes_this_week: Number(pushByProject.get(Number(p.id))?.pushes ?? 0),
        commits_this_week: Number(pushByProject.get(Number(p.id))?.commits ?? 0),
      };
    }),
  });
});
