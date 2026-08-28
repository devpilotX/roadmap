/**
 * github.mjs (routes) | /pushes, /repos and the sync.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, query, run } from '../../db/pool.mjs';
import { ensureRepos, pushSummary, syncUser } from '../../lib/github.mjs';
import { recomputeRange } from '../../db/progress.mjs';
import { getGithubRules, getWeeks } from '../../db/reference.mjs';
import { ok, notFound, ruleViolation } from '../../lib/errors.mjs';
import { isEditableDate, todayInTz, mondayOf, addDays } from '../../lib/dates.mjs';
import { githubSyncLimiter } from '../../middleware/rateLimit.mjs';
import { isoDate, optionalText, positiveId, validate } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

/* ------------------------------------------------------------ GET /pushes */

router.get(
  '/pushes',
  validate({ query: z.object({ from: isoDate.optional(), to: isoDate.optional() }) }),
  async (req, res, next) => {
    try {
      const today = todayInTz();
      const from = req.validQuery.from ?? config.roadmap.firstDay;
      const to = req.validQuery.to ?? config.roadmap.lastDay;
      const [summary, rules, weeks, profile] = await Promise.all([
        pushSummary(req.user.id, { firstDay: from, lastDay: to, today }),
        getGithubRules(),
        getWeeks(),
        one('SELECT github_user, (github_token IS NOT NULL) AS has_token FROM profiles WHERE user_id = ?', [
          req.user.id,
        ]),
      ]);

      const monday = mondayOf(today);
      const sunday = addDays(monday, 6);
      const thisWeek = summary.grid.filter((g) => g.date >= monday && g.date <= sunday);
      const week1 = weeks.find((w) => w.n === 1);
      const week1Commits = week1
        ? summary.grid
            .filter((g) => g.date >= week1.start_date && g.date <= week1.end_date)
            .reduce((a, g) => a + g.commits, 0)
        : 0;

      return ok(res, {
        from,
        to,
        today,
        rules,
        github_user: profile?.github_user ?? null,
        has_token: Number(profile?.has_token ?? 0) === 1,
        mode: Number(profile?.has_token ?? 0) === 1 ? 'authenticated' : 'anonymous',
        mode_cost:
          Number(profile?.has_token ?? 0) === 1
            ? 'Authenticated: 5,000 requests an hour.'
            : 'Unauthenticated: 60 requests an hour per IP address, against 5,000 with a token. Add a token on /profile to stop the sync being throttled.',
        ...summary,
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
    } catch (err) {
      return next(err);
    }
  }
);

/* ------------------------------------------------------ POST /pushes/sync */

router.post('/pushes/sync', githubSyncLimiter, async (req, res, next) => {
  try {
    const report = await syncUser(req.user.id);
    if (report.pushes_written) {
      await recomputeRange(req.user.id, config.roadmap.firstDay, config.roadmap.lastDay);
    }
    return ok(res, report);
  } catch (err) {
    return next(err);
  }
});

/* ----------------------------------------------- POST /pushes, manual entry */

const manualPush = z.object({
  repo_id: positiveId,
  push_date: isoDate,
  commit_count: z.coerce.number().int().min(1).max(200),
  message_head: optionalText(255),
});

router.post('/pushes', validate({ body: manualPush }), async (req, res, next) => {
  try {
    const editable = isEditableDate(req.body.push_date, todayInTz());
    if (!editable.ok) throw ruleViolation(editable.reason);

    const repo = await one('SELECT id, full_name FROM github_repos WHERE id = ? AND user_id = ?', [
      req.body.repo_id,
      req.user.id,
    ]);
    if (!repo) throw notFound('No such repository on your list.');

    await run(
      `INSERT INTO github_pushes (user_id, repo_id, push_date, pushed_at, commit_count, sha_head, message_head, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')
       ON DUPLICATE KEY UPDATE commit_count = VALUES(commit_count), message_head = VALUES(message_head)`,
      [
        req.user.id,
        repo.id,
        req.body.push_date,
        `${req.body.push_date} 12:00:00`,
        req.body.commit_count,
        `manual-${req.body.push_date}-${repo.id}`.padEnd(40, '0').slice(0, 40),
        req.body.message_head ?? null,
      ]
    );
    await recomputeRange(req.user.id, req.body.push_date, req.body.push_date);
    return ok(res, { repo: repo.full_name, push_date: req.body.push_date }, 201);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------- GET /repos */

router.get('/repos', async (req, res, next) => {
  try {
    const repos = await ensureRepos(req.user.id);
    return ok(res, { repos });
  } catch (err) {
    return next(err);
  }
});

const repoBody = z.object({
  full_name: z.string().trim().min(1).max(200),
  kind: z.enum(['project', 'tracker', 'client', 'other']),
});

router.post('/repos', validate({ body: repoBody }), async (req, res, next) => {
  try {
    // A client repository never counts towards the study push target.
    const counts = req.body.kind === 'project' || req.body.kind === 'tracker' ? 1 : 0;
    // This is an upsert on (user_id, full_name), so it can also reclassify a
    // repository that already carries pushes. Whether those pushes count is being
    // changed, so the window has to be repainted for the same reason PATCH does
    // it. Read the previous value first, so the recompute only runs when the
    // answer actually moved.
    const previous = await one(
      'SELECT counts_to_target FROM github_repos WHERE user_id = ? AND full_name = ?',
      [req.user.id, req.body.full_name]
    );
    await run(
      `INSERT INTO github_repos (user_id, full_name, kind, counts_to_target)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE kind = VALUES(kind), counts_to_target = VALUES(counts_to_target)`,
      [req.user.id, req.body.full_name, req.body.kind, counts]
    );
    if (previous && Number(previous.counts_to_target) !== counts) {
      await recomputeRange(req.user.id, config.roadmap.firstDay, config.roadmap.lastDay);
    }
    const row = await one('SELECT id, full_name, kind, counts_to_target FROM github_repos WHERE user_id = ? AND full_name = ?', [
      req.user.id,
      req.body.full_name,
    ]);
    return ok(res, row, 201);
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/repos/:id',
  validate({
    params: z.object({ id: positiveId }),
    body: z.object({ kind: z.enum(['project', 'tracker', 'client', 'other']) }),
  }),
  async (req, res, next) => {
    try {
      const repo = await one('SELECT id, kind FROM github_repos WHERE id = ? AND user_id = ?', [
        req.params.id,
        req.user.id,
      ]);
      if (!repo) throw notFound('No such repository.');
      const counts = req.body.kind === 'project' || req.body.kind === 'tracker' ? 1 : 0;
      await run('UPDATE github_repos SET kind = ?, counts_to_target = ? WHERE id = ? AND user_id = ?', [
        req.body.kind,
        counts,
        repo.id,
        req.user.id,
      ]);
      await recomputeRange(req.user.id, config.roadmap.firstDay, config.roadmap.lastDay);
      const row = await one('SELECT id, full_name, kind, counts_to_target FROM github_repos WHERE id = ?', [repo.id]);
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
