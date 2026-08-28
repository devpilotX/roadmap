/**
 * screens.test.mjs | the client screens, checked without a browser.
 *
 * Every page in this application is an EJS view full of empty containers plus one
 * ES module that fills them. Three things can go wrong silently:
 *
 *   1. the module mounts to an id the view does not have, so a panel stays on
 *      "Loading" forever
 *   2. the module calls an API path that does not exist, so the screen shows an
 *      error card instead of data
 *   3. the module imports a helper that is not exported, which is a blank page
 *
 * None of those are caught by node --check, and all three are caught here. The
 * checks are static, so they need no browser and no running server.
 */

import { strict as assert } from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';
import { ROOT } from '../src/config.mjs';

const SCREENS_DIR = join(ROOT, 'public', 'js', 'screens');
const VIEWS_DIR = join(ROOT, 'views', 'screens');
const API_DIR = join(ROOT, 'src', 'routes', 'api');

const read = (p) => readFile(p, 'utf8');

const screenFiles = (await readdir(SCREENS_DIR)).filter((f) => f.endsWith('.mjs')).sort();
const sources = new Map();
for (const f of screenFiles) sources.set(f, await read(join(SCREENS_DIR, f)));

/** Views are named after the screen, except auth which serves login and signup. */
const viewFor = { 'auth.mjs': ['login.ejs', 'signup.ejs'] };
const viewSources = new Map();
for (const f of screenFiles) {
  const names = viewFor[f] ?? [f.replace(/\.mjs$/, '.ejs')];
  let text = '';
  for (const n of names) {
    try {
      text += await read(join(VIEWS_DIR, n));
    } catch {
      // A screen without a view of its own is reported by the test below.
    }
  }
  viewSources.set(f, text);
}

/* ------------------------------------------------- what the API really has */

/** Every route the API registers, as a matchable pattern. */
const apiRoutes = await (async () => {
  const out = [];
  const files = (await readdir(API_DIR)).filter((f) => f.endsWith('.mjs') && f !== 'index.mjs');
  for (const f of files) {
    const text = await read(join(API_DIR, f));
    // router.get('/path' ... and the multi-line form where the path is next.
    const re = /router\.(get|post|put|patch|delete)\(\s*(?:\/\*[^]*?\*\/\s*)?'([^']+)'/g;
    let m;
    while ((m = re.exec(text))) {
      out.push({ method: m[1].toUpperCase(), path: m[2], file: f });
    }
    // router.patch(\n  '/path',
    const re2 = /router\.(get|post|put|patch|delete)\(\s*\n\s*'([^']+)'/g;
    while ((m = re2.exec(text))) {
      out.push({ method: m[1].toUpperCase(), path: m[2], file: f });
    }
  }
  // /api/me is mounted at a prefix, everything else at /api.
  return out.map((r) => ({
    ...r,
    full: r.file === 'me.mjs' ? `/api/me${r.path === '/' ? '' : r.path}` : `/api${r.path}`,
  }));
})();

/** Turns /api/gates/:no/result into a regexp that matches a concrete call. */
function routeMatcher(full) {
  const body = full
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^${body}$`);
}

const matchers = apiRoutes.map((r) => ({ ...r, re: routeMatcher(r.full) }));

/** Every api.X('path') call in a screen, with template holes made concrete. */
function apiCalls(src) {
  const out = [];
  const re = /\bapi\.(get|post|put|patch|del)\(\s*([`'"])([^`'"]*)\2/g;
  let m;
  while ((m = re.exec(src))) {
    const method = m[1] === 'del' ? 'DELETE' : m[1].toUpperCase();
    let path = m[3]
      .replace(/\$\{[^}]*\}/g, '1') // ${id} becomes a concrete segment
      .replace(/\?.*$/, ''); // query strings are not part of the route
    if (!path.startsWith('/api')) continue;
    out.push({ method, path, raw: m[3] });
  }
  return out;
}

