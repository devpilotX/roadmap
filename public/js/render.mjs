/**
 * render.mjs | shared renderers for tables, stats and hand written SVG charts.
 *
 * There is no chart library here on purpose. Every chart is SVG built from
 * numbers, with an accessible summary next to it, because a chart nobody can
 * read with a screen reader is decoration.
 */

import { clear, el, int, pct, qs, svgIcon } from './ui.mjs';

const SVGNS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined) continue;
    node.setAttribute(k, String(v));
  }
  return node;
}

/* ------------------------------------------------------------------ table */

/**
 * @param {object} spec
 * @param {Array<{key:string,label:string,num?:boolean,render?:Function,width?:string}>} spec.columns
 * @param {object[]} spec.rows
 * @param {string} [spec.caption]
 * @param {Function} [spec.rowClass]
 * @param {Function} [spec.rowCurrent]
 */
export function table({ columns, rows, caption, rowClass, rowCurrent }) {
  const t = el('table', { class: 'table' });
  if (caption) t.appendChild(el('caption', { text: caption }));
  const thead = el('thead');
  const hr = el('tr');
  for (const c of columns) {
    hr.appendChild(el('th', { class: c.num ? 'num' : '', scope: 'col', text: c.label }));
  }
  thead.appendChild(hr);
  t.appendChild(thead);

  const tbody = el('tbody');
  for (const row of rows) {
    const tr = el('tr', { class: rowClass ? rowClass(row) : '' });
    if (rowCurrent && rowCurrent(row)) tr.setAttribute('aria-current', 'true');
    for (const c of columns) {
      const td = el('td', { class: c.num ? 'num' : '' });
      const value = c.render ? c.render(row) : row[c.key];
      if (value === null || value === undefined) td.textContent = '';
      else if (typeof value === 'object' && value.nodeType) td.appendChild(value);
      else td.textContent = String(value);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  return el('div', { class: 'tablewrap' }, [t]);
}

/* ------------------------------------------------------------------- stats */

/** @param {Array<{value:string|number,label:string,sub?:string,tone?:string,hero?:boolean}>} stats */
export function statGrid(stats, { columns = 4 } = {}) {
  const grid = el('div', { class: `grid grid--${columns}` });
  for (const s of stats) {
    grid.appendChild(
      el('div', { class: `card stat ${s.tone ? `stat--${s.tone}` : ''}` }, [
        el('span', {
          class: `stat__value ${s.hero ? 'stat__value--hero' : ''}`,
          text: typeof s.value === 'number' ? int(s.value) : String(s.value ?? '-'),
        }),
        el('span', { class: 'stat__label', text: s.label }),
        s.sub ? el('span', { class: 'stat__sub', text: s.sub }) : null,
      ])
    );
  }
  return grid;
}

export function meter(percent, tone = '') {
  const wrap = el('div', { class: `meter ${tone ? `meter--${tone}` : ''}` });
  const fill = el('div', { class: 'meter__fill', 'data-fill': String(Math.max(0, Math.min(100, percent))) });
  fill.style.setProperty('width', `${Math.max(0, Math.min(100, percent))}%`);
  wrap.appendChild(fill);
  return wrap;
}

/* ------------------------------------------------------------- line chart */

/**
 * Plan against actual, drawn as two paths.
 * @param {object} spec
 * @param {Array<{label:string,plan:number,actual:number|null}>} spec.points
 */
export function lineChart({ points, height = 200, yLabel = '', summary = '' }) {
  const w = 720;
  const h = height;
  const padL = 42;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const maxY = Math.max(1, ...points.map((p) => Math.max(p.plan ?? 0, p.actual ?? 0)));
  const x = (i) => padL + (i * (w - padL - padR)) / Math.max(1, points.length - 1);
  const y = (v) => h - padB - ((v ?? 0) / maxY) * (h - padT - padB);

  const root = svg('svg', {
    class: 'chart',
    viewBox: `0 0 ${w} ${h}`,
    role: 'img',
    'aria-label': summary || 'Plan against actual',
    preserveAspectRatio: 'none',
  });

  for (let g = 0; g <= 4; g += 1) {
    const gy = padT + (g * (h - padT - padB)) / 4;
    root.appendChild(svg('line', { class: 'chart__grid', x1: padL, y1: gy, x2: w - padR, y2: gy }));
    const label = svg('text', { class: 'chart__axis', x: 4, y: gy + 3 });
    label.textContent = String(Math.round(maxY - (g * maxY) / 4));
    root.appendChild(label);
  }

  const planPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.plan).toFixed(1)}`).join(' ');
  root.appendChild(svg('path', { class: 'chart__plan', d: planPath }));

  const actualPoints = points.filter((p) => p.actual !== null && p.actual !== undefined);
  if (actualPoints.length) {
    let d = '';
    let started = false;
    points.forEach((p, i) => {
      if (p.actual === null || p.actual === undefined) return;
      d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.actual).toFixed(1)} `;
      started = true;
    });
    root.appendChild(svg('path', { class: 'chart__actual', d: d.trim() }));
    const last = points.reduce((acc, p, i) => (p.actual !== null && p.actual !== undefined ? i : acc), -1);
    if (last >= 0) {
      root.appendChild(svg('circle', { class: 'chart__dot', cx: x(last), cy: y(points[last].actual), r: 3.5 }));
    }
  }

  points.forEach((p, i) => {
    if (points.length > 12 && i % 3 !== 0 && i !== points.length - 1) return;
    const t = svg('text', { class: 'chart__axis', x: x(i), y: h - 8, 'text-anchor': 'middle' });
    t.textContent = p.label;
    root.appendChild(t);
  });

  return el('div', {}, [
    root,
    el('div', { class: 'legend' }, [
      el('span', { class: 'legend__key' }, [
        el('span', { class: 'legend__swatch legend__swatch--plan' }),
        'Plan',
      ]),
      el('span', { class: 'legend__key' }, [el('span', { class: 'legend__swatch' }), 'Actual']),
      yLabel ? el('span', { class: 'legend__key', text: yLabel }) : null,
    ]),
    summary ? el('p', { class: 'text-xs muted', text: summary }) : null,
  ]);
}

