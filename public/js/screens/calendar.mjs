/**
 * calendar.mjs | the calendar, the day drawer, and Open and start.
 *
 * Month grid, Monday first, six study columns plus a distinct Sunday column.
 * Clicking a cell opens a right side drawer, never a new page.
 * Keyboard: left and right move a day, t jumps to today, Esc closes the drawer.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import {
  addDays,
  clear,
  debounce,
  el,
  emptyState,
  int,
  longDate,
  minutesLabel,
  qs,
  shortDate,
  svgIcon,
  weekdayOf,
} from '../ui.mjs';
import { chipFilter, loadingCard, mount, errorCard } from '../render.mjs';
import { openAndStart } from '../timer.mjs';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  push: 'M12 19V5M5 12l7-7 7 7',
  ext: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The six tracked blocks, with the windows exactly as the table in final.md Part 1
 * states them and the start minute BLOCKS in src/lib/dates.mjs carries. The start
 * minute matters because a manual row is filed at the start of its own block: that
 * is how the server derives started_at, so it is also the time the window rules
 * have to be checked against here.
 */
const TRACKED_BLOCKS = [
  { code: 'DSA', label: 'DSA, 06:30 to 09:00', start: 6 * 60 + 30 },
  { code: 'LEARN', label: 'Learn, 09:30 to 12:30', start: 9 * 60 + 30 },
  { code: 'BUILD', label: 'Build, 14:00 to 16:00', start: 14 * 60 },
  { code: 'CLOSE', label: 'Close, 16:00 to 16:30', start: 16 * 60 },
  { code: 'MONEY', label: 'Money hour, 17:00 to 18:00', start: 17 * 60 },
  { code: 'NIGHT', label: 'Night recall, after 21:00', start: 21 * 60 },
];

let data = null;
let view = 'month';
let focusDate = null;
let openDate = null;

/* ---------------------------------------------------------------- toolbar */

function toolbar() {
  const views = chipFilter(
    [
      { value: 'month', label: 'Month' },
      { value: 'week', label: 'Week strip' },
      { value: 'day', label: 'Single day' },
    ],
    view,
    async (v) => {
      view = v;
      drawGrid();
      try {
        await api.patch('/api/me/settings', { calendar_view: v });
      } catch {
        // Remembering the view is a convenience, not a requirement.
      }
    }
  );

  const today = el('button', { type: 'button', class: 'btn btn--sm', text: 'Today' });
  today.addEventListener('click', () => {
    focusDate = data.today;
    drawGrid();
    openDrawer(data.today);
  });

  const ics = el('a', {
    class: 'btn btn--sm',
    href: '/api/calendar.ics',
    text: 'Subscribe on your phone',
    download: 'roadmap-2026-2027.ics',
  });

  const print = el('button', { type: 'button', class: 'btn btn--sm', text: 'Print' });
  print.addEventListener('click', () => window.print());

  return el('div', { class: 'card' }, [
    el('div', { class: 'between' }, [
      views,
      el('div', { class: 'row' }, [today, ics, print]),
    ]),
    el('p', { class: 'text-xs muted' }, [
      'Keyboard: ',
      el('kbd', { text: 'left' }),
      ' and ',
      el('kbd', { text: 'right' }),
      ' move a day, ',
      el('kbd', { text: 't' }),
      ' jumps to today, ',
      el('kbd', { text: 'Esc' }),
      ' closes the drawer.',
    ]),
  ]);
}

/* ------------------------------------------------------------------- cells */

