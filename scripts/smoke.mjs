/**
 * smoke.mjs | drives every page and every endpoint against a running server.
 *
 * This replaces two harnesses the Express build had. Both were tied to that
 * architecture and could not be carried over:
 *
 *   smoke-screens.mjs         fetched a page's server rendered HTML, installed it
 *                             into linkedom, then imported the screen's own
 *                             ES module so its fetch calls hit the real API.
 *                             The screens are React components now. They are
 *                             compiled into the client bundle and cannot be
 *                             imported into a fake document and made to hydrate.
 *
 *   verify-screens-offline.mjs rendered each EJS view and dispatched fetch calls
 *                             straight into an Express router's middleware stack.
 *                             There are no EJS views and no Express routers.
 *
 * What is checked here instead, with no browser and no extra dependency:
 *
 *   1. every page returns 200 and carries its own heading in the server HTML
 *   2. every read endpoint returns { ok: true } and the keys its screen reads
 *   3. an unauthenticated request is refused, not served
 *   4. a state changing request without a CSRF token is refused
 *
 * What it deliberately does not check: that a screen fills its panels. That needs
 * a real browser, because the data arrives after hydration. Point Playwright at
 * the same list when you want that.
 *
 * Every request is a GET apart from the sign in and the two refusal probes, so
 * this writes nothing except the session row it creates and then deletes.
 *
 *   node scripts/smoke.mjs
 *   node scripts/smoke.mjs --base=http://127.0.0.1:3000 --email=you@example.com --password=...
 *   node scripts/smoke.mjs --only=money,stats
 */

import { closePool } from '../lib/db/pool.ts';
import { banner, bad, good, info, parseArgv, runScript, say, step, table } from './lib/cli.mjs';

const { flags, values } = parseArgv(process.argv.slice(2), ['base', 'email', 'password', 'only']);

