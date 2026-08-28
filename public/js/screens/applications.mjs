/**
 * applications.mjs | Part 13, the application pipeline.
 *
 * Two numbers matter on this screen and both are shown at once. Gate 4 asks for
 * one hundred applications, which is the floor. The realistic total to a single
 * offer is 200 to 400, which is the target. Showing only the first number is how
 * people stop at one hundred and wonder why nothing landed.
 *
 * The board is the status enum from the applications table, in order, so a row
 * can only ever be in a state the database allows. A card can be dragged, and it
 * also carries a select, because a board that only works with a mouse is a board
 * half the time unusable.
 *
 * Mocks and writeups sit at the bottom of the same screen. They are the two
 * things that turn a sent application into a reply, and they have their own
 * targets from the API rather than any figure written here.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, int, optimistic, pct, shortDate } from '../ui.mjs';
import { errorCard, meter, mount, section, statGrid, table } from '../render.mjs';

/** The status enum, in pipeline order. Nothing outside this list can be set. */
const STATUSES = [
  { key: 'applied', label: 'Applied', tone: 'badge--outline' },
  { key: 'screen', label: 'Screen', tone: 'badge--blue' },
  { key: 'tech', label: 'Tech', tone: 'badge--blue' },
  { key: 'onsite', label: 'Onsite', tone: 'badge--orange' },
  { key: 'offer', label: 'Offer', tone: 'badge--green' },
  { key: 'rejected', label: 'Rejected', tone: 'badge--red' },
  { key: 'ghosted', label: 'Ghosted', tone: 'badge--outline' },
];

const MOCK_KINDS = [
  { value: 'coding', label: 'Coding' },
  { value: 'system_design', label: 'System design' },
  { value: 'case_study', label: 'Case study' },
  { value: 'rag_design', label: 'RAG design' },
  { value: 'behavioural', label: 'Behavioural' },
];

const statusMeta = (key) => STATUSES.find((s) => s.key === key) ?? STATUSES[0];

const kindLabel = (value) => MOCK_KINDS.find((k) => k.value === value)?.label ?? value;

/* ------------------------------------------------------------------ banners */

function banners(d) {
  const out = [];

  if (d.red_banner) {
    out.push(
      el('div', { class: 'callout callout--red' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'Applications should already be going out' }),
          el('p', { class: 'measure', text: d.red_banner }),
        ]),
      ])
    );
  }

  if (!d.applications_open) {
    out.push(
      el('div', { class: 'callout callout--blue' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'The pipeline is not open yet' }),
          el('p', {
            class: 'measure',
            text: 'Part 13 opens applications at Gate 3 on 13 December 2026, not at Gate 4. Rows added before then are fine to keep as research, but the count that matters starts at Gate 3.',
          }),
        ]),
      ])
    );
  }

  if (d.funnel.total >= d.gate4.target && d.funnel.total < d.realistic.low) {
    out.push(
      el('div', { class: 'callout callout--orange' }, [
        el('div', { class: 'callout__body' }, [
          el('p', {
            class: 'callout__title',
            text: `${int(d.funnel.total)} sent. The Gate 4 condition is met and the job is not done.`,
          }),
          el('p', {
            class: 'measure',
            text: `One hundred was the floor. ${int(d.realistic.low - d.funnel.total)} more takes you to ${int(d.realistic.low)}, which is the bottom of the realistic range.`,
          }),
        ]),
      ])
    );
  }

  return out.length
    ? out
    : [el('p', { class: 'text-sm muted', text: 'No application warnings.' })];
}

/* ------------------------------------------------------------------ counter */

