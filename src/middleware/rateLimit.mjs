/**
 * Rate limits.
 *
 * Section 5.3: login and signup are limited to 5 attempts per 15 minutes per IP
 * and per email. Two limiters run in series so exhausting either one blocks.
 */

import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config.mjs';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function limitHandler(message) {
  return (req, res) => {
    res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message } });
  };
}

const shared = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  // Local development hits the app from one address, so skipping would hide
  // exactly the behaviour section 20.8 asks us to test.
  skip: () => false,
};

export const loginIpLimiter = rateLimit({
  ...shared,
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  keyGenerator: (req) => `ip:${ipKeyGenerator(req.ip)}`,
  handler: limitHandler('Too many attempts from this address. Try again in 15 minutes.'),
});

export const loginEmailLimiter = rateLimit({
  ...shared,
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  keyGenerator: (req) => `email:${String(req.body?.email ?? '').trim().toLowerCase() || ipKeyGenerator(req.ip)}`,
  handler: limitHandler('Too many attempts for that email. Try again in 15 minutes.'),
});

export const signupLimiter = rateLimit({
  ...shared,
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  keyGenerator: (req) => `signup:${ipKeyGenerator(req.ip)}`,
  handler: limitHandler('Too many sign up attempts from this address. Try again in 15 minutes.'),
});

/** The GitHub sync is limited so the app can never hammer the GitHub API. */
export const githubSyncLimiter = rateLimit({
  ...shared,
  windowMs: 5 * 60 * 1000,
  limit: 6,
  keyGenerator: (req) => `sync:${req.user?.id ?? ipKeyGenerator(req.ip)}`,
  handler: limitHandler('The GitHub sync can run six times in five minutes. Wait, then try again.'),
});

/** A wide limit on everything else, so a runaway script cannot take the app down. */
export const generalApiLimiter = rateLimit({
  ...shared,
  windowMs: 60 * 1000,
  limit: config.isProd ? 300 : 3000,
  keyGenerator: (req) => `api:${req.user?.id ?? ipKeyGenerator(req.ip)}`,
  handler: limitHandler('Slow down. Too many requests in one minute.'),
});
