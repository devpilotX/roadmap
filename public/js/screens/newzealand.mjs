/**
 * newzealand.mjs | Part 16, the New Zealand route.
 *
 * This is the long tail of the plan: what Tier 1 on the Green List actually
 * asks for, what New Zealand actually pays, what the move actually costs, and
 * the seven dated milestones between Gate 4 and a Permanent Resident Visa.
 *
 * Three things this screen is careful about.
 *
 * Every figure here is stored as text, not as a number, because final.md states
 * them with their units and their caveats attached. Nothing is reformatted or
 * rounded on the way to the screen, so what you read is what the source says.
 *
 * The wage and salary figures carry a caveat column and it is always shown. A
 * self reported median from a site that skews senior is not the same kind of
 * fact as a statutory wage threshold, and the two are not run together.
 *
 * The nz_unverified rows are not facts. They are the things that could not be
 * confirmed. They are labelled unverified, kept in their own panel at the
 * bottom, and never mixed into the tables above.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, svgIcon } from '../ui.mjs';
import { errorCard, mount, section, statGrid, table } from '../render.mjs';

const STATUS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const STATUS_BADGE = {
  not_started: 'badge--outline',
  in_progress: 'badge--blue',
  done: 'badge--green',
};

const TICK = 'M4 12l5 5L20 6';

/* ------------------------------------------------------------------ nz-tier */

function tierPanel(requirements, milestones) {
  const done = milestones.filter((m) => m.status === 'done').length;
  const started = milestones.filter((m) => m.status === 'in_progress').length;

  return [
    statGrid([
      {
        value: `${requirements.length}`,
        label: 'conditions on a Straight to Residence application',
        hero: true,
      },
      { value: `${done} of ${milestones.length}`, label: 'milestones marked done', tone: done ? 'green' : '' },
      { value: started, label: 'milestones in progress', tone: started ? 'blue' : '' },
      { value: 'Tier 1', label: 'Software Engineer 261313 on the Green List' },
    ]),
    section(
      'What Tier 1 requires',
      requirements.length
        ? table({
            columns: [
              { key: 'requirement', label: 'Requirement' },
              { key: 'detail', label: 'What it means' },
            ],
            rows: requirements,
            caption: 'The eight conditions, from Part 16.',
          })
        : emptyState(
            'No requirements loaded',
            'The eight Tier 1 conditions come from Part 16 of final.md. Run npm run setup.'
          ),
      {
        lede: 'This is an employer led route. Every one of these is a condition on the application, not a preference.',
      }
    ),
  ];
}

/* ----------------------------------------------------------------- nz-wages */

function factsTable(rows, caption) {
  return table({
    columns: [
      { key: 'label', label: 'Source' },
      { key: 'value', label: 'Figure' },
      { key: 'caveat', label: 'Caveat' },
    ],
    rows,
    caption,
  });
}

function wagesPanel(facts) {
  const wage = facts?.wage ?? [];
  const salary = facts?.salary ?? [];

  return [
    section(
      'Wage thresholds',
      wage.length
        ? factsTable(wage, 'The statutory thresholds Immigration New Zealand publishes.')
        : emptyState('No wage thresholds loaded', 'They come from Part 16 of final.md. Run npm run setup.'),
      {
        lede: 'These are the numbers the visa is measured against. The employer satisfies them, not your savings.',
      }
    ),
    section(
      'What New Zealand actually pays',
      salary.length
        ? factsTable(salary, 'Market figures, each with the reason it might be wrong.')
        : emptyState('No salary figures loaded', 'They come from Part 16 of final.md. Run npm run setup.'),
      {
        lede: 'Self reported data skews senior and skews large employers. The caveat column is part of the figure, not a footnote to it.',
      }
    ),
  ];
}

/* ----------------------------------------------------------- nz-corrections */

function correctionsPanel(corrections) {
  if (!corrections.length) {
    return [
      section(
        'Three corrections',
        emptyState('No corrections loaded', 'They come from Part 16 of final.md. Run npm run setup.')
      ),
    ];
  }

  return [
    section(
      'Three corrections',
      corrections.map((c) =>
        el('div', { class: 'callout callout--orange' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: c.title }),
            el('p', { class: 'measure', text: c.body }),
          ]),
        ])
      ),
      {
        lede: 'Three beliefs about this route that are wrong, and what is true instead. Read these before the numbers.',
      }
    ),
  ];
}

/* -------------------------------------------------------------- nz-timeline */