function counter(d) {
  const g = d.gate4;
  const r = d.realistic;

  const funnelRows = STATUSES.map((s) => {
    const n = d.funnel.by_status[s.key] ?? 0;
    return el('div', { class: 'funnelbar__row' }, [
      el('span', { text: s.label }),
      meter(pct(n, d.funnel.total), s.key === 'offer' && n ? 'green' : ''),
      el('span', { class: 'num', text: int(n) }),
    ]);
  });

  return [
    statGrid([
      {
        value: `${int(g.sent)} of ${int(g.target)}`,
        label: 'sent against the Gate 4 condition, which is the floor',
        tone: g.sent >= g.target ? 'green' : g.sent ? 'orange' : 'red',
        hero: true,
        sub: g.remaining ? `${int(g.remaining)} left to clear the floor` : 'the floor is cleared',
      },
      {
        value: `${int(r.low)} to ${int(r.high)}`,
        label: 'the realistic total to one offer, which is the target',
        sub: `${r.percent_of_low}% of the way to ${int(r.low)}`,
      },
      {
        value: `${d.funnel.interview_rate}%`,
        label: 'reached a screen or further',
        sub: `${int(d.funnel.interviews)} of ${int(d.funnel.total)}`,
        tone: d.funnel.interviews ? 'blue' : '',
      },
      {
        value: `${d.funnel.referral_rate}%`,
        label: 'went in with a referral',
        sub: `${int(d.funnel.referrals)} of ${int(d.funnel.total)}, and ${int(d.funnel.offers)} offers so far`,
      },
    ]),
    el('div', { class: 'card stack-sm' }, [
      el('p', { class: 'card__label', text: 'Both numbers, side by side' }),
      el('div', { class: 'appcounter' }, [
        el('span', { class: 'appcounter__value', text: int(g.sent) }),
        el('span', {
          class: 'text-sm muted',
          text: `applications sent. ${int(g.target)} passes Gate 4. ${int(r.low)} to ${int(r.high)} is what actually produces an offer.`,
        }),
        meter(g.percent, g.percent === 100 ? 'green' : ''),
        el('span', { class: 'text-xs muted', text: `${g.percent}% of the Gate 4 floor of ${int(g.target)}` }),
        meter(r.percent_of_low, r.percent_of_low === 100 ? 'green' : ''),
        el('span', { class: 'text-xs muted', text: `${r.percent_of_low}% of ${int(r.low)}, the bottom of the realistic range` }),
      ]),
      el('p', { class: 'text-sm muted measure', text: r.note }),
    ]),
    el('div', { class: 'card stack-sm' }, [
      el('p', { class: 'card__label', text: 'Where they are' }),
      d.funnel.total
        ? el('div', { class: 'funnelbar' }, funnelRows)
        : emptyState(
            'Nothing has been sent yet',
            'Add the first application below. The funnel fills itself from the board.'
          ),
    ]),
  ];
}

/* -------------------------------------------------------------------- board */

function recount(board) {
  for (const col of board.querySelectorAll('.kancol')) {
    const n = col.querySelector('.kancol__list').children.length;
    col.querySelector('.kancol__count').textContent = String(n);
  }
}

function appCard(a, boardEl, onGone, movers) {
  const meta = statusMeta(a.status);

  const badge = el('span', { class: `badge ${meta.tone}`, text: meta.label });

  const select = el(
    'select',
    { class: 'select select--sm', 'aria-label': `Status of ${a.company}` },
    STATUSES.map((s) => el('option', { value: s.key, text: s.label, selected: s.key === a.status }))
  );

  const card = el('article', {
    class: 'kancard',
    draggable: true,
    'data-id': String(a.id),
    'data-status': a.status,
  }, [
    el('p', { class: 'kancard__title', text: a.company }),
    el('p', { class: 'kancard__meta', text: a.role_title }),
    el('p', { class: 'kancard__meta' }, [
      `Applied ${shortDate(a.applied_on)}`,
      a.last_update ? ` · updated ${shortDate(a.last_update)}` : '',
    ]),
    el('div', { class: 'row' }, [
      badge,
      a.role_code ? el('span', { class: 'badge badge--outline', text: a.role_code }) : null,
      Number(a.referral) === 1 ? el('span', { class: 'badge badge--green', text: 'Referral' }) : null,
    ]),
    a.source ? el('p', { class: 'kancard__meta', text: `Via ${a.source}` }) : null,
    a.salary_offered ? el('p', { class: 'kancard__meta', text: `Offered ${a.salary_offered}` }) : null,
    a.notes ? el('p', { class: 'kancard__meta', text: a.notes }) : null,
  ]);

  /** Repaints the two places the status is visible after a move. */
  function paint(status) {
    const m = statusMeta(status);
    badge.textContent = m.label;
    badge.className = `badge ${m.tone}`;
    select.value = status;
  }

  async function moveTo(status) {
    const from = card.dataset.status;
    if (status === from) return;
    const home = card.parentNode;
    const after = card.nextSibling;
    const target = boardEl.querySelector(`.kancol[data-status="${status}"] .kancol__list`);
    if (!target) return;

    try {
      await optimistic({
        apply: () => {
          target.appendChild(card);
          card.dataset.status = status;
          paint(status);
          recount(boardEl);
        },
        revert: () => {
          home.insertBefore(card, after);
          card.dataset.status = from;
          paint(from);
          recount(boardEl);
        },
        write: () => api.patch(`/api/applications/${a.id}`, { status }),
        onError: (err) => toastError(err.message),
      });
      a.status = status;
      toast(`${a.company} moved to ${statusMeta(status).label}.`);
    } catch {
      // optimistic() has already put the card back and shown the reason.
    }
  }

  select.addEventListener('change', () => moveTo(select.value));

  const remove = el('button', { type: 'button', class: 'btn btn--sm btn--ghost', text: 'Delete' });
  remove.addEventListener('click', async () => {
    if (!window.confirm(`Delete the ${a.company} application? It is soft deleted and can be restored from the API.`)) {
      return;
    }
    remove.disabled = true;
    try {
      await api.del(`/api/applications/${a.id}`);
      card.remove();
      movers.delete(String(a.id));
      recount(boardEl);
      onGone();
      toast(`${a.company} deleted.`);
    } catch (err) {
      toastError(err.message);
      remove.disabled = false;
    }
  });

  card.appendChild(el('div', { class: 'row' }, [select, remove]));
  if (a.jd_url) {
    card.appendChild(
      el('a', {
        class: 'text-xs',
        href: a.jd_url,
        text: 'The job description',
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-ext': '1',
      })
    );
  }

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', String(a.id));
    e.dataTransfer.effectAllowed = 'move';
    card.dataset.dragging = '1';
  });
  card.addEventListener('dragend', () => {
    delete card.dataset.dragging;
  });

  // The move handler is kept in a map keyed by row id rather than hung off the
  // element, so a drop only ever reaches a card this screen actually built.
  movers.set(String(a.id), moveTo);
  return card;
}

