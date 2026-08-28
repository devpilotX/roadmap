/**
 * today.mjs | the screen that gets opened 150 times.
 *
 * One fetch of /api/today draws everything. Every control writes immediately,
 * optimistically, and rolls back with a toast on failure. No task string is
 * written in this file: every one comes from the database.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import {
  clear,
  dayColourBadge,
  debounce,
  el,
  emptyState,
  int,
  minutesLabel,
  optimistic,
  qs,
  rupees,
  shortDate,
  svgIcon,
} from '../ui.mjs';
import { errorCard, mount } from '../render.mjs';
import { openAndStart, startSession, stopSession, currentSession } from '../timer.mjs';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  plus: 'M12 5v14M5 12h14',
  ext: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  check: 'M4 12l5 5L20 6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l4 2',
  phone: 'M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z',
};

let state = null;

/* ---------------------------------------------------------------- helpers */

function writeDay(patch, { apply, revert }) {
  return optimistic({
    apply,
    revert,
    write: () => api.put(`/api/day-logs/${state.header.date}`, patch),
    onError: (err) => toastError(err.message),
  }).then((data) => {
    if (data?.log) Object.assign(state.day_log, data.log);
    if (data?.colour) paintColour(data.colour);
    return data;
  });
}

function paintColour(colour) {
  const host = qs('#t-colour');
  clear(host).appendChild(dayColourBadge(colour.colour ?? colour));
  const count = qs('#t-conditions-count');
  if (colour.met !== undefined && colour.total) {
    count.textContent = `${colour.met} of ${colour.total} met. All ${colour.total}, or the day is not green.`;
  }
}

function minutesField(block, label, current, target) {
  const input = el('input', {
    class: 'input input--sm input--num',
    type: 'number',
    min: '0',
    max: '1440',
    value: String(current ?? 0),
    'aria-label': `${label} minutes logged`,
  });
  const hint = el('span', {
    class: 'text-xs muted',
    text: target ? `of ${target} minutes` : 'minutes',
  });
  input.addEventListener(
    'change',
    debounce(() => {
      const value = Math.max(0, Math.min(1440, Number(input.value) || 0));
      input.value = String(value);
      const field = block === 'LEARN' ? 'learn_minutes' : block === 'BUILD' ? 'build_minutes' : block === 'DSA' ? 'dsa_minutes' : 'money_minutes';
      writeDay({ [field]: value }, { apply: () => {}, revert: () => { input.value = String(current ?? 0); } });
    }, 350)
  );
  return el('div', { class: 'row-tight' }, [input, hint]);
}

function doneToggle(labelText, checked, onChange, { disabled = false, reason = '' } = {}) {
  const box = el('input', { class: 'tick__box', type: 'checkbox', checked, disabled });
  const label = el('label', { class: 'tick' }, [
    box,
    el('span', { class: 'tick__body' }, [
      el('span', { class: 'tick__text', text: labelText }),
      disabled && reason ? el('span', { class: 'tick__meta', text: reason }) : null,
    ]),
  ]);
  box.addEventListener('change', () => {
    const want = box.checked;
    onChange(want, () => {
      box.checked = !want;
    });
  });
  return label;
}

function linkRow(link, block) {
  const status = el('span', {
    class: `badge ${link.status === 'done' ? 'badge--green' : link.status === 'reading' ? 'badge--blue' : 'badge--outline'}`,
    text: link.status === 'done' ? 'Done' : link.status === 'reading' ? 'Reading' : 'Not started',
  });
  const health =
    link.is_alive === false
      ? el('span', { class: 'badge badge--red', text: 'Link check failed' })
      : null;

  const start = el('button', { type: 'button', class: 'btn btn--sm btn--start' }, [
    svgIcon(ICON.play),
    'Open and start',
  ]);
  start.addEventListener('click', async () => {
    start.disabled = true;
    await openAndStart({
      url: link.url,
      block,
      resourceId: link.resource_id ?? null,
      weekLinkId: link.id ?? null,
      label: link.label,
    });
    link.status = 'reading';
    status.textContent = 'Reading';
    status.className = 'badge badge--blue';
    start.disabled = false;
  });

  const mark = (next, text) => {
    const btn = el('button', { type: 'button', class: 'btn btn--sm', text });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const path = link.id
          ? `/api/week-links/${link.id}/progress`
          : `/api/resources/${link.resource_id}/progress`;
        await api.patch(path, { status: next });
        link.status = next;
        status.textContent = next === 'done' ? 'Done' : 'Reading';
        status.className = next === 'done' ? 'badge badge--green' : 'badge badge--blue';
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
        el('a', { href: link.url, text: link.label, 'data-ext': '1', target: '_blank', rel: 'noopener noreferrer' }),
        svgIcon(ICON.ext, 'extlink__icon'),
        status,
        link.cost ? el('span', { class: 'badge badge--outline', text: link.cost }) : null,
        health,
      ]),
      link.why ? el('p', { class: 'linkrow__why', text: link.why }) : null,
    ]),
    el('div', { class: 'linkrow__actions' }, [start, mark('reading', 'Reading'), mark('done', 'Done')]),
  ]);
}