function milestoneRow(m) {
  const badge = el('span', {
    class: `badge ${STATUS_BADGE[m.status] ?? 'badge--outline'}`,
    text: STATUS.find((s) => s.value === m.status)?.label ?? m.status,
  });

  const marker = el('span', { class: 'milestone__marker' }, [
    // A tick only appears once the row is done, so the column reads as progress.
    m.status === 'done' ? svgIcon(TICK, '') : el('span', { class: 'text-xs muted', text: String(m.ord) }),
  ]);

  const select = el(
    'select',
    { class: 'select select--sm', 'aria-label': `Status of ${m.milestone}` },
    STATUS.map((s) => el('option', { value: s.value, text: s.label, selected: s.value === m.status }))
  );

  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What has actually moved on this.' });
  notes.value = m.notes ?? '';
  const save = el('button', { type: 'button', class: 'btn btn--sm', text: 'Save the note' });

  const wrap = el('div', { class: `milestone ${m.status === 'done' ? 'milestone--unlocked' : ''}` }, [
    marker,
    el('div', { class: 'stack-sm' }, [
      el('div', { class: 'between' }, [
        el('div', { class: 'row' }, [
          el('span', { class: 'badge badge--outline', text: m.milestone_date }),
          el('span', { class: 'text-xs muted', text: m.age_label }),
        ]),
        badge,
      ]),
      el('p', { class: 'measure', text: m.milestone }),
      el('p', {
        class: 'text-xs muted',
        text: `Age ${m.age_on_id} on your government ID, ${m.age_actual} by your actual date of birth.`,
      }),
      el('details', { class: 'acc' }, [
        el('summary', { class: 'acc__summary', text: 'Mark this milestone and add a note' }),
        el('div', { class: 'acc__body stack-sm' }, [
          el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Status' }), select]),
          el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Notes' }), notes]),
          el('div', { class: 'row' }, [save]),
        ]),
      ]),
    ]),
  ]);

  async function write(patch, revert) {
    select.disabled = true;
    save.disabled = true;
    try {
      await api.patch(`/api/nz/${m.id}/progress`, patch);
      toast('Saved.', 'ok');
      return true;
    } catch (err) {
      if (revert) revert();
      toastError(err.message);
      return false;
    } finally {
      select.disabled = false;
      save.disabled = false;
    }
  }

  select.addEventListener('change', async () => {
    const want = select.value;
    const before = m.status;
    const ok = await write({ status: want, notes: notes.value }, () => {
      select.value = before;
    });
    if (!ok) return;
    m.status = want;
    badge.className = `badge ${STATUS_BADGE[want] ?? 'badge--outline'}`;
    badge.textContent = STATUS.find((s) => s.value === want)?.label ?? want;
    wrap.classList.toggle('milestone--unlocked', want === 'done');
  });

  save.addEventListener('click', () => write({ notes: notes.value }));

  return wrap;
}

function timelinePanel(milestones) {
  return [
    section(
      'The timeline',
      milestones.length
        ? [el('div', { class: 'card card--flush' }, milestones.map(milestoneRow))]
        : emptyState('No milestones loaded', 'The seven milestones come from Part 16 of final.md. Run npm run setup.'),
      {
        lede: 'Seven dated milestones between Gate 4 and a Permanent Resident Visa. Every date is years out, so each row carries both the age on your ID and your actual age.',
      }
    ),
  ];
}

/* ------------------------------------------------------------------ nz-cost */

function costPanel(costs, total, investor) {
  const lines = costs.filter((c) => Number(c.is_total) !== 1);

  const totalCard = el('div', { class: 'card stack-sm' }, [
    el('p', { class: 'card__label', text: total ? total.item : 'Total' }),
    el('p', { class: 'nztotal', text: total ? total.cost_rupees : 'Not loaded' }),
    total ? el('p', { class: 'text-sm muted measure', text: total.basis }) : null,
  ]);

  const investorCard = investor
    ? el('div', { class: 'card nzinvestor stack-sm' }, [
        el('p', { class: 'card__label', text: investor.label }),
        el('p', { class: 'nzinvestor__figure', text: investor.growth }),
        el('p', { class: 'text-sm', text: investor.rupees_growth }),
        el('p', { class: 'nzinvestor__figure', text: investor.balanced }),
        el('p', { class: 'text-sm', text: investor.rupees_balanced }),
        el('p', { class: 'nzgap', text: investor.multiple }),
        el('p', { class: 'measure text-sm', text: investor.note }),
      ])
    : null;

  return [
    section(
      'What the move costs',
      [
        el('p', {
          class: 'costheading',
          text: 'One person, direct costs only. Not lakhs of migration savings.',
        }),
        lines.length
          ? table({
              columns: [
                { key: 'item', label: 'Item' },
                { key: 'cost_rupees', label: 'Cost' },
                { key: 'basis', label: 'Basis' },
              ],
              rows: lines,
              caption: 'Each line carries the basis it was worked out from.',
            })
          : emptyState('No costs loaded', 'They come from Part 16 of final.md. Run npm run setup.'),
        el('div', { class: 'nzsplit' }, [totalCard, investorCard]),
      ],
      {
        lede: 'The crore figure people repeat about New Zealand comes from a different visa entirely. Both sit here side by side so the gap is visible without scrolling.',
      }
    ),
  ];
}