function board(d, onChange) {
  const wrap = el('div', { class: 'kanban' });
  const movers = new Map();

  for (const s of STATUSES) {
    const list = el('div', { class: 'kancol__list' });
    const col = el('div', { class: 'kancol', 'data-status': s.key }, [
      el('div', { class: 'kancol__head' }, [
        el('span', { class: 'kancol__title', text: s.label }),
        el('span', { class: 'kancol__count', text: '0' }),
      ]),
      list,
    ]);

    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.dataset.dragover = '1';
    });
    col.addEventListener('dragleave', () => {
      delete col.dataset.dragover;
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      delete col.dataset.dragover;
      const move = movers.get(e.dataTransfer.getData('text/plain'));
      if (move) move(s.key);
    });

    wrap.appendChild(col);
  }

  for (const a of d.applications) {
    const col = wrap.querySelector(`.kancol[data-status="${a.status}"] .kancol__list`);
    if (col) col.appendChild(appCard(a, wrap, onChange, movers));
  }
  recount(wrap);

  return [
    section(
      'The board',
      [
        d.applications.length
          ? wrap
          : emptyState(
              'The board is empty',
              'Every column is a value of the status column in the database. Add an application above and it appears under Applied.'
            ),
        el('p', {
          class: 'text-xs muted',
          text: 'Drag a card between columns, or use the select on the card. Changing the status also stamps the last update date.',
        }),
      ],
      { lede: 'Seven columns, because those are the seven statuses the database accepts.' }
    ),
  ];
}

/* --------------------------------------------------------------- add a form */

function field(label, control, hint) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field__label', text: label }),
    control,
    hint ? el('span', { class: 'field__hint', text: hint }) : null,
  ]);
}

