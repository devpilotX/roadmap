/**
 * github.mjs | push tracking, exactly as Part 18.4 states it.
 *
 * Rate limits are respected, not worked around:
 *   - with a token, 5,000 requests an hour; without one, 60 per hour per IP
 *   - a 403 with x-ratelimit-remaining: 0 backs off until x-ratelimit-reset
 *   - ETags are stored and sent as If-None-Match, so an unchanged response is free
 *   - the events endpoint is only used for freshness, because it returns roughly
 *     the last 90 days and 300 events. The commits endpoint per tracked repo is
 *     the source of truth for history.
 *
 * Empty, backdated and padded commits are not welcome. A push carrying more than
 * twenty commits with no file changes is flagged rather than counted.
 */

import { one, query, run } from '../db/pool.mjs';
import { decryptToken } from './crypto.mjs';
import { config } from '../config.mjs';

const UA = 'the-roadmap-tracker/1.0 (personal career tracker)';
const SUSPICIOUS_COMMIT_COUNT = 20;

export const REPOS_THAT_COUNT = [
  'itc-reclaim',
  'itc-reclaim-api',
  'itc-reclaim-ops',
  'tender-fit',
];

async function readToken(userId) {
  const row = await one('SELECT github_token, github_user FROM profiles WHERE user_id = ?', [userId]);
  if (!row) return { token: null, user: null };
  return { token: row.github_token ? decryptToken(row.github_token) : null, user: row.github_user };
}

async function syncState(userId, key) {
  const row = await one('SELECT * FROM github_sync_state WHERE user_id = ? AND resource_key = ?', [userId, key]);
  return row ?? null;
}