/* ---------------------------------------------------------------- nz-salary */

function salaryPanel(salary) {
  return [
    section(
      'What the salary is worth',
      salary.length
        ? table({
            columns: [
              { key: 'gross_nzd', label: 'Gross, NZD' },
              { key: 'gross_rupees', label: 'Gross, rupees' },
              { key: 'effective_tax_pct', label: 'Effective tax' },
              { key: 'net_nzd', label: 'Net, NZD' },
              { key: 'net_rupees', label: 'Net, rupees' },
            ],
            rows: salary,
            caption: 'Gross to net at several salary levels.',
          })
        : emptyState('No salary conversions loaded', 'They come from Part 16 of final.md. Run npm run setup.'),
      {
        lede: 'The rupee column is a conversion, not purchasing power. New Zealand rent and food are not Indian rent and food, and the take home in the last column is what you actually live on.',
      }
    ),
  ];
}

/* ------------------------------------------------------------ nz-projection */

function projectionPanel(projection, label) {
  return [
    section(
      label ?? 'Projection',
      [
        el('div', { class: 'callout callout--orange' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: label ?? 'Projection, not promise' }),
            el('p', {
              class: 'measure',
              text: 'These rows assume a salary you have not been offered, a savings rate you have not held for a decade, and an exchange rate nobody can forecast. They show the shape of the route, not an amount you will have.',
            }),
          ]),
        ]),
        projection.length
          ? table({
              columns: [
                { key: 'years_after_landing', label: 'Years after landing', num: true },
                { key: 'real_age', label: 'Your actual age' },
                { key: 'accumulated_rupees', label: 'Accumulated' },
              ],
              rows: projection,
            })
          : emptyState('No projection loaded', 'It comes from Part 16 of final.md. Run npm run setup.'),
      ]
    ),
  ];
}

/* ------------------------------------------------------------ nz-unverified */

function unverifiedPanel(rows) {
  return [
    section(
      'What could not be verified',
      [
        el('div', { class: 'callout callout--red' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'These are not facts' }),
            el('p', {
              class: 'measure',
              text: 'Every line below failed verification. They are recorded because they were claimed somewhere, not because they are true. Do not plan on them, do not repeat them, and check each one against Immigration New Zealand before it matters.',
            }),
          ]),
        ]),
        rows.length
          ? el(
              'ul',
              { class: 'stack-sm' },
              rows.map((r) =>
                el('li', {}, [
                  el('span', { class: 'badge badge--red', text: 'Unverified' }),
                  ' ',
                  el('span', { class: 'measure', text: r.text }),
                ])
              )
            )
          : emptyState(
              'Nothing outstanding',
              'No unverified claims are recorded for the New Zealand route. That is the good case, not an empty screen.'
            ),
      ]
    ),
  ];
}

/* -------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/nz');
    const milestones = d.milestones ?? [];

    mount('#nz-tier', tierPanel(d.requirements ?? [], milestones));
    mount('#nz-wages', wagesPanel(d.facts ?? {}));
    mount('#nz-corrections', correctionsPanel(d.corrections ?? []));
    mount('#nz-timeline', timelinePanel(milestones));
    mount('#nz-cost', costPanel(d.costs ?? [], d.cost_total ?? null, d.investor_comparison ?? null));
    mount('#nz-salary', salaryPanel(d.salary ?? []));
    mount('#nz-projection', projectionPanel(d.projection ?? [], d.projection_label));
    mount('#nz-unverified', unverifiedPanel(d.unverified ?? []));
  } catch (err) {
    mount('#nz-tier', errorCard(err.message));
    mount('#nz-wages', []);
    mount('#nz-corrections', []);
    mount('#nz-timeline', []);
    mount('#nz-cost', []);
    mount('#nz-salary', []);
    mount('#nz-projection', []);
    mount('#nz-unverified', []);
  }
}

await main();