/**
 * The links for a block. Open in the now card, collapsed in a compact card, so
 * every link on this screen is always one or two clicks away.
 */
function linksBlock(b, { open, title }) {
  if (!b.links?.length) return null;
  const list = el('div', {}, b.links.map((l) => linkRow(l, b.code)));
  const note = b.links_note ? el('p', { class: 'text-xs muted', text: b.links_note }) : null;
  if (open) {
    return el('div', { class: 'card__foot' }, [
      el('p', { class: 'card__label', text: `${title}, ${b.links.length}` }),
      note,
      list,
    ]);
  }
  return el('details', { class: 'acc linkacc' }, [
    el('summary', { class: 'acc__summary' }, [
      svgIcon(ICON.play, 'btn__icon'),
      `${title}, ${b.links.length}`,
    ]),
    el('div', { class: 'acc__body' }, [note, list]),
  ]);
}

/* ------------------------------------------------------------ block cards */

function dsaCard(b, big) {
  const solvedValue = el('span', { class: 'stat__value stat__value--lg', text: int(b.solved_today) });
  const plus = el('button', { type: 'button', class: 'btn btn--primary' }, [svgIcon(ICON.plus), 'Solved one more']);
  plus.addEventListener('click', async () => {
    plus.disabled = true;
    const before = b.solved_today;
    try {
      if (b.problems_imported && b.next_problem) {
        await api.patch(`/api/dsa/problems/${b.next_problem.id}/progress`, { status: 'solved' });
      } else {
        await api.put(`/api/day-logs/${state.header.date}`, { dsa_increment: 1 });
      }
      b.solved_today = before + 1;
      solvedValue.textContent = int(b.solved_today);
      await refresh();
    } catch (err) {
      toastError(err.message);
    }
    plus.disabled = false;
  });

  const children = [
    el('p', { class: 'card__label', text: `DSA  ${b.window}` }),
    el('div', { class: 'row bigrow' }, [
      el('div', { class: 'stat' }, [
        solvedValue,
        el('span', {
          class: 'stat__label',
          text: b.target_is_zero ? 'solved today, no target set for today' : `of ${b.target} today`,
        }),
      ]),
      el('div', { class: 'stat' }, [
        el('span', { class: 'stat__value', text: int(b.cumulative) }),
        el('span', {
          class: 'stat__label',
          text: b.cumulative_target
            ? `of ${int(b.cumulative_target)} planned by the end of this week`
            : 'solved of 474 on the sheet',
        }),
      ]),
    ]),
    el('p', { class: big ? 'tasktext tasktext--big' : 'tasktext', text: b.task ?? '' }),
    b.target_note ? el('p', { class: 'text-xs muted', text: b.target_note }) : null,
  ];

  if (big) {
    children.push(el('div', { class: 'row' }, [plus, minutesField('DSA', 'DSA', b.minutes, null)]));
    if (b.next_problem) {
      const open = el('button', { type: 'button', class: 'btn btn--start' }, [svgIcon(ICON.play), 'Open and start']);
      open.addEventListener('click', () =>
        openAndStart({
          url: b.next_problem.url || 'https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z',
          block: 'DSA',
          label: b.next_problem.name,
        })
      );
      children.push(
        el('div', { class: 'card__foot' }, [
          el('p', { class: 'card__label', text: 'Next unsolved, in topic order' }),
          el('div', { class: 'between' }, [
            el('div', {}, [
              el('strong', { text: b.next_problem.name }),
              el('p', { class: 'text-sm muted', text: `${b.next_problem.topic}, ${b.next_problem.difficulty}` }),
            ]),
            open,
          ]),
        ])
      );
    } else if (!b.problems_imported) {
      children.push(
        el('div', { class: 'callout callout--blue' }, [
          svgIcon('M12 8h.01M11 12h1v5h1', 'callout__icon'),
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'Problem level import is pending' }),
            el('p', {
              text:
                'final.md does not contain the 474 problem names and this app never invents one. Open the sheet below, solve, then count the day here. Import a real export to get per problem ticks.',
            }),
            el('a', { class: 'btn btn--sm', href: '/dsa', text: 'Open the DSA tracker' }),
          ]),
        ])
      );
    }
    children.push(linksBlock(b, { open: true, title: 'The DSA links from Part 7' }));
  } else {
    children.push(linksBlock(b, { open: false, title: 'The DSA links from Part 7' }));
  }
  return children;
}

