/**
 * /api/auth | signup, login, logout.
 *
 * Rules from build prompt section 5, implemented exactly:
 *   - password minimum 12 characters, checked against a local blocklist
 *   - Argon2id at m=19456, t=2, p=1
 *   - the profiles row is created in the same transaction as the user
 *   - a failed login returns a generic 401 and always spends verify time
 *   - the session id is regenerated on login to prevent fixation
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, run, transaction } from '../../db/pool.mjs';
import { ok } from '../../lib/errors.mjs';
import { unauthorised, conflict, unprocessable } from '../../lib/errors.mjs';
import { checkPassword, dummyVerify, hashPassword, verifyPassword } from '../../lib/passwords.mjs';
import { csrfRotate } from '../../middleware/csrf.mjs';
import { loginEmailLimiter, loginIpLimiter, signupLimiter } from '../../middleware/rateLimit.mjs';
import { requireSignupOpen, resetSignupCache } from '../../middleware/signup.mjs';
import { validate } from '../../middleware/validate.mjs';
import { nowDateTime } from '../../lib/dates.mjs';
import { config } from '../../config.mjs';

const router = Router();

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5)
  .max(255)
  .refine((v) => /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(v), { message: 'That is not a valid email address.' });

const signupBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  display_name: z.string().trim().min(1, 'Your name cannot be blank.').max(120),
});

const loginBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
  remember: z.unknown().optional(),
});

/** Regenerates the session id, then stores the user. Promise wrapped. */
function establishSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.startedAt = Date.now();
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

function destroySession(req) {
  return new Promise((resolve) => {
    if (!req.session) return resolve();
    req.session.destroy(() => resolve());
  });
}

/* ------------------------------------------------------------- signup */

router.post('/signup', signupLimiter, requireSignupOpen, validate({ body: signupBody }), async (req, res, next) => {
  try {
    const { email, password, display_name: displayName } = req.body;

    const strength = checkPassword(password, { email, displayName });
    if (!strength.ok) throw unprocessable(strength.reason);

    const existing = await one('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      // Signup is the one place where saying so is unavoidable and acceptable:
      // the person is choosing an identifier, not probing for one.
      throw conflict('An account with that email already exists. Sign in instead.');
    }

    const hash = await hashPassword(password);

    const userId = await transaction(async (tx) => {
      const result = await tx.run(
        'INSERT INTO users (email, password_hash, display_name, last_login_at) VALUES (?, ?, ?, ?)',
        [email, hash, displayName, nowDateTime()]
      );
      const id = result.insertId;
      await tx.run(
        `INSERT INTO profiles (user_id, full_name, roadmap_start, roadmap_end, timezone)
         VALUES (?, ?, ?, ?, ?)`,
        [id, displayName, config.roadmap.firstDay, config.roadmap.lastDay, config.timezone]
      );
      await tx.run('INSERT INTO user_settings (user_id) VALUES (?)', [id]);
      await tx.run(
        `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
         VALUES (?, 'users', ?, 'insert', CAST(? AS JSON))`,
        [id, String(id), JSON.stringify({ email, display_name: displayName })]
      );
      return id;
    });

    await establishSession(req, userId);
    csrfRotate(req, res);
    // The door closes behind them: with an account on file, the first-run window
    // is over and the cached answer must not outlive it.
    resetSignupCache();

    return ok(
      res,
      {
        id: userId,
        email,
        display_name: displayName,
        csrf: res.locals.csrfToken,
        next: '/',
      },
      201
    );
  } catch (err) {
    return next(err);
  }
});

/* -------------------------------------------------------------- login */

router.post(
  '/login',
  loginIpLimiter,
  loginEmailLimiter,
  validate({ body: loginBody }),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const user = await one(
        'SELECT id, email, password_hash, display_name, is_active FROM users WHERE email = ?',
        [email]
      );

      // Always spend verify time, so the response does not reveal whether the
      // email exists. This is the account enumeration defence from Week 11.
      let valid = false;
      if (!user) {
        await dummyVerify(password);
      } else {
        try {
          valid = await verifyPassword(user.password_hash, password);
        } catch {
          valid = false;
        }
      }

      if (!user || !valid || user.is_active !== 1) {
        throw unauthorised('Invalid email or password');
      }

      await establishSession(req, user.id);
      csrfRotate(req, res);
      await run('UPDATE users SET last_login_at = ? WHERE id = ?', [nowDateTime(), user.id]);

      const target = typeof req.body.next === 'string' && req.body.next.startsWith('/') ? req.body.next : '/';
      return ok(res, {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        csrf: res.locals.csrfToken,
        next: target,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/* ------------------------------------------------------------- logout */

router.post('/logout', async (req, res, next) => {
  try {
    await destroySession(req);
    res.clearCookie('roadmap.sid', { path: '/' });
    return ok(res, { signed_out: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
