/**
 * after.mjs | Part 15, what happens after 24 January 2027.
 *
 * Gate 4 is not the finish line, it is where the plan changes shape, so this
 * screen is the only one in the application that looks past the 150 days. The
 * three branches are read only, because which one you are on is decided by
 * whether you have a job and not by a checkbox.
 *
 * The bridge items, the quarters and the year detail lines are real ticks against
 * continuation_progress, which is why the counter at the top is worth something.
 * The weekday shape is reference text and has nothing to tick.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { debounce, el, emptyState, int, shortDate } from '../ui.mjs';
import { errorCard, meter, mount, section, table } from '../render.mjs';

/**
 * The seed text carries markdown emphasis around the lead clause of some lines.
 * Splitting on the markers and returning real elements keeps the emphasis the
 * document intended without ever putting a string through innerHTML.
 */
function emphasise(text) {
  return String(text ?? '')
    .split('**')
    .map((part, i) => (i % 2 === 1 ? el('strong', { text: part }) : part))
    .filter((part) => part !== '');
}

/* ------------------------------------------------------------- the counter */

const progress = { done: 0, total: 0, value: null, fill: null, label: null };

function paintProgress() {
  const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  if (progress.value) progress.value.textContent = `${int(progress.done)} of ${int(progress.total)}`;
  if (progress.label) progress.label.textContent = `${percent}% of the tickable items after Gate 4`;
  if (progress.fill) {
    progress.fill.dataset.fill = String(percent);
    progress.fill.style.setProperty('width', `${percent}%`);
  }
}

function bump(delta) {
  progress.done = Math.max(0, progress.done + delta);
  paintProgress();
}

/* ----------------------------------------------------------------- one tick */

function tickRow(r) {
  const box = el('input', { class: 'tick__box', type: 'checkbox', checked: r.done });
  const stamp = el('span', {
    class: 'tick__meta',
    text: r.completed_on ? `Ticked on ${shortDate(r.completed_on)}` : '',
  });

  box.addEventListener('change', async () => {
    const want = box.checked;
    box.disabled = true;
    try {
      const saved = await api.patch(`/api/after/${r.id}/progress`, { done: want });
      r.done = want;
      r.completed_on = saved?.completed_on ?? null;
      stamp.textContent = r.completed_on ? `Ticked on ${shortDate(r.completed_on)}` : '';
      bump(want ? 1 : -1);
    } catch (err) {
      // An explicit revert, so nothing is ever left looking saved.
      box.checked = !want;
      toastError(err.message);
    } finally {
      box.disabled = false;
    }
  });

  const notes = el('input', {
    class: 'input input--sm',
    value: r.notes ?? '',
    placeholder: 'A note',
    'aria-label': `Note for ${r.label}`,
  });
  notes.addEventListener(
    'change',
    debounce(async () => {
      const before = r.notes ?? '';
      try {
        await api.patch(`/api/after/${r.id}/progress`, { notes: notes.value });
        r.notes = notes.value;
        toast('Note saved.');
      } catch (err) {
        notes.value = before;
        toastError(err.message);
      }
    }, 400)
  );

  return el('div', { class: 'stack-sm' }, [
    el('label', { class: 'tick' }, [
      box,
      el('span', { class: 'tick__body' }, [
        el('span', { class: 'tick__text' }, emphasise(r.goal)),
        stamp,
      ]),
    ]),
    notes,
  ]);
}

/* -------------------------------------------------------------- the branches */

function branchCard(b) {
  return el('article', { class: 'branchcard' }, [
    el('div', { class: 'between' }, [
      el('span', { class: 'branchcard__letter', text: b.label }),
      el('span', { class: 'badge badge--outline', text: b.period }),
    ]),
    el('h3', { class: 'card__title', text: b.goal }),
    b.detail ? el('p', { class: 'measure text-sm' }, emphasise(b.detail)) : null,
    b.hours_text ? el('p', { class: 'text-sm muted', text: `Hours: ${b.hours_text}` }) : null,
  ]);
}

