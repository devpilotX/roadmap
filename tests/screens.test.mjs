/**
 * screens.test.mjs | the screens against the API, checked without a browser.
 *
 * The Express build kept every page in an EJS view full of empty containers plus
 * one ES module that filled them, and this file checked that the module mounted to
 * ids the view actually had. There are no views and no mount ids now: a screen is
 * a React component, and a container that does not exist is a compile error.
 *
 * What TypeScript still cannot see is a **string**. `useResource('/api/tday')`
 * typechecks perfectly and fails at runtime. So does a page that the sidebar links
 * to but which was never created. Those are the two silent failures left, and they
 * are what this file catches:
 *
 *   1. every /api/... path a screen asks for is a route that exists, and the
 *      method it uses is exported by that route
 *   2. every path in the sidebar, the bottom bar and the command palette resolves
 *      to a page
 *   3. no screen still points at an endpoint the Express build had and this one
 *      does not
 *
 * Every check is static. No browser, no server, no database.
 */

import { strict as assert } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { describe, it } from 'node:test';
import { ROOT } from '../lib/config.ts';
import { NAV_PATHS } from '../lib/nav.ts';

const APP_DIR = join(ROOT, 'app');
const API_DIR = join(APP_DIR, 'api');
const SCREEN_DIR = join(APP_DIR, '(app)');

const read = (p) => readFile(p, 'utf8');

/** Every file under a directory, recursively. */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/* --------------------------------------------------- what the API really has */

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Turns app/api/gates/[no]/result/route.ts into
 * { path: '/api/gates/[no]/result', methods: ['PATCH'] }.
 */
