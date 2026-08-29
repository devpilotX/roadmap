/**
 * GET  /api/pushes | the contribution grid, the runs and this week against six.
 * POST /api/pushes | a manual push entry, for when the API cannot see a repo.
 */

import { one, run } from '@/lib/db/pool';
import { pushSummary } from '@/lib/github';
import { recomputeRange } from '@/lib/db/progress';
import { getGithubRules, getWeeks } from '@/lib/db/reference';
import { notFound, ruleViolation } from '@/lib/errors';
import { addDays, isEditableDate, mondayOf, todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import {
  isoDate,
  optionalText,
  parseBody,
  parseQuery,
  positiveId,
  z,
} from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ request, user }) => {
  const q = parseQuery(request, z.object({ from: isoDate.optional(), to: isoDate.optional() }));
  const today = todayInTz();
  const from = q.from ?? config.roadmap.firstDay;
  const to = q.to ?? config.roadmap.lastDay;

  const [summary, rules, weeks, profile] = await Promise.all([
    pushSummary(user.id, { firstDay: from, lastDay: to, today }),
    getGithubRules(),
    getWeeks(),
    one(
      'SELECT github_user, (github_token IS NOT NULL) AS has_token FROM profiles WHERE user_id = ?',
      [user.id]
    ),
  ]);

  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const thisWeek = summary.grid.filter((g) => g.date >= monday && g.date <= sunday);
  const week1 = weeks.find((w) => Number(w.n) === 1);
  const week1Commits = week1
    ? summary.grid
        .filter((g) => g.date >= week1.start_date && g.date <= week1.end_date)
        .reduce((a, g) => a + g.commits, 0)
    : 0;
  const hasToken = Number(profile?.has_token ?? 0) === 1;

  // `pushSummary` also reports a mode, taken from the last recorded sync. The
  // Express build spread it over the token derived value, which left `mode`
  // disagreeing with `mode_cost` on the same response. Both are kept, named for
  // what they actually are.
  const { mode: lastSyncMode, ...summaryRest } = summary;

  return jsonOk({
    from,
    to,
    today,
    rules,
    github_user: profile?.github_user ?? null,
    has_token: hasToken,
    ...summaryRest,
    last_sync_mode: lastSyncMode,
    mode: hasToken ? 'authenticated' : 'anonymous',
    mode_cost: hasToken
      ? 'Authenticated: 5,000 requests an hour.'
      : 'Unauthenticated: 60 requests an hour per IP address, against 5,000 with a token. Add a token on /profile to stop the sync being throttled.',
    week: {
      monday,
      sunday,
      push_days: thisWeek.length,
      target: config.roadmap.weeklyPushTarget,
      commits: thisWeek.reduce((a, g) => a + g.commits, 0),
    },
    week1: {
      repo: 'the Week 1 utility repository',
      commits: week1Commits,
      target: config.roadmap.week1CommitTarget,
      window: week1 ? `${week1.start_date} to ${week1.end_date}` : null,
      applies: Boolean(week1 && today <= week1.end_date),
    },
    honesty_line:
      'Empty commits, backdated commits and padding are not tracked and not welcome. A push carrying more than twenty commits with no file changes is flagged rather than counted.',
  });
});

const manualPush = z.object({
  repo_id: positiveId,
  push_date: isoDate,
  commit_count: z.coerce.number().int().min(1).max(200),
  message_head: optionalText(255),
});

export const POST = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, manualPush);

  const editable = isEditableDate(body.push_date, todayInTz());
  if (!editable.ok) throw ruleViolation(editable.reason!);

  const repo = await one('SELECT id, full_name FROM github_repos WHERE id = ? AND user_id = ?', [
    body.repo_id,
    user.id,
  ]);
  if (!repo) throw notFound('No such repository on your list.');

  await run(
    `INSERT INTO github_pushes (user_id, repo_id, push_date, pushed_at, commit_count, sha_head, message_head, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
     ON DUPLICATE KEY UPDATE commit_count = VALUES(commit_count), message_head = VALUES(message_head)`,
    [
      user.id,
      repo.id,
      body.push_date,
      `${body.push_date} 12:00:00`,
      body.commit_count,
      `manual-${body.push_date}-${repo.id}`.padEnd(40, '0').slice(0, 40),
      body.message_head ?? null,
    ]
  );
  await recomputeRange(user.id, body.push_date, body.push_date);
  return jsonOk({ repo: repo.full_name, push_date: body.push_date }, 201);
});
