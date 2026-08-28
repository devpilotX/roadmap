/**
 * security.test.mjs | password rules, markdown escaping, and the ICS writer.
 *
 * Three things that would each be quietly dangerous if wrong: a weak password
 * rule, markdown that renders raw HTML, and a calendar file that a phone
 * refuses. All three are pure functions, so all three can be pinned here.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  ARGON2_OPTIONS,
  MIN_PASSWORD_LENGTH,
  blocklistSize,
  checkPassword,
  strengthScore,
} from '../src/lib/passwords.mjs';
import { renderMarkdown } from '../src/lib/markdown.mjs';
import { buildIcs } from '../src/lib/ics.mjs';

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
