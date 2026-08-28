/**
 * sw.js | the offline shell.
 *
 * Scope is the whole site. Two caches:
 *   - shell: the CSS, JS and icons, cache first, revalidated in the background
 *   - pages: the last successfully seen HTML for each route, network first
 *
 * API requests are never cached. A stale number is worse than no number, and
 * writes made offline are queued in IndexedDB by offline.mjs, not here.
 *
 * VERSION is the only thing that evicts the shell cache. Because the shell is
 * served cache first, a change to any CSS or JS file is invisible until this
 * number changes: the old copy is returned and the new one only revalidates in
 * the background, so the very next load still shows yesterday's code.
 *
 *   Bump VERSION on every release that touches anything under /css or /js.
 *
 * v1  the first build
 * v2  the 17 screen modules that were placeholders became real, seven shared CSS
 *     classes moved into components.css, Today learned to show an error card on a
 *     failed first load, /roles gained where to apply, interview preparation, the
 *     resume stages and the unlock ladder, and the lead CSV import, repository
 *     controls, manual session entry and operational log gained interfaces.
 *     Without this bump the browser keeps serving the stubs.
 */

const VERSION = 'v2';
const SHELL = `roadmap-shell-${VERSION}`;
const PAGES = `roadmap-pages-${VERSION}`;

const PRECACHE = [
  '/css/tokens.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/js/boot.mjs',
  '/js/api.mjs',
  '/js/ui.mjs',
  '/js/render.mjs',
  '/js/toast.mjs',
  '/js/timer.mjs',
  '/js/offline.mjs',
  '/img/icon.svg',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // One failure must not abort the whole install.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
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

function isStatic(url) {
  return (
    url.pathname.startsWith('/css/') ||
    url.pathname.startsWith('/js/') ||
    url.pathname.startsWith('/img/') ||
    url.pathname === '/manifest.webmanifest'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the API, the ICS export, exports, or the health check.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/healthz' ||
    url.pathname === '/sw.js'
  ) {
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
  if (request.mode === 'navigate' || (request.headers.get('accept') ?? '').includes('text/html')) {
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
              '<body style="font-family:system-ui;padding:2rem;max-width:40rem">' +
              '<h1>You are offline</h1>' +
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
