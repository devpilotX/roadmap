/**
 * dsa.mjs | the DSA tracker.
 *
 * Until a real 474 row export is imported the screen shows topic level progress
 * and says so plainly, because problem names are never invented.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { clear, debounce, el, int, minutesLabel, qs, svgIcon } from '../ui.mjs';
import { chipFilter, errorCard, lineChart, meter, mount, searchBox, section, statGrid, table } from '../render.mjs';
import { openAndStart } from '../timer.mjs';

let summary = null;
const filters = { topic: '', difficulty: '', status: '', q: '' };

function topicBlock(t) {
  const head = el('summary', { class: 'dsatopic__head' }, [
    el('span', { class: 'dsatopic__ord', text: String(t.ord).padStart(2, '0') }),
    el('span', {}, [
      el('strong', { text: t.name }),
      t.total
        ? el('span', { class: 'text-xs muted', text: ` ${t.solved} of ${t.total} solved` })
        : el('span', { class: 'text-xs muted', text: ` ${t.manual_solved} logged, no problem list imported` }),
    ]),
    el('span', { class: 'dsatopic__meter' }, [
      meter(t.total ? Math.round((t.solved / t.total) * 100) : 0, t.total && t.solved === t.total ? 'green' : ''),
    ]),
    t.failed_twice ? el('span', { class: 'badge badge--red', text: `${t.failed_twice} failed twice` }) : el('span', {}),
  ]);

  const body = el('div', { class: 'dsatopic__body stack-sm' });

  if (!summary.problems_imported) {
    const input = el('input', {
      class: 'input input--sm input--num',
      type: 'number',
      min: '0',
      max: '500',
      value: String(t.manual_solved),
      'aria-label': `Problems solved in ${t.name}`,
    });
    input.addEventListener(
      'change',
      debounce(async () => {
        try {
          await api.patch(`/api/dsa/topics/${t.id}/progress`, { solved: Number(input.value) || 0 });
          toast('Saved.', 'ok');
        } catch (err) {
          toastError(err.message);
        }
      }, 350)
    );
    body.appendChild(
      el('div', { class: 'row' }, [el('span', { class: 'text-sm', text: 'Problems solved in this step' }), input])
    );
  } else {
    body.appendChild(el('p', { class: 'text-sm muted', text: 'Open the problem list below and tick them individually.' }));
  }

  return el('details', { class: 'dsatopic' }, [head, body]);
}

function problemRow(p) {
  const select = el('select', { class: 'select select--sm', 'aria-label': `Status for ${p.name}` });
  for (const [value, label] of [
    ['todo', 'Not started'],
    ['solved', 'Solved'],
    ['revisit', 'Revisit'],
    ['failed_twice', 'Failed twice'],
  ]) {
    select.appendChild(el('option', { value, text: label, selected: p.status === value }));
  }
  select.addEventListener('change', async () => {
    try {
      await api.patch(`/api/dsa/problems/${p.id}/progress`, { status: select.value });
      toast('Saved.', 'ok');
      await load();
    } catch (err) {
      toastError(err.message);
    }
  });

  const start = el('button', { type: 'button', class: 'btn btn--sm btn--start' }, [
    svgIcon('M8 5l11 7-11 7z'),
    'Open and start',
  ]);
  start.addEventListener('click', () =>
    openAndStart({
      url: p.url || 'https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z',
      block: 'DSA',
      label: p.name,
    })
  );

  return el('div', { class: 'linkrow' }, [
    el('div', { class: 'linkrow__main' }, [
      el('div', { class: 'linkrow__title' }, [
        el('span', { text: p.name }),
        el('span', { class: `difficulty difficulty--${p.difficulty}`, text: p.difficulty }),
        p.status === 'failed_twice' ? el('span', { class: 'badge badge--red', text: 'Failed twice' }) : null,
      ]),
      el('p', { class: 'linkrow__why', text: p.topic }),
    ]),
    el('div', { class: 'linkrow__actions' }, [select, start]),
  ]);
}

async function loadProblems() {
  if (!summary.problems_imported) {
    mount('#d-list', [
      section('The 18 A2Z steps', el('div', {}, summary.topics.map(topicBlock)), {
        lede: 'Progress is tracked per step until a real problem list is imported.',
      }),
    ]);
    return;
  }
  const params = new URLSearchParams();
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  const d = await api.get(`/api/dsa/problems?${params.toString()}`);
  mount('#d-list', [
    section(`Problems, ${d.count} shown`, el('div', {}, d.problems.map(problemRow))),
    section('The 18 A2Z steps', el('div', {}, summary.topics.map(topicBlock))),
  ]);
}

function drawFilters() {
  const q = searchBox('Search a problem name', (value) => {
    filters.q = value;
    debouncedLoad();
  });
  mount('#d-filters', [
    el('div', { class: 'card' }, [
      el('div', { class: 'filters' }, [
        q,
        (() => {
          const sel = el('select', { class: 'select select--sm', 'aria-label': 'Filter by topic' });
          sel.appendChild(el('option', { value: '', text: 'Every topic' }));
          for (const t of summary.topics) sel.appendChild(el('option', { value: String(t.id), text: t.name }));
          sel.addEventListener('change', () => {
            filters.topic = sel.value;
            loadProblems();
          });
          return sel;
        })(),
        chipFilter(
          [
            { value: '', label: 'Any difficulty' },
            { value: 'Easy', label: 'Easy', count: summary.expected_split.Easy },
            { value: 'Medium', label: 'Medium', count: summary.expected_split.Medium },
            { value: 'Hard', label: 'Hard', count: summary.expected_split.Hard },
          ],
          filters.difficulty,
          (v) => {
            filters.difficulty = v;
            loadProblems();
          }
        ),
        chipFilter(
          [
            { value: '', label: 'Any status' },
            { value: 'todo', label: 'Not started' },
            { value: 'solved', label: 'Solved' },
            { value: 'revisit', label: 'Revisit' },
            { value: 'failed_twice', label: 'Failed twice' },
          ],
          filters.status,
          (v) => {
            filters.status = v;
            loadProblems();
          }
        ),
      ]),
    ]),
  ]);
}

const debouncedLoad = debounce(() => loadProblems(), 250);

async function load() {
  summary = await api.get('/api/dsa/summary');

  mount('#d-summary', [
    statGrid(
      [
        {
          value: `${int(summary.solved)} of ${int(summary.total_in_sheet)}`,
          label: 'problems solved',
          sub: `${int(summary.target_by_gate4)} is the target by 24 January 2027`,
          hero: true,
          tone: summary.solved >= summary.target_by_gate4 ? 'green' : '',
        },
        { value: summary.by_difficulty.Easy?.solved ?? 0, label: `Easy, of ${summary.expected_split.Easy}` },
        { value: summary.by_difficulty.Medium?.solved ?? 0, label: `Medium, of ${summary.expected_split.Medium}` },
        { value: summary.by_difficulty.Hard?.solved ?? 0, label: `Hard, of ${summary.expected_split.Hard}` },
      ],
      { columns: 4 }
    ),
    summary.import_notice
      ? el('div', { class: 'callout callout--orange' }, [
          svgIcon('M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'callout__icon'),
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'Problem level import is pending' }),
            el('p', { text: summary.import_notice }),
          ]),
        ])
      : null,
    el('div', { class: 'callout callout--blue' }, [
      svgIcon('M12 8h.01M11 12h1v5h1', 'callout__icon'),
      el('div', { class: 'callout__body' }, [
        el('p', { class: 'callout__title', text: 'Completing DSA on its own unlocks no job role at all' }),
        el('p', {
          text:
            'DSA is a filter, not a qualification. The count gets you past a screen. The projects get you the offer. A candidate with 474 problems and no shipped system loses to a candidate with 200 problems and a live application, every time.',
        }),
      ]),
    ]),
  ]);

  mount('#d-chart', [
    section(
      'Cumulative against the plan',
      lineChart({
        points: summary.curve.map((c) => ({ label: `W${c.week_n}`, plan: c.plan, actual: c.actual })),
        summary: `Plan ends at ${int(summary.target_by_gate4)}. Actual is ${int(summary.solved)}.`,
      }),
      { lede: 'The dashed line is the Part 3 cumulative column. The solid line is what actually happened.' }
    ),
    section(
      'The DSA only ladder',
      table({
        columns: [
          { key: 'problems', label: 'Problems', num: true },
          { key: 'reached_about', label: 'Reached about' },
          { key: 'gets_you_past', label: 'What the number alone gets you past' },
          { key: 'does_not_open', label: 'What it still does not open' },
        ],
        rows: summary.ladder,
        rowCurrent: (r) => r.reached && !summary.ladder.some((o) => o.problems > r.problems && o.reached),
      }),
      { lede: 'No number in this table unlocks a single role.' }
    ),
  ]);

  if (summary.failed_twice.length) {
    mount('#d-failed', [
      section(
        `Failed twice, ${summary.failed_twice.length}`,
        el('div', {}, summary.failed_twice.map(problemRow)),
        { lede: 'Each one stays here, and on Today, until it is solved cold. Every entry needs the mechanism, not the answer.' }
      ),
    ]);
  } else {
    mount('#d-failed', [
      section('Failed twice', el('p', { class: 'muted', text: 'Nothing has beaten you twice yet. When something does, it lands here and on Today.' })),
    ]);
  }

  drawFilters();
  await loadProblems();
}

try {
  await load();
} catch (err) {
  mount('#d-summary', errorCard(err.message));
}
