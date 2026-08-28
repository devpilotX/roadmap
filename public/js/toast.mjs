/**
 * toast.mjs | short lived messages, announced to assistive technology.
 *
 * An error toast stays until it is dismissed, because a failed tick is the one
 * thing in this application that must not disappear quietly.
 */

const HOLD = { ok: 2600, info: 3200, warn: 5200, error: 0 };

function container() {
  return document.getElementById('toasts');
}

function icon(kind) {
  const paths = {
    ok: 'M4 12l5 5L20 6',
    info: 'M12 8h.01M11 12h1v5h1',
    warn: 'M12 3 2 20h20L12 3ZM12 9v5M12 17h.01',
    error: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM9 9l6 6M15 9l-6 6',
  };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'callout__icon');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', paths[kind] ?? paths.info);
  svg.appendChild(p);
  return svg;
}

/**
 * @param {string} message plain text, never HTML
 * @param {'ok'|'info'|'warn'|'error'} kind
 */
export function toast(message, kind = 'info') {
  const host = container();
  if (!host) return null;

  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.appendChild(icon(kind));

  const body = document.createElement('div');
  body.className = 'toast__body';
  body.textContent = message; // textContent, so nothing user supplied can render as markup
  node.appendChild(body);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'iconbtn';
  close.setAttribute('aria-label', 'Dismiss this message');
  const cs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  cs.setAttribute('viewBox', '0 0 24 24');
  cs.setAttribute('aria-hidden', 'true');
  const cp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  cp.setAttribute('d', 'M6 6l12 12M18 6 6 18');
  cs.appendChild(cp);
  close.appendChild(cs);
  close.addEventListener('click', () => node.remove());
  node.appendChild(close);

  host.appendChild(node);

  const hold = HOLD[kind] ?? 3000;
  if (hold > 0) window.setTimeout(() => node.remove(), hold);
  return node;
}

export const toastOk = (m) => toast(m, 'ok');
export const toastWarn = (m) => toast(m, 'warn');
export const toastError = (m) => toast(m, 'error');
export default toast;