/* -------------------------------------------------------------- bar chart */

/**
 * @param {Array<{label:string,value:number,tone?:string,bandLow?:number,bandHigh?:number}>} bars
 */
export function barChart(bars, { height = 190, summary = '', valueFormat = (v) => int(v) } = {}) {
  const w = 720;
  const h = height;
  const padL = 46;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const maxY = Math.max(1, ...bars.map((b) => Math.max(b.value ?? 0, b.bandHigh ?? 0)));
  const innerW = w - padL - padR;
  const slot = innerW / Math.max(1, bars.length);
  const barW = Math.max(3, Math.min(30, slot * 0.6));
  const y = (v) => h - padB - ((v ?? 0) / maxY) * (h - padT - padB);

  const root = svg('svg', {
    class: 'chart',
    viewBox: `0 0 ${w} ${h}`,
    role: 'img',
    'aria-label': summary || 'Bar chart',
    preserveAspectRatio: 'none',
  });

  for (let g = 0; g <= 4; g += 1) {
    const gy = padT + (g * (h - padT - padB)) / 4;
    root.appendChild(svg('line', { class: 'chart__grid', x1: padL, y1: gy, x2: w - padR, y2: gy }));
    const label = svg('text', { class: 'chart__axis', x: 4, y: gy + 3 });
    label.textContent = valueFormat(Math.round(maxY - (g * maxY) / 4));
    root.appendChild(label);
  }

  bars.forEach((b, i) => {
    const cx = padL + slot * i + slot / 2;
    if (b.bandLow !== undefined && b.bandHigh !== undefined) {
      root.appendChild(
        svg('rect', {
          class: 'chart__band',
          x: cx - barW / 2 - 3,
          y: y(b.bandHigh),
          width: barW + 6,
          height: Math.max(1, y(b.bandLow) - y(b.bandHigh)),
          rx: 2,
        })
      );
    }
    root.appendChild(
      svg('rect', {
        class: `chart__bar ${b.tone ? `chart__bar--${b.tone}` : ''}`,
        x: cx - barW / 2,
        y: y(b.value),
        width: barW,
        height: Math.max(0, h - padB - y(b.value)),
        rx: 2,
      })
    );
    if (bars.length <= 24) {
      const t = svg('text', { class: 'chart__axis', x: cx, y: h - 8, 'text-anchor': 'middle' });
      t.textContent = b.label;
      root.appendChild(t);
    }
  });

  return el('div', {}, [root, summary ? el('p', { class: 'text-xs muted', text: summary }) : null]);
}

/* -------------------------------------------------------- contribution grid */

/**
 * The 150 day grid. Weeks run down the columns, weekdays across the rows, which
 * is the shape a GitHub contribution graph uses and the shape people expect.
 */