const apiRoutes = await (async () => {
  const files = (await walk(API_DIR)).filter((f) => f.endsWith(`${sep}route.ts`));
  const out = [];
  for (const file of files) {
    const rel = relative(APP_DIR, file).split(sep).slice(0, -1);
    // A route group in brackets is not part of the URL. There are none under
    // app/api today, and this keeps the test honest if one is ever added.
    const segments = rel.filter((s) => !(s.startsWith('(') && s.endsWith(')')));
    const path = `/${segments.join('/')}`;
    const text = await read(file);
    const methods = METHODS.filter(
      (m) =>
        new RegExp(`export\\s+const\\s+${m}\\s*=`).test(text) ||
        new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\s*\\(`).test(text)
    );
    out.push({ path, methods, file: relative(ROOT, file) });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
})();

/** Matches a concrete call against a route path, dynamic segments included. */
function matcher(path) {
  const body = path
    .split('/')
    .map((seg) =>
      seg.startsWith('[') && seg.endsWith(']')
        ? '[^/]+'
        : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('/');
  return new RegExp(`^${body}$`);
}

const matchers = apiRoutes.map((r) => ({ ...r, re: matcher(r.path) }));

/* ------------------------------------------------------ what the screens ask */

const screenFiles = (await walk(SCREEN_DIR)).filter((f) => f.endsWith('.tsx'));
const sources = new Map();
for (const f of screenFiles) sources.set(relative(ROOT, f), await read(f));

/**
 * Every API path a source file asks for, with the method it uses.
 *
 * A template hole becomes a single concrete segment, because that is what it is
 * at runtime. A query string is dropped: routes are matched on the path.
 */
function apiCalls(src) {
  const out = [];

  const record = (method, raw) => {
    if (!raw.startsWith('/api/')) return;
    const path = raw
      .replace(/\$\{[^}]*\}/g, 'X')
      .split('?')[0]
      .replace(/\/+$/, '');
    out.push({ method, path: path || '/api' });
  };

  // useResource<T>('/api/...') and useResource('/api/...') are always GET.
  const useRe = /useResource\s*(?:<[^>]*>)?\s*\(\s*([`'"])([^`'"]*)\1/g;
  let m;
  while ((m = useRe.exec(src))) record('GET', m[2]);

  // api.get / post / put / patch / del
  const apiRe = /\bapi\.(get|post|put|patch|del|raw)\s*(?:<[^>]*>)?\s*\(\s*([`'"])([^`'"]*)\2/g;
  while ((m = apiRe.exec(src))) {
    const verb = m[1] === 'del' ? 'DELETE' : m[1].toUpperCase();
    // api.raw takes the method first, so its path is the second argument and is
    // matched by the rule below instead.
    if (verb !== 'RAW') record(verb, m[3]);
  }

  // api.raw('POST', '/api/...')
  const rawRe = /\bapi\.raw\s*(?:<[^>]*>)?\s*\(\s*([`'"])(\w+)\1\s*,\s*([`'"])([^`'"]*)\3/g;
  while ((m = rawRe.exec(src))) record(m[2].toUpperCase(), m[4]);

  return out;
}

/* -------------------------------------------------------------------- tests */

describe('the API surface itself', () => {
  it('has at least one route', () => {
    assert.ok(apiRoutes.length > 40, `only found ${apiRoutes.length} routes`);
  });

  it('exports at least one HTTP method from every route file', () => {
    const empty = apiRoutes.filter((r) => r.methods.length === 0);
    assert.deepEqual(
      empty.map((r) => r.file),
      [],
      'a route file that exports no method is a 405 waiting to happen'
    );
  });

  it('has no two route files claiming the same path', () => {
    const seen = new Map();
    const clashes = [];
    for (const r of apiRoutes) {
      if (seen.has(r.path)) clashes.push(`${r.path}: ${seen.get(r.path)} and ${r.file}`);
      seen.set(r.path, r.file);
    }
    assert.deepEqual(clashes, []);
  });
});

describe('every screen asks for an endpoint that exists', () => {
  for (const [file, src] of sources) {
    const calls = apiCalls(src);
    if (!calls.length) continue;

    it(`${file} calls ${calls.length} ${calls.length === 1 ? 'endpoint' : 'endpoints'}, all real`, () => {
      const problems = [];
      for (const call of calls) {
        const hits = matchers.filter((r) => r.re.test(call.path));
        if (!hits.length) {
          problems.push(`${call.method} ${call.path} matches no route`);
          continue;
        }
        if (!hits.some((r) => r.methods.includes(call.method))) {
          problems.push(
            `${call.method} ${call.path} exists but only exports ${hits
              .flatMap((r) => r.methods)
              .join(', ')}`
          );
        }
      }
      assert.deepEqual(problems, []);
    });
  }
});

describe('every navigable path has a page', () => {
  const pagePaths = new Set();

  for (const file of screenFiles) {
    if (!file.endsWith(`${sep}page.tsx`)) continue;
    const segments = relative(SCREEN_DIR, file)
      .split(sep)
      .slice(0, -1)
      .filter((s) => !(s.startsWith('(') && s.endsWith(')')));
    pagePaths.add(`/${segments.join('/')}`.replace(/\/$/, '') || '/');
  }

  it('found the pages on disk', () => {
    assert.ok(pagePaths.size >= 23, `only found ${pagePaths.size} pages`);
  });

  for (const href of NAV_PATHS) {
    it(`${href} is a real page`, () => {
      assert.ok(pagePaths.has(href), `${href} is in the sidebar but has no page.tsx`);
    });
  }

  for (const href of ['/reference', '/review', '/print/week', '/weeks/[n]']) {
    it(`${href} is a real page`, () => {
      assert.ok(pagePaths.has(href), `${href} has no page.tsx`);
    });
  }
});

describe('no screen points at an endpoint the rewrite removed', () => {
  /** Paths the Express build served that this one deliberately does not. */
  const GONE = ['/api/health', '/api/money/leads', '/api/dsa\'', '/api/export/day_logs.csv'];

  for (const [file, src] of sources) {
    it(`${file} has no stale path`, () => {
      const found = GONE.filter((p) => src.includes(p));
      assert.deepEqual(found, []);
    });
  }
});
