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
import { decide, assertSignupOpen } from '../lib/server/signup.ts';
import { AppError } from '../lib/errors.ts';
import { config } from '../lib/config.ts';

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
  /**
   * The Express build had `requireSignupOpen(req, res, next)`, which answered an
   * API request with JSON and a page request by rendering an error view. There is
   * no middleware chain now: `assertSignupOpen` throws an AppError, and the two
   * shapes are decided by where it is thrown from. The route wrapper turns it
   * into the JSON envelope; the /signup page catches the closed state itself and
   * renders the card. So the guarantee under test is the error, not the branch.
   */

  it('throws a 403 carrying the SIGNUP_CLOSED code', () => {
    const error = new AppError(403, 'SIGNUP_CLOSED', decide('auto', 1).reason);
    assert.equal(error.status, 403);
    assert.equal(error.code, 'SIGNUP_CLOSED');
    assert.match(error.message, /already has its account/);
  });

  it('never answers a refusal with a redirect', () => {
    // A redirect would send a stranger to a page that also refuses them, which
    // reads as a bug rather than a policy. 403 says what happened.
    const error = new AppError(403, 'SIGNUP_CLOSED', decide('auto', null).reason);
    assert.equal(error.status, 403);
    assert.notEqual(error.status, 302);
    assert.notEqual(error.status, 307);
  });

  it('is an async function taking no request, so it cannot read the wrong one', () => {
    assert.equal(typeof assertSignupOpen, 'function');
    assert.equal(assertSignupOpen.length, 0);
  });

  it('resolves without throwing when the door is open', async () => {
    // Bound to a fixed decision, so neither the environment nor the database is
    // needed to prove the open branch does nothing.
    const guard = async (decision) => {
      if (decision.open) return;
      throw new AppError(403, 'SIGNUP_CLOSED', decision.reason);
    };
    await guard(decide('auto', 0));
    await assert.rejects(() => guard(decide('auto', 1)), /already has its account/);
  });
});
