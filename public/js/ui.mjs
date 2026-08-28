/**
 * ui.mjs | small helpers shared by every screen.
 *
 * Two rules this file exists to keep:
 *   1. Nothing is ever inserted with innerHTML from a value that came from the
 *      database or from a person. Text goes in through textContent.
 *   2. No style attribute is ever written into markup, because the CSP forbids
 *      it. Dynamic geometry is applied here with setProperty instead.
 */

export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Build an element. Children may be strings, which become text nodes. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') throw new Error('el() refuses html. Use text.');
    else if (k.startsWith('data-') || k.startsWith('aria-')) node.setAttribute(k, String(v));
    else if (k === 'for') node.htmlFor = v;
    else if (k in node) node[k] = v;
    else node.setAttribute(k, String(v));
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** Inline SVG from path data. Used for every icon. */
export function svgIcon(pathData, cls = 'btn__icon') {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', cls);
  for (const d of [].concat(pathData)) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Applies every data-fill percentage as a width. The server renders
 * data-fill="63" and this turns it into a bar, so no style attribute is needed.
 */
export function applyFills(root = document) {
  for (const node of qsa('[data-fill]', root)) {
    const pct = Math.max(0, Math.min(100, Number(node.dataset.fill) || 0));
    node.style.setProperty('width', `${pct}%`);
  }
  for (const node of qsa('[data-colour-var]', root)) {
    node.style.setProperty('--phase', `var(${node.dataset.colourVar})`);
  }
}

/* ------------------------------------------------------------ formatting */

export const int = (n) => Number(n ?? 0).toLocaleString('en-IN');

export function rupees(n) {
  return `Rs ${Number(n ?? 0).toLocaleString('en-IN')}`;
}

export function pct(part, whole) {
  if (!whole) return 0;
  return Math.round((Number(part) / Number(whole)) * 100);
}

export function minutesLabel(m) {
  const n = Math.max(0, Math.round(Number(m) || 0));
  if (n < 60) return `${n} m`;
  const h = Math.floor(n / 60);
  const rest = n % 60;
  return rest ? `${h} h ${rest} m` : `${h} h`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function weekdayOf(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return DAYS[(d.getUTCDay() + 6) % 7];
}

export function longDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${weekdayOf(iso)}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function shortDate(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------- optimistic write */

/**
 * Runs an optimistic UI change, then the write. On failure the change is undone
 * and the reason is shown. Nothing is ever left looking saved when it was not.
 */
export async function optimistic({ apply, revert, write, onError }) {
  apply();
  try {
    return await write();
  } catch (err) {
    revert();
    if (onError) onError(err);
    throw err;
  }
}

/** Debounce, for search boxes and note fields. */
export function debounce(fn, ms = 250) {
  let t = 0;
  return (...args) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

/** External links always open safely. Applied to anything with data-ext. */
export function hardenExternalLinks(root = document) {
  for (const a of qsa('a[data-ext]', root)) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
}

/** A written empty state, never a blank panel. */
export function emptyState(title, body) {
  return el('div', { class: 'empty' }, [
    el('p', { class: 'empty__title', text: title }),
    el('p', { class: 'empty__body', text: body }),
  ]);
}

export function dayColourBadge(colour) {
  const map = {
    green: ['badge--green', 'Green day'],
    amber: ['badge--orange', 'Amber day'],
    red: ['badge--red', 'Red day'],
    neutral: ['badge--outline', 'Neutral, rest Sunday'],
  };
  const [cls, label] = map[colour] ?? map.red;
  return el('span', { class: `badge ${cls}` }, [
    el('span', { class: 'badge__dot', 'aria-hidden': 'true' }),
    label,
  ]);
}