const BASE = (values.get('base') ?? process.env.SMOKE_BASE ?? 'http://127.0.0.1:3000').replace(
  /\/+$/,
  ''
);
const EMAIL = values.get('email') ?? process.env.SMOKE_EMAIL ?? '';
const PASSWORD = values.get('password') ?? process.env.SMOKE_PASSWORD ?? '';
const ONLY = (values.get('only') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const VERBOSE = flags.has('verbose');

/** Every page, with a string the server renders into it. */
const PAGES = [
  ['today', '/', 'Today'],
  ['calendar', '/calendar', 'Calendar'],
  ['weeks', '/weeks', 'The 21 weeks'],
  ['week-detail', '/weeks/1', 'Week'],
  ['dsa', '/dsa', 'DSA tracker'],
  ['library', '/library', 'Resource library'],
  ['projects', '/projects', 'Projects'],
  ['gates', '/gates', 'Gates'],
  ['sundays', '/sundays', 'Sundays'],
  ['pushes', '/pushes', 'GitHub pushes'],
  ['money', '/money', 'Money hour'],
  ['applications', '/applications', 'Applications'],
  ['ladder', '/ladder', 'Unlock ladder'],
  ['roles', '/roles', 'The seven roles'],
  ['eligibility', '/eligibility', 'Eligibility'],
  ['after', '/after', 'After January 2027'],
  ['newzealand', '/newzealand', 'New Zealand'],
  ['everything', '/everything', 'Everything'],
  ['stats', '/stats', 'Stats'],
  ['profile', '/profile', 'Profile'],
  ['review', '/review', 'Saturday review'],
  ['reference', '/reference', 'Reference'],
  ['print-week', '/print/week', 'Printable week sheet'],
];

/** Every read endpoint, with the top level keys its screen actually reads. */
const ENDPOINTS = [
  ['/api/me', ['user', 'profile', 'settings']],
  ['/api/today', ['header', 'clock', 'blocks', 'conditions']],
  ['/api/warnings', ['warnings', 'count']],
  ['/api/calendar', ['days', 'weeks', 'today']],
  ['/api/day-logs', ['logs']],
  ['/api/sessions', ['sessions']],
  ['/api/sessions/open', []],
  ['/api/weeks', ['weeks', 'phases', 'gates']],
  ['/api/weeks/1', ['week', 'days', 'links', 'neighbours']],
  ['/api/resources', ['categories', 'resources', 'tally']],
  ['/api/projects', ['projects', 'readme_sections']],
  ['/api/gates', ['gates', 'money_gates']],
  ['/api/sundays', ['sundays', 'totals']],
  ['/api/dsa/summary', ['solved', 'topics', 'curve', 'ladder']],
  ['/api/dsa/problems', ['problems', 'count']],
  ['/api/pushes', ['grid', 'repos', 'week', 'mode', 'mode_cost']],
  ['/api/repos', ['repos']],
  ['/api/money/summary', ['strip', 'offers', 'money_gates', 'touches']],
  ['/api/money/scripts', ['scripts', 'substitutions']],
  ['/api/leads', ['leads', 'next_15']],
  ['/api/deals', ['deals', 'stats']],
  ['/api/care-plans', ['care_plans', 'floor']],
  ['/api/applications', ['applications', 'funnel', 'gate4']],
  ['/api/mocks', ['mocks', 'by_kind']],
  ['/api/writeups', ['writeups']],
  ['/api/ladder', ['milestones', 'thresholds', 'resume_stages']],
  ['/api/roles', ['roles', 'roles_early', 'skills', 'where_to_apply']],
  ['/api/eligibility', ['eligible', 'ladder', 'combos', 'exits']],
  ['/api/after', ['rows', 'grouped']],
  ['/api/nz', ['requirements', 'milestones', 'costs', 'salary']],
  ['/api/reference', ['corrections', 'stack_versions', 'verification_log']],
  ['/api/everything', ['global', 'groups', 'items']],
  ['/api/stats', ['dsa_curve', 'colours', 'streak', 'money']],
  ['/api/ops', ['link_check', 'backups', 'dsa_imports']],
];

let cookie = '';
let csrf = '';

function mergeCookies(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const jar = new Map(
    cookie
      .split('; ')
      .filter(Boolean)
      .map((p) => {
        const eq = p.indexOf('=');
        return [p.slice(0, eq), p.slice(eq + 1)];
      })
  );
  for (const line of raw) {
    const pair = line.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const token = jar.get('csrf_token');
  if (token) csrf = decodeURIComponent(token);
}

async function site(path, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (cookie) headers.Cookie = cookie;
  if (init.method && init.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
  mergeCookies(res);
  return res;
}

async function main() {
  banner('Smoke test', `${BASE}`);

  if (!EMAIL || !PASSWORD) {
    bad('An account is needed. Pass --email and --password, or set SMOKE_EMAIL and SMOKE_PASSWORD.');
    info('This harness signs in as a real account rather than creating one, so it writes nothing.');
    return 2;
  }

  const failures = [];
  const pass = (name) => {
    good(name);
  };
  const fail = (name, why) => {
    bad(`${name}: ${why}`);
    failures.push([name, why]);
  };

  /* ---------------------------------------------------- is it listening */

  step('The server');
  try {
    const res = await fetch(`${BASE}/api/healthz`);
    const body = await res.json();
    if (!body?.data) throw new Error('no envelope');
    if (body.data.db !== 'up') throw new Error(`database is ${body.data.db}`);
    pass(`healthz, database up, today ${body.data.today}`);
  } catch (err) {
    bad(`Nothing is listening on ${BASE}, or the database is down. ${err.message}`);
    info('Start it with: npm run build; npm start');
    return 2;
  }

  /* ------------------------------------------------- refused when anonymous */

  step('Refusals');

  const anonApi = await fetch(`${BASE}/api/today`, { redirect: 'manual' });
  if (anonApi.status === 401) pass('GET /api/today without a session is 401');
  else fail('anonymous API', `expected 401, got ${anonApi.status}`);

  const anonPage = await fetch(`${BASE}/`, { redirect: 'manual' });
  if (anonPage.status === 307 || anonPage.status === 302) {
    pass(`GET / without a session redirects to ${anonPage.headers.get('location')}`);
  } else {
    fail('anonymous page', `expected a redirect, got ${anonPage.status}`);
  }

  /* --------------------------------------------------------------- sign in */

  step('Sign in');
  await site('/api/csrf');
  const login = await site('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await login.json().catch(() => null);
  if (!login.ok || loginBody?.ok !== true) {
    bad(`Sign in failed: ${loginBody?.error?.message ?? login.status}`);
    return 2;
  }
  pass(`signed in as ${loginBody.data.email}`);

  const noCsrf = await fetch(`${BASE}/api/me/synced`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (noCsrf.status === 403) pass('a POST without the CSRF token is 403');
  else fail('csrf guard', `expected 403, got ${noCsrf.status}`);

  /* ------------------------------------------------------------ endpoints */

  step('Endpoints');
  for (const [path, keys] of ENDPOINTS) {
    if (ONLY.length && !ONLY.some((o) => path.includes(o))) continue;
    try {
      const res = await site(path);
      const body = await res.json();
      if (!res.ok || body?.ok !== true) {
        fail(path, body?.error?.message ?? `status ${res.status}`);
        continue;
      }
      const missing = keys.filter((k) => !(k in (body.data ?? {})));
      if (missing.length) fail(path, `missing ${missing.join(', ')}`);
      else pass(`${path}${VERBOSE ? ` ${JSON.stringify(body.data).length} bytes` : ''}`);
    } catch (err) {
      fail(path, err.message);
    }
  }

  /* ---------------------------------------------------------------- pages */

  step('Pages');
  for (const [name, path, needle] of PAGES) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    try {
      const res = await site(path, { headers: { Accept: 'text/html' } });
      if (!res.ok) {
        fail(path, `status ${res.status}`);
        continue;
      }
      const html = await res.text();
      if (!html.includes(needle)) fail(path, `the server HTML does not contain "${needle}"`);
      else pass(`${path}${VERBOSE ? ` ${html.length} bytes` : ''}`);
    } catch (err) {
      fail(path, err.message);
    }
  }

  /* --------------------------------------------------------------- exports */

  step('Downloads');
  for (const [path, type] of [
    ['/api/calendar.ics', 'text/calendar'],
    ['/api/export/day_logs', 'text/csv'],
  ]) {
    const res = await site(path);
    const got = res.headers.get('content-type') ?? '';
    if (res.ok && got.includes(type)) pass(`${path} is ${type}`);
    else fail(path, `expected ${type}, got ${res.status} ${got}`);
  }

  /* ------------------------------------------------------------- sign out */

  step('Sign out');
  const out = await site('/api/auth/logout', { method: 'POST', body: '{}' });
  if (out.ok) pass('signed out, session row deleted');
  else fail('logout', `status ${out.status}`);

  /* --------------------------------------------------------------- verdict */

  if (failures.length) {
    say('');
    table(
      failures.map(([what, why]) => ({ What: what, Why: why })),
      ['What', 'Why']
    );
    bad(`${failures.length} ${failures.length === 1 ? 'check' : 'checks'} failed.`);
    return 1;
  }

  good('Every page and every endpoint answered.');
  return 0;
}

await runScript('smoke', main, { closePool });