function learnCard(b, big) {
  const children = [
    el('p', { class: 'card__label', text: `Learn  ${b.window}` }),
    el('p', { class: big ? 'tasktext tasktext--big' : 'tasktext', text: b.task ?? 'No learn task today.' }),
  ];
  if (big) {
    children.push(
      doneToggle(
        `Learn done, ${b.minutes_target} minutes`,
        b.done,
        (want, revert) => {
          if (!b.week_day_id) {
            writeDay({ learn_done: want }, { apply: () => {}, revert });
            return;
          }
          optimistic({
            apply: () => {},
            revert,
            write: () => api.patch(`/api/week-days/${b.week_day_id}/progress`, { learn_done: want }),
            onError: (err) => toastError(err.message),
          }).then((d) => d?.colour && paintColour(d.colour));
        }
      ),
      el('div', { class: 'row' }, [minutesField('LEARN', 'Learn', b.minutes, b.minutes_target)]),
      videoField(b)
    );
    children.push(
      linksBlock(b, {
        open: true,
        title: b.links_are_early ? `Week ${b.links_week} links, ready early` : "This week's links",
      })
    );
  } else {
    children.push(
      linksBlock(b, {
        open: false,
        title: b.links_are_early ? `Week ${b.links_week} links` : "This week's links",
      })
    );
  }
  return children;
}

function videoField(b) {
  const input = el('input', {
    class: 'input input--sm input--num',
    type: 'number',
    min: '0',
    max: '600',
    value: String(b.video_minutes ?? 0),
    'aria-label': 'Video minutes today',
  });
  const warn = el('span', { class: 'text-xs', text: '' });
  const paint = () => {
    const v = Number(input.value) || 0;
    warn.textContent =
      v > b.video_cap ? `${v - b.video_cap} minutes over the cap. This came out of LEARN, it was not added on top.` : `Cap ${b.video_cap} minutes a day, taken from inside this block.`;
    warn.className = v > b.video_cap ? 'text-xs' : 'text-xs muted';
  };
  paint();
  input.addEventListener(
    'change',
    debounce(() => {
      const v = Math.max(0, Number(input.value) || 0);
      input.value = String(v);
      paint();
      writeDay({ video_minutes: v }, { apply: () => {}, revert: () => {} });
    }, 350)
  );
  return el('div', { class: 'row-tight videorow' }, [
    el('span', { class: 'text-sm', text: 'Video minutes' }),
    input,
    warn,
  ]);
}

function buildCard(b, big) {
  const children = [
    el('p', { class: 'card__label', text: `Build  ${b.window}` }),
    el('p', { class: big ? 'tasktext tasktext--big' : 'tasktext', text: b.task ?? 'No build task today.' }),
  ];
  if (big) {
    children.push(
      doneToggle(
        `Build done, ${b.minutes_target} minutes, at least one push`,
        b.done,
        (want, revert) => {
          if (!b.week_day_id) {
            writeDay({ build_done: want }, { apply: () => {}, revert });
            return;
          }
          optimistic({
            apply: () => {},
            revert,
            write: () => api.patch(`/api/week-days/${b.week_day_id}/progress`, { build_done: want }),
            onError: (err) => toastError(err.message),
          }).then((d) => d?.colour && paintColour(d.colour));
        }
      ),
      el('div', { class: 'row' }, [
        minutesField('BUILD', 'Build', b.minutes, b.minutes_target),
        el('span', {
          class: b.pushes_today > 0 ? 'badge badge--green' : 'badge badge--red',
          text: `${b.pushes_today} ${b.pushes_today === 1 ? 'commit' : 'commits'} pushed today`,
        }),
      ])
    );
    if (b.project) {
      const startBtn = el('button', { type: 'button', class: 'btn btn--start' }, [svgIcon(ICON.play), 'Start a build session']);
      startBtn.addEventListener('click', () => startSession({ block: 'BUILD', label: b.project.name }));
      children.push(
        el('div', { class: 'card__foot' }, [
          el('p', { class: 'card__label', text: 'The active project' }),
          el('div', { class: 'between' }, [
            el('div', {}, [
              el('strong', { text: `${b.project.code}  ${b.project.name}` }),
              el('p', { class: 'text-sm muted', text: `Repository ${b.project.repo}` }),
              b.project.live_url
                ? el('a', {
                    href: b.project.live_url,
                    text: b.project.live_url,
                    'data-ext': '1',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                    class: 'text-sm',
                  })
                : el('p', { class: 'text-sm muted', text: 'No live URL recorded yet. Deployed means a stranger opens the link and it works.' }),
            ]),
            startBtn,
          ]),
        ])
      );
    }
  }
  return children;
}