/* -------------------------------------------------- what the helpers export */

async function exportsOf(relPath) {
  const text = await read(join(ROOT, relPath));
  const names = new Set();
  for (const m of text.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/export\s+(?:const|let|var|class)\s+(\w+)/g)) names.add(m[1]);
  for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name && name !== 'default') names.add(name);
    }
  }
  return names;
}

const HELPERS = {
  '../api.mjs': await exportsOf('public/js/api.mjs'),
  '../ui.mjs': await exportsOf('public/js/ui.mjs'),
  '../render.mjs': await exportsOf('public/js/render.mjs'),
  '../toast.mjs': await exportsOf('public/js/toast.mjs'),
  '../timer.mjs': await exportsOf('public/js/timer.mjs'),
  '../offline.mjs': await exportsOf('public/js/offline.mjs'),
};

function namedImports(src) {
  const out = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const from = m[2];
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) out.push({ name, from });
    }
  }
  return out;
}

/* --------------------------------------------------------------- the tests */

describe('every screen module is real', () => {
  it('finds one module per screen, and 24 of them', () => {
    assert.equal(screenFiles.length, 24, `found ${screenFiles.length} screen modules`);
  });

  for (const f of screenFiles) {
    it(`${f} is not a placeholder stub`, () => {
      const src = sources.get(f);
      assert.equal(/placeholder, replaced in the next step/.test(src), false, `${f} is still a stub`);
      assert.equal(/#placeholder-none/.test(src), false, `${f} still mounts to #placeholder-none`);
      assert.ok(src.split('\n').length > 20, `${f} is only ${src.split('\n').length} lines`);
    });
  }
});

describe('every mount target exists in the view', () => {
  for (const f of screenFiles) {
    it(`${f} mounts only to ids its view declares`, () => {
      const src = sources.get(f);
      const view = viewSources.get(f) ?? '';
      const ids = new Set([...view.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
      const mounted = [...src.matchAll(/mount\(\s*'#([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
      const missing = mounted.filter((id) => !ids.has(id));
      assert.deepEqual(missing, [], `${f} mounts to ids that are not in the view: ${missing.join(', ')}`);
    });
  }
});

describe('every view container gets filled', () => {
  // A container the module never fills keeps its "Loading" text forever, which is
  // the exact bug this suite exists to prevent.
  for (const f of screenFiles) {
    const view = viewSources.get(f) ?? '';
    if (!/Loading/.test(view)) continue;
    it(`${f} fills every container the view leaves on Loading`, () => {
      const src = sources.get(f);
      const loadingIds = [...view.matchAll(/id="([^"]+)"[^>]*>\s*(?:<[^>]+>\s*)*<p class="muted">Loading/g)].map(
        (m) => m[1]
      );
      const touched = new Set([
        ...[...src.matchAll(/mount\(\s*'#([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]),
        ...[...src.matchAll(/qs\(\s*'#([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]),
        ...[...src.matchAll(/'#([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]),
      ]);
      const never = loadingIds.filter((id) => !touched.has(id));
      assert.deepEqual(never, [], `${f} never touches: ${never.join(', ')}, so those panels stay on Loading`);
    });
  }
});

describe('every API path a screen calls is registered', () => {
  it('found the API route table', () => {
    assert.ok(apiRoutes.length >= 60, `only found ${apiRoutes.length} API routes`);
  });

  for (const f of screenFiles) {
    const calls = apiCalls(sources.get(f));
    if (!calls.length) continue;
    it(`${f} calls ${calls.length} path${calls.length === 1 ? '' : 's'}, all of which exist`, () => {
      const bad = [];
      for (const c of calls) {
        const hit = matchers.some((r) => r.method === c.method && r.re.test(c.path));
        if (!hit) bad.push(`${c.method} ${c.raw}`);
      }
      assert.deepEqual(bad, [], `${f} calls routes that do not exist: ${bad.join(', ')}`);
    });
  }
});

describe('every helper a screen imports is exported', () => {
  for (const f of screenFiles) {
    it(`${f} imports nothing that does not exist`, () => {
      const bad = [];
      for (const { name, from } of namedImports(sources.get(f))) {
        const known = HELPERS[from];
        if (!known) continue; // a relative import of something else is not our business
        if (!known.has(name)) bad.push(`${name} from ${from}`);
      }
      assert.deepEqual(bad, [], `${f} imports missing exports: ${bad.join(', ')}`);
    });
  }
});

describe('the two rules the CSP and el() enforce', () => {
  for (const f of screenFiles) {
    it(`${f} never injects HTML from data and never writes a style attribute`, () => {
      // Comments are stripped first, because these files discuss the rules.
      const src = sources
        .get(f)
        .replace(/\/\*[^]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      assert.equal(/\binnerHTML\b/.test(src), false, `${f} uses innerHTML`);
      assert.equal(/\bouterHTML\s*=/.test(src), false, `${f} assigns outerHTML`);
      assert.equal(/setAttribute\(\s*['"]style['"]/.test(src), false, `${f} sets a style attribute`);
      assert.equal(/\bhtml:\s/.test(src), false, `${f} passes html: to el(), which throws`);
    });
  }
});

describe('every screen fails visibly rather than silently', () => {
  for (const f of screenFiles) {
    if (f === 'auth.mjs') continue; // the auth screens are forms, not fetch-and-fill
    it(`${f} catches its own errors and shows an error card`, () => {
      const src = sources.get(f);
      assert.match(src, /catch\s*\(/, `${f} has no catch block`);
      assert.match(src, /errorCard\(/, `${f} never renders an errorCard, so a failure would stay on Loading`);
    });
  }
});

describe('every screen actually runs itself', () => {
  for (const f of screenFiles) {
    it(`${f} invokes its entry point at the top level`, () => {
      // Three shapes are in use and all three are fine: `await main();` at the
      // end, a top level `try { await load(); } catch {}`, and a screen that is
      // pure event wiring, which auth.mjs is because it only reacts to a submit.
      const src = sources.get(f);
      const started =
        /^\s*await\s+\w+\(/m.test(src) ||
        /^\s*\w+\(\)\s*\.catch/m.test(src) ||
        /^(document|window|form|toggle)\??\.addEventListener/m.test(src);
      assert.ok(started, `${f} defines its work but never starts it`);
    });
  }
});

describe('every class a screen uses is defined somewhere', () => {
  // A class name with no rule behind it is invisible: the markup is right, the
  // layout is wrong, and nothing errors. This is the check that catches it.
  const cssDir = join(ROOT, 'public', 'css');
  const defined = new Set();
  const cssFiles = [];

  before(async () => {
    for (const dir of [cssDir, join(cssDir, 'screens')]) {
      for (const f of (await readdir(dir)).filter((n) => n.endsWith('.css'))) {
        cssFiles.push(join(dir, f));
        const text = await read(join(dir, f));
        for (const m of text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) defined.add(m[1]);
      }
    }
  });

  /** Class literals, skipping anything containing a template hole. */
  function classesIn(src) {
    const out = new Set();
    for (const m of src.matchAll(/class:\s*'([^'`$]*)'/g)) {
      for (const c of m[1].split(/\s+/)) if (c) out.add(c);
    }
    for (const m of src.matchAll(/classList\.(?:add|toggle|remove)\(\s*'([a-zA-Z][\w-]*)'/g)) {
      out.add(m[1]);
    }
    return out;
  }

  it('has stylesheets to check against', () => {
    assert.ok(cssFiles.length >= 25, `only found ${cssFiles.length} stylesheets`);
    assert.ok(defined.size >= 300, `only found ${defined.size} class definitions`);
  });

  for (const f of screenFiles) {
    it(`${f} uses no class that has no rule`, () => {
      const missing = [...classesIn(sources.get(f))].filter((c) => !defined.has(c));
      assert.deepEqual(missing, [], `${f} uses undefined classes: ${missing.join(', ')}`);
    });
  }

  /**
   * The stronger check. head.ejs loads tokens, base, layout and components on
   * every page and then exactly one screens/NAME.css, so a class defined in some
   * other screen's stylesheet is not available here. The markup renders, the
   * layout does not, and nothing errors. That is the bug this catches.
   */
  it('uses no class that its own page does not load', async () => {
    const global = new Set();
    for (const f of ['tokens.css', 'base.css', 'layout.css', 'components.css']) {
      const text = await read(join(cssDir, f));
      for (const m of text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) global.add(m[1]);
    }

    // Which stylesheets each page loads, straight from the route table.
    const pagesSrc = await read(join(ROOT, 'src', 'routes', 'pages', 'index.mjs'));
    const rows = [...pagesSrc.matchAll(/\['(\/[^']*)',\s*'([a-z-]+)',\s*'[^']*',\s*\[([^\]]*)\],\s*\[([^\]]*)\]/g)];

    const problems = [];
    for (const [, path, , cssList, jsList] of rows) {
      const sheets = cssList.split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
      const modules = jsList.split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);

      const available = new Set(global);
      for (const sheet of sheets) {
        let text = '';
        try {
          text = await read(join(cssDir, 'screens', `${sheet}.css`));
        } catch {
          continue;
        }
        for (const m of text.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) available.add(m[1]);
      }

      for (const mod of modules) {
        const src = sources.get(`${mod}.mjs`);
        if (!src) continue;
        for (const c of classesIn(src)) {
          if (!available.has(c)) problems.push(`${path} (${mod}.mjs) uses .${c}, which ${sheets.join('+')}.css does not load`);
        }
      }
    }
    assert.deepEqual(problems, [], `\n${problems.join('\n')}`);
  });

  for (const f of screenFiles) {
    it(`${f} does not stack two flex containers on one element`, () => {
      // .row, .between, .row-tight and .filters are each a complete flex row with
      // their own gap. Combining two means the winner depends on the order the
      // rules happen to appear in, which is not a layout decision.
      const clashes = [];
      for (const m of sources.get(f).matchAll(/class:\s*'([^'`$]*)'/g)) {
        const parts = m[1].split(/\s+/).filter(Boolean);
        const flex = parts.filter((p) => ['row', 'between', 'row-tight', 'filters'].includes(p));
        if (flex.length > 1) clashes.push(m[1]);
      }
      assert.deepEqual(clashes, [], `${f} stacks flex containers: ${clashes.join(' | ')}`);
    });
  }
});

describe('every page route has the assets it names', () => {
  it('names a css file and a js file that both exist', async () => {
    const pages = await read(join(ROOT, 'src', 'routes', 'pages', 'index.mjs'));
    const rows = [...pages.matchAll(/\['(\/[^']*)',\s*'([a-z-]+)',\s*'[^']*',\s*\[([^\]]*)\],\s*\[([^\]]*)\]/g)];
    assert.ok(rows.length >= 20, `only parsed ${rows.length} page routes`);

    const cssFiles = new Set(await readdir(join(ROOT, 'public', 'css', 'screens')));
    const jsFiles = new Set(await readdir(SCREENS_DIR));
    const missing = [];

    for (const [, path, , cssList, jsList] of rows) {
      for (const raw of cssList.split(',')) {
        const name = raw.trim().replace(/'/g, '');
        if (name && !cssFiles.has(`${name}.css`)) missing.push(`${path} wants css/screens/${name}.css`);
      }
      for (const raw of jsList.split(',')) {
        const name = raw.trim().replace(/'/g, '');
        if (name && !jsFiles.has(`${name}.mjs`)) missing.push(`${path} wants js/screens/${name}.mjs`);
      }
    }
    assert.deepEqual(missing, [], missing.join('; '));
  });
});
