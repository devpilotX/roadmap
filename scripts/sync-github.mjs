/**
 * sync-github.mjs | the cron half of the push tracker.
 *
 * Part 18.4 of final.md, and build prompt section 10. All of the GitHub logic
 * lives in src/lib/github.mjs, so the script and the /pushes button behave
 * identically. This file only decides who to sync, reports what happened, and
 * exits with a code cron can act on.
 *
 * What is respected, because the build prompt requires it:
 *   - authenticated at 5,000 requests an hour, anonymous at 60 per IP per hour,
 *     and the active mode is printed along with what it costs
 *   - a 403 with x-ratelimit-remaining: 0 stops the run and reports the reset
 *     time. The API is never hammered
 *   - ETags are stored and sent as If-None-Match, so an unchanged repository is
 *     free. "not modified" in the summary means a request that cost nothing
 *   - /users/{user}/events is only read for freshness. Per repo commits are the
 *     source of truth for history
 *   - manual entry on /pushes always remains, so a sync that cannot run is an
 *     inconvenience and never a dead end
 *
 * Usage
 *   node scripts/sync-github.mjs                     every active user
 *   node scripts/sync-github.mjs --user=me@x.com     one user
 *   node scripts/sync-github.mjs --since=2026-08-28  override the commit window
 *   node scripts/sync-github.mjs --dry-run           report the plan, call nothing
 *   node scripts/sync-github.mjs --quiet             summary only
 *
 * Cron, every 30 minutes:
 *   0,30 * * * *  cd /srv/roadmap-tracker && /usr/bin/node scripts/sync-github.mjs >> /var/log/roadmap/github.log 2>&1
 *
 * Exit codes
 *   0  everything synced, or there was nothing to do
 *   1  a hard failure, for example the database is down
 *   2  a rate limit stopped the run. Cron should treat this as "try later",
 *      not as a bug, which is why it is its own code.
 */

import { config } from '../src/config.mjs';
import { closePool, one, query } from '../src/db/pool.mjs';
import { todayInTz } from '../src/lib/dates.mjs';
import { pushSummary, syncUser } from '../src/lib/github.mjs';
import {
  banner, bad, good, info, parseArgv, runScript, say, step, table, warn,
} from './lib/cli.mjs';

const { flags, values } = parseArgv(process.argv.slice(2), ['user', 'since']);
const dryRun = flags.has('dry-run');
const quiet = flags.has('quiet');

const since = (() => {
  if (!values.has('since')) return null;
  const v = values.get('since');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`--since must be YYYY-MM-DD, got "${v}"`);
  return `${v}T00:00:00Z`;
})();

function hoursText(h) {
  if (h === null || h === undefined) return 'never';
  const n = Number(h);
  if (n < 1) return `${Math.round(n * 60)} minutes ago`;
  if (n < 48) return `${n.toFixed(1)} hours ago`;
  return `${Math.floor(n / 24)} days ago`;
}