function cellFor(day) {
  const classes = ['calcell'];
  if (day.kind.startsWith('sunday_')) classes.push('calcell--sunday');
  if (day.kind === 'sunday_rest') classes.push('calcell--rest');
  if (day.kind === 'sunday_gate') classes.push('calcell--gate');
  if (day.kind === 'launch') classes.push('calcell--launch');
  if (day.cal_date === data.today) classes.push('calcell--today');
  if (day.cal_date > data.today) classes.push('calcell--future');

  const dot = el('span', {
    class: `calcell__dot calcell__dot--${day.day_colour ?? 'todo'}`,
    'aria-hidden': 'true',
  });

  const week = data.weeks.find((w) => w.n === day.week_n);
  const label =
    day.kind === 'launch'
      ? 'Launch'
      : day.kind === 'sunday_rest'
        ? 'Rest'
        : day.kind === 'sunday_gate'
          ? `Gate ${week?.gate_no ?? ''}`
          : day.kind === 'sunday_working'
            ? 'Working'
            : '';

  const cell = el(
    'button',
    {
      type: 'button',
      class: classes.join(' '),
      'data-date': day.cal_date,
      'aria-label': `${longDate(day.cal_date)}. ${label || 'Study day'}. DSA target ${day.dsa_target}, solved ${day.dsa_solved}. ${day.day_colour ?? 'not logged'}.`,
    },
    [
      el('span', { class: 'calcell__top' }, [
        el('span', { class: 'calcell__date', text: String(Number(day.cal_date.slice(8, 10))) }),
        el('span', { class: 'calcell__week', text: day.week_n ? `W${String(day.week_n).padStart(2, '0')}` : 'LNC' }),
      ]),
      el('span', { class: 'calcell__mid', text: label }),
      el('span', { class: 'calcell__bottom' }, [
        dot,
        day.pushes ? svgIcon(ICON.push, 'calcell__push') : null,
        el('span', { class: 'calcell__dsa', text: `${day.dsa_solved}/${day.dsa_target}` }),
      ]),
    ]
  );
  cell.addEventListener('click', () => openDrawer(day.cal_date));
  return cell;
}

function monthGrid() {
  const byMonth = new Map();
  for (const d of data.days) {
    const key = d.cal_date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key).push(d);
  }
  const out = [];
  for (const [key, days] of byMonth) {
    const [y, m] = key.split('-').map(Number);
    const grid = el('div', { class: 'calgrid' });
    DAY_HEADS.forEach((h, i) => {
      grid.appendChild(
        el('div', { class: `calgrid__head ${i === 6 ? 'calgrid__head--sunday' : ''}`, text: h })
      );
    });
    const firstIdx = (new Date(`${days[0].cal_date}T00:00:00Z`).getUTCDay() + 6) % 7;
    for (let i = 0; i < firstIdx; i += 1) grid.appendChild(el('div', { class: 'calcell calcell--empty' }));
    for (const d of days) grid.appendChild(cellFor(d));
    out.push(
      el('div', { class: 'calmonth' }, [
        el('h2', { class: 'calmonth__title', text: `${MONTHS[m - 1]} ${y}` }),
        grid,
      ])
    );
  }
  return out;
}

function weekStrip() {
  const anchor = focusDate ?? data.today;
  const day = data.days.find((d) => d.cal_date === anchor) ?? data.days[0];
  const week = data.weeks.find((w) => w.n === day.week_n);
  const from = week ? week.start_date : anchor;
  const to = week ? week.end_date : anchor;
  const days = data.days.filter((d) => d.cal_date >= from && d.cal_date <= to);
  const grid = el('div', { class: 'weekstrip' });
  for (const d of days) grid.appendChild(cellFor(d));
  return [
    el('h2', { class: 'calmonth__title', text: week ? `Week ${week.n}, ${week.dates_label}` : 'Launch block' }),
    week ? el('p', { class: 'muted', text: week.title }) : null,
    grid,
  ];
}

function dayView() {
  const anchor = focusDate ?? data.today;
  const day = data.days.find((d) => d.cal_date === anchor);
  if (!day) return [emptyState('That day is outside the roadmap', 'The window runs 28 August 2026 to 24 January 2027.')];
  const grid = el('div', { class: 'weekstrip dayview' }, [cellFor(day)]);
  return [el('h2', { class: 'calmonth__title', text: longDate(anchor) }), grid];
}

function drawGrid() {
  const nodes = view === 'month' ? monthGrid() : view === 'week' ? weekStrip() : dayView();
  mount('#c-grid', nodes);
}

/* ------------------------------------------------------------------ drawer */

function statusBadge(status) {
  return el('span', {
    class: `badge ${status === 'done' ? 'badge--green' : status === 'reading' ? 'badge--blue' : 'badge--outline'}`,
    text: status === 'done' ? 'Done' : status === 'reading' ? 'Reading' : 'Not started',
  });
}

