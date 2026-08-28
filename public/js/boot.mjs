/**
 * boot.mjs | runs on every screen.
 *
 * Theme, warnings bell, command palette, offline banner, service worker,
 * the timer chip, and the last synced stamp. Nothing screen specific lives here.
 */

import { api } from './api.mjs';
import { toast, toastError } from './toast.mjs';
import { applyFills, hardenExternalLinks, qs, qsa, clear, el, svgIcon } from './ui.mjs';
import { initTimer } from './timer.mjs';
import { flushQueue, onQueueChange, pendingCount } from './offline.mjs';

/* ------------------------------------------------------------- theme */

const THEMES = ['system', 'light', 'dark'];
const THEME_LABEL = { system: 'System', light: 'Light', dark: 'Dark' };

function applyTheme(value) {
  document.documentElement.dataset.theme = value;
  const label = qs('#theme-label');
  if (label) label.textContent = THEME_LABEL[value];
}

function initTheme() {
  const btn = qs('#theme-toggle');
  const current = document.documentElement.dataset.theme || 'system';
  applyTheme(THEMES.includes(current) ? current : 'system');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const now = document.documentElement.dataset.theme || 'system';
    const next = THEMES[(THEMES.indexOf(now) + 1) % THEMES.length];
    applyTheme(next);
    try {
      await api.patch('/api/me/settings', { theme: next });
    } catch (err) {
      // The theme still changed for this session; the failure to remember is worth saying.
      toast(`Theme changed, but not saved: ${err.message}`, 'warn');
    }
  });
}

/* ---------------------------------------------------------- warnings */

function warningNode(w) {
  const cls = w.level === 'red' ? 'callout--red' : 'callout--orange';
  const body = el('div', { class: 'callout__body' }, [
    el('p', { class: 'callout__title', text: `${w.code}  ${w.title}` }),
    el('p', { text: w.message }),
  ]);
  const node = el('div', { class: `callout ${cls}` }, [
    svgIcon(w.level === 'red' ? 'M12 3 2 20h20L12 3ZM12 9v5M12 17h.01' : 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'callout__icon'),
    body,
  ]);
  if (w.level === 'orange' && w.can_snooze) {
    const snooze = el('button', {
      type: 'button',
      class: 'btn btn--sm',
      text: 'Snooze 24 h',
    });
    snooze.addEventListener('click', async () => {
      snooze.disabled = true;
      try {
        await api.post(`/api/warnings/${w.code}/snooze`, {});
        node.remove();
        loadWarnings();
      } catch (err) {
        snooze.disabled = false;
        toastError(err.message);
      }
    });
    body.appendChild(snooze);
  } else if (w.level === 'red') {
    body.appendChild(el('p', { class: 'text-xs', text: 'Red cannot be dismissed.' }));
  }
  return node;
}

let warningCache = [];

async function loadWarnings() {
  const list = qs('#bell-list');
  const count = qs('#bell-count');
  try {
    const data = await api.get('/api/warnings');
    warningCache = data.warnings ?? [];
    if (count) {
      if (warningCache.length) {
        count.hidden = false;
        count.textContent = String(warningCache.length);
        count.className = warningCache.some((w) => w.level === 'red') ? 'badge badge--red' : 'badge badge--orange';
      } else {
        count.hidden = true;
      }
    }
    if (list) {
      clear(list);
      if (!warningCache.length) {
        list.appendChild(
          el('p', { class: 'muted', text: 'Nothing is wrong right now. Keep the day moving.' })
        );
      } else {
        for (const w of warningCache) list.appendChild(warningNode(w));
      }
    }
    document.dispatchEvent(new CustomEvent('warnings:loaded', { detail: warningCache }));
  } catch {
    if (list) {
      clear(list);
      list.appendChild(el('p', { class: 'muted', text: 'Warnings could not be loaded.' }));
    }
  }
}

function initBell() {
  const open = qs('#bell-open');
  const panel = qs('#bell-panel');
  if (!open || !panel) return;
  const show = (on) => {
    panel.dataset.open = on ? '1' : '0';
    open.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) qs('[data-close-bell]', panel)?.focus();
  };
  open.addEventListener('click', () => show(panel.dataset.open !== '1'));
  qsa('[data-close-bell]', panel).forEach((b) => b.addEventListener('click', () => show(false)));
  panel.addEventListener('click', (e) => {
    if (e.target === panel) show(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.dataset.open === '1') show(false);
  });
}

/* --------------------------------------------------- command palette */

const PALETTE_BASE = [
  ['Today', '/'],
  ['Calendar', '/calendar'],
  ['Weeks', '/weeks'],
  ['DSA tracker', '/dsa'],
  ['Projects', '/projects'],
  ['Gates', '/gates'],
  ['Sundays', '/sundays'],
  ['Library', '/library'],
  ['GitHub pushes', '/pushes'],
  ['Money hour', '/money'],
  ['Applications', '/applications'],
  ['Unlock ladder', '/ladder'],
  ['The seven roles', '/roles'],
  ['Eligibility, what can I apply for today', '/eligibility'],
  ['After Jan 2027', '/after'],
  ['New Zealand', '/newzealand'],
  ['Everything A to Z', '/everything'],
  ['Reference', '/reference'],
  ['Stats', '/stats'],
  ['Profile', '/profile'],
  ['Saturday review', '/review'],
  ['Printable week sheet', '/print/week'],
];

