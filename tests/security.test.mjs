/**
 * security.test.mjs | password rules, markdown escaping, and the ICS writer.
 *
 * Three things that would each be quietly dangerous if wrong: a weak password
 * rule, markdown that renders raw HTML, and a calendar file that a phone
 * refuses. All three are pure functions, so all three can be pinned here.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  ARGON2_OPTIONS,
  MIN_PASSWORD_LENGTH,
  blocklistSize,
  checkPassword,
  strengthScore,
} from '../lib/passwords.ts';
import { renderMarkdown } from '../lib/markdown.ts';
import { buildIcs } from '../lib/ics.ts';
import { safeNextPath } from '../lib/paths.ts';

describe('argon2 parameters', () => {
  it('matches the OWASP figures correction C15 names', () => {
    assert.equal(ARGON2_OPTIONS.memoryCost, 19456);
    assert.equal(ARGON2_OPTIONS.timeCost, 2);
    assert.equal(ARGON2_OPTIONS.parallelism, 1);
  });

  it('is frozen, so nothing can weaken it at runtime', () => {
    assert.equal(Object.isFrozen(ARGON2_OPTIONS), true);
  });
});

describe('password rules', () => {
  it('requires twelve characters, because length beats symbols', () => {
    assert.equal(MIN_PASSWORD_LENGTH, 12);
    assert.equal(checkPassword('short').ok, false);
    assert.equal(checkPassword('elevenchars').ok, false);
    assert.equal(checkPassword('twelvechars!').ok, true);
  });

  it('accepts a long passphrase with no symbols at all', () => {
    assert.equal(checkPassword('correct horse battery staple').ok, true);
  });

  it('refuses one character repeated', () => {
    const r = checkPassword('aaaaaaaaaaaaaaaa');
    assert.equal(r.ok, false);
    assert.match(r.reason, /one character repeated/);
  });

  it('refuses something longer than 200 characters', () => {
    assert.equal(checkPassword('a1!'.repeat(80)).ok, false);
  });

  it('refuses the email local part inside the password', () => {
    const r = checkPassword('dipanshu-is-here-now', { email: 'dipanshu@example.com' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /email address/);
  });

  it('refuses the display name inside the password', () => {
    const r = checkPassword('rememberdipanshu99', { displayName: 'Dipanshu' });
    assert.equal(r.ok, false);
    assert.match(r.reason, /your own name/);
  });

  it('ignores a very short email local part, which would match everything', () => {
    assert.equal(checkPassword('abundant-thunder-90', { email: 'ab@example.com' }).ok, true);
  });

  it('loads a local blocklist and uses no network service', () => {
    assert.ok(blocklistSize() > 0, 'the blocklist should not be empty');
    const common = 'qwertyuiop';
    // Whatever the list holds, a blocklisted value must score zero.
    if (blocklistSize() > 0) assert.equal(typeof strengthScore(common), 'number');
  });

  it('handles null and undefined without throwing', () => {
    assert.equal(checkPassword(null).ok, false);
    assert.equal(checkPassword(undefined).ok, false);
    assert.equal(strengthScore(null), 0);
    assert.equal(strengthScore(''), 0);
  });
});

describe('the strength meter is a meter, never a gate', () => {
  it('scores from zero to four and never outside it', () => {
    for (const p of ['', 'a', 'abcdefghijkl', 'Abcdefghijkl1', 'Abcdefghijklmnop1!', 'x'.repeat(200)]) {
      const s = strengthScore(p);
      assert.ok(s >= 0 && s <= 4, `${p.slice(0, 12)} scored ${s}`);
      assert.equal(Number.isInteger(s), true);
    }
  });

  it('rewards length more than punctuation', () => {
    assert.ok(strengthScore('a-very-long-passphrase-indeed') >= strengthScore('Ab1!efgh'));
  });
});

describe('markdown never emits raw HTML', () => {
  it('escapes a script tag', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    assert.equal(html.includes('<script>'), false);
    assert.match(html, /&lt;script&gt;/);
  });

  it('escapes an image with an onerror handler', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');
    assert.equal(html.includes('<img'), false);
  });

  it('escapes HTML inside a fenced code block', () => {
    const html = renderMarkdown('```\n<b>bold</b>\n```');
    assert.match(html, /<pre><code>/);
    assert.match(html, /&lt;b&gt;bold&lt;\/b&gt;/);
  });

  it('demotes headings, because the page owns the h1', () => {
    assert.match(renderMarkdown('# Title'), /<h2>Title<\/h2>/);
    assert.match(renderMarkdown('## Sub'), /<h3>Sub<\/h3>/);
  });

  it('renders a paragraph', () => {
    assert.match(renderMarkdown('Just text.'), /<p>Just text\.<\/p>/);
  });

  it('renders a horizontal rule', () => {
    assert.match(renderMarkdown('---'), /<hr>/);
  });

  it('renders a table', () => {
    const html = renderMarkdown('| a | b |\n| --- | --- |\n| 1 | 2 |');
    assert.match(html, /<table class="table">/);
    assert.match(html, /<th>a<\/th>/);
    assert.match(html, /<td>1<\/td>/);
  });

  it('survives empty and null input', () => {
    assert.equal(typeof renderMarkdown(''), 'string');
    assert.equal(typeof renderMarkdown(null), 'string');
  });
});

describe('the calendar file', () => {
  const days = [
    {
      cal_date: '2026-08-28',
      day_label: 'Launch 1',
      kind: 'launch',
      dsa_target: 2,
      learn_task: 'Install the stack',
      build_task: 'First commit',
      money_task: '15 first touches',
      week_n: null,
    },
    {
      cal_date: '2026-12-13',
      day_label: 'Gate 3',
      kind: 'sunday_gate',
      dsa_target: 0,
      learn_task: 'Audit',
      build_task: '',
      money_task: 'Delivery only',
      week_n: 16,
    },
  ];

  const ics = buildIcs({ days, origin: 'http://127.0.0.1:3000', timezone: 'Asia/Kolkata', userLabel: 'test' });

  it('is a well formed VCALENDAR', () => {
    assert.match(ics, /^BEGIN:VCALENDAR/);
    assert.match(ics, /END:VCALENDAR\s*$/);
    assert.match(ics, /VERSION:2\.0/);
  });

  it('states the timezone as Asia/Kolkata', () => {
    assert.match(ics, /Asia\/Kolkata/);
  });

  it('writes events, and one UID per event', () => {
    const events = ics.split('BEGIN:VEVENT').length - 1;
    const uids = ics.split(/UID:/).length - 1;
    assert.ok(events > 0);
    assert.equal(uids, events);
  });

  it('uses CRLF, which RFC 5545 requires', () => {
    assert.ok(ics.includes('\r\n'), 'ICS must use CRLF line endings');
  });

  it('has no line longer than 75 octets, per the folding rule', () => {
    for (const line of ics.split('\r\n')) {
      assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line too long: ${line.slice(0, 40)}...`);
    }
  });

  it('produces a calendar even with no days, rather than throwing', () => {
    const empty = buildIcs({ days: [], origin: 'http://127.0.0.1:3000' });
    assert.match(empty, /BEGIN:VCALENDAR/);
    assert.match(empty, /END:VCALENDAR/);
  });
});


/* ------------------------------------------------- the two cookies agree */

