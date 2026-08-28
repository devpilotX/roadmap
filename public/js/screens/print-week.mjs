/**
 * print-week.mjs | one week on one sheet of A4, for days without power.
 *
 * This serves the same Part 3 week data as the week detail screen, laid out for
 * paper rather than for a browser. Nothing here writes. A printed sheet cannot
 * tick a checkbox, so every box is drawn empty for a pen, and where a tick
 * already exists in the database it is stated in words beside the box instead of
 * being filled in. A sheet that came out of the printer already ticked would be
 * a sheet you cannot trust.
 *
 * The controls carry the no-print class from print-week.css, so the week picker,
 * the navigation and the print button all disappear when the sheet is printed
 * and the paper starts at the week itself.
 *
 * Two endpoints. GET /api/weeks fills the picker, because the option labels are
 * the real week titles and dates rather than bare numbers, and it is also how
 * the current week is found when the page is opened without ?week=. GET
 * /api/weeks/:n is the sheet.
 */

import { api } from '../api.mjs';
import { el, emptyState, int, shortDate, svgIcon } from '../ui.mjs';
import { errorCard, mount, table } from '../render.mjs';

const ICON_PRINT = 'M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8v-7Z';

/** An empty square to tick by hand. */
const tickBox = () => el('span', { class: 'sheet__box', 'aria-hidden': 'true' });

/**
 * A box, the text beside it, and a plain note when the item is already ticked in
 * the database. The words matter more than a colour, because a red or green fill
 * may not survive a monochrome printer.
 */
function boxLine(text, alreadyDone) {
  return el('div', { class: 'row' }, [
    tickBox(),
    el('span', { class: 'grow', text }),
    alreadyDone ? el('span', { class: 'text-xs muted', text: 'already ticked' }) : null,
  ]);
}

/* ---------------------------------------------------------------- controls */

function controls(weeks, current, onPick) {
  const select = el(
    'select',
    { class: 'select', 'aria-label': 'Which week to print' },
    weeks.map((w) =>
      el('option', {
        value: String(w.n),
        text: `Week ${String(w.n).padStart(2, '0')}, ${w.title} (${w.dates_label})`,
        selected: Number(w.n) === Number(current),
      })
    )
  );
  select.addEventListener('change', () => onPick(Number(select.value)));

  const prev = el('button', { type: 'button', class: 'btn btn--sm', text: 'Previous week' });
  const next = el('button', { type: 'button', class: 'btn btn--sm', text: 'Next week' });
  prev.disabled = Number(current) <= 1;
  next.disabled = Number(current) >= weeks.length;
  prev.addEventListener('click', () => onPick(Number(current) - 1));
  next.addEventListener('click', () => onPick(Number(current) + 1));

  const print = el('button', { type: 'button', class: 'btn btn--primary' }, [
    svgIcon(ICON_PRINT),
    'Print this sheet',
  ]);
  print.addEventListener('click', () => window.print());

  const currentWeek = weeks.find((w) => w.is_current);

  // no-print is what removes this whole panel from the paper.
  return el('div', { class: 'card stack-sm no-print' }, [
    el('div', { class: 'row' }, [
      el('label', { class: 'field grow' }, [
        el('span', { class: 'field__label', text: 'Week' }),
        select,
      ]),
    ]),
    el('div', { class: 'row' }, [prev, next, print]),
    el('p', {
      class: 'text-sm muted measure',
      text: currentWeek
        ? `Today falls in week ${currentWeek.n}, ${currentWeek.title}. The sheet prints A4 portrait, one week to a page, and these controls do not print.`
        : 'Today is outside the 21 week window, so week 1 is shown unless you pick another. The sheet prints A4 portrait, one week to a page, and these controls do not print.',
    }),
    el('a', { class: 'btn btn--sm btn--ghost', href: `/weeks/${current}`, text: 'Open this week on screen' }),
  ]);
}