async function main() {
  banner(
    'sync-github.mjs | push tracking against the target of six a week',
    dryRun ? 'dry run, no GitHub request is made and nothing is written' : `api ${config.githubApi}`
  );

  const users = values.has('user')
    ? await query('SELECT id, email, display_name FROM users WHERE email = ? AND is_active = 1', [values.get('user')])
    : await query('SELECT id, email, display_name FROM users WHERE is_active = 1 ORDER BY id');

  if (!users.length) {
    say('');
    warn(
      values.has('user')
        ? `No active user with the email ${values.get('user')}.`
        : 'There are no active users yet, so there is nothing to sync. Sign up first.'
    );
    return 0;
  }

  step(`${users.length} user${users.length === 1 ? '' : 's'} to sync`);

  let rateLimited = false;
  let hardFailures = 0;
  const summaries = [];

  for (const user of users) {
    const profile = await one(
      'SELECT github_user, github_token IS NOT NULL AS has_token FROM profiles WHERE user_id = ?',
      [user.id]
    );
    const ghUser = profile?.github_user ?? null;
    const hasToken = Boolean(Number(profile?.has_token ?? 0));
    const mode = hasToken ? 'authenticated' : 'anonymous';

    say('');
    info(`${user.email}`);
    info(`  github user   ${ghUser ?? 'not set on /profile'}`);
    info(`  mode          ${mode}`);
    info(
      hasToken
        ? '  budget        5,000 requests an hour, so a 30 minute cron is comfortable'
        : '  budget        60 requests an hour for this whole IP. Six repositories plus the events feed is seven ' +
          'requests a run, so a 30 minute cron uses 14 of the 60. Adding a token on /profile removes the worry.'
    );

    if (!ghUser) {
      warn('  skipped: no GitHub username, and manual entry on /pushes still works');
      summaries.push({ user: user.email, mode, repos: 0, pushes: 0, free: 0, flagged: 0, result: 'no username' });
      continue;
    }

    if (dryRun) {
      // A dry run reads, it does not register. ensureRepos would insert rows.
      const repos = await query(
        'SELECT full_name, kind, counts_to_target FROM github_repos WHERE user_id = ? ORDER BY kind, full_name',
        [user.id]
      );
      if (repos.length) {
        info(`  would check   ${repos.length} repositories plus the events feed, ${repos.length + 1} requests`);
        table(
          repos.map((r) => ({ repository: r.full_name, kind: r.kind, counts: Number(r.counts_to_target) ? 'yes' : 'no' })),
          ['repository', 'kind', 'counts']
        );
      } else {
        const projects = await query('SELECT repo FROM projects ORDER BY id');
        info(`  would register the ${projects.length} project repositories plus roadmap-tracker on the first real run:`);
        info(`                ${[...projects.map((p) => p.repo), 'roadmap-tracker'].join(', ')}`);
      }
      summaries.push({ user: user.email, mode, repos: repos.length, pushes: 0, free: 0, flagged: 0, result: 'dry run' });
      continue;
    }

    let report;
    try {
      report = await syncUser(user.id, since ? { since } : {});
    } catch (err) {
      hardFailures += 1;
      bad(`  ${err.message}`);
      summaries.push({ user: user.email, mode, repos: 0, pushes: 0, free: 0, flagged: 0, result: 'failed' });
      continue;
    }

    if (report.rate_limited) rateLimited = true;

    info(`  repos checked ${report.repos_checked}`);
    info(`  pushes stored ${report.pushes_written}`);
    info(`  free replies  ${report.not_modified}   (304 Not Modified, an ETag paid for itself)`);
    if (report.flagged) {
      warn(`  flagged       ${report.flagged} push${report.flagged === 1 ? '' : 'es'} carrying more than 20 commits. Flagged, not counted.`);
    }
    if (report.rate) {
      info(`  rate limit    ${report.rate.remaining} of ${report.rate.limit} left${report.rate.reset ? `, resets ${new Date(report.rate.reset * 1000).toISOString().slice(11, 19)} UTC` : ''}`);
    }
    for (const e of report.errors) warn(`  ${e}`);

    if (!quiet) {
      const s = await pushSummary(user.id, {
        firstDay: config.roadmap.firstDay,
        lastDay: config.roadmap.lastDay,
        today: todayInTz(),
      });
      info(`  last push     ${s.last_push ? `${s.last_push.repo}, ${hoursText(s.hours_since_last_push)}` : 'none on a repository that counts'}`);
      info(`  runs          current ${s.current_run} days, longest ${s.longest_run} days`);
      if (s.streak_cancelled) {
        bad(`  72 hours with no push. The streak is cancelled. Last push ${s.last_push?.pushed_at ?? 'unknown'}.`);
      } else if (s.red_banner) {
        warn('  48 hours with no push on a study week. /pushes is showing the red banner.');
      }
    }

    summaries.push({
      user: user.email,
      mode: report.mode,
      repos: report.repos_checked,
      pushes: report.pushes_written,
      free: report.not_modified,
      flagged: report.flagged,
      result: report.rate_limited ? 'rate limited' : report.errors.length ? 'partial' : 'ok',
    });
  }

  step('Summary');
  table(summaries, ['user', 'mode', 'repos', 'pushes', 'free', 'flagged', 'result']);

  if (rateLimited) {
    say('');
    warn('A rate limit stopped part of this run. Nothing was hammered and nothing was lost.');
    warn('Exit code 2 so cron can treat this as "try again later" rather than a failure.');
    return 2;
  }
  if (hardFailures) return 1;
  say('');
  good(dryRun ? 'Dry run complete. No GitHub request was made.' : 'Sync complete.');
  return 0;
}

await runScript('sync-github.mjs', main, { closePool });