function closeCard(b, big) {
  const children = [
    el('p', { class: 'card__label', text: `Close  ${b.window}` }),
    el('p', { class: 'tasktext', text: b.task }),
  ];
  if (!big) return children;

  const mk = (id, label, value, field, placeholder) => {
    const input = el(field === 'close_log_line' ? 'textarea' : 'input', {
      class: field === 'close_log_line' ? 'textarea' : 'input',
      id,
      value,
      placeholder,
    });
    if (field === 'close_log_line') input.value = value ?? '';
    input.addEventListener(
      'change',
      debounce(() => {
        writeDay({ [field]: input.value }, { apply: () => {}, revert: () => { input.value = value ?? ''; } }).then(
          () => refresh()
        );
      }, 400)
    );
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: id, text: label }),
      input,
    ]);
  };

  children.push(
    mk('close-log', 'One log line for today', b.log_line, 'close_log_line', 'What shipped, what blocked.'),
    mk('close-dsa', "Tomorrow's first DSA problem", b.tomorrow_dsa, 'close_tomorrow_dsa', 'Name the problem.'),
    mk('close-build', "Tomorrow's first build task", b.tomorrow_build, 'close_tomorrow_build', 'Name the task.'),
    doneToggle(
      'Close done',
      b.done,
      (want, revert) => writeDay({ close_done: want }, { apply: () => {}, revert }).catch(() => {}),
      {
        disabled: !b.can_complete && !b.done,
        reason: 'All three fields are needed. Tomorrow is decided before you stand up.',
      }
    )
  );
  return children;
}

function moneyCard(b, big) {
  const children = [
    el('p', { class: 'card__label', text: `Money hour  ${b.window}` }),
    el('p', { class: big ? 'tasktext tasktext--big' : 'tasktext', text: b.task ?? 'No money task today.' }),
    el('div', { class: 'row bigrow' }, [
      el('div', { class: 'stat' }, [
        el('span', {
          class: `stat__value ${b.touches_today >= b.touch_target && b.touch_target > 0 ? '' : ''}`,
          text: int(b.touches_today),
        }),
        el('span', { class: 'stat__label', text: b.touch_target ? `of ${b.touch_target} touches today` : 'touches today' }),
      ]),
      el('div', { class: 'stat' }, [
        el('span', { class: 'stat__value', text: rupees(b.received_this_week) }),
        el('span', { class: 'stat__label', text: 'received this week' }),
      ]),
    ]),
  ];
  if (!big) return children;

  children.push(
    doneToggle('Money task done', b.done, (want, revert) =>
      writeDay({ money_done: want }, { apply: () => {}, revert }).catch(() => {})
    ),
    el('div', { class: 'row' }, [minutesField('MONEY', 'Money', b.minutes, 60)])
  );

  if (b.next_leads?.length) {
    const list = el('div', { class: 'stack-sm' });
    for (const lead of b.next_leads) {
      const btn = el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: 'Log a touch' });
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await api.post(`/api/leads/${lead.id}/touch`, { channel: 'whatsapp' });
          toast(`Touch logged for ${lead.name}.`, 'ok');
          refresh();
        } catch (err) {
          toastError(err.message);
          btn.disabled = false;
        }
      });
      list.appendChild(
        el('div', { class: 'linkrow' }, [
          el('div', { class: 'linkrow__main' }, [
            el('div', { class: 'linkrow__title' }, [
              el('span', { text: lead.name }),
              lead.mobile_broken ? el('span', { class: 'badge badge--orange', text: 'Broken on mobile' }) : null,
            ]),
            el('p', {
              class: 'linkrow__why',
              text: [lead.category, lead.area, lead.rating ? `${lead.rating} stars` : null, lead.reviews ? `${lead.reviews} reviews` : null]
                .filter(Boolean)
                .join(', '),
            }),
          ]),
          el('div', { class: 'linkrow__actions' }, [
            lead.phone
              ? el('a', { class: 'btn btn--sm', href: `tel:${lead.phone}`, text: 'Call' })
              : null,
            lead.phone
              ? el('a', {
                  class: 'btn btn--sm',
                  href: `https://wa.me/${String(lead.phone).replace(/\D/g, '')}`,
                  text: 'WhatsApp',
                  'data-ext': '1',
                  target: '_blank',
                  rel: 'noopener noreferrer',
                })
              : null,
            btn,
          ]),
        ])
      );
    }
    children.push(
      el('div', { class: 'card__foot' }, [
        el('p', { class: 'card__label', text: `The next ${b.next_leads.length} due` }),
        list,
        el('a', { class: 'btn btn--sm', href: '/money', text: 'Open the money hour' }),
      ])
    );
  } else {
    children.push(
      el('div', { class: 'card__foot' }, [
        emptyState(
          'There are no leads on the list yet',
          'Part 17.13 says the first ten minutes are for filling 30 rows from Google Maps. Open the money hour and add them, or import a leads.csv.'
        ),
        el('a', { class: 'btn btn--sm', href: '/money', text: 'Open the money hour' }),
      ])
    );
  }
  return children;
}