function addForm(d, onDone) {
  const company = el('input', { class: 'input', type: 'text', maxLength: 200, required: true, placeholder: 'The company' });
  const title = el('input', { class: 'input', type: 'text', maxLength: 200, required: true, placeholder: 'The title on the advert' });
  const roleCode = el(
    'select',
    { class: 'select', 'aria-label': 'Which of the roles this is' },
    [el('option', { value: '', text: 'No role code' })].concat(
      d.roles.map((r) => el('option', { value: r.code, text: `${r.code}  ${r.name}` }))
    )
  );
  const source = el('input', { class: 'input', type: 'text', maxLength: 120, placeholder: 'Naukri, referral, careers page' });
  const appliedOn = el('input', { class: 'input', type: 'date', value: d.today, required: true });
  const status = el(
    'select',
    { class: 'select', 'aria-label': 'Starting status' },
    STATUSES.map((s) => el('option', { value: s.key, text: s.label, selected: s.key === 'applied' }))
  );
  const referral = el('input', { class: 'tick__box', type: 'checkbox' });
  const salary = el('input', { class: 'input', type: 'text', maxLength: 120, placeholder: 'What was quoted, if anything' });
  const jd = el('input', { class: 'input', type: 'url', maxLength: 500, placeholder: 'https://the-advert' });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'Who it went to, what you sent.' });

  const submit = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Add the application' });

  const form = el('form', { class: 'stack-sm' }, [
    el('div', { class: 'grid grid--3' }, [
      field('Company', company),
      field('Role title', title),
      field('Role code', roleCode, 'One of the sixteen roles, if it maps to one.'),
    ]),
    el('div', { class: 'grid grid--3' }, [
      field('Source', source),
      field('Applied on', appliedOn),
      field('Status', status),
    ]),
    el('div', { class: 'grid grid--3' }, [
      field('Salary quoted', salary),
      field('Job description URL', jd),
      el('label', { class: 'tick' }, [
        referral,
        el('span', { class: 'tick__body' }, [
          el('span', { class: 'tick__text', text: 'Went in with a referral' }),
          el('span', { class: 'tick__meta', text: 'A referral is the single largest change to a reply rate.' }),
        ]),
      ]),
    ]),
    field('Notes', notes),
    el('div', { class: 'between' }, [
      submit,
      el('span', { class: 'text-xs muted', text: 'Company, role title and the date are the only required fields.' }),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!company.value.trim() || !title.value.trim() || !appliedOn.value) {
      toastError('Company, role title and the date applied are all needed.');
      return;
    }
    submit.disabled = true;
    try {
      await api.post('/api/applications', {
        company: company.value.trim(),
        role_title: title.value.trim(),
        role_code: roleCode.value || null,
        source: source.value.trim() || null,
        applied_on: appliedOn.value,
        status: status.value,
        referral: referral.checked,
        salary_offered: salary.value.trim() || null,
        jd_url: jd.value.trim() || null,
        notes: notes.value.trim() || null,
      });
      toast(`${company.value.trim()} added.`);
      await onDone();
    } catch (err) {
      toastError(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  return [section('Add an application', [form], { lede: 'One row per application. The count on this screen is only as honest as this form.' })];
}

/* -------------------------------------------------------- mocks and writeups */

function mockForm(onDone) {
  const heldOn = el('input', { class: 'input', type: 'date', required: true });
  const platform = el('input', { class: 'input', type: 'text', maxLength: 120, required: true, placeholder: 'Exponent, interviewing.io, a friend' });
  const topic = el('input', { class: 'input', type: 'text', maxLength: 200, required: true, placeholder: 'What it covered' });
  const kind = el(
    'select',
    { class: 'select', 'aria-label': 'Kind of mock' },
    MOCK_KINDS.map((k) => el('option', { value: k.value, text: k.label, selected: k.value === 'coding' }))
  );
  const score = el('input', { class: 'input input--num', type: 'number', min: '0', max: '10', placeholder: 'out of 10' });
  const broke = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What actually broke. This is the only part worth reading later.' });
  const submit = el('button', { type: 'submit', class: 'btn btn--primary btn--sm', text: 'Record the mock' });

  const form = el('form', { class: 'stack-sm' }, [
    el('div', { class: 'grid grid--3' }, [field('Held on', heldOn), field('Platform', platform), field('Topic', topic)]),
    el('div', { class: 'grid grid--2' }, [field('Kind', kind), field('Score', score, 'Leave it blank if there was no score.')]),
    field('What broke', broke),
    el('div', { class: 'row' }, [submit]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!heldOn.value || !platform.value.trim() || !topic.value.trim()) {
      toastError('The date, the platform and the topic are all needed.');
      return;
    }
    submit.disabled = true;
    try {
      await api.post('/api/mocks', {
        held_on: heldOn.value,
        platform: platform.value.trim(),
        topic: topic.value.trim(),
        kind: kind.value,
        score: score.value === '' ? null : Number(score.value),
        what_broke: broke.value.trim() || null,
      });
      toast('Mock recorded.');
      await onDone();
    } catch (err) {
      toastError(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  return form;
}

function writeupForm(onDone) {
  const title = el('input', { class: 'input', type: 'text', maxLength: 255, required: true, placeholder: 'The title as published' });
  const url = el('input', { class: 'input', type: 'url', maxLength: 500, required: true, placeholder: 'https://where-it-is-published' });
  const publishedOn = el('input', { class: 'input', type: 'date', required: true });
  const topic = el('input', { class: 'input', type: 'text', maxLength: 200, placeholder: 'ITC Reclaim, Ragas, the MCP server' });
  const submit = el('button', { type: 'submit', class: 'btn btn--primary btn--sm', text: 'Record the writeup' });

  const form = el('form', { class: 'stack-sm' }, [
    el('div', { class: 'grid grid--2' }, [field('Title', title), field('URL', url, 'It has to be a full http or https address.')]),
    el('div', { class: 'grid grid--2' }, [field('Published on', publishedOn), field('Topic', topic)]),
    el('div', { class: 'row' }, [submit]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!title.value.trim() || !url.value.trim() || !publishedOn.value) {
      toastError('The title, the URL and the date published are all needed.');
      return;
    }
    submit.disabled = true;
    try {
      await api.post('/api/writeups', {
        title: title.value.trim(),
        url: url.value.trim(),
        published_on: publishedOn.value,
        topic: topic.value.trim() || null,
      });
      toast('Writeup recorded.');
      await onDone();
    } catch (err) {
      toastError(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  return form;
}

function extras(mocks, writeups, onDone) {
  const caseStudies = mocks.by_kind?.case_study ?? 0;

  const mockSection = section(
    'Mock interviews',
    [
      statGrid(
        [
          {
            value: `${int(mocks.total)} of ${int(mocks.week20_target)}`,
            label: 'mocks, against the Week 20 target',
            tone: mocks.total >= mocks.week20_target ? 'green' : mocks.total ? 'orange' : 'red',
          },
          {
            value: `${int(caseStudies)} of ${int(mocks.case_study_target)}`,
            label: 'case studies rather than coding mocks',
            tone: caseStudies >= mocks.case_study_target ? 'green' : '',
          },
          { value: `${int(mocks.from_february_target)} a week`, label: 'the rate from February onward' },
        ],
        { columns: 3 }
      ),
      el('p', { class: 'text-sm muted measure', text: mocks.note }),
      mocks.mocks.length
        ? table({
            columns: [
              { key: 'held_on', label: 'Held on', render: (r) => shortDate(r.held_on) },
              { key: 'platform', label: 'Platform' },
              { key: 'topic', label: 'Topic' },
              { key: 'kind', label: 'Kind', render: (r) => kindLabel(r.kind) },
              { key: 'score', label: 'Score', num: true, render: (r) => (r.score === null ? '' : `${r.score} of 10`) },
              { key: 'what_broke', label: 'What broke' },
            ],
            rows: mocks.mocks,
          })
        : emptyState(
            'No mocks recorded',
            'Ten in Week 20, four of them case studies, then two a week from February. A mock you did not write up is a mock you will repeat.'
          ),
      el('details', { class: 'acc' }, [
        el('summary', { class: 'acc__summary', text: 'Record a mock' }),
        el('div', { class: 'acc__body' }, [mockForm(onDone)]),
      ]),
    ]
  );

  const writeupSection = section(
    'Writeups',
    [
      statGrid(
        [
          {
            value: `${int(writeups.total)} of ${int(writeups.target)}`,
            label: 'published',
            tone: writeups.total >= writeups.target ? 'green' : writeups.total ? 'orange' : 'red',
          },
        ],
        { columns: 3 }
      ),
      el('p', { class: 'text-sm muted measure', text: writeups.note }),
      writeups.writeups.length
        ? el(
            'div',
            { class: 'stack-sm' },
            writeups.writeups.map((w) =>
              el('div', { class: 'linkrow' }, [
                el('div', { class: 'linkrow__main' }, [
                  el('div', { class: 'linkrow__title' }, [
                    el('a', {
                      href: w.url,
                      text: w.title,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                      'data-ext': '1',
                    }),
                    el('span', { class: 'badge badge--outline', text: shortDate(w.published_on) }),
                  ]),
                  w.topic ? el('p', { class: 'linkrow__why', text: w.topic }) : null,
                ]),
              ])
            )
          )
        : emptyState(
            'Nothing published yet',
            'Three pieces: the ITC Reclaim reconciliation logic, the Ragas numbers and what they revealed, and the MCP server. These are what recruiters actually read.'
          ),
      el('details', { class: 'acc' }, [
        el('summary', { class: 'acc__summary', text: 'Record a writeup' }),
        el('div', { class: 'acc__body' }, [writeupForm(onDone)]),
      ]),
    ]
  );

  return [mockSection, writeupSection];
}

/* --------------------------------------------------------------------- main */

async function render() {
  const [d, mocks, writeups] = await Promise.all([
    api.get('/api/applications'),
    api.get('/api/mocks'),
    api.get('/api/writeups'),
  ]);

  mount('#a-banner', banners(d));
  mount('#a-summary', counter(d));
  mount('#a-form', addForm(d, render));
  mount('#a-board', board(d, render));
  mount('#a-extra', extras(mocks, writeups, render));
}

async function main() {
  try {
    await render();
  } catch (err) {
    mount('#a-banner', errorCard(err.message));
    for (const id of ['#a-summary', '#a-form', '#a-board', '#a-extra']) mount(id, []);
  }
}

await main();
