/**
 * timer.mjs | the study session timer.
 *
 * Behaviour required by build prompt section 8:
 *   - Open and start opens the link in a new tab, marks the resource reading,
 *     starts a session, and shows a persistent chip with block, elapsed and stop.
 *   - The chip survives a page navigation, because the running session lives on
 *     the server and its id is kept in sessionStorage.
 *   - If the tab is closed without stopping, the server closes the session at
 *     the end of the block window and flags it auto_closed. Minutes are never
 *     silently inflated.
 */

import { api } from './api.mjs';
import { toast, toastError } from './toast.mjs';
import { minutesLabel } from './ui.mjs';

const KEY = 'roadmap.session';
let ticker = 0;

function chip() {
  return {
    root: document.getElementById('timerchip'),
    block: document.getElementById('timerchip-block'),
    time: document.getElementById('timerchip-time'),
    stop: document.getElementById('timerchip-stop'),
  };
}

function load() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(state) {
  try {
    if (state) window.sessionStorage.setItem(KEY, JSON.stringify(state));
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // A browser with storage disabled still gets a working timer for this page.
  }
}

function render() {
  const c = chip();
  if (!c.root) return;
  const state = load();
  if (!state) {
    c.root.dataset.running = '0';
    window.clearInterval(ticker);
    ticker = 0;
    return;
  }
  c.root.dataset.running = '1';
  c.block.textContent = state.block;
  const elapsed = Math.floor((Date.now() - state.startedAtMs) / 60000);
  c.time.textContent = minutesLabel(elapsed);
  document.dispatchEvent(new CustomEvent('timer:tick', { detail: { ...state, elapsed } }));
}

function startTicking() {
  window.clearInterval(ticker);
  render();
  ticker = window.setInterval(render, 15000);
}

/** The session currently running, or null. */
export function currentSession() {
  return load();
}

/**
 * Starts a session. Returns the created session, or null when the server refused
 * because of a block window rule, in which case the reason is shown as a toast.
 */
export async function startSession({ block, resourceId = null, weekLinkId = null, label = '' }) {
  const existing = load();
  if (existing) {
    toast(`A ${existing.block} session is already running. Stop it first.`, 'warn');
    return null;
  }
  try {
    const data = await api.post('/api/sessions/start', {
      block,
      resource_id: resourceId,
      week_link_id: weekLinkId,
    });
    save({
      id: data.id,
      block: data.block,
      startedAtMs: Date.now(),
      label,
    });
    startTicking();
    toast(`${data.block} session started.${label ? ` ${label}` : ''}`, 'ok');
    return data;
  } catch (err) {
    toastError(err.message);
    return null;
  }
}

/** Stops the running session and writes its minutes. */
export async function stopSession() {
  const state = load();
  if (!state) return null;
  try {
    const data = await api.post(`/api/sessions/${state.id}/stop`, {});
    save(null);
    render();
    toast(`${state.block} session logged: ${minutesLabel(data.minutes)}.`, 'ok');
    document.dispatchEvent(new CustomEvent('timer:stopped', { detail: data }));
    return data;
  } catch (err) {
    toastError(err.message);
    return null;
  }
}

/**
 * Open and start. Opens the URL in a new tab with rel="noopener noreferrer",
 * marks the link as reading, and starts a session in the given block.
 */
export async function openAndStart({ url, block, resourceId = null, weekLinkId = null, label = '' }) {
  // The tab is opened first, inside the click gesture, so the popup blocker
  // does not eat it while an await is pending.
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win) toast('The browser blocked the new tab. Allow pop-ups for this site.', 'warn');

  try {
    await api.post('/api/resources/open', {
      resource_id: resourceId,
      week_link_id: weekLinkId,
    });
  } catch (err) {
    toastError(`The link opened but its status did not save: ${err.message}`);
  }
  return startSession({ block, resourceId, weekLinkId, label });
}

/** Restores the chip after a navigation and wires the stop button once. */
export function initTimer() {
  const c = chip();
  if (!c.root) return;
  c.stop?.addEventListener('click', () => {
    stopSession();
  });
  if (load()) startTicking();

  // Reconcile with the server: if it closed the session while the tab was away,
  // drop the local chip rather than showing a timer that is counting nothing.
  const state = load();
  if (state) {
    api
      .get('/api/sessions/open')
      .then((open) => {
        if (!open || open.id !== state.id) {
          save(null);
          render();
        }
      })
      .catch(() => {
        // Offline. Keep the chip; the server will close the session if needed.
      });
  }
}
