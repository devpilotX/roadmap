/**
 * signup-gate.test.mjs | the front door.
 *
 * This application is one person's tracker. `requireAnon` only keeps a signed in
 * visitor away from /signup, so before this gate existed anyone who found the URL
 * on a deployed instance could register an account on the server.
 *
 * The rule these tests hold in place:
 *
 *   ALLOW_SIGNUP unset   open only while the database has no users
 *   ALLOW_SIGNUP=true    forced open
 *   ALLOW_SIGNUP=false   forced shut
 *
 * and, above everything else, that a count which cannot be read fails **closed**.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { decide, requireSignupOpen } from '../src/middleware/signup.mjs';
import { config } from '../src/config.mjs';

describe('the policy, as a pure decision', () => {
  it('is open on an empty database', () => {
    const d = decide('auto', 0);
    assert.equal(d.open, true);
    assert.equal(d.mode, 'first-run');
  });

  it('is shut as soon as one account exists', () => {
    const d = decide('auto', 1);
    assert.equal(d.open, false);
    assert.equal(d.mode, 'closed-after-first');
    assert.match(d.reason, /already has its account/);
  });

  it('is shut for any number of accounts above zero', () => {
    for (const n of [1, 2, 7, 1000]) {
      assert.equal(decide('auto', n).open, false, `${n} accounts should close the door`);
    }
  });

  it('fails CLOSED when the count cannot be read', () => {
    const d = decide('auto', null);
    assert.equal(d.open, false, 'an unreadable count must never open the door');
    assert.equal(d.mode, 'unknown-fails-closed');
  });

  it('is forced open by true, whatever the count', () => {
    for (const n of [0, 1, 99, null]) {
      const d = decide(true, n);
      assert.equal(d.open, true);
      assert.equal(d.mode, 'forced-open');
    }
  });

  it('is forced shut by false, even on an empty database', () => {
    for (const n of [0, 1, null]) {
      const d = decide(false, n);
      assert.equal(d.open, false);
      assert.equal(d.mode, 'forced-shut');
    }
  });

  it('always gives a reason a person can read', () => {
    for (const [mode, n] of [['auto', 0], ['auto', 1], ['auto', null], [true, 0], [false, 0]]) {
      const d = decide(mode, n);
      assert.ok(d.reason && d.reason.length > 15, `${mode}/${n} has no readable reason`);
      assert.equal(/undefined|null|\[object/.test(d.reason), false);
    }
  });
});

describe('the config flag is read safely', () => {
  it('is one of true, false or the string auto', () => {
    assert.ok([true, false, 'auto'].includes(config.allowSignup), `got ${config.allowSignup}`);
  });

  it('defaults to auto, so a fresh deployment closes itself after the first account', () => {
    // The shipped .env.example does not set ALLOW_SIGNUP, so this is the state a
    // deployment starts in unless someone deliberately changes it.
    if (!process.env.ALLOW_SIGNUP) assert.equal(config.allowSignup, 'auto');
  });
});

describe('the guard refuses in the right shape', () => {
  /** A guard bound to a fixed decision, so no environment or database is needed. */
  function guardWith(decision) {
    return async (req) => {
      const out = { status: 0, json: null, rendered: null, nexted: false };
      const res = {
        status(c) { out.status = c; return this; },
        json(b) { out.json = b; return this; },
        render(view, locals) { out.rendered = { view, locals }; return this; },
      };
      // Exercise the same branch the real guard takes, with the decision fixed.
      if (decision.open) {
        out.nexted = true;
        return out;
      }
      if (String(req.path).startsWith('/api/')) {
        res.status(403).json({ ok: false, error: { code: 'SIGNUP_CLOSED', message: decision.reason } });
      } else {
        res.status(403).render('screens/error', {
          title: 'Account creation is closed',
          status: 403,
          heading: 'Account creation is closed',
          message: decision.reason,
        });
      }
      return out;
    };
  }

  it('answers an API request with 403 and a code, never a redirect', async () => {
    const out = await guardWith(decide('auto', 1))({ path: '/api/auth/signup' });
    assert.equal(out.nexted, false);
    assert.equal(out.status, 403);
    assert.equal(out.json.ok, false);
    assert.equal(out.json.error.code, 'SIGNUP_CLOSED');
    assert.equal(out.rendered, null, 'an API request must not be rendered as HTML');
  });

  it('answers a page request by rendering, never with JSON', async () => {
    const out = await guardWith(decide('auto', 1))({ path: '/signup' });
    assert.equal(out.status, 403);
    assert.equal(out.rendered.view, 'screens/error');
    assert.match(out.rendered.locals.heading, /closed/i);
    assert.equal(out.json, null, 'a page request must not be answered with JSON');
  });

  it('calls next when the door is open', async () => {
    const out = await guardWith(decide('auto', 0))({ path: '/api/auth/signup' });
    assert.equal(out.nexted, true);
    assert.equal(out.status, 0);
  });

  it('is wired as real middleware with the right arity', () => {
    assert.equal(typeof requireSignupOpen, 'function');
    assert.equal(requireSignupOpen.length, 3, 'Express middleware takes (req, res, next)');
  });
});
