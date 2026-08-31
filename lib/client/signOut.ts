'use client';

/**
 * signOut.ts | one sign out path, used by every control that offers one.
 *
 * Signing out used to be a POST and a navigation. That cleared the cookies and
 * left two other stores holding the previous person's data on the device:
 *
 *   - Cache Storage. The service worker writes the rendered HTML of every screen
 *     into the `roadmap-pages-*` cache so the app works offline. Nothing removed
 *     it, so after a sign out the whole tracker was still readable offline, and
 *     any same origin script could read it through caches.match(). Cache-Control
 *     cannot prevent this, because the worker performs the write itself.
 *   - IndexedDB. The offline write queue survived the sign out and would replay
 *     under whoever signed in next, writing one person's ticks to another's
 *     account.
 *
 * Both are cleared here, before the navigation. Every step is allowed to fail
 * without blocking the sign out: a person trying to leave a shared machine must
 * always end up signed out, even if a cache refuses to drop.
 */

import { api } from './api';
import { clearQueue } from './offline';

/** Asks the service worker to drop the page cache, and waits briefly for it. */
async function clearPageCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
  const worker = registration?.active;
  if (!worker) {
    // No worker running: delete the caches directly from the page instead.
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys().catch(() => [] as string[]);
      await Promise.all(
        keys.filter((k) => k.startsWith('roadmap-pages-')).map((k) => caches.delete(k))
      ).catch(() => {});
    }
    return;
  }

  await new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    // Never wait longer than a moment. A sign out must not hang on a cache.
    const timer = setTimeout(resolve, 1200);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve();
    };
    try {
      worker.postMessage({ type: 'signout' }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

/**
 * Ends the session and removes every local trace of it, then navigates to the
 * sign in page with a full page load so no cached server component survives.
 *
 * @param onError called with a message if the server call failed, so the caller
 *   can show it. The sign out continues regardless.
 */
export async function signOutEverywhere(onError?: (message: string) => void): Promise<void> {
  try {
    await api.post('/api/auth/logout', {});
  } catch (err) {
    // The cookie is cleared server side either way; report it rather than hang.
    onError?.((err as Error).message);
  }

  await Promise.allSettled([clearQueue(), clearPageCache()]);

  window.location.href = '/login';
}