function nightCard(b, big) {
  const children = [
    el('p', { class: 'card__label', text: `Night recall  ${b.window}` }),
    el('p', { class: 'tasktext', text: b.task }),
  ];
  if (!big) return children;

  const overdue = el('input', {
    class: 'input input--sm input--num',
    type: 'number',
    min: '0',
    max: '9999',
    value: String(b.anki_overdue ?? 0),
    'aria-label': 'Anki cards overdue',
  });
  overdue.addEventListener(
    'change',
    debounce(() => {
      const v = Math.max(0, Number(overdue.value) || 0);
      overdue.value = String(v);
      writeDay({ anki_overdue: v, night_anki_done: v === 0 }, { apply: () => {}, revert: () => {} }).then(() => refresh());
    }, 350)
  );

  const aloud = el('input', { class: 'tick__box', type: 'checkbox', checked: b.spoken_aloud });
  aloud.addEventListener('change', () => {
    writeDay({ night_spoken_aloud: aloud.checked }, { apply: () => {}, revert: () => { aloud.checked = !aloud.checked; } });
  });

  children.push(
    doneToggle('Anki at zero overdue', b.anki_done, (want, revert) =>
      writeDay({ night_anki_done: want }, { apply: () => {}, revert }).catch(() => {})
    ),
    el('div', { class: 'row-tight' }, [el('span', { class: 'text-sm', text: 'Cards overdue' }), overdue]),
    doneToggle('Spoken explanation done', b.spoken_done, (want, revert) =>
      writeDay({ night_spoken_done: want }, { apply: () => {}, revert }).catch(() => {})
    ),
    el('label', { class: 'tick' }, [
      aloud,
      el('span', { class: 'tick__body' }, [
        el('span', { class: 'tick__text', text: 'Spoken aloud, not read' }),
        el('span', { class: 'tick__meta', text: 'Four nights of six must be spoken, not read.' }),
      ]),
    ]),
    doneToggle('Tomorrow decided', b.tomorrow_done, (want, revert) =>
      writeDay({ night_tomorrow_done: want }, { apply: () => {}, revert }).catch(() => {})
    )
  );
  return children;
}

function breakCard(b) {
  return [
    el('p', { class: 'card__label', text: `Break  ${b.window}` }),
    el('p', { class: 'tasktext', text: b.task }),
  ];
}

const RENDERERS = {
  DSA: dsaCard,
  LEARN: learnCard,
  BUILD: buildCard,
  CLOSE: closeCard,
  BREAK: breakCard,
  MONEY: moneyCard,
  NIGHT: nightCard,
};

function blockCard(b, big) {
  const render = RENDERERS[b.code];
  const children = render(b, big);
  const classes = ['card'];
  if (big) classes.push('card--now');
  else if (b.is_past && b.tracked && !b.done) classes.push('card--missed');
  else if (b.done) classes.push('card--done');
  const card = el('div', { class: classes.join(' ') }, children.filter(Boolean));
  if (!big) {
    const jump = el('span', {
      class: 'badge badge--outline',
      text: b.is_past ? 'Earlier today' : b.is_future ? 'Later today' : 'Now',
    });
    card.insertBefore(jump, card.firstChild);
  }
  return card;
}

/* ------------------------------------------------------------- rest Sunday */

/**
 * Shown on any day inside the 150 day window that falls before the day this
 * person actually starts.
 *
 * The window itself cannot move: final.md fixes all 150 dates and the four gate
 * dates, and the seed verifier enforces them. The start date can, and a day
 * before it is neutral rather than red, so the tracker does not open with a
 * failure that was never possible to avoid.
 */
