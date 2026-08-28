/**
 * eligibility.mjs | Part 19, what can I apply for today.
 *
 * The whole screen hangs off one sentence, which the API supplies and this file
 * does not soften: eligible is not a reason to apply, eligible plus advised is.
 * Until 13 December 2026 the banner is red and says exactly that, whatever the
 * chips below it happen to show.
 *
 * Nothing here is stored. The server recomputes eligibility on every request from
 * finished weeks and real solved problems, so a chip appearing is evidence and not
 * a date arriving. Part 19.3 names one role a week early with the qualifier
 * "weakly", and that chip is drawn weak rather than full, because the document
 * itself draws that distinction.
 */

import { api } from '../api.mjs';
import { el, emptyState, int, shortDate } from '../ui.mjs';
import { errorCard, mount, section, statGrid, table } from '../render.mjs';

/* ------------------------------------------------------------------- banner */

function banner(d) {
  const tone = d.banner.tone === 'green' ? 'eligbanner--green' : 'eligbanner--red';

  return [
    el('p', { class: `eligbanner ${tone}`, text: d.banner.text }),
    el('div', { class: 'row' }, [
      el('span', {
        class: `badge ${d.advised_badge.tone === 'green' ? 'badge--green' : 'badge--red'}`,
        text: d.advised_badge.label,
      }),
      el('span', {
        class: `badge ${d.applications_open ? 'badge--green' : 'badge--outline'}`,
        text: d.applications_open
          ? `Applications have been open since ${shortDate(d.gate3_date)}`
          : `Applications open at Gate 3 on ${shortDate(d.gate3_date)}`,
      }),
      d.current_week
        ? el('span', {
            class: 'badge badge--outline',
            text: `Week ${d.current_week.n}, ${d.current_week.dates_label}`,
          })
        : el('span', { class: 'badge badge--outline', text: 'Outside the 21 week window' }),
    ]),
    d.current_week_row
      ? el('p', {
          class: 'text-sm muted measure',
          text: `The verdict on this week's row in Part 19.3: ${d.current_week_row.apply_verdict}`,
        })
      : null,
  ];
}

/* ----------------------------------------------------------------- headline */

function headline(d) {
  return [
    el('div', { class: 'card stack-sm' }, [
      el('p', { class: 'eligheadline', text: d.headline }),
      el('p', {
        class: 'text-sm muted measure',
        text: `${int(d.part12_roles)} of those ${int(d.total_roles)} are the Part 11 roles the 21 weeks are actually built for. The rest open earlier and pay less.`,
      }),
    ]),
    statGrid([
      {
        value: `${int(d.eligible_count)} of ${int(d.total_roles)}`,
        label: 'roles eligible today, on evidence',
        tone: d.eligible_count ? 'green' : 'red',
        hero: true,
      },
      {
        value: int(d.solved),
        label: 'problems solved',
        sub: d.dsa_source === 'problems' ? 'counted from the imported problem list' : 'counted from the day logs',
      },
      {
        value: d.completed_weeks.length,
        label: 'weeks finished in full',
        sub: d.completed_weeks.length ? `Weeks ${d.completed_weeks.join(', ')}` : 'all twelve ticks or it does not count',
      },
      {
        value: d.advised ? 'Advised' : 'Not advised',
        label: 'what Part 19.3 says about applying this week',
        tone: d.advised ? 'green' : 'red',
      },
    ]),
  ];
}

/* --------------------------------------------------------------- the chips */

function eligibleChip(r) {
  return el('div', { class: `eligchip ${r.strength === 'weak' ? 'eligchip--weak' : ''}` }, [
    el('span', { class: 'rolechip__code', text: r.code }),
    el('div', { class: 'rolechip__name' }, [
      el('span', { text: r.role }),
      el('p', {
        class: 'text-xs muted',
        text:
          r.unlocked_at_week === 0
            ? 'Open from the launch block'
            : `Unlocked at week ${r.unlocked_at_week}`,
      }),
      r.strength === 'weak'
        ? el('p', {
            class: 'text-xs',
            text: 'Named a week early and qualified as weakly in Part 19.3. Treat it as a maybe, not a yes.',
          })
        : null,
      r.verdict ? el('p', { class: 'text-xs muted measure', text: r.verdict }) : null,
    ]),
    el('span', { class: 'rolechip__band', text: r.band || 'no band listed' }),
  ]);
}

