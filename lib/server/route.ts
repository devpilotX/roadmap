/**
 * route.ts | one wrapper every API route goes through.
 *
 * It replaces the middleware chain the Express build had, in the same order:
 *   1. the general rate limit
 *   2. the CSRF guard on every state changing request
 *   3. the session and the user
 *   4. the handler
 *   5. one error handler, which is the only place a status code is decided
 *
 * A handler returns a Response. `jsonOk` builds the { ok: true, data } envelope,
 * and anything thrown becomes { ok: false, error: { code, message } }. A SQL
 * error never reaches the client: it is translated or replaced.
 */

import 'server-only';
import { NextResponse } from 'next/server';
import { AppError, translateDbError, type ErrorDetail } from '../errors';
import { auth, type CurrentUser } from './auth';
import { assertCsrf } from './csrf';
import { limiters } from './rateLimit';
import { refreshSessionWindow, type Session } from './session';

/* -------------------------------------------------------------- responses */

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

/** The success envelope. */
export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status, headers: NO_STORE });
}

/** The failure envelope. */
export function jsonFail(
  status: number,
  code: string,
  message: string,
  details: ErrorDetail[] | null = null
): NextResponse {
  const error: { code: string; message: string; details?: ErrorDetail[] } = { code, message };
  if (details) error.details = details;
  return NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });
}

/** A file download, used by the CSV, JSON and ICS routes. */
export function fileResponse(
  body: string,
  { type, filename }: { type: string; filename: string }
): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

/* ----------------------------------------------------------- error handler */

export function toErrorResponse(err: unknown, request: Request): NextResponse {
  const translated = translateDbError(err);
  const e = translated ?? err;

  if (e instanceof AppError) {
    return jsonFail(e.status, e.code, e.message, e.details);
  }

  // Anything unrecognised is a bug. The stack goes to the log, never to the
  // client, and the client is told plainly that nothing was saved.
  const stamp = new Date().toISOString();
  console.error(`[${stamp}] ${request.method} ${request.url}`);
  console.error(e instanceof Error ? (e.stack ?? e.message) : e);
  return jsonFail(
    500,
    'SERVER_ERROR',
    'Something broke on the server. Nothing was saved. The error is in the server log with a timestamp.'
  );
}

/* --------------------------------------------------------------- contexts */

/** Next 15 hands dynamic parameters over as a promise. */
export type RouteParams<P> = { params: Promise<P> };

export interface PublicContext<P> {
  request: Request;
  params: P;
  user: CurrentUser | null;
  session: Session | null;
}

export interface AuthedContext<P> {
  request: Request;
  params: P;
  user: CurrentUser;
  session: Session;
}

type Handler<C> = (ctx: C) => Promise<Response> | Response;

/**
 * A route that does not need a session, used by /api/auth/*.
 * The CSRF guard still runs, because a login post is a state change.
 */
export function publicRoute<P = Record<string, never>>(
  handler: Handler<PublicContext<P>>,
  { csrf = true, rateLimit = true }: { csrf?: boolean; rateLimit?: boolean } = {}
) {
  return async (request: Request, ctx: RouteParams<P>): Promise<Response> => {
    try {
      const { user, session } = await auth();
      if (rateLimit) limiters.generalApi(request, user?.id ?? null);
      if (csrf) await assertCsrf(request, session);
      const params = ((await ctx?.params) ?? {}) as P;
      return await handler({ request, params, user, session });
    } catch (err) {
      return toErrorResponse(err, request);
    }
  };
}

/** A route that requires a signed in user. Everything under /api except auth. */
export function authedRoute<P = Record<string, never>>(
  handler: Handler<AuthedContext<P>>,
  { csrf = true, rateLimit = true }: { csrf?: boolean; rateLimit?: boolean } = {}
) {
  return async (request: Request, ctx: RouteParams<P>): Promise<Response> => {
    try {
      const { user, session } = await auth();
      if (rateLimit) limiters.generalApi(request, user?.id ?? null);
      if (csrf) await assertCsrf(request, session);
      if (!user || !session) {
        return jsonFail(401, 'UNAUTHORISED', 'You need to sign in to do that.');
      }
      // The rolling 30 day window, which express-session did with `rolling: true`.
      // Only a route handler can set a cookie, which is why it happens here rather
      // than in auth().
      await refreshSessionWindow(session);
      const params = ((await ctx?.params) ?? {}) as P;
      return await handler({ request, params, user, session });
    } catch (err) {
      return toErrorResponse(err, request);
    }
  };
}
