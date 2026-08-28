/**
 * verify-screens-offline.mjs | every screen rendered without a server.
 *
 * scripts/smoke-screens.mjs drives the real HTTP surface, which is the right test
 * but needs a listening server and a throwaway account, and the signup limiter
 * caps it at five runs a quarter hour.
 *
 * This does the same job with neither. It renders each EJS view itself, installs
 * it as a document, and stubs `fetch` so that a call to /api/whatever is
 * dispatched straight into the matching Express route handler in this process,
 * against the real database. So the screen runs its real code against real rows,
 * and nothing has to be listening.
 *
 * It writes nothing. Every request is a GET; a screen's write paths are not
 * exercised here, which is what smoke-screens.mjs is for.
 *
 * ONE THING THIS CANNOT CATCH, AND IT HAS BITTEN ONCE.
 *
 * Because the handlers are imported from source in this process, the client and the
 * server are always the same version here. A **running server that is older than
 * the client** is therefore invisible to this harness: /roles passed every check
 * here while the deployed server was still returning the previous payload shape,
 * and the browser threw "Cannot read properties of undefined".
 *
 * Two things follow. Restart the server after changing anything under src/. And
 * write screens so a missing field degrades the panel rather than the page, which
 * is what the normalise() step in roles.mjs now does.
 *
 *   npm install linkedom --no-save
 *   node scripts/verify-screens-offline.mjs
 *   node scripts/verify-screens-offline.mjs --only=roles,money --dump
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import ejs from 'ejs';
import { config, ROOT } from '../src/config.mjs';
import { closePool, one } from '../src/db/pool.mjs';
import { todayInTz } from '../src/lib/dates.mjs';
import { NAV } from '../src/lib/nav.mjs';
import { banner, bad, good, info, parseArgv, runScript, say, step, table } from './lib/cli.mjs';

const { flags, values } = parseArgv(process.argv.slice(2), ['only']);
const only = (values.get('only') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const dump = flags.has('dump');

const { parseHTML } = await (async () => {
  try {
    return await import('linkedom');
  } catch {
    console.error(
      'This harness needs linkedom, which is deliberately not a dependency.\n' +
        '  npm install linkedom --no-save\n'
    );
    process.exit(2);
  }
})();

const realSetTimeout = globalThis.setTimeout;
const sleep = (ms) => new Promise((r) => realSetTimeout(r, ms));

/* ------------------------------------------------- the in-process API */

/** Every route across every API router, with a matcher. */
async function buildRouteTable() {
  const files = [
    ['auth.mjs', '/api/auth'],
    ['me.mjs', '/api/me'],
    ['daily.mjs', '/api'],
    ['plan.mjs', '/api'],
    ['dsa.mjs', '/api'],
    ['github.mjs', '/api'],
    ['money.mjs', '/api'],
    ['career.mjs', '/api'],
    ['meta.mjs', '/api'],
  ];
  const out = [];
  for (const [file, prefix] of files) {
    const router = (await import(`../src/routes/api/${file}`)).default;
    for (const layer of router.stack) {
      if (!layer.route) continue;
      for (const method of Object.keys(layer.route.methods)) {
        const path = layer.route.path === '/' ? '' : layer.route.path;
        const full = prefix + path;
        const names = [];
        const pattern = full
          .split('/')
          .map((seg) => {
            if (!seg.startsWith(':')) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            names.push(seg.slice(1));
            return '([^/]+)';
          })
          .join('/');
        out.push({
          method: method.toUpperCase(),
          full,
          names,
          re: new RegExp(`^${pattern}$`),
          // The last handler in the stack is the route body; the ones before it
          // are validators, which are run in order so validation still applies.
          stack: layer.route.stack.map((s) => s.handle),
        });
      }
    }
  }
  return out;
}

const ROUTES = await buildRouteTable();