function paletteMatches(term) {
  const t = term.trim().toLowerCase();
  const out = [];
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= 21) out.push([`Week ${n}`, `/weeks/${n}`]);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) out.push([`Calendar, ${t}`, `/calendar?date=${t}`]);
  if (!t) return PALETTE_BASE.slice(0, 8);
  for (const [label, href] of PALETTE_BASE) {
    if (label.toLowerCase().includes(t)) out.push([label, href]);
  }
  return out.slice(0, 10);
}

function initPalette() {
  const modal = qs('#palette');
  const input = qs('#palette-input');
  const results = qs('#palette-results');
  const opener = qs('#palette-open');
  if (!modal || !input || !results) return;

  let index = 0;

  function draw() {
    const items = paletteMatches(input.value);
    clear(results);
    items.forEach(([label, href], i) => {
      const li = el('li', {}, [
        el('a', {
          class: `kancard${i === index ? ' is-active' : ''}`,
          href,
          text: label,
          role: 'option',
          'aria-selected': i === index ? 'true' : 'false',
        }),
      ]);
      results.appendChild(li);
    });
  }

  function show(on) {
    modal.dataset.open = on ? '1' : '0';
    if (on) {
      index = 0;
      input.value = '';
      draw();
      input.focus();
    }
  }

  opener?.addEventListener('click', () => show(true));
  input.addEventListener('input', () => {
    index = 0;
    draw();
  });
  input.addEventListener('keydown', (e) => {
    const items = paletteMatches(input.value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      index = Math.min(index + 1, items.length - 1);
      draw();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      index = Math.max(index - 1, 0);
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = items[index];
      if (hit) window.location.href = hit[1];
    }
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) show(false);
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      show(modal.dataset.open !== '1');
    } else if (e.key === 'Escape' && modal.dataset.open === '1') {
      show(false);
    }
  });
}

/* -------------------------------------------------- offline and sync */

function initSync() {
  const bar = qs('#syncbar');
  const text = qs('#syncbar-text');
  const stamp = qs('#lastsynced');

  function paintStamp(when) {
    if (!stamp) return;
    stamp.textContent = when ? `Last synced: ${when}` : 'Last synced: never';
  }
  paintStamp(stamp?.dataset.lastSynced || '');

  async function paint() {
    const n = await pendingCount();
    if (!bar || !text) return;
    if (!navigator.onLine) {
      bar.dataset.show = '1';
      text.textContent =
        n > 0
          ? `You are offline. ${n} ${n === 1 ? 'change is' : 'changes are'} saved on this device and will sync when you reconnect.`
          : 'You are offline. Ticks are saved on this device and will sync when you reconnect.';
    } else if (n > 0) {
      bar.dataset.show = '1';
      text.textContent = `${n} ${n === 1 ? 'change is' : 'changes are'} waiting to sync.`;
    } else {
      bar.dataset.show = '0';
    }
  }

  onQueueChange(paint);
  window.addEventListener('online', async () => {
    const r = await flushQueue({
      onReport: (err) => toastError(`A queued change was rejected: ${err.message}`),
    });
    if (r.sent) {
      toast(`${r.sent} ${r.sent === 1 ? 'change' : 'changes'} synced.`, 'ok');
      paintStamp(new Date().toLocaleString('en-GB'));
      document.dispatchEvent(new CustomEvent('queue:flushed', { detail: r }));
    }
    paint();
  });
  window.addEventListener('offline', paint);
  paint();
  if (navigator.onLine) {
    flushQueue({ onReport: (err) => toastError(`A queued change was rejected: ${err.message}`) }).then(
      (r) => {
        if (r.sent) {
          toast(`${r.sent} queued ${r.sent === 1 ? 'change' : 'changes'} synced.`, 'ok');
          paintStamp(new Date().toLocaleString('en-GB'));
        }
        paint();
      }
    );
  }

  // Record a heartbeat so Today can show a last synced value that means something.
  if (navigator.onLine) {
    api
      .post('/api/me/synced', {})
      .then((d) => paintStamp(d.last_synced_at))
      .catch(() => {});
  }
}

/* ------------------------------------------------- service worker */

function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return;
  }
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
    // Offline shell is a bonus, not a requirement. A failure is not worth a toast.
  });
}

/* ------------------------------------------------------- sign out */

function initLogout() {
  for (const form of qsa('form[data-logout]')) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.post('/api/auth/logout', {});
      } finally {
        window.location.href = '/login';
      }
    });
  }
}

/* ------------------------------------------------------------ start */

applyFills();
hardenExternalLinks();
initTheme();
initBell();
initPalette();
initSync();
initTimer();
initLogout();
initServiceWorker();

if (document.body.dataset.page && document.body.dataset.page !== 'auth') {
  loadWarnings();
  window.setInterval(loadWarnings, 5 * 60 * 1000);
}

export { loadWarnings };
