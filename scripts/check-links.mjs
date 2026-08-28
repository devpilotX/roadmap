/**
 * check-links.mjs | link health for `resources` and `week_links`.
 *
 * Build prompt section 9.4, implemented exactly:
 *   - a HEAD request to every row in `resources` and `week_links`
 *   - redirects are followed
 *   - `is_alive`, `last_status` and `last_checked` are updated
 *   - 4xx and 5xx mark the row dead, which the UI paints as a red badge
 *   - a dead link is NEVER deleted, only flagged
 *   - `dead_links` from Appendix A is cross referenced for the known replacement
 *   - one request per second, ten second timeout
 *
 * Some hosts refuse HEAD with 403, 405 or 501 while serving GET perfectly well.
 * That is a server quirk, not a dead link, so those three statuses are retried
 * once with a ranged GET that reads no body. A quirk must never be recorded as
 * a broken resource.
 *
 * Usage
 *   node scripts/check-links.mjs                  check everything, write results
 *   node scripts/check-links.mjs --dry-run        check everything, write nothing
 *   node scripts/check-links.mjs --only=resources resources or week-links
 *   node scripts/check-links.mjs --limit=20       stop after 20 urls
 *   node scripts/check-links.mjs --stale=7        only urls unchecked for 7 days
 *   node scripts/check-links.mjs --delay=1000     ms between requests, min 1000
 *   node scripts/check-links.mjs --timeout=10000  ms per request
 *   node scripts/check-links.mjs --quiet          only print the summary
 *
 * Cron, nightly at 03:10 Asia/Kolkata:
 *   10 3 * * *  cd /srv/roadmap-tracker && /usr/bin/node scripts/check-links.mjs >> /var/log/roadmap/links.log 2>&1
 */

import { closePool, query, run } from '../src/db/pool.mjs';
import { todayInTz } from '../src/lib/dates.mjs';
import {
  banner, bad, good, info, intOption, parseArgv, runScript, say, sleep, sqlNow, step, table, tick, warn,
} from './lib/cli.mjs';

const UA =
  'the-roadmap-tracker/1.0 link checker (personal career tracker, one request per second)';

/** Statuses that mean "this host dislikes HEAD", not "this link is dead". */
const HEAD_HOSTILE = new Set([403, 405, 501, 400]);

const { flags, values } = parseArgv(process.argv.slice(2), ['only', 'limit', 'stale', 'delay', 'timeout']);
const dryRun = flags.has('dry-run');
const quiet = flags.has('quiet');
const only = (values.get('only') ?? 'all').toLowerCase();
const limit = intOption(values, 'limit', 0, { min: 0 });
const stale = intOption(values, 'stale', 0, { min: 0 });
// One request per second is the floor, and it is a floor, not a default to lower.
const delayMs = intOption(values, 'delay', 1000, { min: 1000, max: 60_000 });
const timeoutMs = intOption(values, 'timeout', 10_000, { min: 1000, max: 120_000 });

if (!['all', 'resources', 'week-links', 'week_links'].includes(only)) {
  throw new Error(`--only must be all, resources or week-links, got "${only}"`);
}
const wantResources = only === 'all' || only === 'resources';
const wantWeekLinks = only === 'all' || only === 'week-links' || only === 'week_links';

/* ---------------------------------------------------------- the probe */

/**
 * One URL, one verdict. Never throws.
 * Returns { status, alive, note, redirectedTo, ms, method }.
 */
async function probe(url) {
  const started = Date.now();

  const attempt = async (method) => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': UA,
        Accept: '*/*',
        // Ask for the first byte only. A compliant server answers 206, a plain
        // one answers 200, and either way no page is downloaded.
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
    });
    return res;
  };

  try {
    let res = await attempt('HEAD');
    let method = 'HEAD';
    if (HEAD_HOSTILE.has(res.status)) {
      await sleep(delayMs);
      const retry = await attempt('GET');
      if (retry.status < 400) {
        res = retry;
        method = 'GET';
      } else if (retry.status !== res.status) {
        res = retry;
        method = 'GET';
      }
    }
    const redirectedTo = res.url && res.url !== url ? res.url : null;
    return {
      status: res.status,
      alive: res.status < 400,
      note: res.status < 400 ? '' : `HTTP ${res.status} ${res.statusText || ''}`.trim(),
      redirectedTo,
      ms: Date.now() - started,
      method,
    };
  } catch (err) {
    // A network failure is not an HTTP status. It is recorded as dead with a
    // null status so the UI can tell "server said no" from "never answered".
    const name = err?.name ?? 'Error';
    const note =
      name === 'TimeoutError' || name === 'AbortError'
        ? `no answer within ${timeoutMs} ms`
        : `${name}: ${err?.cause?.code ?? err?.message ?? 'unreachable'}`;
    return { status: null, alive: false, note, redirectedTo: null, ms: Date.now() - started, method: 'HEAD' };
  }
}

