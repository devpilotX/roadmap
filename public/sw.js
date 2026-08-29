/**
 * sw.js | the offline shell.
 *
 * Scope is the whole site. Two caches:
 *   - shell: the build output and the icons, cache first
 *   - pages: the last successfully seen HTML for each route, network first
 *
 * API requests are never cached. A stale number is worse than no number, and
 * writes made offline are queued in IndexedDB by lib/client/offline.ts, not here.
 *
 * VERSION is the only thing that evicts the shell cache.
 *
 * v1  the first build
 * v2  the 17 screen modules that were placeholders became real, seven shared CSS
 *     classes moved into components.css, Today learned to show an error card on a
 *     failed first load, /roles gained where to apply, interview preparation, the
 *     resume stages and the unlock ladder, and the lead CSV import, repository
 *     controls, manual session entry and operational log gained interfaces.
 * v3  the Next.js rewrite. The old precache list named /css/*.css and /js/*.mjs,
 *     which no longer exist: the build output now lives under /_next/static/ with
 *     a content hash in every filename. Those are cached on first use rather than
 *     precached, which is both correct and safer, because a hashed URL can never
 *     go stale. Only the two files whose URLs are fixed are precached.
 */

const VERSION = 'v3';
const SHELL = `roadmap-shell-${VERSION}`;
const PAGES = `roadmap-pages-${VERSION}`;

/**
 * Only URLs that are stable across builds belong here. Everything under
 * /_next/static/ carries a content hash, so it is cached the first time it is
 * asked for and never needs revalidating.
 */
const PRECACHE = ['/img/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // One failure must not abort the whole install.
      await Promise.allSettled(
        PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, PAGES]);
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

/** A hashed build asset. The URL changes whenever the content does. */
function isImmutable(url) {
  return url.pathname.startsWith('/_next/static/');
}

function isStatic(url) {
  return url.pathname.startsWith('/img/') || url.pathname === '/manifest.webmanifest';
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API, the health check, or the worker itself. Next's own data
  // requests carry the same hazard as the API: a stale payload is worse than none.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/healthz' ||
    url.pathname === '/sw.js' ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // A hashed asset can be answered from the cache forever.
  if (isImmutable(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline and not cached' });
        }
      })()
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL);
        const hit = await cache.match(request);
        if (hit) {
          // Revalidate quietly so the next load is fresh.
          event.waitUntil(
            fetch(request)
              .then((res) => (res.ok ? cache.put(request, res.clone()) : null))
              .catch(() => null)
          );
          return hit;
        }
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          return new Response('', { status: 504, statusText: 'Offline and not cached' });
        }
      })()
    );
    return;
  }

  // HTML: network first, fall back to the last good copy of that route.
  if (
    request.mode === 'navigate' ||
    (request.headers.get('accept') ?? '').includes('text/html')
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(request);
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch {
          const hit = await cache.match(request);
          if (hit) return hit;
          const today = await cache.match('/');
          if (today) return today;
          return new Response(
            '<!DOCTYPE html><meta charset="utf-8"><title>Offline</title>' +
              '<body><h1>You are offline</h1>' +
              '<p>This screen has not been opened on this device yet, so there is no copy to show.</p>' +
              '<p>Ticks you make offline are saved on the device and sync when the connection returns.</p>' +
              '<p><a href="/">Try Today</a></p></body>',
            { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        }
      })()
    );
  }
});

/** The page asks for a block reminder; the worker shows it. */
self.addEventListener('message', (event) => {
  const data = event.data ?? {};
  if (data.type === 'notify' && self.registration.showNotification) {
    self.registration.showNotification(data.title ?? 'The Roadmap Tracker', {
      body: data.body ?? '',
      icon: '/img/icon-192.png',
      badge: '/img/icon-192.png',
      tag: data.tag ?? 'roadmap',
      renotify: false,
      requireInteraction: false,
      data: { url: data.url ?? '/' },
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? '/';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if (client.url.includes(target)) return client.focus();
      }
      return self.clients.openWindow(target);
    })()
  );
});
