/**
 * week-detail.mjs | one week in full.
 *
 * Focus, the learn list, the build list, the six day table with per day
 * checkboxes, ships, the trap, the note, and every link with a status toggle
 * and an Open and start button.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { clear, debounce, el, int, minutesLabel, qs, svgIcon } from '../ui.mjs';
import { errorCard, meter, mount, section, statGrid, table } from '../render.mjs';
import { openAndStart } from '../timer.mjs';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  ext: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

const n = Number(window.location.pathname.split('/').pop());

function tickBox(checked, disabled, onChange) {
  const box = el('input', { class: 'tick__box', type: 'checkbox', checked, disabled });
  box.addEventListener('change', () => onChange(box.checked, () => { box.checked = !box.checked; }));
  return el('label', { class: 'tick' }, [box, el('span', { class: 'tick__body' })]);
}

function statusBadge(status) {
  return el('span', {
    class: `badge ${status === 'done' ? 'badge--green' : status === 'reading' ? 'badge--blue' : 'badge--outline'}`,
    text: status === 'done' ? 'Done' : status === 'reading' ? 'Reading' : 'Not started',
  });
}

function linkRow(link) {
  const badge = statusBadge(link.status);
  const start = el('button', { type: 'button', class: 'btn btn--sm btn--start' }, [svgIcon(ICON.play), 'Open and start']);
  start.addEventListener('click', async () => {
    start.disabled = true;
    await openAndStart({ url: link.url, block: 'LEARN', resourceId: link.resource_id, weekLinkId: link.id, label: link.label });
    badge.replaceWith(statusBadge('reading'));
    start.disabled = false;
  });
  const mark = (next, text) => {
    const btn = el('button', { type: 'button', class: 'btn btn--sm', text });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.patch(`/api/week-links/${link.id}/progress`, { status: next });
        badge.replaceWith(statusBadge(next));
        toast(`Marked ${next}.`, 'ok');
      } catch (err) {
        toastError(err.message);
      }
      btn.disabled = false;
    });
    return btn;
  };
  return el('div', { class: 'linkrow' }, [
    el('div', { class: 'linkrow__main' }, [
      el('div', { class: 'linkrow__title' }, [
        el('a', { href: link.url, text: link.label, target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' }),
        svgIcon(ICON.ext, 'extlink__icon'),
        badge,
        link.is_alive === false ? el('span', { class: 'badge badge--red', text: 'Link check failed' }) : null,
      ]),
      link.why ? el('p', { class: 'linkrow__why', text: link.why }) : null,
      link.cost ? el('p', { class: 'linkrow__why', text: `Cost: ${link.cost}` }) : null,
    ]),
    el('div', { class: 'linkrow__actions' }, [start, mark('reading', 'Reading'), mark('done', 'Done')]),
  ]);
}

async function main() {
  try {
    const d = await api.get(`/api/weeks/${n}`);
    const w = d.week;

    mount('#wd-head', [
      el('div', { class: 'card' }, [
        el('div', { class: 'between' }, [
          el('div', {}, [
            el('p', { class: 'card__label', text: `Phase ${d.phase.code} ${d.phase.name}` }),
            el('h1', { class: 'page-head__title', text: `Week ${w.n}, ${w.title}` }),
            el('p', { class: 'muted', text: w.dates_label }),
          ]),
          el('div', { class: 'row' }, [
            d.neighbours.prev ? el('a', { class: 'btn btn--sm', href: `/weeks/${d.neighbours.prev}`, text: 'Previous week' }) : null,
            d.neighbours.next ? el('a', { class: 'btn btn--sm', href: `/weeks/${d.neighbours.next}`, text: 'Next week' }) : null,
            el('a', { class: 'btn btn--sm', href: `/print/week?week=${w.n}`, text: 'Print' }),
          ]),
        ]),
        d.gate
          ? el('div', { class: 'callout callout--orange' }, [
              svgIcon('M6 3v18M18 3v18M6 8h12M6 15h12', 'callout__icon'),
              el('div', { class: 'callout__body' }, [
                el('p', { class: 'callout__title', text: `Gate ${d.gate.no}, ${d.gate.gate_date}` }),
                el('p', { text: d.gate.condition_text }),
              ]),
            ])
          : null,
      ]),
      statGrid([
        { value: w.dsa_target, label: 'problems this week' },
        { value: w.dsa_cumulative, label: 'cumulative by the end of it' },
        { value: `${d.days.filter((x) => x.learn_done && x.build_done).length} of 6`, label: 'days finished in full' },
        { value: d.links.length, label: 'links for this week' },
      ]),
      section('Focus', el('p', { class: 'measure', text: w.focus })),
    ]);

    const dayRows = table({
      columns: [
        { key: 'day_name', label: 'Day' },
        { key: 'cal_date', label: 'Date' },
        { key: 'dsa_day_target', label: 'DSA', num: true },
        {
          key: 'learn',
          label: 'Learn, 09:30 to 12:30',
          render: (row) =>
            el('div', { class: 'row' }, [
              tickBox(row.learn_done, !row.editable, async (want, revert) => {
                try {
                  await api.patch(`/api/week-days/${row.id}/progress`, { learn_done: want });
                  toast('Saved.', 'ok');
                } catch (err) {
                  revert();
                  toastError(err.message);
                }
              }),
              el('span', { class: 'grow', text: row.learn_task }),
            ]),
        },
        {
          key: 'build',
          label: 'Build, 14:00 to 16:00',
          render: (row) =>
            el('div', { class: 'row' }, [
              tickBox(row.build_done, !row.editable, async (want, revert) => {
                try {
                  await api.patch(`/api/week-days/${row.id}/progress`, { build_done: want });
                  toast('Saved.', 'ok');
                } catch (err) {
                  revert();
                  toastError(err.message);
                }
              }),
              el('span', { class: 'grow', text: row.build_task }),
            ]),
        },
        {
          key: 'solved',
          label: 'Solved',
          num: true,
          render: (row) => `${row.dsa_solved}/${row.dsa_day_target}`,
        },
      ],
      rows: d.days,
      rowClass: () => 'daytable',
      rowCurrent: (row) => row.cal_date === document.body.dataset.today,
    });

    mount('#wd-body', [
      section('Learn', el('ul', {}, d.learn.map((r) => el('li', { text: r.text })))),
      section('Build', el('ul', {}, d.build.map((r) => el('li', { text: r.text })))),
      section('The six days', dayRows, { lede: 'One tick each for learn and build. Retroactive editing stops after 7 days.' }),
      section('Ships at the end of this week', el('ul', {}, d.ships.map((r) => el('li', { text: r.text })))),
      el('div', { class: 'callout callout--red' }, [
        svgIcon('M12 3 2 20h20L12 3ZM12 9v5M12 17h.01', 'callout__icon'),
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'The trap' }),
          el('p', { text: d.trap ?? '' }),
        ]),
      ]),
      el('div', { class: 'callout callout--blue' }, [
        svgIcon('M12 8h.01M11 12h1v5h1', 'callout__icon'),
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'Note' }),
          el('p', { text: d.note ?? '' }),
        ]),
      ]),
      section(`Links for this week, ${d.links.length}`, el('div', {}, d.links.map(linkRow))),
      d.sunday
        ? section(
            `Sunday ${d.sunday.sunday_date}, ${d.sunday.type_text}`,
            el('p', { class: 'measure', text: d.sunday.topic })
          )
        : null,
    ]);
  } catch (err) {
    mount('#wd-head', errorCard(err.message));
  }
}

await main();