/* ------------------------------------------------------------------- sheet */

function sheetHead(d) {
  const w = d.week;
  return el('div', { class: 'sheet__head' }, [
    el('p', { class: 'card__label', text: d.phase ? `Phase ${d.phase.code}, ${d.phase.name}` : 'Phase unknown' }),
    el('h2', { class: 'sheet__title', text: `Week ${w.n} of 21 | ${w.title}` }),
    el('p', { text: w.dates_label }),
    el('p', {
      class: 'text-sm',
      text: `DSA this week ${int(w.dsa_target)}, cumulative by the end of it ${int(w.dsa_cumulative)}.`,
    }),
    d.gate
      ? el('p', {
          class: 'text-sm',
          text: `Gate ${d.gate.no} falls on ${shortDate(d.gate.gate_date)}: ${d.gate.condition_text}`,
        })
      : null,
  ]);
}

function daysTable(days) {
  if (!days.length) {
    return emptyState('No days on this week', 'The six days come from Part 3 of final.md. Run npm run setup.');
  }
  return table({
    columns: [
      { key: 'day_name', label: 'Day' },
      { key: 'cal_date', label: 'Date', render: (r) => shortDate(r.cal_date) },
      { key: 'dsa_day_target', label: 'DSA', num: true },
      { key: 'learn', label: 'Learn, 09:30 to 12:30', render: (r) => boxLine(r.learn_task, r.learn_done) },
      { key: 'build', label: 'Build, 14:00 to 16:00', render: (r) => boxLine(r.build_task, r.build_done) },
    ],
    rows: days,
    caption: 'Six days. One tick for learn and one for build.',
  });
}

function listBlock(title, rows, emptyBody) {
  return el('div', { class: 'stack-sm' }, [
    el('h3', { text: title }),
    rows.length
      ? el('div', { class: 'stack-sm' }, rows.map((r) => boxLine(r.text, false)))
      : emptyState(`Nothing listed under ${title.toLowerCase()}`, emptyBody),
  ]);
}

function textBlock(title, body, fallback) {
  return el('div', { class: 'stack-sm' }, [
    el('h3', { text: title }),
    el('p', { class: 'measure', text: body ?? fallback }),
  ]);
}

function linksBlock(links) {
  if (!links.length) {
    return el('div', { class: 'stack-sm' }, [
      el('h3', { text: 'Links for this week' }),
      emptyState('No links on this week', 'The 120 week links come from Part 8 of final.md. Run npm run setup.'),
    ]);
  }
  // The full address is printed as text, because a hyperlink is no use on paper.
  return el('div', { class: 'stack-sm' }, [
    el('h3', { text: `Links for this week, ${int(links.length)}` }),
    el(
      'div',
      { class: 'stack-sm' },
      links.map((l) =>
        el('div', { class: 'row' }, [
          tickBox(),
          el('span', { class: 'grow' }, [
            el('span', { text: l.label }),
            el('br'),
            el('span', { class: 'text-xs', text: l.url }),
            l.why ? el('br') : null,
            l.why ? el('span', { class: 'text-xs muted', text: l.why }) : null,
          ]),
          el('span', {
            class: 'text-xs muted',
            text: l.status === 'done' ? 'done' : l.status === 'reading' ? 'reading' : '',
          }),
        ])
      )
    ),
  ]);
}

function sundayBlock(sunday) {
  if (!sunday) {
    return el('div', { class: 'stack-sm' }, [
      el('h3', { text: 'The Sunday' }),
      emptyState('No Sunday on this week', 'The 21 Sundays come from Part 3 of final.md. Run npm run setup.'),
    ]);
  }
  return el('div', { class: 'stack-sm' }, [
    el('h3', { text: `Sunday ${shortDate(sunday.sunday_date)}, ${sunday.type_text}` }),
    el('p', { class: 'measure', text: sunday.topic }),
    sunday.kind === 'rest'
      ? el('p', {
          class: 'text-sm',
          text: 'Rest Sunday. No code. No screens before noon. This is load bearing, and there is nothing on this sheet to tick.',
        })
      : el('p', { class: 'text-sm', text: `${sunday.hours} hours is what this Sunday asks for.` }),
  ]);
}

