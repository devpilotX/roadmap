'use client';

/**
 * api.ts | the only place the browser talks to the server.
 *
 * Every response is { ok: true, data } or { ok: false, error: { code, message } }.
 * A rejected promise always carries a message that is safe to show a person.
 */

import { isQueueable, queueWrite } from './offline';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'csrf_token';

function readCookie(name: string): string {
  if (typeof document === 'undefined') return '';
  const match = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(document.cookie);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/**
 * The CSRF token.
 *
 * The Express build issued it in middleware on every request. A Next server
 * component cannot write a cookie, so the token is fetched once on demand and
 * the cookie carries it from then on.
 *
 * `force` skips the cookie. That matters: the cookie outlives the session row it
 * is paired with, so after signing out, or after another device changed the
 * password, the cookie holds a token the server can no longer match. Reading it
 * again would fail forever. Asking the server for a new one recovers.
 */
async function csrfToken(force = false): Promise<string> {
  if (!force) {
    const existing = readCookie(CSRF_COOKIE);
    if (existing) return existing;
  }
  try {
    const res = await fetch('/api/csrf', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await res.json();
    return payload?.data?.csrf ?? '';
  } catch {
    return '';
  }
}

export class ApiError extends Error {
  code: string;
  status: number;
  details: { field: string; message: string }[] | null;

  constructor(
    message: string,
    {
      code = 'ERROR',
      status = 0,
      details = null,
    }: { code?: string; status?: number; details?: { field: string; message: string }[] | null } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  queueable?: boolean;
  signal?: AbortSignal;
  /** Internal. Set when this is already the retry after a refused token. */
  retried?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  { queueable = false, signal, retried = false }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers[CSRF_HEADER] = await csrfToken(retried);

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      cache: 'no-store',
    });
  } catch {
    // A network failure. If the write can wait, park it and tell the caller.
    if (queueable && isQueueable(method)) {
      await queueWrite({ method, path, body });
      throw new ApiError('You are offline. That tick is saved on this device and will sync.', {
        code: 'QUEUED',
        status: 0,
      });
    }
    throw new ApiError('No connection to the server.', { code: 'OFFLINE', status: 0 });
  }

  if (res.status === 401) {
    // The session ended. Send them to sign in rather than failing silently.
    if (typeof window !== 'undefined') {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError('Your session ended. Sign in again.', {
      code: 'UNAUTHORISED',
      status: 401,
    });
  }

  let payload: { ok?: boolean; data?: T; error?: { code?: string; message?: string; details?: any } } | null =
    null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new ApiError('The server sent something this app could not read.', {
        code: 'BAD_RESPONSE',
        status: res.status,
      });
    }
  }

  if (!res.ok || !payload || payload.ok !== true) {
    const err = payload?.error ?? {};

    // A refused token, once. The cookie can outlive the session row it belongs to,
    // so the first thing to try is a new token rather than reporting a failure the
    // person cannot do anything about. Only once, and never on a safe method,
    // because a second refusal is a real one.
    if (
      res.status === 403 &&
      err.code === 'FORBIDDEN' &&
      !retried &&
      method !== 'GET' &&
      method !== 'HEAD'
    ) {
      return request<T>(method, path, body, { queueable, signal, retried: true });
    }

    throw new ApiError(err.message ?? `Request failed with status ${res.status}.`, {
      code: err.code ?? 'ERROR',
      status: res.status,
      details: err.details ?? null,
    });
  }
  return payload.data as T;
}

export const api = {
  get: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>('GET', path, undefined, opts),
  post: <T = any>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('POST', path, body ?? {}, { queueable: true, ...opts }),
  put: <T = any>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PUT', path, body ?? {}, { queueable: true, ...opts }),
  patch: <T = any>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>('PATCH', path, body ?? {}, { queueable: true, ...opts }),
  del: <T = any>(path: string, opts?: RequestOptions) =>
    request<T>('DELETE', path, undefined, { queueable: true, ...opts }),
  /** Used by the offline queue to replay without re-queueing on failure. */
  raw: <T = any>(method: string, path: string, body?: unknown) =>
    request<T>(method, path, body, { queueable: false }),
};

export default api;