/** Runs a route's middleware chain, then its handler, and returns the payload. */
async function dispatch(userId, method, url) {
  const [pathname, search = ''] = url.split('?');
  const route = ROUTES.find((r) => r.method === method && r.re.test(pathname));
  if (!route) {
    return { status: 404, body: { ok: false, error: { code: 'NOT_FOUND', message: `No route for ${method} ${pathname}` } } };
  }
  const m = route.re.exec(pathname);
  const params = {};
  route.names.forEach((n, i) => {
    params[n] = m[i + 1];
  });

  const query = Object.fromEntries(new URLSearchParams(search));
  const req = {
    user: { id: userId },
    params,
    query,
    validQuery: query,
    body: {},
    method,
    originalUrl: url,
    headers: {},
    get: () => undefined,
    session: {},
  };

  let payload = null;
  let status = 200;
  const res = {
    statusCode: 200,
    status(code) {
      status = code;
      this.statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    },
    send(body) {
      payload = body;
      return this;
    },
    setHeader() {},
    type() {
      return this;
    },
  };

  let failed = null;
  for (const handler of route.stack) {
    let advanced = false;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => {
      const next = (err) => {
        if (err) failed = err;
        advanced = true;
        resolve();
      };
      Promise.resolve(handler(req, res, next)).then(
        () => resolve(),
        (err) => {
          failed = err;
          resolve();
        }
      );
    });
    if (failed) break;
    if (payload !== null && !advanced) break;
  }

  if (failed) {
    return {
      status: failed.status ?? 500,
      body: { ok: false, error: { code: failed.code ?? 'ERROR', message: failed.message ?? 'Failed' } },
    };
  }
  return { status, body: payload };
}

/* ------------------------------------------------------------ the DOM */

function installDom(html, path, userId, today) {
  const { document, window } = parseHTML(html);
  const [pathname, search = ''] = path.split('?');

  const proto = document.createElement('div').constructor.prototype;
  if (!('style' in proto)) {
    Object.defineProperty(proto, 'style', {
      get() {
        if (!this.__style) this.__style = { setProperty() {}, removeProperty() {} };
        return this.__style;
      },
    });
  }

  globalThis.document = document;
  globalThis.window = window;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: { onLine: true, serviceWorker: undefined },
  });
  globalThis.location = { pathname, search: search ? `?${search}` : '', href: `http://offline${path}`, assign() {}, replace() {} };
  window.location = globalThis.location;
  globalThis.localStorage = {
    _v: new Map(),
    getItem(k) { return this._v.has(k) ? this._v.get(k) : null; },
    setItem(k, v) { this._v.set(k, String(v)); },
    removeItem(k) { this._v.delete(k); },
  };
  globalThis.indexedDB = undefined;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.matchMedia = globalThis.matchMedia;
  window.print = () => {};
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  window.setInterval = () => 0;
  window.clearInterval = () => {};
  globalThis.requestAnimationFrame = (fn) => realSetTimeout(fn, 0);
  window.requestAnimationFrame = globalThis.requestAnimationFrame;

  // Straight into the route handlers. No socket, no server.
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const { status, body } = await dispatch(userId, method, url.replace(/^https?:\/\/[^/]+/, ''));
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? null);
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      headers: { get: () => 'application/json; charset=utf-8', getSetCookie: () => [] },
      text: async () => text,
      json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    };
  };

  return document;
}

/* ----------------------------------------------------------- the pages */

const PAGES = [
  ['/', 'today', 'today', { wide: false }],
  ['/calendar', 'calendar', 'calendar', { wide: true }],
  ['/weeks', 'weeks', 'weeks', { wide: true }],
  ['/weeks/1', 'week-detail', 'week-detail', { wide: false, style: 'weeks' }],
  ['/dsa', 'dsa', 'dsa', { wide: true }],
  ['/library', 'library', 'library', { wide: true }],
  ['/projects', 'projects', 'projects', { wide: true }],
  ['/gates', 'gates', 'gates', { wide: true }],
  ['/sundays', 'sundays', 'sundays', { wide: false }],
  ['/pushes', 'pushes', 'pushes', { wide: true }],
  ['/money', 'money', 'money', { wide: true }],
  ['/applications', 'applications', 'applications', { wide: true }],
  ['/ladder', 'ladder', 'ladder', { wide: false }],
  ['/roles', 'roles', 'roles', { wide: true }],
  ['/eligibility', 'eligibility', 'eligibility', { wide: true }],
  ['/after', 'after', 'after', { wide: false }],
  ['/newzealand', 'newzealand', 'newzealand', { wide: true }],
  ['/everything', 'everything', 'everything', { wide: true }],
  ['/stats', 'stats', 'stats', { wide: true }],
  ['/profile', 'profile', 'profile', { wide: false }],
  ['/review', 'review', 'review', { wide: false }],
  ['/reference', 'reference', 'reference', { wide: true }],
  ['/print/week', 'print-week', 'print-week', { wide: false }],
];