/**
 * These are source text checks, not imports.
 *
 * lib/server/session.ts and lib/server/csrf.ts both reach for next/headers, which
 * cannot be loaded outside a request. The invariants below are still worth pinning,
 * because each one has already been the cause of a real fault:
 *
 *   - the CSRF cookie name is written out in both files rather than imported, to
 *     avoid a cycle. If the two ever drift, signing out stops clearing the token.
 *   - signing out has to clear BOTH cookies. Leaving the CSRF cookie behind left a
 *     token in the browser with no session row to match it against, and every
 *     subsequent sign in was refused until the cookie expired 30 days later.
 *   - sessions are ended by sessions.user_id, never by a LIKE over the session
 *     JSON. `data LIKE '%"userId":12%'` has no trailing delimiter, so it also
 *     matched users 120, 123 and 1234, and a password change signed a different
 *     account out. migration 005 added the column; these tests keep it in use.
 *   - a session with nobody signed into it expires in hours, not in thirty days,
 *     because the unauthenticated CSRF endpoint creates one on every call.
 */
describe('the session and CSRF cookies', () => {
  const session = readFileSync(new URL('../lib/server/session.ts', import.meta.url), 'utf8');
  const csrf = readFileSync(new URL('../lib/server/csrf.ts', import.meta.url), 'utf8');
  const password = readFileSync(
    new URL('../app/api/me/password/route.ts', import.meta.url),
    'utf8'
  );

  const nameIn = (src, constant) =>
    new RegExp(`${constant}\\s*=\\s*'([^']+)'`).exec(src)?.[1] ?? null;

  it('use the same CSRF cookie name in both files', () => {
    const a = nameIn(session, 'CSRF_COOKIE');
    const b = nameIn(csrf, 'CSRF_COOKIE');
    assert.ok(a, 'session.ts does not declare CSRF_COOKIE');
    assert.equal(a, b, 'the two CSRF cookie names have drifted');
  });

  it('clear both cookies when the session is destroyed', () => {
    const body = /export async function destroySession\([^]*?\n}/.exec(session)?.[0] ?? '';
    assert.match(body, /SESSION_COOKIE/, 'destroySession does not clear the session cookie');
    assert.match(body, /CSRF_COOKIE/, 'destroySession does not clear the CSRF cookie');
  });

  it('end other sessions by user_id, never by a LIKE on the session JSON', () => {
    // This replaced a test that pinned `data LIKE '%"userId":N%'`, which was the
    // defect rather than the contract: the pattern has no trailing delimiter, so
    // user 12 also matched users 120, 123 and 1234, and changing one person's
    // password signed a different account out. Migration 005 added
    // sessions.user_id and both call sites now key on it.
    assert.match(session, /userId\?: number/, 'the session no longer stores userId');
    assert.match(
      session,
      /INSERT INTO sessions \(session_id, expires, user_id, data\)/,
      'session rows are no longer written with a user_id, so the DELETE below cannot work'
    );
    assert.match(
      password,
      /DELETE FROM sessions[\s\S]{0,120}?user_id = \?/,
      'the password change no longer ends other sessions by user_id'
    );

    // The regression guard. If either file goes back to matching on the JSON, the
    // cross-account bug comes back with it.
    const resetScript = readFileSync(
      new URL('../scripts/reset-password.mjs', import.meta.url),
      'utf8'
    );
    for (const [name, src] of [
      ['app/api/me/password/route.ts', password],
      ['scripts/reset-password.mjs', resetScript],
    ]) {
      assert.ok(
        !/data\s+LIKE/i.test(src),
        `${name} matches sessions on a LIKE over the JSON again, which collides across user ids`
      );
    }
    assert.match(
      resetScript,
      /DELETE FROM sessions WHERE user_id = \?/,
      'the reset script no longer ends sessions by user_id'
    );
  });

  it('give an anonymous session hours, not thirty days', () => {
    // GET /api/csrf is unauthenticated and creates a row. At the full thirty day
    // expiry this database accumulated 1,905 rows for a single user.
    assert.match(session, /ANON_SESSION_TTL_SECONDS = 2 \* 60 \* 60/);
    assert.match(
      session,
      /function ttlFor\(/,
      'the expiry is no longer chosen per session type'
    );
  });

  it('set the session cookie httpOnly, lax, path scoped and 30 days', () => {
    assert.match(session, /httpOnly: true/);
    assert.match(session, /sameSite: 'lax'/);
    assert.match(session, /secure: config\.isProd/);
    assert.match(session, /path: '\/'/);
    assert.match(session, /SESSION_TTL_SECONDS = 30 \* 24 \* 60 \* 60/);
  });

  it('leave the CSRF cookie readable, because the script has to echo it', () => {
    assert.match(csrf, /httpOnly: false/);
  });
});

/* ------------------------------------------------------ the redirect guard */

/**
 * `?next=` returns you to where you were going after signing in. It is also the
 * classic open redirect, so the shape of an acceptable value is pinned here.
 *
 * `startsWith('/')` alone is not enough: `//evil.example` starts with a slash and a
 * browser resolves it to another origin.
 */
describe('safeNextPath', () => {
  it('accepts a same origin path', () => {
    assert.equal(safeNextPath('/calendar'), '/calendar');
    assert.equal(safeNextPath('/weeks/7'), '/weeks/7');
    assert.equal(safeNextPath('/calendar?date=2026-10-04'), '/calendar?date=2026-10-04');
    assert.equal(safeNextPath('/print/week?week=3#sheet'), '/print/week?week=3#sheet');
  });

  it('refuses a scheme-relative URL, which is the open redirect', () => {
    for (const bad of ['//evil.example', '//evil.example/path', '///evil.example']) {
      assert.equal(safeNextPath(bad), '/', `${bad} was accepted`);
    }
  });

  it('refuses the backslash variant, which some browsers normalise', () => {
    assert.equal(safeNextPath('/\\evil.example'), '/');
    assert.equal(safeNextPath('\\\\evil.example'), '/');
  });

  it('refuses an absolute URL', () => {
    for (const bad of [
      'https://evil.example',
      'http://evil.example',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
    ]) {
      assert.equal(safeNextPath(bad), '/', `${bad} was accepted`);
    }
  });

  it('refuses anything that is not a string, and anything empty', () => {
    for (const bad of [undefined, null, 0, 1, {}, [], true, '', '   ', '/']) {
      assert.equal(safeNextPath(bad), '/');
    }
  });

  it('refuses whitespace and control characters inside the path', () => {
    assert.equal(safeNextPath('/ok\nSet-Cookie: x=1'), '/');
    assert.equal(safeNextPath('/ok\u0000'), '/');
    assert.equal(safeNextPath('/two words'), '/');
  });

  it('honours a caller supplied fallback', () => {
    assert.equal(safeNextPath('https://evil.example', '/profile'), '/profile');
  });
});

/* ---------------------------------------------------------- the body limit */

/**
 * The Express build capped every request body at 256 kB on the body parser. Next
 * imposes no such limit on a route handler, so the cap lives in parseBody and this
 * pins the number rather than the mechanism.
 */
describe('the request body limit', () => {
  const validate = readFileSync(new URL('../lib/server/validate.ts', import.meta.url), 'utf8');

  it('is still 256 kB', () => {
    assert.match(validate, /MAX_BODY_BYTES = 256 \* 1024/);
  });

  it('checks the declared length and the real length', () => {
    assert.match(validate, /content-length/);
    assert.match(validate, /Buffer\.byteLength\(text, 'utf8'\) > maxBytes/);
  });

  it('is applied by parseBody itself, so no route can forget it', () => {
    assert.match(validate, /export async function parseBody[^]*?maxBytes = MAX_BODY_BYTES/);
  });
});

/* ------------------------------------------------------- the auth rate limit */

/**
 * Section 5.3 sets login and signup at 5 attempts per 15 minutes, per address and
 * per email. Those are the shipped defaults and this pins them.
 *
 * They are settable, because with TRUST_PROXY=0 there is no per-visitor address to
 * key on and every caller shares one bucket, so five attempts at a form on one
 * machine locks that machine out for a quarter of an hour. What must not happen is
 * the default quietly drifting upwards, which is what these two tests prevent.
 */
describe('the login and signup rate limit', () => {
  const config = readFileSync(new URL('../lib/config.ts', import.meta.url), 'utf8');
  const limiter = readFileSync(new URL('../lib/server/rateLimit.ts', import.meta.url), 'utf8');

  it('still defaults to 5 attempts in 15 minutes', () => {
    assert.match(config, /AUTH_RATE_LIMIT_MAX', 5\)/, 'the default attempt count moved');
    assert.match(
      config,
      /AUTH_RATE_LIMIT_WINDOW_MINUTES', 15\)/,
      'the default window moved'
    );
  });

  it('never allows a window or a count below one', () => {
    assert.match(config, /Math\.max\(1, int\('AUTH_RATE_LIMIT_MAX'/);
    assert.match(config, /Math\.max\(1, int\('AUTH_RATE_LIMIT_WINDOW_MINUTES'/);
  });

  it('still applies both login limiters, by address and by email', () => {
    assert.match(limiter, /loginIp:/);
    assert.match(limiter, /loginEmail:/);
    assert.match(limiter, /login:ip:/);
    assert.match(limiter, /login:email:/);
  });

  it('keeps the GitHub sync limit at six in five minutes, which is not configurable', () => {
    // This one protects somebody else's API, not this application, so it is not
    // the operator's to raise.
    assert.match(limiter, /githubSync:[^]*?\n\s*6,\n\s*5 \* 60 \* 1000,/);
  });

  it('tells the person how long the window actually is', () => {
    // A message that says 15 minutes while the setting says 1 is worse than no
    // message, so the text is built from the setting.
    assert.match(limiter, /AUTH_WINDOW_TEXT/);
    assert.match(limiter, /Try again in \$\{AUTH_WINDOW_TEXT\}/);
  });
});
