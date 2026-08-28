/**
 * smoke-screens.mjs | drives every page against the running server.
 *
 * This is a throwaway verification harness, not part of the application. It
 * exists to answer one question with evidence rather than confidence: does each
 * of the 24 screens actually fill its containers when pointed at the real API
 * and the real database.
 *
 * How it works:
 *   1. signs up a throwaway account, so the session is real
 *   2. fetches each page's server rendered HTML, which still says "Loading"
 *   3. parses it with linkedom, installs it as the global document
 *   4. imports the real screen module, whose fetch calls go to the real server
 *   5. asserts every container that said "Loading" no longer does
 *   6. deletes the throwaway account
 *
 * Run:  npm install linkedom --no-save && node scripts/smoke-screens.mjs
 *
 * linkedom is deliberately NOT a dependency of this project. It is only needed to
 * run the screens outside a browser, it never ships, and the application does not
 * import it. Installing it with --no-save keeps package.json honest.
 */

import { closePool, one, query, run } from '../src/db/pool.mjs';

const { parseHTML } = await (async () => {
  try {
    return await import('linkedom');
  } catch {
    console.error(
      'This harness needs linkedom, which is not a dependency of this project.\n' +
        'Install it just for this run, without touching package.json:\n\n' +
        '  npm install linkedom --no-save\n'
    );
    process.exit(2);
  }
})();

/** Defaults to the usual port. SMOKE_BASE points it at a throwaway instance. */
const BASE = (process.env.SMOKE_BASE ?? 'http://127.0.0.1:3000').replace(/\/+$/, '');
const EMAIL = `smoke-${Date.now()}@example.invalid`;
const PASSWORD = 'a-throwaway-passphrase-for-the-smoke-test';
const NAME = 'Smoke Test';

/** --only=money,stats restricts the run. --dump prints the rendered content. */
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) ?? '').replace('--only=', '');
const DUMP_ONLY = ONLY ? ONLY.split(',').map((s) => s.trim()).filter(Boolean) : [];

let cookie = '';

/* -------------------------------------------------------------- plumbing */

const realFetch = globalThis.fetch;
// Captured before any shim is installed. linkedom's window proxies globalThis, so
// assigning window.setTimeout would otherwise make setTimeout call itself.
const realSetTimeout = globalThis.setTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;

async function siteFetch(path, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await realFetch(path.startsWith('http') ? path : BASE + path, {
    ...init,
    headers,
    redirect: 'manual',
  });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const pair = c.split(';')[0];
    const name = pair.split('=')[0];
    const others = cookie
      .split('; ')
      .filter((x) => x && x.split('=')[0] !== name)
      .join('; ');
    cookie = others ? `${others}; ${pair}` : pair;
  }
  return res;
}

function csrfFrom(html) {
  const m = /data-csrf="([^"]*)"/.exec(html);
  return m ? m[1] : '';
}

