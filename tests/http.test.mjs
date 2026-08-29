/**
 * http.test.mjs | the server as a stranger sees it.
 *
 * This is the test that answers "is anything reachable without signing in".
 * It runs against a server that is already listening, because that is the thing
 * worth testing, and skips itself entirely when nothing is up. Start one with
 * `npm run build; npm start` and run the suite again to get real coverage here.
 *
 * It also refuses to run against something that is listening but is not this
 * application, so a different project on the same port cannot produce a wall of
 * false failures.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { config } from '../lib/config.ts';

const BASE = config.publicOrigin;

/** True only when the thing on that port answers as this application. */
async function reachable() {
  try {
    const res = await fetch(`${BASE}/api/healthz`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(2500),
    });
    const body = await res.json();
    return typeof body?.data?.today === 'string' && 'db' in body.data;
  } catch {
    return false;
  }
}

const up = await reachable();
const skip = () =>
  up ? false : `the Roadmap Tracker is not listening on ${BASE}, so the HTTP surface cannot be checked`;

const get = (path, init = {}) =>
  fetch(`${BASE}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(8000), ...init });

/** Every page route in app/(app). */
const PAGES = [
  '/', '/calendar', '/weeks', '/weeks/1', '/dsa', '/library', '/projects', '/gates',
  '/sundays', '/pushes', '/money', '/applications', '/ladder', '/roles', '/eligibility',
  '/after', '/newzealand', '/everything', '/stats', '/profile', '/review', '/reference',
  '/print/week',
];

/** A sample of API routes, one per area of the surface. */
const API = [
  '/api/me',
  '/api/today',
  '/api/warnings',
  '/api/calendar',
  '/api/weeks',
  '/api/dsa/summary',
  '/api/money/summary',
  '/api/leads',
  '/api/applications',
  '/api/ladder',
  '/api/roles',
  '/api/eligibility',
  '/api/stats',
  '/api/everything',
  '/api/ops',
  '/api/export/all.json',
  '/api/export/day_logs',
];

describe('nothing private is reachable without a session', () => {
  for (const path of PAGES) {
    it(`${path} redirects to the login page`, { skip: skip() }, async () => {
      const res = await get(path);
      // Next answers a server side redirect with 307, which preserves the method.
      assert.ok([302, 307].includes(res.status), `${path} answered ${res.status}`);
      assert.match(res.headers.get('location') ?? '', /\/login/);
    });
  }

  for (const path of API) {
    it(`${path} answers 401 with a JSON error`, { skip: skip() }, async () => {
      const res = await get(path);
      assert.equal(res.status, 401, `${path} answered ${res.status}`);
      assert.match(res.headers.get('content-type') ?? '', /application\/json/);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.error.code, 'UNAUTHORISED');
    });
  }

  it('never leaks a row of data in the 401 body', { skip: skip() }, async () => {
    const body = await (await get('/api/export/all.json')).text();
    assert.equal(body.includes('day_logs'), false);
    assert.ok(body.length < 500);
  });
});

describe('the pages a stranger is allowed to see', () => {
  it('serves the login page', { skip: skip() }, async () => {
    const res = await get('/login');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
  });

  it('serves the signup page', { skip: skip() }, async () => {
    // Open or closed, it must answer rather than redirect: the closed state is a
    // page that explains itself.
    assert.equal((await get('/signup')).status, 200);
  });

  it('answers the health check without a session', { skip: skip() }, async () => {
    const res = await get('/api/healthz');
    assert.ok([200, 503].includes(res.status));
  });

  it('answers 404 for a route that does not exist', { skip: skip() }, async () => {
    assert.equal((await get('/definitely-not-a-route')).status, 404);
  });

  it('tells crawlers to stay out', { skip: skip() }, async () => {
    const body = await (await get('/robots.txt')).text();
    assert.match(body, /Disallow: \//);
  });
});

describe('static assets are served from the same origin', () => {
  for (const [path, type] of [
    ['/sw.js', /javascript/],
    ['/manifest.webmanifest', /manifest|json/],
    ['/img/icon.svg', /svg/],
    ['/img/icon-192.png', /png/],
  ]) {
    it(`${path} is served as ${type}`, { skip: skip() }, async () => {
      const res = await get(path);
      assert.equal(res.status, 200, `${path} answered ${res.status}`);
      assert.match(res.headers.get('content-type') ?? '', type);
    });
  }
});

describe('the security headers', () => {
  it('sends a content security policy with a nonce and no unsafe-inline script', { skip: skip() }, async () => {
    const csp = (await get('/login')).headers.get('content-security-policy') ?? '';
    assert.ok(csp.length > 0, 'there is no CSP at all');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /script-src[^;]*'nonce-/, 'the script policy carries no nonce');
    assert.equal(
      /script-src[^;]*unsafe-inline/.test(csp),
      false,
      'the CSP allows inline script'
    );
    assert.match(csp, /style-src-attr 'none'/, 'a style attribute would be allowed');
  });

  it('refuses to be framed and refuses content sniffing', { skip: skip() }, async () => {
    const h = (await get('/login')).headers;
    assert.equal(h.get('x-frame-options'), 'DENY');
    assert.equal(h.get('x-content-type-options'), 'nosniff');
    assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  it('sets a permissions policy that turns the hardware off', { skip: skip() }, async () => {
    const pp = (await get('/login')).headers.get('permissions-policy') ?? '';
    for (const feature of ['camera', 'geolocation', 'microphone', 'payment', 'usb']) {
      assert.match(pp, new RegExp(`${feature}=\\(\\)`));
    }
  });

  it('sets a session cookie that is HttpOnly, SameSite and path scoped', { skip: skip() }, async () => {
    // The session row is created when the CSRF token is issued, which is the
    // first thing the browser asks for before it can post anything.
    const res = await get('/api/csrf');
    const cookies = (res.headers.getSetCookie?.() ?? []).join('\n');
    const session = cookies.split('\n').find((c) => c.startsWith('roadmap.sid=')) ?? '';
    assert.ok(session, 'no session cookie was set');
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=(Lax|Strict)/i);
    assert.match(session, /Path=\//);
  });

  it('never advertises the framework', { skip: skip() }, async () => {
    assert.equal((await get('/login')).headers.get('x-powered-by'), null);
  });
});

describe('CSRF protection', () => {
  const post = (path, body) =>
    get(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('rejects a login POST that carries no token', { skip: skip() }, async () => {
    const res = await post('/api/auth/login', {
      email: 'a@example.com',
      password: 'whatever-12345',
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('rejects a signup POST that carries no token', { skip: skip() }, async () => {
    assert.equal((await post('/api/auth/signup', {})).status, 403);
  });

  it('rejects a write to a data route that carries no token', { skip: skip() }, async () => {
    const res = await post('/api/me/synced', {});
    assert.ok([401, 403].includes(res.status), `answered ${res.status}`);
  });

  it('does not reject a plain GET', { skip: skip() }, async () => {
    assert.equal((await get('/login')).status, 200);
  });
});

describe('the calendar subscription', () => {
  it('needs a session like everything else', { skip: skip() }, async () => {
    const res = await get('/api/calendar.ics');
    assert.equal(res.status, 401);
  });
});