function drawerLink(link, block) {
  const badge = statusBadge(link.status);
  const health = link.is_alive === false ? el('span', { class: 'badge badge--red', text: 'Link check failed' }) : null;

  const start = el('button', { type: 'button', class: 'btn btn--sm btn--start' }, [svgIcon(ICON.play), 'Open and start']);
  start.addEventListener('click', async () => {
    start.disabled = true;
    await openAndStart({ url: link.url, block, resourceId: link.resource_id, weekLinkId: link.id, label: link.label });
    link.status = 'reading';
    badge.replaceWith(statusBadge('reading'));
    start.disabled = false;
  });

  const mark = (next, text) => {
    const btn = el('button', { type: 'button', class: 'btn btn--sm', text });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.patch(`/api/week-links/${link.id}/progress`, { status: next });
        link.status = next;
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
        health,
      ]),
      link.why ? el('p', { class: 'linkrow__why', text: link.why }) : null,
    ]),
    el('div', { class: 'linkrow__actions' }, [start, mark('reading', 'Reading'), mark('done', 'Done')]),
  ]);
}

function drawerSection(title, children) {
  return el('div', { class: 'drawer__section' }, [el('h3', { text: title }), ...[].concat(children).filter(Boolean)]);
}

/**
 * The two window rules blockAllowedAt applies in src/lib/dates.mjs, repeated here
 * so the form can quote the roadmap rather than let the server refuse the write
 * with no explanation. The server checks as well, and a database trigger checks
 * after that; this only gets there first. The MONEY wording is final.md Part 17.1
 * rule 1, quoted rather than paraphrased.
 */
function blockAllowedAt(code, minutes) {
  if (code === 'MONEY' && minutes < 16 * 60 + 30) {
    return {
      ok: false,
      message:
        'The money hour never borrows from study. If client work overruns, the client waits two days. The roadmap does not wait one hour.',
    };
  }
  if (['DSA', 'LEARN', 'BUILD', 'CLOSE'].includes(code) && minutes >= 17 * 60 && minutes < 18 * 60) {
    return {
      ok: false,
      message: 'A study block cannot be logged inside the money hour, 17:00 to 18:00.',
    };
  }
  return { ok: true, message: null };
}

/**
 * Manual session entry, which src/routes/api/daily.mjs calls the fallback that
 * always exists. The timer is the normal way minutes get logged, but a timer
 * nobody started leaves the day at zero with no way to correct it, and this is
 * that way. It lives in the drawer because the drawer already knows its date, so
 * session_date is implied rather than typed, and the date is the one field a
 * person filing yesterday's hour would get wrong.
 *
 * @param {string} date the drawer's own date, sent as session_date
 * @param {object} d the /api/calendar/:date payload, for editable and its reason
 */
