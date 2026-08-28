/**
 * everything.mjs | Everything A to Z.
 *
 * This screen exists for one reason: to prove nothing in final.md was lost on the
 * way into the database. Every trackable item in the roadmap appears here once,
 * grouped by the part it came from, with one completion percentage for the whole
 * thing and the same percentage for each group.
 *
 * A row is one of four states. Done and todo are obvious. Partial means it was
 * started but not finished, which for a week day means one of learn and build was
 * ticked. Reference means the row is read only content from the plan, such as the
 * New Zealand cost table, and it is deliberately left out of every percentage,
 * because counting a table you cannot tick would flatter the number.
 *
 * Source: GET /api/everything. There are no writes on this screen; each row links
 * to the screen that owns it.
 */

import { api } from '../api.mjs';
import { toastError } from '../toast.mjs';
import { debounce, el, emptyState, int } from '../ui.mjs';
import { chipFilter, errorCard, meter, mount, searchBox, section, statGrid } from '../render.mjs';

const STATE_LABEL = {
  done: 'Done',
  partial: 'Started',
  todo: 'Not started',
  reference: 'Reference, not counted',
};

let data = null;
const filters = { q: '', state: '', group: '' };

/* --------------------------------------------------------------- ev-summary */

function drawSummary() {
  const g = data.global;

  mount('#ev-summary', [
    section(
      'One number for the whole roadmap',
      [
        el('div', { class: 'row' }, [
          el('span', { class: 'evglobal', text: `${g.percent}%` }),
          el('div', { class: 'stack-sm grow' }, [
            meter(g.percent, g.percent === 100 ? 'green' : ''),
            el('p', {
              class: 'text-sm muted',
              text: `${int(g.done)} of ${int(g.trackable)} tickable items are finished. ${int(g.partial)} are started, ${int(g.todo)} are not. ${int(g.total - g.trackable)} more rows are reference content and are not counted.`,
            }),
          ]),
        ]),
        statGrid([
          { value: g.done, label: 'items finished', tone: g.done ? 'green' : '' },
          { value: g.partial, label: 'items started but not finished', tone: g.partial ? 'orange' : '' },
          { value: g.todo, label: 'items not started' },
          { value: data.item_count, label: 'rows on this page', sub: `${data.groups.length} groups, as of ${data.today}` },
        ]),
        el('p', {
          class: 'text-sm muted measure',
          text: 'The percentage counts finished items only. A started item counts nothing until it is finished, because half a week day is not a week day.',
        }),
      ],
      { lede: 'Nothing here is a summary of a summary. Every row below is a real item you can open.' }
    ),
  ]);
}

/* --------------------------------------------------------------- ev-filters */

function drawFilters() {
  const reload = debounce(() => drawList(), 200);

  const groupSelect = el('select', { class: 'select select--sm', 'aria-label': 'Filter by group' });
  groupSelect.appendChild(el('option', { value: '', text: 'Every group' }));
  for (const grp of data.groups) {
    groupSelect.appendChild(
      el('option', { value: grp.key, text: `${grp.title} (${grp.counts.done} of ${grp.counts.trackable})`, selected: grp.key === filters.group })
    );
  }
  groupSelect.addEventListener('change', () => {
    filters.group = groupSelect.value;
    drawGroups();
    drawList();
  });

  mount('#ev-filters', [
    el('div', { class: 'card' }, [
      el('div', { class: 'filters' }, [
        searchBox('Search every item in the roadmap', (v) => {
          filters.q = v;
          reload();
        }),
        groupSelect,
        chipFilter(
          [
            { value: '', label: 'Any state' },
            { value: 'done', label: 'Done', count: data.global.done },
            { value: 'partial', label: 'Started', count: data.global.partial },
            { value: 'todo', label: 'Not started', count: data.global.todo },
            { value: 'reference', label: 'Reference', count: data.global.total - data.global.trackable },
          ],
          filters.state,
          (v) => {
            filters.state = v;
            drawList();
          }
        ),
      ]),
    ]),
  ]);
}

/* ---------------------------------------------------------------- ev-groups */