function notStartedCard(h) {
  const days = Number(h.days_until_start ?? 0);
  return el('div', { class: 'card card--rest card--pad-lg' }, [
    el('p', { class: 'card__label', text: h.day_label ? `${h.day_label}, day ${h.day_number} of ${h.total_days}` : 'Before the start' }),
    el('h2', { class: 'resttitle', text: days === 1 ? 'Starts tomorrow' : `Starts in ${days} days` }),
    el('p', { class: 'restbody', text: h.start_note ?? '' }),
    el('p', {
      class: 'muted measure',
      text:
        'Today is neutral. It does not break a streak, it is not a red day, and no warning is raised about it. ' +
        'The 150 day window and the four gate dates come from final.md and do not move, so the days before your start ' +
        'simply do not count against you.',
    }),
    el('div', { class: 'row' }, [
      el('a', { class: 'btn btn--ghost btn--sm', href: '/profile', text: 'Change the start date' }),
      el('a', { class: 'btn btn--ghost btn--sm', href: '/weeks', text: 'Read what week 1 asks for' }),
      el('a', { class: 'btn btn--ghost btn--sm', href: '/library', text: 'Open the library' }),
    ]),
    el('p', {
      class: 'text-xs muted',
      text: 'Nothing stops you starting early. Tick anything you do and the day is scored like any other.',
    }),
  ]);
}

function restSundayCard(data) {
  const notes = el('textarea', {
    class: 'textarea',
    id: 'rest-notes',
    value: data.day_log.notes ?? '',
    placeholder: 'A note, if you want one. Nothing else is tickable today.',
  });
  notes.value = data.day_log.notes ?? '';
  notes.addEventListener(
    'change',
    debounce(() => {
      api.put(`/api/day-logs/${data.header.date}`, { notes: notes.value }).catch((err) => toastError(err.message));
    }, 500)
  );
  return el('div', { class: 'card card--rest card--pad-lg' }, [
    el('p', { class: 'card__label', text: `Week ${data.sunday.week_n} Sunday` }),
    el('h2', { class: 'resttitle', text: 'Rest' }),
    el('p', { class: 'restbody', text: data.sunday.topic }),
    el('p', {
      class: 'muted measure',
      text:
        'The money hour is also rest today. No outreach, no delivery. A rest Sunday never breaks a streak and never counts as a green day. It is simply neutral.',
    }),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'rest-notes', text: 'Note' }),
      notes,
    ]),
  ]);
}

function gateSundayCard(data) {
  const gate = data.gate;
  const evidence = el('input', {
    class: 'input',
    id: 'gate-evidence',
    type: 'url',
    placeholder: 'https://the live URL a stranger can open',
    value: gate.result?.evidence_url ?? '',
  });
  const box = el('input', {
    class: 'tick__box',
    type: 'checkbox',
    checked: Number(gate.result?.passed ?? 0) === 1,
  });
  box.addEventListener('change', async () => {
    const want = box.checked;
    try {
      await api.patch(`/api/gates/${gate.no}/result`, { passed: want, evidence_url: evidence.value || null });
      toast(want ? `Gate ${gate.no} marked passed.` : `Gate ${gate.no} unmarked.`, 'ok');
      refresh();
    } catch (err) {
      box.checked = !want;
      toastError(err.message);
    }
  });
  return el('div', { class: 'card card--now' }, [
    el('p', { class: 'card__label', text: `Gate audit Sunday, ${data.sunday.type_text}` }),
    el('h2', { class: 'gatetitle', text: `Gate ${gate.no}` }),
    el('p', { class: 'tasktext tasktext--big', text: gate.condition_text }),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'gate-evidence', text: 'Evidence URL' }),
      evidence,
      el('p', {
        class: 'field__hint',
        text: 'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.',
      }),
    ]),
    el('label', { class: 'tick' }, [box, el('span', { class: 'tick__body' }, [el('span', { class: 'tick__text', text: `Gate ${gate.no} passed` })])]),
    el('p', { class: 'muted text-sm', text: data.sunday.topic }),
  ]);
}

/* ------------------------------------------------------------------ render */

