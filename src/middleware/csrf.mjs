/**
 * CSRF, double submit cookie.
 *
 * A random token is issued in a readable cookie and mirrored into the session.
 * Every state changing request must echo it in the X-CSRF-Token header, or in a
 * _csrf field for a plain form post. The two are compared in constant time.
 *
 * This is the double submit pattern the build prompt asks for, hardened by also
 * keeping the expected value server side so a token cannot simply be planted in
 * the cookie by an attacker who can write cookies but cannot read the session.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.mjs';
import { forbidden } from '../lib/errors.mjs';

export const CSRF_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function newToken() {
  return randomBytes(32).toString('base64url');
}

function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/**
 * Issues a token when there is not one, and exposes it to templates as
 * res.locals.csrfToken. Runs on every request, before the guard.
 */
export function csrfIssue(req, res, next) {
  if (!req.session) return next();
  if (!req.session.csrfToken) req.session.csrfToken = newToken();
  const token = req.session.csrfToken;
  const cookie = req.cookies?.[CSRF_COOKIE];
  if (cookie !== token) {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false, // the browser script has to read it to echo it back
      sameSite: 'lax',
      secure: config.isProd,
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
  res.locals.csrfToken = token;
  return next();
}

/** Rejects a state changing request whose token is missing or does not match. */
export function csrfGuard(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const expected = req.session?.csrfToken;
  const sent =
    req.get(CSRF_HEADER) ||
    (typeof req.body === 'object' && req.body !== null ? req.body._csrf : undefined) ||
    '';
  const cookie = req.cookies?.[CSRF_COOKIE] ?? '';
  if (!expected || !sameToken(String(sent), expected) || !sameToken(cookie, expected)) {
    return next(
      forbidden('That request could not be verified. Reload the page and try again.')
    );
  }
  return next();
}

/** Rotates the token. Called on login and on logout to prevent fixation. */
export function csrfRotate(req, res) {
  if (!req.session) return null;
  req.session.csrfToken = newToken();
  res.cookie(CSRF_COOKIE, req.session.csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.locals.csrfToken = req.session.csrfToken;
  return req.session.csrfToken;
}

/**
 * A tiny cookie parser. There is no cookie-parser dependency because the app
 * only ever reads two cookies and adding a package for that is not worth it.
 */
export function cookies(req, _res, next) {
  const header = req.headers.cookie;
  req.cookies = Object.create(null);
  if (!header) return next();
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      req.cookies[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      req.cookies[key] = part.slice(eq + 1).trim();
    }
  }
  return next();
}