function manualSessionForm(date, d) {
  const block = el(
    'select',
    { class: 'select', 'aria-label': 'Which block these minutes belong to' },
    TRACKED_BLOCKS.map((b) => el('option', { value: b.code, text: b.label }))
  );

  // The bounds are the ones manualBody enforces, min(1) and max(600).
  const minutes = el('input', {
    class: 'input input--num',
    type: 'number',
    min: '1',
    max: '600',
    step: '1',
    inputmode: 'numeric',
    'aria-label': 'Minutes, 1 to 600',
  });

  // note is optionalText(255) on the server, so 255 is the real limit, not a guess.
  const note = el('input', { class: 'input', type: 'text', maxlength: '255', 'aria-label': 'Note, optional' });

  // Present and empty by default: .field__error reserves a line, so the panel does
  // not jump when a refusal appears.
  const error = el('p', { class: 'field__error', 'aria-live': 'polite' });

  const save = el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: 'Log these minutes' });

  const refuse = (message) => {
    error.textContent = message;
    toast(message, 'warn');
  };

  save.addEventListener('click', async () => {
    error.textContent = '';

    // The seven day limit, as the server itself computed it for this date. Part
    // 18.7 rule 3: retroactive editing is limited to 7 days, history is not
    // rewritten, and a day cannot be logged before it happens. editable_reason is
    // the server's own sentence, so the two never disagree.
    if (!d.editable) {
      refuse(d.editable_reason ?? 'Retroactive editing is limited to 7 days. History is not rewritten.');
      return;
    }

    const chosen = TRACKED_BLOCKS.find((b) => b.code === block.value);
    const allowed = blockAllowedAt(block.value, chosen ? chosen.start : 0);
    if (!allowed.ok) {
      refuse(allowed.message);
      return;
    }

    const mins = Number(minutes.value);
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) {
      refuse('Minutes must be a whole number from 1 to 600.');
      return;
    }

    save.disabled = true;
    try {
      const created = await api.post('/api/sessions/manual', {
        block: block.value,
        session_date: date,
        minutes: mins,
        note: note.value.trim() || null,
      });
      // What the server actually stored, not what was typed, so a clamp or a trim
      // is visible rather than hidden.
      toast(
        `Logged ${minutesLabel(created.minutes)} of ${created.block} on ${shortDate(created.session_date)}.`,
        'ok'
      );
      // Nothing here was drawn ahead of the write, so the refresh is the first time
      // the new minutes appear anywhere. The whole drawer is rebuilt, which also
      // updates the DSA count and the cell's day colour.
      await refresh({ keepDrawer: true });
    } catch (err) {
      // No optimistic change was applied, so there is nothing to revert: the drawer
      // still shows only the minutes the server holds.
      error.textContent = err.message;
      toastError(err.message);
      save.disabled = false;
    }
  });

  return el('details', { class: 'acc' }, [
    el('summary', { class: 'acc__summary', text: 'Log time you forgot to start the timer for' }),
    el('div', { class: 'acc__body stack-sm' }, [
      el('p', { class: 'text-xs muted', text: `Filed against ${longDate(date)}, the day this drawer is showing.` }),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Block' }), block]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: 'Minutes' }),
        minutes,
        el('span', { class: 'field__hint', text: 'A whole number from 1 to 600.' }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: 'Note, optional' }),
        note,
        el('span', { class: 'field__hint', text: 'Up to 255 characters, stored with the session.' }),
      ]),
      // Both rules stated before the button rather than after the refusal, because
      // the point is that the roadmap explains itself. Wording as above: Part 17.1
      // rule 1 for the first, and the money hour window for the second.
      el('div', { class: 'callout callout--orange' }, [
        svgIcon('M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'callout__icon'),
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'Two rules this form will not let you break' }),
          el('p', {
            text: 'The money hour never borrows from study. If client work overruns, the client waits two days. The roadmap does not wait one hour.',
          }),
          el('p', { text: 'A study block cannot be logged inside the money hour, 17:00 to 18:00.' }),
          el('p', { text: 'Retroactive editing is limited to 7 days. History is not rewritten.' }),
        ]),
      ]),
      error,
      el('div', { class: 'row' }, [save]),
      !d.editable ? el('p', { class: 'text-xs muted', text: d.editable_reason ?? '' }) : null,
    ]),
  ]);
}