function handwritingBlock() {
  return el('div', { class: 'stack-sm' }, [
    el('h3', { text: 'What actually happened' }),
    el('p', { class: 'text-sm muted', text: 'Written by hand, then typed into the tracker when the power is back.' }),
    table({
      columns: [
        { key: 'day', label: 'Day' },
        { key: 'solved', label: 'DSA solved', num: true },
        { key: 'pushes', label: 'Pushes', num: true },
        { key: 'what', label: 'What broke, and what shipped' },
      ],
      rows: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => ({
        day,
        solved: '',
        pushes: '',
        what: '',
      })),
    }),
  ]);
}

function sheet(d) {
  const w = d.week;
  return el('div', { class: 'pwwrap' }, [
    el('div', { class: 'sheet stack' }, [
      sheetHead(d),
      textBlock('Focus', w.focus, 'No focus recorded for this week.'),
      daysTable(d.days ?? []),
      listBlock('Learn', d.learn ?? [], 'The learn list comes from Part 3 of final.md.'),
      listBlock('Build', d.build ?? [], 'The build list comes from Part 3 of final.md.'),
      listBlock('Ships at the end of this week', d.ships ?? [], 'The ships list comes from Part 3 of final.md.'),
      textBlock('The trap', d.trap, 'No trap is recorded for this week. That is unusual; check the seed.'),
      textBlock('Note', d.note, 'No note is recorded for this week.'),
      linksBlock(d.links ?? []),
      sundayBlock(d.sunday ?? null),
      handwritingBlock(),
      el('p', {
        class: 'text-xs muted',
        text: `Printed from The Roadmap Tracker. Week ${w.n} of 21, ${w.dates_label}. Nothing on this sheet was written back to the database.`,
      }),
    ]),
  ]);
}

/* -------------------------------------------------------------------- main */

/** Reads ?week=, and keeps it in step with the picker so a reload stays put. */
function wantedWeek() {
  const raw = new URLSearchParams(window.location.search).get('week');
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 21 ? n : null;
}

async function draw(weeks, n) {
  mount('#pw-controls', [controls(weeks, n, (next) => {
    if (next < 1 || next > weeks.length) return;
    const url = new URL(window.location.href);
    url.searchParams.set('week', String(next));
    window.history.replaceState({}, '', url);
    draw(weeks, next);
  })]);

  mount('#pw-sheet', [el('div', { class: 'card' }, [el('p', { class: 'muted', text: `Loading week ${n}.` })])]);
  try {
    const d = await api.get(`/api/weeks/${n}`);
    mount('#pw-sheet', [sheet(d)]);
  } catch (err) {
    mount('#pw-sheet', errorCard(err.message));
  }
}

async function main() {
  try {
    const list = await api.get('/api/weeks');
    const weeks = list.weeks ?? [];
    if (!weeks.length) {
      mount('#pw-controls', [
        emptyState('No weeks to print', 'The 21 weeks come from Part 3 of final.md. Run npm run setup.'),
      ]);
      mount('#pw-sheet', [
        emptyState('Nothing to print', 'There is no week to lay out until the roadmap has been seeded.'),
      ]);
      return;
    }
    const n = wantedWeek() ?? weeks.find((w) => w.is_current)?.n ?? 1;
    await draw(weeks, n);
  } catch (err) {
    mount('#pw-controls', errorCard(err.message));
    mount('#pw-sheet', [
      emptyState(
        'The sheet did not load',
        'Nothing here writes anything, so nothing was lost. Reload once the error above is dealt with.'
      ),
    ]);
  }
}

await main();
