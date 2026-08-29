/**
 * paths.ts | the one place a redirect target is decided.
 *
 * `?next=` exists so that being sent to /login half way through something returns
 * you to where you were going. That is the whole feature, and it is also a
 * well known way to hand somebody an open redirect.
 *
 * `startsWith('/')` on its own is not enough. `//evil.example` starts with a slash
 * and a browser resolves it as a scheme-relative URL to another origin, so a link
 * to `/login?next=//evil.example` would bounce a person straight off this server
 * with the referrer intact. `/\evil.example` is the same trick with the other
 * slash, which some browsers normalise.
 *
 * Deliberately no dependency and no URL parsing: the rule is a whitelist of shapes,
 * which is easier to be sure about than a blacklist of attacks.
 */

/**
 * A same origin path, or '/' when the candidate is anything else.
 *
 * Accepts only a single leading slash followed by something that is not a slash or
 * a backslash. A query string and a fragment are allowed, because /calendar?date=
 * is a real destination.
 */
export function safeNextPath(candidate: unknown, fallback = '/'): string {
  if (typeof candidate !== 'string') return fallback;

  const value = candidate.trim();
  if (value === '' || value === '/') return fallback;

  // One leading slash, and the next character must not be another slash or a
  // backslash, which is what makes it scheme-relative.
  if (!/^\/(?![/\\])/.test(value)) return fallback;

  // A control character or whitespace inside a path is never legitimate here and
  // is how a filter gets walked past.
  if (/[\s\u0000-\u001f\u007f]/.test(value)) return fallback;

  return value;
}

export default safeNextPath;
