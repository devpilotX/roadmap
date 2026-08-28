/**
 * http.test.mjs | the server as a stranger sees it.
 *
 * This is the test that answers "is anything reachable without signing in".
 * It runs against a server that is already listening, because that is the thing
 * worth testing, and skips itself entirely when nothing is up. Start one with
 * `npm start` and run the suite again to get real coverage here.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { config } from '../src/config.mjs';

const BASE = config.publicOrigin;

async function reachable() {
  try {
    const res = await fetch(`${BASE}/login`, { redirect: 'manual', signal: AbortSignal.timeout(2500) });
    return res.status > 0;
  } catch {
    return false;
  }
}

const up = await reachable();
const skip = () => (up ? false : `no server is listening on ${BASE}, so the HTTP surface cannot be checked`);

const get = (path, init = {}) =>
  fetch(`${BASE}${path}`, { redirect: 'manual', signal: AbortSignal.timeout(8000), ...init });

/** Every page route registered in src/routes/pages/index.mjs. */
const PAGES = [
  '/', '/calendar', '/weeks', '/weeks/1', '/dsa', '/library', '/projects', '/gates',
  '/sundays', '/pushes', '/money', '/applications', '/ladder', '/roles', '/eligibility',
  '/after', '/newzealand', '/everything', '/stats', '/profile', '/review', '/reference',
  '/print/week',
];

/** A sample of API routes, one per domain file. */
const API = [
  '/api/health', '/api/today', '/api/weeks', '/api/dsa', '/api/money/leads',
  '/api/applications', '/api/ladder', '/api/roles', '/api/eligibility', '/api/stats',
  '/api/warnings', '/api/everything', '/api/export/all.json', '/api/export/day_logs.csv',
];

describe('nothing private is reachable without a session', () => {
  for (const path of PAGES) {
    it(`${path} redirects to the login page`, { skip: skip() }, async () => {
      const res = await get(path);
      assert.equal(res.status, 302, `${path} answered ${res.status}`);
      assert.match(res.headers.get('location') ?? '', /^\/login/);
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
    assert.equal((await get('/signup')).status, 200);
  });

  it('answers 404 for a route that does not exist', { skip: skip() }, async () => {
    assert.equal((await get('/definitely-not-a-route')).status, 404);
  });
});

describe('static assets are served from the same origin', () => {
  for (const [path, type] of [
    ['/css/tokens.css', /text\/css/],
    ['/css/base.css', /text\/css/],
    ['/js/boot.mjs', /javascript/],
    ['/js/sw.js', /javascript/],
  ]) {
    it(`${path} is served as ${type}`, { skip: skip() }, async () => {
      const res = await get(path);
      assert.equal(res.status, 200, `${path} answered ${res.status}`);
      assert.match(res.headers.get('content-type') ?? '', type);
    });
  }
});

describe('the security headers helmet sets', () => {
  it('sends a content security policy with no unsafe-inline script source', { skip: skip() }, async () => {
    const csp = (await get('/login')).headers.get('content-security-policy') ?? '';
    assert.ok(csp.length > 0, 'there is no CSP at all');
    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(/script-src[^;]*unsafe-inline/.test(csp), false, 'the CSP allows inline script');
    assert.equal(/script-src[^;]*unsafe-eval/.test(csp), false, 'the CSP allows eval');
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
    const cookie = (await get('/login')).headers.get('set-cookie') ?? '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=(Lax|Strict)/i);
    assert.match(cookie, /Path=\//);
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
    const res = await post('/api/auth/login', { email: 'a@example.com', password: 'whatever-12345' });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  it('rejects a signup POST that carries no token', { skip: skip() }, async () => {
    assert.equal((await post('/api/auth/signup', {})).status, 403);
  });

  it('rejects a write to a data route that carries no token', { skip: skip() }, async () => {
    const res = await post('/api/daily/log', { log_date: '2026-08-28' });
    assert.ok([401, 403, 404].includes(res.status), `answered ${res.status}`);
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