function eligibleNow(d) {
  const full = d.eligible.filter((r) => r.strength === 'full');
  const weak = d.eligible.filter((r) => r.strength === 'weak');

  return [
    section(
      'Eligible now',
      [
        d.eligible.length
          ? el('div', { class: 'eligchips' }, d.eligible.map(eligibleChip))
          : emptyState(
              'Nothing is unlocked yet',
              'A role appears here when a row of the Part 19.3 ladder that names it has both of its conditions met: the week finished in full and the DSA total reached. Neither is met by the date arriving.'
            ),
        d.eligible.length
          ? el('p', {
              class: 'text-xs muted',
              text: `${full.length} held properly, ${weak.length} held weakly. A dashed border is a weak chip.`,
            })
          : null,
      ],
      { lede: 'Eligible means a screen would not reject you outright. It does not mean you should send the application.' }
    ),
  ];
}

/* ---------------------------------------------------------- the next unlock */

function ladderRow(r, solved) {
  return {
    week: r.week_n === 0 ? 'Launch' : `Week ${r.week_n}`,
    reached_date: shortDate(r.reached_date),
    dsa_total: int(r.dsa_total),
    newly_holds: r.newly_holds,
    newly_eligible_text: r.newly_eligible_text,
    band: r.band,
    apply_verdict: r.apply_verdict,
    state: r.reached
      ? 'Reached'
      : r.week_done
        ? `Week done, ${int(Math.max(0, r.dsa_total - solved))} problems short`
        : r.dsa_met
          ? 'DSA met, week not finished'
          : 'Neither condition met',
    reached: r.reached,
  };
}

function nextUnlock(d) {
  const n = d.next_unlock;

  const body = n
    ? [
        el('div', { class: 'card stack-sm' }, [
          el('p', { class: 'card__label', text: n.week_n === 0 ? 'The launch block' : `Week ${n.week_n}` }),
          el('p', { class: 'measure', text: n.sentence }),
          statGrid(
            [
              { value: int(n.problems_needed), label: 'more problems needed', tone: n.problems_needed ? 'orange' : 'green' },
              { value: int(n.dsa_total), label: 'the cumulative DSA total on that row' },
              {
                value: n.week_done ? 'Yes' : 'No',
                label: 'that week finished in full',
                tone: n.week_done ? 'green' : 'red',
              },
              { value: shortDate(n.reached_date), label: 'the date the plan reaches that row' },
            ],
            { columns: 4 }
          ),
          el('p', { class: 'text-sm', text: `What it adds: ${n.newly_holds}` }),
          el('p', { class: 'text-sm muted', text: `Newly eligible: ${n.newly_eligible_text}` }),
          n.codes.length
            ? el('div', { class: 'row' }, n.codes.map((c) => el('span', { class: 'badge badge--outline', text: c })))
            : null,
          n.band && n.band !== 'none' ? el('span', { class: 'badge badge--outline', text: n.band }) : null,
        ]),
      ]
    : [
        emptyState(
          'Every row of the ladder is reached',
          'There is no next unlock left in Part 19.3. From here the constraint is applications and interviews, not eligibility.'
        ),
      ];

  return [
    section('The next unlock', body, {
      lede: 'Two conditions, both required: the week finished in full and the cumulative DSA total reached.',
    }),
    section(
      'The week by week ladder',
      [
        d.ladder.length
          ? el('details', { class: 'acc' }, [
              el('summary', { class: 'acc__summary', text: `All ${d.ladder.length} rows of the Part 19.3 ladder` }),
              el('div', { class: 'acc__body' }, [
                table({
                  columns: [
                    { key: 'week', label: 'Week' },
                    { key: 'reached_date', label: 'Reached' },
                    { key: 'dsa_total', label: 'DSA', num: true },
                    { key: 'newly_holds', label: 'What you newly hold' },
                    { key: 'newly_eligible_text', label: 'Newly eligible' },
                    { key: 'band', label: 'Band' },
                    { key: 'apply_verdict', label: 'Apply?' },
                    {
                      key: 'state',
                      label: 'State',
                      render: (r) =>
                        el('span', {
                          class: `badge ${r.reached ? 'badge--green' : 'badge--outline'}`,
                          text: r.reached ? 'Reached' : r.state,
                        }),
                    },
                  ],
                  rows: d.ladder.map((r) => ladderRow(r, d.solved)),
                }),
              ]),
            ])
          : emptyState('No ladder rows', 'They come from Part 19.3 of final.md. Run npm run setup.'),
      ]
    ),
  ];
}