async function openDrawer(date) {
  openDate = date;
  focusDate = date;
  const drawer = qs('#c-drawer');
  const scrim = qs('#c-scrim');
  const body = qs('#c-drawer-body');
  drawer.dataset.open = '1';
  scrim.dataset.open = '1';
  qs('#c-drawer-title').textContent = longDate(date);
  qs('#c-drawer-sub').textContent = 'Loading';
  clear(body).appendChild(loadingCard());
  drawer.focus();

  try {
    const d = await api.get(`/api/calendar/${date}`);
    qs('#c-drawer-sub').textContent = d.week
      ? `Week ${d.week.n}, ${d.week.dates_label}. ${d.week.title}`
      : 'Launch block';

    const nodes = [];

    if (d.day.kind === 'sunday_rest') {
      nodes.push(
        el('div', { class: 'callout' }, [
          svgIcon('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'callout__icon'),
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'Rest Sunday' }),
            el('p', { text: d.day.learn_task }),
            el('p', { text: d.day.money_task }),
          ]),
        ])
      );
    } else {
      nodes.push(drawerSection('Learn, 09:30 to 12:30', el('p', { class: 'measure', text: d.day.learn_task })));
      nodes.push(drawerSection('Build, 14:00 to 16:00', el('p', { class: 'measure', text: d.day.build_task })));
    }
    nodes.push(drawerSection('Money, 17:00 to 18:00', el('p', { class: 'measure', text: d.day.money_task })));

    nodes.push(
      drawerSection(
        'DSA',
        el('div', { class: 'row bigrow' }, [
          el('div', { class: 'stat' }, [
            el('span', { class: 'stat__value', text: int(d.log?.dsa_solved ?? 0) }),
            el('span', { class: 'stat__label', text: `of ${d.day.dsa_target} target` }),
          ]),
          el('div', { class: 'stat' }, [
            el('span', { class: 'stat__value', text: minutesLabel(d.log?.dsa_minutes ?? 0) }),
            el('span', { class: 'stat__label', text: 'logged' }),
          ]),
        ])
      )
    );

    if (d.week_day) {
      const learn = el('input', {
        class: 'tick__box',
        type: 'checkbox',
        checked: Number(d.week_day.learn_done) === 1,
        disabled: !d.editable,
      });
      const build = el('input', {
        class: 'tick__box',
        type: 'checkbox',
        checked: Number(d.week_day.build_done) === 1,
        disabled: !d.editable,
      });
      const wire = (box, field) => {
        box.addEventListener('change', async () => {
          const want = box.checked;
          try {
            await api.patch(`/api/week-days/${d.week_day.id}/progress`, { [field]: want });
            toast('Saved.', 'ok');
            await refresh({ keepDrawer: true });
          } catch (err) {
            box.checked = !want;
            toastError(err.message);
          }
        });
      };
      wire(learn, 'learn_done');
      wire(build, 'build_done');
      nodes.push(
        drawerSection('The two ticks for this day', [
          el('label', { class: 'tick' }, [learn, el('span', { class: 'tick__body' }, [el('span', { class: 'tick__text', text: 'Learn done' })])]),
          el('label', { class: 'tick' }, [build, el('span', { class: 'tick__body' }, [el('span', { class: 'tick__text', text: 'Build done' })])]),
          !d.editable ? el('p', { class: 'text-xs muted', text: d.editable_reason ?? '' }) : null,
        ])
      );
    }

    if (d.links.length) {
      nodes.push(
        drawerSection(
          `Every link for week ${d.week?.n ?? ''}, ${d.links.length}`,
          el('div', {}, d.links.map((l) => drawerLink(l, 'LEARN')))
        )
      );
    }

    // The log line, blockers and notes, editable inside the 7 day window.
    const mk = (id, label, value, field, tag = 'input') => {
      const input = el(tag, {
        class: tag === 'textarea' ? 'textarea' : 'input',
        id,
        value: value ?? '',
        disabled: !d.editable,
      });
      if (tag === 'textarea') input.value = value ?? '';
      input.addEventListener(
        'change',
        debounce(async () => {
          try {
            await api.put(`/api/day-logs/${date}`, { [field]: input.value });
            toast('Saved.', 'ok');
          } catch (err) {
            toastError(err.message);
          }
        }, 400)
      );
      return el('div', { class: 'field' }, [el('label', { class: 'field__label', for: id, text: label }), input]);
    };
    nodes.push(
      drawerSection('The log for this day', [
        mk('dr-log', 'Log line', d.log?.close_log_line, 'close_log_line', 'textarea'),
        mk('dr-blocked', 'Blocked on', d.log?.blocked_on, 'blocked_on'),
        mk('dr-notes', 'Notes', d.log?.notes, 'notes', 'textarea'),
        !d.editable
          ? el('div', { class: 'callout callout--orange' }, [
              svgIcon('M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'callout__icon'),
              el('div', { class: 'callout__body' }, [el('p', { text: d.editable_reason ?? '' })]),
            ])
          : null,
      ])
    );

    nodes.push(
      drawerSection(
        'Pushes on this date',
        d.pushes.length
          ? el(
              'div',
              {},
              d.pushes.map((p) =>
                el('div', { class: 'linkrow' }, [
                  el('div', { class: 'linkrow__main' }, [
                    el('div', { class: 'linkrow__title' }, [
                      el('span', { text: p.repo }),
                      Number(p.counts_to_target) === 1
                        ? null
                        : el('span', { class: 'badge badge--outline', text: 'Client, does not count' }),
                    ]),
                    el('p', { class: 'linkrow__why', text: p.message_head ?? '' }),
                  ]),
                  el('div', { class: 'linkrow__actions' }, [
                    el('span', { class: 'badge badge--green', text: `${p.commit_count} commits` }),
                  ]),
                ])
              )
            )
          : el('p', { class: 'muted text-sm', text: 'No push on this date.' })
      )
    );

    nodes.push(
      drawerSection(
        'Sessions',
        [
          d.sessions.length
            ? el(
                'div',
                {},
                d.sessions.map((s) =>
                  el('div', { class: 'linkrow' }, [
                    el('div', { class: 'linkrow__main' }, [
                      el('div', { class: 'linkrow__title' }, [
                        el('span', { text: s.block }),
                        Number(s.auto_closed) === 1
                          ? el('span', { class: 'badge badge--orange', text: 'Auto closed at the end of the block' })
                          : null,
                        s.source === 'manual' ? el('span', { class: 'badge badge--outline', text: 'Manual' }) : null,
                      ]),
                      el('p', { class: 'linkrow__why', text: `${s.started_at} to ${s.ended_at ?? 'still running'}` }),
                    ]),
                    el('div', { class: 'linkrow__actions' }, [
                      el('span', { class: 'badge', text: minutesLabel(s.minutes) }),
                    ]),
                  ])
                )
              )
            : emptyState(
                'No session on this date',
                'Nothing was timed on this day. If you worked and forgot to start the timer, log the minutes with the form below.'
              ),
          // Directly under the list it corrects, so the empty state above can point
          // straight at it.
          manualSessionForm(date, d),
        ]
      )
    );

    clear(body);
    for (const n of nodes.filter(Boolean)) body.appendChild(n);
  } catch (err) {
    clear(body).appendChild(errorCard(err.message));
  }
}