/** Containers the view leaves saying "Loading", plus ones written by name. */
const REQUIRED = {
  today: ['t-date', 't-week', 't-strip', 't-now', 't-conditions', 't-yesterday', 't-dsa-total'],
  calendar: ['c-grid'],
  'week-detail': ['wd-head', 'wd-body'],
};

/**
 * Renders a view with the same locals src/routes/pages/index.mjs supplies, so a
 * missing local shows up here rather than only in a browser.
 */
async function renderView(screen, path, user, today, opts = {}) {
  const viewPath = join(ROOT, 'views', 'screens', `${screen}.ejs`);
  const { blockForNow, longDate } = await import('../src/lib/dates.mjs');
  const { getVerificationLog } = await import('../src/db/reference.mjs');
  const { renderMarkdown } = await import('../src/lib/markdown.mjs');
  const { MIN_PASSWORD_LENGTH } = await import('../src/lib/passwords.mjs');
  const clock = blockForNow();

  const extra = {};
  if (screen === 'week-detail') {
    extra.weekNumber = Number(path.split('/').pop()) || 1;
    extra.topbarTitle = `Week ${extra.weekNumber}`;
  }
  if (screen === 'newzealand') {
    extra.verificationLog = (await getVerificationLog()).markdown;
  }
  if (screen === 'reference') {
    // Appendix G is rendered read only, straight from data/final.md. It is never
    // parsed into rows and never seeded, because final.md says so.
    const log = await getVerificationLog();
    extra.verificationLogHtml = renderMarkdown(log.markdown);
    extra.verificationLogFound = log.found;
  }
  if (screen === 'print-week') {
    extra.weekNumber = 1;
  }

  return ejs.renderFile(
    viewPath,
    {
      title: screen,
      page: screen,
      styles: [opts.style ?? screen],
      scripts: [screen],
      wide: Boolean(opts.wide),
      today,
      todayLong: longDate(today),
      clock: {
        time: clock.now.time,
        current: clock.current?.code ?? null,
        currentLabel: clock.current?.label ?? null,
        next: clock.next?.code ?? null,
        nextLabel: clock.next?.label ?? null,
      },
      roadmap: config.roadmap,
      theme: 'system',
      calendarView: 'month',
      lastSyncedAt: '',
      warningCount: 0,
      // These are set by the app level middleware in src/server.mjs, not by the
      // page route, so they have to be supplied here too or every view fails on
      // the sidebar include.
      user,
      nav: NAV,
      currentPath: path,
      isFakeClock: Boolean(config.fakeToday || config.fakeTime),
      publicOrigin: config.publicOrigin,
      csrfToken: 'offline-token',
      minPasswordLength: MIN_PASSWORD_LENGTH,
      next: '/',
      ...extra,
    },
    { async: true }
  );
}

