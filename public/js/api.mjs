/**
 * api.mjs | the only place this application talks to the server.
 *
 * Every response is { ok: true, data } or { ok: false, error: { code, message } }.
 * A rejected promise always carries a message that is safe to show a person.
 */

import { queueWrite, isQueueable } from './offline.mjs';

const CSRF_HEADER = 'X-CSRF-Token';

function csrfToken() {
  const fromBody = document.body?.dataset.csrf;
  if (fromBody) return fromBody;
  const match = /(?:^|;\s*)csrf_token=([^;]*)/.exec(document.cookie);
  return match ? decodeURIComponent(match[1]) : '';
}

export class ApiError extends Error {
  constructor(message, { code = 'ERROR', status = 0, details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(method, path, body, { queueable = false, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && method !== 'HEAD') headers[CSRF_HEADER] = csrfToken();

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
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
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError('Your session ended. Sign in again.', { code: 'UNAUTHORISED', status: 401 });
  }

  let payload = null;
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
    throw new ApiError(err.message ?? `Request failed with status ${res.status}.`, {
      code: err.code ?? 'ERROR',
      status: res.status,
      details: err.details ?? null,
    });
  }
  return payload.data;
}

export const api = {
  get: (path, opts) => request('GET', path, undefined, opts),
  post: (path, body, opts) => request('POST', path, body ?? {}, { queueable: true, ...opts }),
  put: (path, body, opts) => request('PUT', path, body ?? {}, { queueable: true, ...opts }),
  patch: (path, body, opts) => request('PATCH', path, body ?? {}, { queueable: true, ...opts }),
  del: (path, opts) => request('DELETE', path, undefined, { queueable: true, ...opts }),
  /** Used by the offline queue to replay without re-queueing on failure. */
  raw: (method, path, body) => request(method, path, body, { queueable: false }),
};

export default api;