function closeDrawer() {
  qs('#c-drawer').dataset.open = '0';
  qs('#c-scrim').dataset.open = '0';
  openDate = null;
}

/* --------------------------------------------------------------- keyboard */

function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'Escape') {
      closeDrawer();
      return;
    }
    if (e.key === 't' || e.key === 'T') {
      focusDate = data.today;
      drawGrid();
      openDrawer(data.today);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const step = e.key === 'ArrowRight' ? 1 : -1;
      const from = focusDate ?? data.today;
      const to = addDays(from, step);
      if (!data.days.some((d) => d.cal_date === to)) return;
      e.preventDefault();
      focusDate = to;
      drawGrid();
      if (openDate) openDrawer(to);
      qs(`.calcell[data-date="${to}"]`)?.scrollIntoView({ block: 'nearest' });
    }
  });
}

/* ------------------------------------------------------------------- start */

async function refresh({ keepDrawer = false } = {}) {
  try {
    data = await api.get('/api/calendar');
    focusDate = focusDate ?? data.today;
    mount('#c-toolbar', toolbar());
    drawGrid();
    mount('#c-foot', [
      el('div', { class: 'card' }, [
        el('p', { class: 'card__label', text: 'How to read this' }),
        el('ul', {}, [
          el('li', { text: 'Six study columns plus a distinct Sunday column, Monday first.' }),
          el('li', { text: 'A dashed cell is a rest Sunday. An outlined cell is a gate audit Sunday. A blue cell is a launch day.' }),
          el('li', { text: 'The dot is the day colour. The arrow means there was a push. The fraction is solved of target.' }),
          el('li', { text: 'Today keeps a permanent ring. Future days stay readable, not greyed out.' }),
        ]),
      ]),
    ]);
    if (keepDrawer && openDate) await openDrawer(openDate);
  } catch (err) {
    mount('#c-grid', errorCard(err.message));
  }
}

qs('#c-drawer-close')?.addEventListener('click', closeDrawer);
qs('#c-scrim')?.addEventListener('click', closeDrawer);
initKeyboard();

await refresh();

// A date can be linked to directly, which is what the command palette does.
const wanted = new URLSearchParams(window.location.search).get('date');
if (wanted && data?.days.some((d) => d.cal_date === wanted)) {
  focusDate = wanted;
  drawGrid();
  openDrawer(wanted);
}