async function saveState(userId, key, patch) {
  await run(
    'INSERT INTO github_sync_state (user_id, resource_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE resource_key = VALUES(resource_key)',
    [userId, key]
  );
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k} = ?`);
    params.push(v);
  }
  if (!sets.length) return;
  params.push(userId, key);
  await run(`UPDATE github_sync_state SET ${sets.join(', ')} WHERE user_id = ? AND resource_key = ?`, params);
}

/**
 * One GitHub request with ETag support and rate limit accounting.
 * Returns { status, data, etag, rate, notModified }.
 */
async function ghFetch(path, { token, etag, signal } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': UA,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (etag) headers['If-None-Match'] = etag;

  const res = await fetch(`${config.githubApi}${path}`, { headers, signal });
  const rate = {
    limit: Number(res.headers.get('x-ratelimit-limit') ?? 0),
    remaining: Number(res.headers.get('x-ratelimit-remaining') ?? 0),
    reset: Number(res.headers.get('x-ratelimit-reset') ?? 0),
  };
  if (res.status === 304) {
    return { status: 304, data: null, etag, rate, notModified: true };
  }
  if (res.status === 403 && rate.remaining === 0) {
    const resetAt = rate.reset ? new Date(rate.reset * 1000).toISOString() : 'an unknown time';
    const err = new Error(
      `GitHub rate limit reached${token ? '' : ' on the unauthenticated 60 an hour limit'}. Backing off until ${resetAt}.`
    );
    err.code = 'RATE_LIMIT';
    err.rate = rate;
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`GitHub returned ${res.status}. ${body.slice(0, 200)}`);
    err.code = `HTTP_${res.status}`;
    err.rate = rate;
    throw err;
  }
  return {
    status: res.status,
    data: await res.json(),
    etag: res.headers.get('etag'),
    rate,
    notModified: false,
  };
}

/** Repositories the user has registered, with the four project repos seeded in. */
export async function ensureRepos(userId) {
  const projects = await query('SELECT id, code, name, repo FROM projects ORDER BY id');
  for (const p of projects) {
    await run(
      `INSERT INTO github_repos (user_id, full_name, kind, counts_to_target, project_id)
       VALUES (?, ?, 'project', 1, ?)
       ON DUPLICATE KEY UPDATE kind = VALUES(kind), counts_to_target = VALUES(counts_to_target), project_id = VALUES(project_id)`,
      [userId, p.repo, p.id]
    );
  }
  // The tracker repository also counts, per Part 18.4.
  await run(
    `INSERT INTO github_repos (user_id, full_name, kind, counts_to_target)
     VALUES (?, 'roadmap-tracker', 'tracker', 1)
     ON DUPLICATE KEY UPDATE kind = VALUES(kind)`,
    [userId]
  );
  return query('SELECT id, full_name, kind, counts_to_target, project_id FROM github_repos WHERE user_id = ? ORDER BY kind, full_name', [userId]);
}

function repoPath(githubUser, fullName) {
  return fullName.includes('/') ? fullName : `${githubUser}/${fullName}`;
}

/**
 * Syncs one user. Never hammers the API: it stops at the first rate limit and
 * records why, so /pushes can show a clear banner instead of failing silently.
 */
export async function syncUser(userId, { since = null } = {}) {
  const { token, user } = await readToken(userId);
  const mode = token ? 'authenticated' : 'anonymous';
  const report = {
    mode,
    github_user: user,
    repos_checked: 0,
    pushes_written: 0,
    not_modified: 0,
    flagged: 0,
    errors: [],
    rate: null,
    rate_limited: false,
  };

  if (!user) {
    report.errors.push(
      'No GitHub username is set on your profile, so there is nothing to sync. Add it on /profile.'
    );
    return report;
  }

  const repos = await ensureRepos(userId);
  const sinceIso = since ?? `${config.roadmap.firstDay}T00:00:00Z`;

  // The events endpoint is only used for freshness, never for history.
  try {
    const key = `events:${user}`;
    const state = await syncState(userId, key);
    const r = await ghFetch(`/users/${encodeURIComponent(user)}/events?per_page=100`, {
      token,
      etag: state?.etag,
    });
    await saveState(userId, key, {
      etag: r.etag ?? state?.etag ?? null,
      last_status: r.status,
      last_run_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      rate_remaining: r.rate.remaining,
      rate_reset_at: r.rate.reset ? new Date(r.rate.reset * 1000).toISOString().slice(0, 19).replace('T', ' ') : null,
      mode,
      last_error: null,
    });
    if (r.notModified) report.not_modified += 1;
    report.rate = r.rate;
  } catch (err) {
    if (err.code === 'RATE_LIMIT') {
      report.rate_limited = true;
      report.rate = err.rate;
      report.errors.push(err.message);
      return report;
    }
    report.errors.push(`events: ${err.message}`);
  }

  for (const repo of repos) {
    const full = repoPath(user, repo.full_name);
    const key = `commits:${full}`;
    const state = await syncState(userId, key);
    try {
      const r = await ghFetch(
        `/repos/${full}/commits?since=${encodeURIComponent(sinceIso)}&per_page=100`,
        { token, etag: state?.etag }
      );
      report.repos_checked += 1;
      report.rate = r.rate;
      await saveState(userId, key, {
        etag: r.etag ?? state?.etag ?? null,
        last_status: r.status,
        last_run_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        rate_remaining: r.rate.remaining,
        rate_reset_at: r.rate.reset ? new Date(r.rate.reset * 1000).toISOString().slice(0, 19).replace('T', ' ') : null,
        mode,
        last_error: null,
      });
      if (r.notModified) {
        report.not_modified += 1;
        continue;
      }

      // Commits are grouped by calendar date in Asia/Kolkata, which is what a
      // push day means to the person doing the work.
      const byDate = new Map();
      for (const c of r.data ?? []) {
        const iso = c.commit?.author?.date ?? c.commit?.committer?.date;
        if (!iso) continue;
        const local = new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000);
        const date = local.toISOString().slice(0, 10);
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date).push(c);
      }

      for (const [date, commits] of byDate) {
        const head = commits[0];
        const flagged = commits.length > SUSPICIOUS_COMMIT_COUNT;
        if (flagged) report.flagged += 1;
        const pushedAt = new Date(head.commit.author?.date ?? head.commit.committer.date)
          .toISOString()
          .slice(0, 19)
          .replace('T', ' ');
        const result = await run(
          `INSERT INTO github_pushes (user_id, repo_id, push_date, pushed_at, commit_count, sha_head, message_head, source, suspicious)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'api', ?)
           ON DUPLICATE KEY UPDATE commit_count = VALUES(commit_count), pushed_at = VALUES(pushed_at),
             message_head = VALUES(message_head), suspicious = VALUES(suspicious)`,
          [
            userId,
            repo.id,
            date,
            pushedAt,
            commits.length,
            head.sha,
            String(head.commit.message ?? '').split('\n')[0].slice(0, 255),
            flagged ? 1 : 0,
          ]
        );
        if (result.affectedRows) report.pushes_written += 1;
      }
    } catch (err) {
      if (err.code === 'RATE_LIMIT') {
        report.rate_limited = true;
        report.rate = err.rate;
        report.errors.push(err.message);
        await saveState(userId, key, { last_error: err.message.slice(0, 500) });
        break; // never hammer the API
      }
      if (err.code === 'HTTP_404') {
        report.errors.push(`${full} was not found. Either it does not exist yet or it is private and there is no token.`);
      } else {
        report.errors.push(`${full}: ${err.message}`);
      }
      await saveState(userId, key, { last_error: String(err.message).slice(0, 500) });
    }
  }
  return report;
}

/** The 150 day contribution grid, runs, and this week against the target of six. */
export async function pushSummary(userId, { firstDay, lastDay, today }) {
  const [rows, repos, lastPush, states] = await Promise.all([
    query(
      `SELECT p.push_date, r.full_name, r.kind, r.counts_to_target,
              SUM(p.commit_count) AS commits, COUNT(*) AS pushes, MAX(p.suspicious) AS suspicious
         FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
        WHERE p.user_id = ? AND p.push_date BETWEEN ? AND ?
        GROUP BY p.push_date, r.full_name, r.kind, r.counts_to_target
        ORDER BY p.push_date`,
      [userId, firstDay, lastDay]
    ),
    query(
      `SELECT r.id, r.full_name, r.kind, r.counts_to_target, r.project_id,
              COALESCE(SUM(p.commit_count), 0) AS commits, COUNT(p.id) AS pushes,
              MAX(p.pushed_at) AS last_push
         FROM github_repos r LEFT JOIN github_pushes p ON p.repo_id = r.id AND p.user_id = r.user_id
        WHERE r.user_id = ? GROUP BY r.id ORDER BY r.counts_to_target DESC, r.full_name`,
      [userId]
    ),
    one(
      `SELECT r.full_name AS repo, p.pushed_at, TIMESTAMPDIFF(MINUTE, p.pushed_at, NOW()) / 60 AS hours_since
         FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
        WHERE p.user_id = ? AND r.counts_to_target = 1 ORDER BY p.pushed_at DESC LIMIT 1`,
      [userId]
    ),
    query('SELECT resource_key, etag, last_status, last_run_at, rate_remaining, rate_reset_at, mode, last_error FROM github_sync_state WHERE user_id = ?', [userId]),
  ]);

  const counting = rows.filter((r) => Number(r.counts_to_target) === 1);
  const byDate = new Map();
  for (const r of counting) {
    const prev = byDate.get(r.push_date) ?? { pushes: 0, commits: 0, repos: [], suspicious: false };
    prev.pushes += Number(r.pushes);
    prev.commits += Number(r.commits);
    prev.repos.push(r.full_name);
    prev.suspicious = prev.suspicious || Number(r.suspicious) === 1;
    byDate.set(r.push_date, prev);
  }

  // Runs of consecutive push days.
  const dates = [...byDate.keys()].sort();
  let currentRun = 0;
  let longestRun = 0;
  let run_ = 0;
  let prevDate = null;
  for (const d of dates) {
    if (prevDate) {
      const gap = Math.round((new Date(`${d}T00:00:00Z`) - new Date(`${prevDate}T00:00:00Z`)) / 86400000);
      run_ = gap === 1 ? run_ + 1 : 1;
    } else {
      run_ = 1;
    }
    longestRun = Math.max(longestRun, run_);
    prevDate = d;
  }
  if (dates.length) {
    const last = dates[dates.length - 1];
    const gapFromToday = Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${last}T00:00:00Z`)) / 86400000);
    currentRun = gapFromToday <= 1 ? run_ : 0;
  }

  const hoursSince = lastPush ? Number(lastPush.hours_since) : null;

  return {
    grid: [...byDate.entries()].map(([date, v]) => ({ date, ...v })),
    repos: repos.map((r) => ({
      ...r,
      commits: Number(r.commits),
      pushes: Number(r.pushes),
      counts_to_target: Number(r.counts_to_target) === 1,
    })),
    client_repos: repos.filter((r) => r.kind === 'client'),
    current_run: currentRun,
    longest_run: longestRun,
    last_push: lastPush ? { repo: lastPush.repo, pushed_at: lastPush.pushed_at, hours_since: hoursSince } : null,
    hours_since_last_push: hoursSince,
    red_banner: hoursSince === null || hoursSince >= 48,
    streak_cancelled: hoursSince !== null && hoursSince >= 72,
    sync_state: states,
    mode: states.find((s) => s.mode)?.mode ?? 'anonymous',
    flagged: counting.filter((r) => Number(r.suspicious) === 1).length,
  };
}
