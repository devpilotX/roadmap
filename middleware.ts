import { NextResponse, type NextRequest } from 'next/server';

/**
 * middleware.ts | the Content Security Policy, with a per request nonce.
 *
 * The Express build could write `script-src 'self'` with nothing else, because it
 * had no inline script anywhere: every screen was an external .mjs file. Next
 * cannot do that, because it inlines a small bootstrap script to hydrate the page
 * and to stream the rest of it.
 *
 * The wrong answer is `'unsafe-inline'`, which would let any injected <script>
 * run and throw away the protection the old policy actually bought. The right one
 * is a nonce: a fresh random value per response, named in the header and stamped
 * on the scripts Next emits. An injected script has no nonce, so it does not run.
 *
 * Next picks the nonce up by reading the CSP off the *request* headers, which is
 * why the header is set on both the request and the response below.
 *
 * `'strict-dynamic'` lets a script that already passed the nonce check load the
 * chunks it needs, which is how the App Router loads a route's JavaScript.
 *
 * Styles are a separate matter. `style-src 'self'` covers the stylesheet, and
 * `style-src-attr 'none'` keeps the old rule that no style attribute is ever
 * written into markup: dynamic geometry such as a meter width is applied from
 * script, exactly as the Express build did.
 */

export const config = {
  /**
   * Everything except the build output and the files served straight from disk.
   * A hashed asset needs no policy, and skipping it keeps the middleware off the
   * hot path for every chunk on the page.
   */
  matcher: ['/((?!_next/static|_next/image|img/|sw\\.js|manifest\\.webmanifest|robots\\.txt).*)'],
};

const isProd = process.env.NODE_ENV === 'production';

export function middleware(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    // The nonce covers Next's inline bootstrap. strict-dynamic covers the chunks
    // that bootstrap then loads. Development additionally needs eval, because
    // React Refresh compiles components in the browser.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? '' : " 'unsafe-eval'"}`,
    "script-src-attr 'none'",
    // One external stylesheet. Next inlines critical CSS in development only,
    // which the nonce also covers.
    `style-src 'self' 'nonce-${nonce}'${isProd ? '' : " 'unsafe-inline'"}`,
    "style-src-attr 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}