function render(data) {
  state = data;
  const h = data.header;

  qs('#t-date').textContent = h.date_long;
  qs('#t-week').textContent = h.week
    ? `Week ${h.week.n}, ${h.week.dates_label}. ${h.week.title}`
    : h.in_roadmap
      ? 'Launch block. Three days before Week 1 starts on Monday 31 August.'
      : 'Outside the 150 day window.';

  qs('#t-day-number').textContent = h.day_number ? int(h.day_number) : '-';
  qs('#t-week-n').textContent = h.week ? `W${String(h.week.n).padStart(2, '0')}` : 'Launch';
  qs('#t-phase').textContent = h.phase ? `Phase ${h.phase.code} ${h.phase.name}` : 'Before Week 1';
  qs('#t-gate-days').textContent = h.next_gate ? int(h.next_gate.days_remaining) : '-';
  qs('#t-gate-label').textContent = h.next_gate
    ? `to Gate ${h.next_gate.no}, ${shortDate(h.next_gate.gate_date)}`
    : 'no gate left';
  qs('#t-end-days').textContent = int(h.days_to_end);
  qs('#t-streak').textContent = int(h.streak);
  const dsaBlock = data.blocks.find((b) => b.code === 'DSA');
  qs('#t-dsa-total').textContent = int(dsaBlock?.cumulative ?? 0);
  qs('#t-dsa-label').textContent = `problems solved of ${int(data.header.week?.dsa_cumulative ?? 415)} planned by this week`;

  // Rest Sunday replaces the whole screen, and so does a day before the start
  // date, because on neither is there anything to tick.
  const override = qs('#t-override');
  clear(override);
  if (h.not_started_yet) {
    override.hidden = false;
    override.appendChild(notStartedCard(h));
    qs('#t-main').hidden = true;
  } else if (data.day?.kind === 'sunday_rest') {
    override.hidden = false;
    override.appendChild(restSundayCard(data));
    qs('#t-main').hidden = true;
  } else {
    override.hidden = true;
    qs('#t-main').hidden = false;
  }

  const before = clear(qs('#t-before'));
  const now = clear(qs('#t-now'));
  const after = clear(qs('#t-after'));

  if (data.day?.kind !== 'sunday_rest') {
    const isGateSunday = data.day?.kind === 'sunday_gate' && data.gate;
    if (isGateSunday) {
      now.appendChild(gateSundayCard(data));
    }

    const current = data.blocks.find((b) => b.is_current);
    for (const b of data.blocks) {
      if (data.day?.kind?.startsWith('sunday_') && ['BUILD', 'CLOSE'].includes(b.code)) continue;
      if (!isGateSunday && b === current) {
        now.appendChild(blockCard(b, true));
      } else if (b.is_past) {
        before.appendChild(blockCard(b, false));
      } else {
        after.appendChild(blockCard(b, false));
      }
    }

    // Outside every window the now card shows the next block and a countdown.
    if (!current && !isGateSunday) {
      const next = data.blocks.find((b) => b.code === data.clock.next_block);
      now.appendChild(
        el('div', { class: 'card card--now' }, [
          el('p', { class: 'card__label', text: `It is ${data.clock.time}. No block is open.` }),
          next
            ? el('div', { class: 'stack-sm' }, [
                el('div', { class: 'stat' }, [
                  el('span', { class: 'stat__value stat__value--lg', text: data.clock.countdown ?? '' }),
                  el('span', { class: 'stat__label', text: `until ${next.label}, ${next.window}` }),
                ]),
                el('p', { class: 'tasktext', text: next.task ?? '' }),
              ])
            : el('div', { class: 'stack-sm' }, [
                el('p', { text: 'Every block for today is behind you. The day ends at 16:30 whether or not it went well.' }),
                el('a', { class: 'btn', href: '/calendar', text: 'Look at tomorrow' }),
              ]),
        ])
      );
    }
  }

  /* ---- right rail ---- */
  paintColour({ colour: data.conditions.colour, met: data.conditions.met, total: data.conditions.total });
  const cond = clear(qs('#t-conditions'));
  if (!data.conditions.list.length) {
    cond.appendChild(el('li', { class: 'muted text-sm', text: 'A rest Sunday has no conditions. It is neutral.' }));
  }
  for (const c of data.conditions.list) {
    cond.appendChild(
      el('li', { class: `cond ${c.met ? 'cond--met' : 'cond--unmet'}` }, [
        svgIcon(c.met ? ICON.check : 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'cond__icon'),
        el('div', {}, [
          el('span', { class: 'cond__label', text: c.label }),
          el('span', { class: 'cond__detail', text: c.detail }),
        ]),
      ])
    );
  }

  const failedCard = qs('#t-failed-card');
  const failed = clear(qs('#t-failed'));
  if (data.failed_twice.length) {
    failedCard.hidden = false;
    qs('#t-failed-count').textContent = String(data.failed_twice.length);
    for (const p of data.failed_twice) {
      failed.appendChild(
        el('li', { class: 'cond cond--unmet' }, [
          svgIcon('M12 3 2 20h20L12 3ZM12 9v5M12 17h.01', 'cond__icon'),
          el('div', {}, [
            el('span', { class: 'cond__label', text: p.name }),
            el('span', { class: 'cond__detail', text: `${p.topic}, ${p.difficulty}` }),
          ]),
        ])
      );
    }
  } else {
    failedCard.hidden = true;
  }

  const warnCard = qs('#t-warnings-card');
  const warn = clear(qs('#t-warnings'));
  if (data.warnings.length) {
    warnCard.hidden = false;
    for (const w of data.warnings) {
      warn.appendChild(
        el('div', { class: `callout ${w.level === 'red' ? 'callout--red' : 'callout--orange'}` }, [
          svgIcon('M12 3 2 20h20L12 3ZM12 9v5M12 17h.01', 'callout__icon'),
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: `${w.code}  ${w.title}` }),
            el('p', { class: 'text-sm', text: w.message }),
          ]),
        ])
      );
    }
  } else {
    warnCard.hidden = true;
  }

  const y = data.yesterday;
  qs('#t-yesterday').textContent = y.exists
    ? y.line || 'No log line was written yesterday.'
    : `Nothing was logged on ${y.date}. Missed days stay visible. The pattern of misses is the most useful data you will collect.`;
  const yc = clear(qs('#t-yesterday-colour'));
  if (y.colour) yc.appendChild(dayColourBadge(y.colour));
}