function drawGroups() {
  const cards = data.groups.map((grp) => {
    const active = filters.group === grp.key;
    const card = el('button', {
      type: 'button',
      class: 'evgroup',
      'aria-pressed': String(active),
    }, [
      el('span', { class: 'evrow__label', text: grp.title }),
      el('span', { class: 'evrow__text', text: grp.source }),
      el('strong', { text: `${grp.counts.percent}%` }),
      meter(grp.counts.percent, grp.counts.percent === 100 ? 'green' : ''),
      el('span', {
        class: 'evrow__text',
        text: grp.counts.trackable
          ? `${grp.counts.done} done, ${grp.counts.partial} started, ${grp.counts.todo} to go, of ${grp.counts.trackable} tickable`
          : `${grp.counts.total} reference rows, nothing to tick`,
      }),
    ]);
    card.addEventListener('click', () => {
      filters.group = active ? '' : grp.key;
      drawGroups();
      drawFilters();
      drawList();
    });
    // A button centres its text by default and there is no alignment utility class,
    // so it is set here rather than in a style attribute the CSP would refuse.
    card.style.setProperty('text-align', 'left');
    return card;
  });

  mount('#ev-groups', [
    section(
      'The same number, per group',
      [
        cards.length
          ? el('div', { class: 'evgroups' }, cards)
          : emptyState('No groups', 'Nothing has been seeded yet. Run npm run setup and the groups appear from final.md.'),
        el('p', { class: 'text-xs muted', text: 'Select a group to narrow the list below. Select it again to clear it.' }),
      ]
    ),
  ]);
}

/* ------------------------------------------------------------------ ev-list */

function evRow(item) {
  return el('div', { class: 'evrow' }, [
    el('span', { class: `evrow__state evrow__state--${item.state}`, 'aria-hidden': 'true' }),
    el('div', {}, [
      el('div', { class: 'evrow__label', text: item.label }),
      el('div', { class: 'evrow__text', text: `${STATE_LABEL[item.state] ?? item.state}. ${item.text ?? ''}` }),
    ]),
    item.href ? el('a', { class: 'btn btn--sm btn--ghost', href: item.href, text: 'Open' }) : null,
  ]);
}

function matches(item) {
  if (filters.group && item.group !== filters.group) return false;
  if (filters.state && item.state !== filters.state) return false;
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const hay = `${item.label} ${item.text ?? ''} ${item.group_title ?? ''}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

function drawList() {
  const shown = data.items.filter(matches);

  if (!shown.length) {
    mount('#ev-list', [
      section('Every item', [
        emptyState(
          'Nothing matches those filters',
          `There are ${int(data.item_count)} items on this page. Clear the search, the group and the state and all of them come back.`
        ),
      ]),
    ]);
    return;
  }

  // Grouped, and collapsed once a group runs long, so the first paint is quick
  // without hiding anything: every row is still in the page.
  const blocks = [];
  for (const grp of data.groups) {
    const rows = shown.filter((i) => i.group === grp.key);
    if (!rows.length) continue;
    blocks.push(
      el('details', { class: 'acc', open: rows.length <= 60 || Boolean(filters.group) }, [
        el('summary', { class: 'acc__summary' }, [
          el('span', { class: 'grow', text: `${grp.title}, ${rows.length} shown` }),
          el('span', { class: 'badge badge--outline', text: `${grp.counts.percent}%` }),
        ]),
        el('div', { class: 'acc__body' }, [el('div', { class: 'card card--flush' }, rows.map(evRow))]),
      ])
    );
  }

  mount('#ev-list', [
    section(
      'Every item',
      [
        el('p', {
          class: 'text-sm muted',
          text: `Showing ${int(shown.length)} of ${int(data.item_count)} items.`,
        }),
        ...blocks,
      ],
      { lede: 'Grouped by the part of final.md the item came from. Long groups start folded, and nothing is left out.' }
    ),
  ]);
}

/* -------------------------------------------------------------------- main */

async function main() {
  try {
    data = await api.get('/api/everything');
    drawSummary();
    drawFilters();
    drawGroups();
    drawList();
  } catch (err) {
    mount('#ev-summary', errorCard(err.message));
    mount('#ev-filters', []);
    mount('#ev-groups', []);
    mount('#ev-list', []);
    toastError(err.message);
  }
}

await main();