/* ------------------------------------------------------- the DSA only ladder */

function dsaOnly(d) {
  const rows = d.dsa_ladder ?? [];

  return [
    section(
      'The DSA only ladder',
      [
        // This callout is the point of the whole table and it goes above it.
        el('div', { class: 'callout callout--red' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: d.dsa_callout }),
            el('p', {
              class: 'measure',
              text: 'The count is a filter on the way in. Every row below tells you what it gets you past and what it does not open, and the second column is the longer one for a reason.',
            }),
          ]),
        ]),
        rows.length
          ? table({
              columns: [
                { key: 'problems', label: 'Problems', num: true, render: (r) => int(r.problems) },
                { key: 'reached_about', label: 'Reached about' },
                { key: 'gets_you_past', label: 'What it gets you past' },
                { key: 'does_not_open', label: 'What it does not open' },
                {
                  key: 'reached',
                  label: 'Reached',
                  render: (r) =>
                    el('span', {
                      class: `badge ${r.reached ? 'badge--green' : 'badge--outline'}`,
                      text: r.reached ? 'Yes' : 'Not yet',
                    }),
                },
              ],
              rows,
              rowCurrent: (r) => rows.indexOf(r) === d.dsa_position_index,
              caption:
                d.dsa_position_index >= 0
                  ? `You are at ${int(d.solved)} solved, which sits on the ${int(rows[d.dsa_position_index].problems)} row.`
                  : `You are at ${int(d.solved)} solved, below the first row of this table.`,
            })
          : emptyState('No DSA rows', 'They come from Part 19.4 of final.md. Run npm run setup.'),
      ]
    ),
  ];
}

/* -------------------------------------------------------- the combo matrix */

function combos(d) {
  const rows = d.combos ?? [];

  return [
    section(
      'The skill combination matrix',
      [
        rows.length
          ? table({
              columns: [
                { key: 'stack_held', label: 'Stack held' },
                { key: 'dsa_needed_text', label: 'DSA needed' },
                { key: 'roles_unlocked_text', label: 'Roles unlocked' },
                { key: 'band', label: 'Band' },
                { key: 'interview_you_face', label: 'The interview you face' },
                {
                  key: 'held',
                  label: 'Held',
                  render: (r) =>
                    el('div', { class: 'row' }, [
                      el('span', {
                        class: `badge ${r.stack_held_now ? 'badge--green' : 'badge--outline'}`,
                        text: r.stack_held_now ? 'Stack held' : 'Stack short',
                      }),
                      el('span', {
                        class: `badge ${r.dsa_met ? 'badge--green' : 'badge--outline'}`,
                        text: r.dsa_met ? 'DSA met' : `DSA short by ${int(Math.max(0, r.dsa_needed - d.solved))}`,
                      }),
                    ]),
                },
              ],
              rows,
              rowCurrent: (r) => rows.indexOf(r) === d.current_combo_index,
              caption:
                d.current_combo_index >= 0
                  ? `The furthest row you hold in full is ${rows[d.current_combo_index].stack_held}.`
                  : 'No row of this matrix is held in full yet.',
            })
          : emptyState('No combinations', 'The matrix comes from Part 19.6 of final.md. Run npm run setup.'),
        el('p', {
          class: 'text-sm muted measure',
          text: 'A row counts as held only when every role it unlocks is already eligible and its DSA figure is reached. The stack is the thing that moves the band, not the problem count on its own.',
        }),
      ]
    ),
  ];
}

/* ------------------------------------------------------------- the exits */