/* ------------------------------------------------------------------ start */

let everRendered = false;

async function refresh() {
  try {
    render(await api.get('/api/today'));
    everRendered = true;
  } catch (err) {
    // A later refresh failing is a toast, because the screen still holds the last
    // good draw. The first one failing is not: without this the whole page would
    // sit on "Loading" with no explanation, which is the one thing a tracker
    // opened 150 times must never do.
    if (everRendered) {
      toastError(`Today could not refresh: ${err.message}`);
      return;
    }
    mount('#t-now', errorCard(err.message));
    for (const id of ['#t-before', '#t-after', '#t-conditions', '#t-warnings']) mount(id, []);
    const strip = qs('#t-strip');
    if (strip) strip.hidden = true;
  }
}

/**
 * Live tracking.
 *
 * The block windows are known on the client, so the countdown ticks every ten
 * seconds without a request. A refetch only happens when the block that owns the
 * current minute actually changes, or every five minutes as a floor, so the
 * screen is never stale and the server is never hammered.
 */
const WINDOWS = [
  ['DSA', 390, 540],
  ['LEARN', 570, 750],
  ['BUILD', 840, 960],
  ['CLOSE', 960, 990],
  ['BREAK', 990, 1020],
  ['MONEY', 1020, 1080],
  ['NIGHT', 1260, 1440],
];

function localMinutes() {
  // The server clock decides what writes. This is only used to notice that a
  // boundary has passed and a refetch is worth making.
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.getHours() * 60 + ist.getMinutes();
}

function blockAt(minutes) {
  const hit = WINDOWS.find(([, s, e]) => minutes >= s && minutes < e);
  return hit ? hit[0] : null;
}

let lastBlock = null;
let lastFetch = Date.now();

function tick() {
  if (!state) return;
  const minutes = localMinutes();
  const nowBlock = blockAt(minutes);

  // The countdown, updated without a request.
  if (!nowBlock) {
    const upcoming = WINDOWS.filter(([, s]) => s > minutes).sort((a, b) => a[1] - b[1])[0];
    const label = qs('#t-now .stat__value--lg');
    if (label && upcoming) {
      const left = upcoming[1] - minutes;
      label.textContent = left < 60 ? `${left} m` : `${Math.floor(left / 60)} h ${left % 60} m`;
    }
  }

  const boundaryCrossed = lastBlock !== null && nowBlock !== lastBlock;
  const stale = Date.now() - lastFetch > 5 * 60 * 1000;
  lastBlock = nowBlock;
  if (boundaryCrossed || stale) {
    lastFetch = Date.now();
    refresh();
  }
}

document.addEventListener('timer:stopped', () => refresh());
document.addEventListener('queue:flushed', () => refresh());
window.addEventListener('focus', () => {
  lastFetch = Date.now();
  refresh();
});
window.setInterval(tick, 10000);

await refresh();
lastBlock = blockAt(localMinutes());
lastFetch = Date.now();