async function checkPage(path, screen, view, user, today, index, opts) {
  let html;
  try {
    html = await renderView(view, path, user, today, opts);
  } catch (err) {
    return { path, screen, ok: false, why: `view failed to render: ${String(err.message).split('\n')[0]}` };
  }

  const loading = [...html.matchAll(/id="([^"]+)"[^>]*>\s*(?:<[^>]*>\s*)*<p class="muted">Loading/g)].map((m) => m[1]);
  const watched = [...new Set([...loading, ...(REQUIRED[screen] ?? [])])];

  const document = installDom(html, path, user.id, today);

  try {
    await import(`../public/js/screens/${screen}.mjs?off=${index}-${Date.now()}`);
  } catch (err) {
    return { path, screen, ok: false, why: `module threw: ${err.message}`, containers: watched.length };
  }

  for (let i = 0; i < 40; i += 1) await sleep(50);

  const stillLoading = [];
  const empty = [];
  const filled = [];
  for (const id of watched) {
    const node = document.getElementById(id);
    const text = (node?.textContent ?? '').trim();
    if (!node) empty.push(`${id} (missing)`);
    else if (/^Loading/.test(text)) stillLoading.push(id);
    else if (!text && node.children.length === 0) empty.push(id);
    else filled.push({ id, chars: text.length });
  }

  const errors = [...document.querySelectorAll('.callout--red')]
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
    .filter((t) => /did not load/.test(t));

  if (dump && (!only.length || only.includes(screen))) {
    say(`\n${'='.repeat(78)}\n${path}  (${screen})\n${'='.repeat(78)}`);
    for (const id of watched) {
      const node = document.getElementById(id);
      const text = (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
      say(`\n--- #${id}  ${text.length} chars ---`);
      say(text.slice(0, 1600));
    }
  }

  return {
    path,
    screen,
    ok: stillLoading.length === 0 && empty.length === 0 && errors.length === 0,
    containers: watched.length,
    filled: filled.length,
    chars: filled.reduce((a, f) => a + f.chars, 0),
    stillLoading,
    empty,
    errors,
  };
}

/* ------------------------------------------------------------------ main */

async function main() {
  const today = todayInTz();
  const user = await one(
    "SELECT id, email, display_name FROM users WHERE email NOT LIKE 'smoke-%' AND is_active = 1 ORDER BY id LIMIT 1"
  );
  if (!user) throw new Error('There is no user to render for. Sign up first.');

  banner(
    'verify-screens-offline.mjs | every screen, no server, real database',
    `${user.email}  ·  ${today}  ·  ${ROUTES.length} API routes dispatched in process`
  );

  const pages = only.length ? PAGES.filter(([, s]) => only.includes(s)) : PAGES;
  const results = [];

  step(`${pages.length} page${pages.length === 1 ? '' : 's'}`);
  for (const [i, [path, screen, view, opts]] of pages.entries()) {
    const r = await checkPage(path, screen, view, user, today, i, opts ?? {});
    results.push(r);
    const mark = r.ok ? 'ok  ' : 'FAIL';
    say(
      `  ${mark} ${path.padEnd(14)} ${screen.padEnd(13)} ` +
        (r.why
          ? r.why
          : `${r.filled}/${r.containers} filled, ${r.chars} chars` +
            (r.stillLoading?.length ? `  LOADING: ${r.stillLoading.join(', ')}` : '') +
            (r.empty?.length ? `  EMPTY: ${r.empty.join(', ')}` : '') +
            (r.errors?.length ? `  ERROR: ${r.errors[0].slice(0, 80)}` : ''))
    );
  }

  const failed = results.filter((r) => !r.ok);
  step('Summary');
  table(
    [
      { measure: 'pages rendered', value: results.length },
      { measure: 'filled every container', value: results.length - failed.length },
      { measure: 'failed', value: failed.length },
      { measure: 'total characters drawn', value: results.reduce((a, r) => a + (r.chars ?? 0), 0) },
    ],
    ['measure', 'value']
  );

  if (failed.length) {
    for (const f of failed) bad(`${f.path} ${f.screen}: ${f.why ?? f.stillLoading?.join(', ') ?? f.empty?.join(', ') ?? f.errors?.[0]}`);
    return 1;
  }
  good(`${results.length} of ${results.length} screens filled every container, with no server running.`);
  info('Writes are not exercised here. Use scripts/smoke-screens.mjs against a live server for those.');
  return 0;
}

await runScript('verify-screens-offline.mjs', main, { closePool });