async function signUp() {
  const page = await siteFetch('/signup');
  const html = await page.text();
  const token = csrfFrom(html);
  const res = await siteFetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, display_name: NAME }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`signup failed ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

/* --------------------------------------------------------- the DOM shim */

/** The screens run against a real parsed document, one page at a time. */
function installDom(html, path = '/') {
  const { document, window } = parseHTML(html);
  const [pathname, search = ''] = path.split('?');

  // linkedom has no layout, so setProperty needs to exist on every element.
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
  // navigator is a getter-only global in Node 24, so it has to be redefined.
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: window.navigator ?? { onLine: true, serviceWorker: undefined },
  });
  // The real path matters: week-detail reads the week number out of it, and
  // calendar, reference and print-week read a query string.
  globalThis.location = {
    pathname,
    search: search ? `?${search}` : '',
    href: BASE + path,
    assign() {},
    replace() {},
  };
  window.location = globalThis.location;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.CustomEvent = window.CustomEvent;
  globalThis.Event = window.Event;
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
  // No real intervals: the Today screen ticks every ten seconds and would keep
  // the process alive forever.
  window.setInterval = () => 0;
  window.clearInterval = () => {};
  globalThis.setInterval = () => 0;
  globalThis.clearInterval = () => {};
  window.requestAnimationFrame = (fn) => realSetTimeout(fn, 0);
  globalThis.requestAnimationFrame = window.requestAnimationFrame;

  // Every request the screen makes goes to the real server with the real session.
  globalThis.fetch = (path, init) => siteFetch(String(path), init);

  return document;
}

/* ------------------------------------------------------------- the pages */

const PAGES = [
  ['/', 'today'],
  ['/calendar', 'calendar'],
  ['/weeks', 'weeks'],
  ['/weeks/1', 'week-detail'],
  ['/dsa', 'dsa'],
  ['/library', 'library'],
  ['/projects', 'projects'],
  ['/gates', 'gates'],
  ['/sundays', 'sundays'],
  ['/pushes', 'pushes'],
  ['/money', 'money'],
  ['/applications', 'applications'],
  ['/ladder', 'ladder'],
  ['/roles', 'roles'],
  ['/eligibility', 'eligibility'],
  ['/after', 'after'],
  ['/newzealand', 'newzealand'],
  ['/everything', 'everything'],
  ['/stats', 'stats'],
  ['/profile', 'profile'],
  ['/review', 'review'],
  ['/reference', 'reference'],
  ['/print/week', 'print-week'],
];

/**
 * Pages whose containers are not marked with a "Loading" paragraph need an
 * explicit list of ids that must end up carrying content. Today is the main one:
 * it writes into named nodes with textContent rather than through mount().
 */
const REQUIRED = {
  today: ['t-date', 't-week', 't-strip', 't-now', 't-conditions', 't-yesterday', 't-dsa-total'],
  calendar: ['c-grid'],
  'week-detail': ['wd-head', 'wd-body'],
};

const sleep = (ms) => new Promise((r) => realSetTimeout(r, ms));

// One listener for the whole run, rather than one per page.
const thrown = [];
process.on('unhandledRejection', (e) => thrown.push(String(e?.message ?? e)));
process.on('uncaughtException', (e) => thrown.push(String(e?.message ?? e)));

async function checkPage(path, screen, index) {
  const res = await siteFetch(path);
  if (res.status !== 200) return { path, screen, ok: false, why: `page returned ${res.status}` };
  const html = await res.text();

  // Which containers the server left saying "Loading".
  const loading = [...html.matchAll(/id="([^"]+)"[^>]*>\s*(?:<[^>]*>\s*)*<p class="muted">Loading/g)].map(
    (m) => m[1]
  );
  const required = REQUIRED[screen] ?? [];
  const watched = [...new Set([...loading, ...required])];

  const document = installDom(html, path);
  const before = thrown.length;

  try {
    // A cache buster, because each page needs its own fresh module instance.
    await import(`../public/js/screens/${screen}.mjs?run=${index}-${Date.now()}`);
  } catch (err) {
    return { path, screen, ok: false, why: `module threw: ${err.message}`, containers: watched.length };
  }

  // Give any chained fetches a chance to land.
  for (let i = 0; i < 40; i += 1) await sleep(50);

  // --dump prints what each container actually rendered, so the content can be
  // judged rather than just counted.
  if (process.argv.includes('--dump') && (!DUMP_ONLY.length || DUMP_ONLY.includes(screen))) {
    console.log(`\n${'='.repeat(78)}\n${path}  (${screen})\n${'='.repeat(78)}`);
    for (const id of watched) {
      const node = document.getElementById(id);
      const text = (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
      console.log(`\n--- #${id}  ${text.length} chars, ${node?.children.length ?? 0} children ---`);
      console.log(text.slice(0, 1400));
    }
  }

  const stillLoading = [];
  const empty = [];
  const filled = [];
  for (const id of watched) {
    const node = document.getElementById(id);
    const text = (node?.textContent ?? '').trim();
    if (!node) {
      empty.push(`${id} (no such element)`);
    } else if (/^Loading/.test(text)) {
      stillLoading.push(id);
    } else if (text.length === 0 && node.children.length === 0) {
      empty.push(id);
    } else {
      filled.push({ id, chars: text.length });
    }
  }

  const errorText = [...document.querySelectorAll('.callout--red')]
    .map((n) => n.textContent.replace(/\s+/g, ' ').trim())
    .filter((t) => /did not load/.test(t));

  return {
    path,
    screen,
    ok: stillLoading.length === 0 && empty.length === 0 && errorText.length === 0,
    containers: watched.length,
    filled: filled.length,
    stillLoading,
    empty,
    errorText,
    chars: filled.reduce((a, f) => a + f.chars, 0),
    thrown: thrown.slice(before),
  };
}

/* ------------------------------------------------------------------ main */

async function main() {
  console.log('smoke-screens.mjs');
  console.log(`server ${BASE}`);

  const health = await siteFetch('/login');
  if (health.status !== 200) throw new Error(`the server is not answering on ${BASE}`);

  console.log(`\nsigning up a throwaway account: ${EMAIL}`);
  await signUp();
  const user = await one('SELECT id, email FROM users WHERE email = ?', [EMAIL]);
  if (!user) throw new Error('the throwaway account was not created');
  console.log(`  user id ${user.id}, session established`);

  const results = [];
  console.log('');
  const pages = DUMP_ONLY.length ? PAGES.filter(([, s]) => DUMP_ONLY.includes(s)) : PAGES;
  for (const [i, [path, screen]] of pages.entries()) {
    const r = await checkPage(path, screen, i);
    results.push(r);
    const mark = r.ok ? 'ok  ' : 'FAIL';
    console.log(
      `  ${mark} ${path.padEnd(14)} ${screen.padEnd(13)} ` +
        (r.why
          ? r.why
          : `${r.filled}/${r.containers} containers filled, ${r.chars} chars` +
            (r.stillLoading?.length ? `  STILL LOADING: ${r.stillLoading.join(', ')}` : '') +
            (r.empty?.length ? `  EMPTY: ${r.empty.join(', ')}` : '') +
            (r.errorText?.length ? `  ERROR CARD: ${r.errorText[0].slice(0, 90)}` : ''))
    );
  }

  /* ---- clean up ---- */
  console.log('');
  await run('DELETE FROM users WHERE email = ?', [EMAIL]);
  const gone = await one('SELECT id FROM users WHERE email = ?', [EMAIL]);
  console.log(`throwaway account deleted: ${gone ? 'STILL PRESENT' : 'confirmed gone'}`);
  const orphans = await query(
    'SELECT COUNT(*) AS c FROM profiles WHERE user_id NOT IN (SELECT id FROM users)'
  );
  console.log(`orphaned profile rows: ${orphans[0].c}`);

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`${results.length - failed.length} of ${results.length} screens filled every container.`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(`  ${f.path} ${f.screen}: ${f.why ?? (f.stillLoading?.join(', ') || f.errorText?.[0])}`);
  }
  await closePool();
  process.exit(failed.length ? 1 : 0);
}

try {
  await main();
} catch (err) {
  console.error(`\nsmoke-screens failed: ${err.message}`);
  try {
    await run('DELETE FROM users WHERE email = ?', [EMAIL]);
    console.error('throwaway account cleaned up');
  } catch {
    console.error(`clean up the throwaway account by hand: DELETE FROM users WHERE email = '${EMAIL}';`);
  }
  await closePool();
  process.exit(1);
}