/* --------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/after');
    const g = d.grouped ?? {};
    const branches = g.branch ?? [];
    const bridge = g.bridge ?? [];
    const weekday = g.weekday ?? [];
    const years = g.year ?? [];
    const quarters = g.quarter ?? [];
    const details = g.year_detail ?? [];

    progress.done = Number(d.done_count ?? 0);
    progress.total = Number(d.total_count ?? 0);
    progress.value = el('span', { class: 'stat__value stat__value--hero', text: '' });
    progress.label = el('span', { class: 'stat__label', text: '' });
    const bar = meter(0);
    progress.fill = bar.querySelector('.meter__fill');

    mount('#af-branches', [
      section(
        'The three branches',
        [
          el('div', { class: 'card stat' }, [
            progress.value,
            progress.label,
            bar,
            el('span', {
              class: 'stat__sub',
              text: 'The bridge items, the four quarters and the year detail lines are the tickable ones. The branches and the weekday shape are reference.',
            }),
          ]),
          branches.length
            ? el('div', { class: 'grid grid--3' }, branches.map(branchCard))
            : emptyState('No branches listed', 'The three branches come from Part 15 of final.md. Run npm run setup.'),
          el('p', {
            class: 'text-sm muted measure',
            text: 'Which branch you are on is decided by whether you are employed on 1 February 2027, so there is nothing to choose here. Read the one that applies and ignore the other two.',
          }),
        ],
        { lede: 'Gate 4 is not the finish line. It is where the plan changes shape.' }
      ),
    ]);
    paintProgress();

    mount('#af-bridge', [
      section(
        'February to March 2027',
        [
          bridge.length
            ? el('div', { class: 'stack-sm' }, bridge.map(tickRow))
            : emptyState('No bridge items', 'They come from Part 15 of final.md. Run npm run setup.'),
          el('p', {
            class: 'text-sm muted measure',
            text: 'Six weeks of finishing what the 21 weeks left open. The instruction not to start a fifth project is the one most likely to be ignored and the one that costs the most.',
          }),
        ],
        { lede: bridge.length ? `${bridge.length} items, each one tickable.` : '' }
      ),
    ]);

    mount('#af-shape', [
      section(
        'The weekday shape when employed',
        [
          weekday.length
            ? table({
                columns: [
                  { key: 'period', label: 'When' },
                  { key: 'goal', label: 'What happens' },
                  { key: 'hours_text', label: 'Hours', num: true },
                ],
                rows: weekday,
              })
            : emptyState('No shape listed', 'It comes from Part 15 of final.md. Run npm run setup.'),
          el('p', {
            class: 'text-sm muted measure',
            text: 'This is branch A, the employed shape. Sunday is rest and it stays rest, exactly as it does inside the 21 weeks.',
          }),
        ]
      ),
    ]);

    const yearSections = years.map((y) => {
      const q = quarters.filter((row) => row.period === y.period);
      const dets = details.filter((row) => row.label === y.label);

      return section(
        `${y.label}, ${y.period}`,
        [
          el('div', { class: 'row' }, [
            y.age_label ? el('span', { class: 'badge badge--outline', text: y.age_label }) : null,
            el('span', { class: 'badge badge--outline', text: y.period }),
          ]),
          el('p', { class: 'measure', text: `The goal: ${y.goal}` }),
          q.length
            ? el('div', { class: 'stack-sm' }, [
                el('p', { class: 'card__label', text: 'By quarter' }),
                ...q.map((row) =>
                  el('div', { class: 'stack-sm' }, [
                    el('span', { class: 'badge badge--outline', text: row.label }),
                    tickRow(row),
                  ])
                ),
              ])
            : null,
          dets.length
            ? el('div', { class: 'stack-sm' }, [
                el('p', { class: 'card__label', text: 'The detail' }),
                ...dets.map(tickRow),
              ])
            : null,
          q.length || dets.length
            ? null
            : emptyState('Nothing listed for this year', 'The detail comes from Part 15 of final.md. Run npm run setup.'),
        ],
        { lede: y.age_label ? `You are ${y.age_label} through this one.` : '' }
      );
    });

    mount('#af-years', [
      ...(years.length
        ? yearSections
        : [
            section('Year one, two and three', [
              emptyState('No years listed', 'They come from Part 15 of final.md. Run npm run setup.'),
            ]),
          ]),
      el('div', { class: 'callout callout--blue' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'Three years is the New Zealand threshold' }),
          el('p', {
            class: 'measure',
            text: 'Year three exists because three years of verifiable experience is the New Zealand work visa skills threshold. The NZQA assessment and IELTS both take months, which is why they are listed a year before they are needed.',
          }),
          el('a', { class: 'btn btn--sm', href: '/nz', text: 'Open the New Zealand plan' }),
        ]),
      ]),
    ]);
  } catch (err) {
    mount('#af-branches', errorCard(err.message));
    for (const id of ['#af-bridge', '#af-shape', '#af-years']) mount(id, []);
  }
}

await main();