export function contributionGrid({ from, to, byDate, today, colourFor }) {
  const cell = 13;
  const gap = 3;
  const dates = [];
  let cursor = from;
  while (cursor <= to) {
    dates.push(cursor);
    const d = new Date(`${cursor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = d.toISOString().slice(0, 10);
  }
  const firstIdx = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const columns = Math.ceil((dates.length + firstIdx) / 7);
  const w = columns * (cell + gap) + 30;
  const h = 7 * (cell + gap) + 18;

  const root = svg('svg', {
    class: 'chart heatgrid',
    viewBox: `0 0 ${w} ${h}`,
    role: 'img',
    'aria-label': `${dates.length} day grid from ${from} to ${to}`,
  });

  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  DAYS.forEach((label, i) => {
    const t = svg('text', { class: 'chart__axis', x: 0, y: i * (cell + gap) + cell });
    t.textContent = label;
    root.appendChild(t);
  });

  dates.forEach((date, i) => {
    const slot = i + firstIdx;
    const col = Math.floor(slot / 7);
    const row = slot % 7;
    const info = byDate.get(date);
    const g = svg('g');
    const rect = svg('rect', {
      x: 22 + col * (cell + gap),
      y: row * (cell + gap),
      width: cell,
      height: cell,
      rx: 3,
      class: `heatcell ${colourFor(info, date)}`,
      'data-date': date,
    });
    if (date === today) rect.setAttribute('stroke-width', '2');
    if (date === today) rect.classList.add('heatcell--today');
    const title = svg('title');
    title.textContent = info
      ? `${date}: ${info.commits ?? 0} commits across ${info.pushes ?? 0} pushes${info.repos ? ` in ${info.repos.join(', ')}` : ''}`
      : `${date}: no push`;
    g.appendChild(rect);
    g.appendChild(title);
    root.appendChild(g);
  });

  return root;
}

/* ---------------------------------------------------------------- filters */

/**
 * A chip filter bar. onChange receives the active value.
 * @param {Array<{value:string,label:string,count?:number}>} options
 */
export function chipFilter(options, current, onChange) {
  const bar = el('div', { class: 'row' });
  for (const o of options) {
    const chip = el('button', {
      type: 'button',
      class: 'chip',
      'aria-pressed': String(o.value === current),
    }, [
      o.label,
      o.count !== undefined ? el('span', { class: 'badge badge--outline', text: String(o.count) }) : null,
    ]);
    chip.addEventListener('click', () => {
      for (const other of bar.querySelectorAll('.chip')) other.setAttribute('aria-pressed', 'false');
      chip.setAttribute('aria-pressed', 'true');
      onChange(o.value);
    });
    bar.appendChild(chip);
  }
  return bar;
}

export function searchBox(placeholder, onInput) {
  const input = el('input', {
    class: 'input searchbox__input',
    type: 'search',
    placeholder,
    autocomplete: 'off',
    'aria-label': placeholder,
  });
  input.addEventListener('input', () => onInput(input.value));
  return el('div', { class: 'searchbox' }, [svgIcon('M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l4 4', 'searchbox__icon'), input]);
}

/* --------------------------------------------------------------- sections */

export function section(title, children, { lede = '', actions = null, id = null } = {}) {
  return el('section', { class: 'card stack', id }, [
    el('div', { class: 'card__head' }, [
      el('h2', { class: 'card__title', text: title }),
      actions,
    ]),
    lede ? el('p', { class: 'muted text-sm', text: lede }) : null,
    ...[].concat(children).filter(Boolean),
  ]);
}

export function verbatim(title, text) {
  return el('div', { class: 'card' }, [
    el('p', { class: 'card__label', text: title }),
    el('p', { class: 'measure', text }),
  ]);
}

/** Replaces a container's contents with nodes. */
export function mount(selector, nodes) {
  const host = qs(selector);
  if (!host) return null;
  clear(host);
  for (const n of [].concat(nodes).filter(Boolean)) host.appendChild(n);
  return host;
}

export function loadingCard(text = 'Loading.') {
  return el('div', { class: 'card' }, [el('p', { class: 'muted', text })]);
}

export function errorCard(message) {
  return el('div', { class: 'callout callout--red' }, [
    svgIcon('M12 3 2 20h20L12 3ZM12 9v5M12 17h.01', 'callout__icon'),
    el('div', { class: 'callout__body' }, [
      el('p', { class: 'callout__title', text: 'That did not load' }),
      el('p', { text: message }),
    ]),
  ]);
}

export { el, pct, int };
