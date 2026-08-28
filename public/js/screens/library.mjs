/**
 * library.mjs | every link in Part 7, all twenty categories, each one tickable.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { debounce, el, int, qs, svgIcon } from '../ui.mjs';
import { chipFilter, errorCard, mount, searchBox, section, statGrid } from '../render.mjs';
import { openAndStart } from '../timer.mjs';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  ext: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

const filters = { category: '', week: '', cost: '', status: '', q: '' };
let categories = [];

function statusBadge(status) {
  return el('span', {
    class: `badge ${status === 'done' ? 'badge--green' : status === 'reading' ? 'badge--blue' : 'badge--outline'}`,
    text: status === 'done' ? 'Done' : status === 'reading' ? 'Reading' : 'Not started',
  });
}

function resourceRow(r) {
  const badge = statusBadge(r.status);

  const start = el('button', { type: 'button', class: 'btn btn--sm btn--start' }, [svgIcon(ICON.play), 'Open and start']);
  start.addEventListener('click', async () => {
    start.disabled = true;
    await openAndStart({ url: r.url, block: 'LEARN', resourceId: r.id, label: r.label });
    badge.replaceWith(statusBadge('reading'));
    start.disabled = false;
  });

  const mark = (next, text) => {
    const btn = el('button', { type: 'button', class: 'btn btn--sm', text });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.patch(`/api/resources/${r.id}/progress`, { status: next });
        badge.replaceWith(statusBadge(next));
        toast(`Marked ${next}.`, 'ok');
      } catch (err) {
        toastError(err.message);
      }
      btn.disabled = false;
    });
    return btn;
  };

  const notes = el('input', {
    class: 'input input--sm',
    value: r.notes ?? '',
    placeholder: 'A note',
    'aria-label': `Note for ${r.label}`,
  });
  notes.addEventListener(
    'change',
    debounce(async () => {
      try {
        await api.patch(`/api/resources/${r.id}/progress`, { notes: notes.value });
      } catch (err) {
        toastError(err.message);
      }
    }, 400)
  );

  return el('div', { class: 'linkrow' }, [
    el('div', { class: 'linkrow__main' }, [
      el('div', { class: 'linkrow__title' }, [
        el('a', { href: r.url, text: r.label, target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' }),
        svgIcon(ICON.ext, 'extlink__icon'),
        badge,
        el('span', { class: 'badge badge--outline', text: r.cost }),
        r.weeks.length ? el('span', { class: 'badge', text: `Week ${r.weeks.join(', ')}` }) : null,
        r.is_alive === false
          ? el('span', {
              class: 'badge badge--red',
              text: r.last_checked ? `Link check failed on ${r.last_checked}` : 'Link check failed',
            })
          : r.last_checked
            ? el('span', { class: 'badge badge--green', text: `Checked ${r.last_checked}` })
            : null,
      ]),
      el('p', { class: 'linkrow__why', text: r.why }),
      notes,
    ]),
    el('div', { class: 'linkrow__actions' }, [start, mark('reading', 'Reading'), mark('done', 'Done')]),
  ]);
}

async function load() {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const d = await api.get(`/api/resources?${params.toString()}`);
  categories = d.categories;

  mount('#l-summary', [
    statGrid([
      { value: `${d.tally.done} of ${d.total}`, label: 'links finished', tone: d.tally.done ? 'green' : '' },
      { value: d.tally.reading, label: 'in progress', tone: d.tally.reading ? 'blue' : '' },
      { value: d.categories.length, label: 'categories' },
      {
        value: d.dead,
        label: 'links flagged by the checker',
        tone: d.dead ? 'red' : '',
        sub: 'A dead link is flagged, never deleted.',
      },
    ]),
  ]);

  const byCategory = new Map();
  for (const r of d.resources) {
    if (!byCategory.has(r.category_no)) byCategory.set(r.category_no, []);
    byCategory.get(r.category_no).push(r);
  }

  const blocks = [];
  for (const c of d.categories) {
    const rows = byCategory.get(c.no) ?? [];
    if (!rows.length) continue;
    blocks.push(
      el('details', { class: 'catcard', open: rows.length <= 12 }, [
        el('summary', { class: 'catcard__head' }, [
          el('span', { class: 'catcard__no', text: String(c.no).padStart(2, '0') }),
          el('strong', { class: 'grow', text: c.name }),
          el('span', { class: 'badge badge--outline', text: `${rows.filter((r) => r.status === 'done').length} of ${rows.length}` }),
        ]),
        el('div', { class: 'catcard__body' }, rows.map(resourceRow)),
      ])
    );
  }
  mount('#l-list', blocks.length ? blocks : [el('div', { class: 'empty' }, [
    el('p', { class: 'empty__title', text: 'Nothing matches those filters' }),
    el('p', { class: 'empty__body', text: 'Clear a filter and the whole library comes back. There are 127 links in Part 7.' }),
  ])]);
}

const debounced = debounce(() => load(), 250);

function drawFilters() {
  mount('#l-filters', [
    el('div', { class: 'card' }, [
      el('div', { class: 'filters' }, [
        searchBox('Search a link or a reason', (v) => {
          filters.q = v;
          debounced();
        }),
        (() => {
          const sel = el('select', { class: 'select select--sm', 'aria-label': 'Filter by category' });
          sel.appendChild(el('option', { value: '', text: 'Every category' }));
          for (const c of categories) {
            sel.appendChild(el('option', { value: String(c.no), text: `${String(c.no).padStart(2, '0')} ${c.name}` }));
          }
          sel.addEventListener('change', () => {
            filters.category = sel.value;
            load();
          });
          return sel;
        })(),
        (() => {
          const sel = el('select', { class: 'select select--sm', 'aria-label': 'Filter by week' });
          sel.appendChild(el('option', { value: '', text: 'Any week' }));
          for (let i = 1; i <= 21; i += 1) sel.appendChild(el('option', { value: String(i), text: `Week ${i}` }));
          sel.addEventListener('change', () => {
            filters.week = sel.value;
            load();
          });
          return sel;
        })(),
        chipFilter(
          [
            { value: '', label: 'Any cost' },
            { value: 'Free', label: 'Free' },
            { value: 'Paid', label: 'Paid' },
            { value: 'Owned', label: 'Owned' },
          ],
          filters.cost,
          (v) => {
            filters.cost = v;
            load();
          }
        ),
        chipFilter(
          [
            { value: '', label: 'Any status' },
            { value: 'todo', label: 'Not started' },
            { value: 'reading', label: 'Reading' },
            { value: 'done', label: 'Done' },
          ],
          filters.status,
          (v) => {
            filters.status = v;
            load();
          }
        ),
      ]),
    ]),
  ]);
}

try {
  await load();
  drawFilters();
} catch (err) {
  mount('#l-summary', errorCard(err.message));
}