function exitCard(e) {
  return el('article', { class: `exitcard ${e.costs_money ? 'exitcard--costly' : ''}` }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [
        el('strong', { text: e.exit_label }),
        el('span', { class: 'badge badge--outline', text: shortDate(e.exit_date) }),
        el('span', { class: 'badge badge--outline', text: `Week ${e.exit_week}` }),
      ]),
      el('span', {
        class: `badge ${e.is_past ? 'badge--outline' : 'badge--blue'}`,
        text: e.is_past
          ? `${int(Math.abs(e.days_away))} days ago`
          : e.days_away === 0
            ? 'today'
            : `${int(e.days_away)} days away`,
      }),
    ]),
    el('p', { class: 'text-sm', text: `Available: ${e.roles_available}` }),
    el('span', { class: 'badge badge--outline', text: e.band }),
    el('div', { class: 'stack-sm' }, [
      el('p', { class: 'card__label', text: 'What you give up' }),
      el('p', { class: 'measure text-sm', text: e.what_you_give_up }),
    ]),
    el('p', { class: 'measure text-sm', text: e.verdict }),
    e.cost_note ? el('p', { class: 'exitcost measure', text: e.cost_note }) : null,
  ]);
}

function exits(d) {
  const all = d.exits ?? [];
  const costly = d.early_exits ?? [];
  const later = all.filter((e) => !e.costs_money);

  return [
    section(
      'The four exits',
      [
        costly.length
          ? el('div', { class: 'stack-sm' }, [
              el('p', { class: 'costheading', text: d.early_exit_heading }),
              el('p', {
                class: 'text-sm measure',
                text: `${costly.length === 1 ? 'This exit falls' : `These ${costly.length} exits fall`} before Gate 3 on ${shortDate(d.gate3_date)}. The cost line on each one is the annual figure Part 19.5 puts on leaving early, and it is not a one off.`,
              }),
              ...costly.map(exitCard),
            ])
          : null,
        later.length
          ? el('div', { class: 'stack-sm' }, [
              el('p', { class: 'card__label', text: 'From Gate 3 onward' }),
              ...later.map(exitCard),
            ])
          : null,
        all.length
          ? null
          : emptyState('No exits listed', 'The four exits come from Part 19.5 of final.md. Run npm run setup.'),
      ],
      { lede: 'Every exit is a real option. Two of them are priced, and the price is per year, permanently.' }
    ),
  ];
}

/* ----------------------------------------------- definitions and break plan */

function breakPlan(d) {
  const plan = d.break_plan ?? [];
  const defs = d.definitions ?? [];

  return [
    section(
      'When to break this plan',
      [
        plan.length
          ? el('ul', { class: 'stack-sm' }, plan.map((p) => el('li', { class: 'measure', text: p.text })))
          : emptyState('No break conditions', 'They come from Part 19.7 of final.md. Run npm run setup.'),
      ],
      { lede: 'The plan is not sacred. These are the conditions under which abandoning it is the correct decision.' }
    ),
    section(
      'What eligible actually means here',
      [
        defs.length
          ? el('ul', { class: 'stack-sm' }, defs.map((x) => el('li', { class: 'measure', text: x.text })))
          : emptyState('No definitions', 'They come from Part 19 of final.md. Run npm run setup.'),
        el('p', {
          class: 'text-xs muted measure',
          text: d.problems_imported
            ? 'The solved count on this screen comes from the imported problem list, one row per problem.'
            : 'The solved count on this screen comes from the per day totals, because no 474 row problem list has been imported yet.',
        }),
      ]
    ),
  ];
}

/* --------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/eligibility');

    mount('#e-banner', banner(d));
    mount('#e-headline', headline(d));
    mount('#e-now', eligibleNow(d));
    mount('#e-next', nextUnlock(d));
    mount('#e-dsa', dsaOnly(d));
    mount('#e-combos', combos(d));
    mount('#e-exits', exits(d));
    mount('#e-break', breakPlan(d));
  } catch (err) {
    mount('#e-banner', errorCard(err.message));
    for (const id of ['#e-headline', '#e-now', '#e-next', '#e-dsa', '#e-combos', '#e-exits', '#e-break']) {
      mount(id, []);
    }
  }
}

await main();