/* ------------------------------------------------------------ the run */

async function loadTargets() {
  const staleClause = stale
    ? `AND (last_checked IS NULL OR last_checked < DATE_SUB(CURDATE(), INTERVAL ${stale} DAY))`
    : '';
  const out = [];
  if (wantResources) {
    const rows = await query(
      `SELECT id, url, label, category_no AS grp, ord, is_alive, last_status, last_checked
         FROM resources WHERE url LIKE 'http%' ${staleClause} ORDER BY category_no, ord`
    );
    out.push(...rows.map((r) => ({ ...r, table: 'resources' })));
  }
  if (wantWeekLinks) {
    const rows = await query(
      `SELECT id, url, label, week_n AS grp, ord, is_alive, last_status, last_checked
         FROM week_links WHERE url LIKE 'http%' ${staleClause} ORDER BY week_n, ord`
    );
    out.push(...rows.map((r) => ({ ...r, table: 'week_links' })));
  }
  return out;
}

/** Appendix A, keyed by a loose form of the URL so a trailing slash still matches. */
function loose(url) {
  return String(url).toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

async function loadKnownReplacements() {
  const rows = await query('SELECT was, now_url, what_happened FROM dead_links ORDER BY id');
  const byUrl = new Map();
  for (const r of rows) byUrl.set(loose(r.was), r);
  return { rows, byUrl };
}

async function main() {
  banner(
    'check-links.mjs | link health for resources and week_links',
    `${dryRun ? 'dry run, nothing is written' : 'writing results'}  ·  ${delayMs} ms between requests  ·  ${timeoutMs} ms timeout`
  );

  const [targets, known] = await Promise.all([loadTargets(), loadKnownReplacements()]);
  const urls = [...new Set(targets.map((t) => t.url))];
  const work = limit ? urls.slice(0, limit) : urls;

  say('');
  info(`${targets.length} rows to check across ${urls.length} distinct urls`);
  if (limit) info(`--limit=${limit} so only the first ${work.length} urls are probed`);
  if (stale) info(`--stale=${stale} so only rows unchecked for ${stale} days are included`);
  info(`${known.rows.length} known replacements are on file from Appendix A of final.md`);
  const estimate = Math.round((work.length * delayMs) / 1000);
  info(`at one request per second this takes about ${Math.floor(estimate / 60)}m ${estimate % 60}s`);

  if (!work.length) {
    say('');
    good('Nothing to check.');
    return 0;
  }

  const startedAt = sqlNow();
  let runId = null;
  if (!dryRun) {
    const res = await run('INSERT INTO link_check_runs (started_at, checked_count, dead_count) VALUES (?, 0, 0)', [
      startedAt,
    ]);
    runId = res.insertId;
    info(`link_check_runs row ${runId} opened at ${startedAt}`);
  }

  const today = todayInTz();
  const results = new Map();
  const dead = [];
  const revived = [];
  const redirects = [];
  let done = 0;

  step('Probing');
  for (const url of work) {
    const verdict = await probe(url);
    results.set(url, verdict);
    done += 1;

    const rows = targets.filter((t) => t.url === url);
    const wasAlive = rows.every((r) => Number(r.is_alive) === 1);
    const label = rows[0]?.label ?? '';
    const shortUrl = url.length > 68 ? `${url.slice(0, 65)}...` : url;

    if (!verdict.alive) {
      const replacement = known.byUrl.get(loose(url)) ?? null;
      dead.push({ url, label, status: verdict.status ?? '-', note: verdict.note, replacement });
      if (!quiet) {
        bad(`${String(verdict.status ?? 'no answer').padEnd(9)} ${shortUrl}`);
        info(`       ${verdict.note}`);
        if (replacement) {
          info(`       Appendix A has a replacement: ${replacement.now_url}`);
          info(`       ${replacement.what_happened}`);
        } else {
          info('       flagged, not deleted. Add the replacement to Appendix A of final.md when you find it.');
        }
      }
    } else {
      if (!wasAlive) revived.push({ url, label, status: verdict.status });
      if (verdict.redirectedTo) redirects.push({ url, to: verdict.redirectedTo });
      if (!quiet) {
        tick(
          `${String(verdict.status).padEnd(4)} ${String(verdict.ms + ' ms').padEnd(8)} ${verdict.method.padEnd(4)} ${shortUrl}` +
            (verdict.redirectedTo ? '  -> redirected' : '')
        );
      }
    }

    if (!dryRun) {
      for (const r of rows) {
        await run(
          `UPDATE \`${r.table === 'resources' ? 'resources' : 'week_links'}\`
              SET is_alive = ?, last_status = ?, last_checked = ? WHERE id = ?`,
          [verdict.alive ? 1 : 0, verdict.status ?? null, today, r.id]
        );
      }
    }

    if (done < work.length) await sleep(delayMs);
  }

  /* --------------------------------------------------------- the summary */

  const checkedRows = targets.filter((t) => results.has(t.url));
  const deadRows = checkedRows.filter((t) => results.get(t.url).alive === false);

  step('Summary');
  table(
    [
      { measure: 'urls probed', value: work.length },
      { measure: 'rows updated', value: dryRun ? 0 : checkedRows.length },
      { measure: 'alive', value: work.length - dead.length },
      { measure: 'dead or unreachable', value: dead.length },
      { measure: 'rows now flagged dead', value: deadRows.length },
      { measure: 'came back to life', value: revived.length },
      { measure: 'redirected', value: redirects.length },
    ],
    ['measure', 'value']
  );

  if (dead.length) {
    step(`${dead.length} url${dead.length === 1 ? '' : 's'} to look at. None were deleted.`);
    table(
      dead.map((d) => ({
        status: d.status,
        url: d.url.length > 60 ? `${d.url.slice(0, 57)}...` : d.url,
        'known replacement': d.replacement ? d.replacement.now_url : 'none on file',
      })),
      ['status', 'url', 'known replacement']
    );
    const unknown = dead.filter((d) => !d.replacement);
    if (unknown.length) {
      say('');
      warn(
        `${unknown.length} dead url${unknown.length === 1 ? ' has' : 's have'} no replacement in Appendix A. ` +
          'Find the new address, add it to Appendix A of data/final.md, then re-run npm run setup.'
      );
    }
  }

  if (revived.length) {
    step(`${revived.length} url${revived.length === 1 ? '' : 's'} that were flagged are answering again`);
    table(revived.map((r) => ({ status: r.status, url: r.url })), ['status', 'url']);
  }

  if (redirects.length && !quiet) {
    step(`${redirects.length} redirect${redirects.length === 1 ? '' : 's'} followed. The stored url still works, so it is left alone.`);
    table(
      redirects.slice(0, 25).map((r) => ({ from: r.url, to: r.to })),
      ['from', 'to']
    );
  }

  if (!dryRun && runId) {
    const notes = [
      `${work.length} urls probed, ${dead.length} dead, ${revived.length} revived, ${redirects.length} redirected.`,
      dead.length ? `Dead: ${dead.map((d) => `${d.url} (${d.status})`).join('; ')}` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 60_000);
    await run(
      'UPDATE link_check_runs SET finished_at = ?, checked_count = ?, dead_count = ?, notes = ? WHERE id = ?',
      [sqlNow(), work.length, dead.length, notes, runId]
    );
    good(`link_check_runs row ${runId} closed`);
  } else {
    say('');
    info('Dry run: no row in resources, week_links or link_check_runs was touched.');
  }

  // A dead link is a fact to act on, not a script failure. Exit 0 unless asked.
  if (dead.length && flags.has('fail-on-dead')) return 1;
  return 0;
}

await runScript('check-links.mjs', main, { closePool });
