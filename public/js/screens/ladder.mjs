/**
 * ladder.mjs | Part 12, the unlock ladder.
 *
 * The screen exists to answer one question honestly: what does this milestone
 * actually qualify me for. The answer is usually less than it feels like, which
 * is why the callout from the API sits above the ladder and not below it.
 *
 * A milestone is drawn as unlocked only when the server says so, and the server
 * decides from real evidence: a gate row marked passed, or a week finished in
 * full. Nothing here is unlocked by a date arriving.
 */

import { api } from '../api.mjs';
import { el, emptyState, int, shortDate, svgIcon } from '../ui.mjs';
import { errorCard, mount, section, statGrid, table } from '../render.mjs';

const ICON = {
  check: 'M4 12l5 5L20 6',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3M6 11h12v9H6z',
};

/* ------------------------------------------------------------------ callout */

function callouts(d) {
  return [
    el('div', { class: 'callout callout--red' }, [
      el('div', { class: 'callout__body' }, [
        el('p', { class: 'callout__title', text: 'The part you will not like' }),
        el('p', { class: 'measure', text: d.callout }),
      ]),
    ]),
    el('div', { class: 'callout callout--orange' }, [
      el('div', { class: 'callout__body' }, [
        el('p', { class: 'callout__title', text: 'Applications start at Gate 3, not Gate 4' }),
        el('p', { class: 'measure', text: d.applications_note }),
      ]),
    ]),
  ];
}

/* ----------------------------------------------------------- the milestones */

function daysText(m) {
  if (m.unlocked) return 'unlocked';
  if (m.days_away === 0) return 'the date is today';
  if (m.days_away < 0) return `${int(Math.abs(m.days_away))} days past the date, still not unlocked`;
  return `${int(m.days_away)} days away`;
}

function milestoneRow(m) {
  const classes = ['milestone'];
  if (m.is_gate) classes.push('milestone--gate');
  if (m.unlocked) classes.push('milestone--unlocked');

  return el('div', { class: classes.join(' ') }, [
    el('span', { class: 'milestone__marker' }, [svgIcon(m.unlocked ? ICON.check : ICON.lock, '')]),
    el('div', { class: 'stack-sm' }, [
      el('div', { class: 'row' }, [
        el('strong', { text: m.milestone }),
        el('span', { class: 'badge badge--outline', text: shortDate(m.unlock_date) }),
        m.is_gate ? el('span', { class: 'badge badge--orange', text: `Gate ${m.gate_no}` }) : null,
        m.week_n ? el('span', { class: 'badge badge--outline', text: `Week ${m.week_n}` }) : null,
        el('span', {
          class: `badge ${m.unlocked ? 'badge--green' : m.days_away < 0 ? 'badge--red' : 'badge--outline'}`,
          text: daysText(m),
        }),
      ]),
      el('p', { class: 'measure text-sm', text: m.roles_text }),
      m.roles.length
        ? el(
            'div',
            { class: 'row' },
            m.roles.map((code) => el('span', { class: 'badge badge--outline', text: code }))
          )
        : null,
      el('p', { class: 'measure text-sm muted', text: m.verdict }),
    ]),
  ]);
}

function roleLegend(roles) {
  return el('details', { class: 'acc' }, [
    el('summary', { class: 'acc__summary', text: `What the role codes mean, ${roles.length} of them` }),
    el('div', { class: 'acc__body' }, [
      el(
        'div',
        { class: 'grid grid--2' },
        roles.map((r) =>
          el('div', { class: 'rolechip' }, [
            el('span', { class: 'rolechip__code', text: r.code }),
            el('span', { class: 'rolechip__name', text: r.name }),
            el('span', { class: 'rolechip__band', text: r.entry_band }),
          ])
        )
      ),
    ]),
  ]);
}

/* --------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/ladder');
    const milestones = d.milestones ?? [];
    const thresholds = d.thresholds ?? [];
    const stages = d.resume_stages ?? [];
    const roles = d.roles ?? [];

    const unlocked = milestones.filter((m) => m.unlocked).length;
    const overdue = milestones.filter((m) => !m.unlocked && m.days_away < 0).length;
    const next = milestones.find((m) => !m.unlocked) ?? null;
    const current = thresholds.find((t) => t.is_current) ?? null;
    // Several resume stages can be available at once, so only the furthest one is
    // marked as the current row. Marking all of them says nothing.
    const furthestStage = stages.filter((s) => s.available).at(-1) ?? null;

    mount('#ld-callout', callouts(d));

    mount('#ld-list', [
      section(
        'The real ladder',
        [
          statGrid([
            {
              value: `${unlocked} of ${milestones.length}`,
              label: 'milestones actually unlocked',
              tone: unlocked ? 'green' : 'red',
              hero: true,
            },
            {
              value: next ? shortDate(next.unlock_date) : 'None left',
              label: next ? next.milestone : 'every milestone on the ladder is behind you',
              sub: next ? daysText(next) : '',
            },
            { value: int(d.solved), label: 'problems solved, which is what the thresholds below read' },
            {
              value: overdue,
              label: 'milestones whose date has passed and are still locked',
              tone: overdue ? 'red' : '',
            },
          ]),
          milestones.length
            ? el('div', { class: 'card card--flush' }, milestones.map(milestoneRow))
            : emptyState('No milestones', 'The ladder comes from Part 12 of final.md. Run npm run setup.'),
          roles.length ? roleLegend(roles) : null,
        ],
        {
          lede: 'A milestone is unlocked by evidence, not by a date. Gates need a gate row marked passed, weeks need all twelve ticks.',
        }
      ),
    ]);

    mount('#ld-dsa', [
      section(
        'The DSA threshold table',
        [
          thresholds.length
            ? table({
                columns: [
                  { key: 'cumulative', label: 'Solved', num: true, render: (r) => int(r.cumulative) },
                  { key: 'reached_label', label: 'Reached about' },
                  { key: 'unlocks', label: 'What the count unlocks' },
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
                rows: thresholds,
                rowCurrent: (r) => Boolean(r.is_current),
                caption: current
                  ? `You are at ${int(d.solved)} solved, which sits on the ${int(current.cumulative)} row.`
                  : `You are at ${int(d.solved)} solved, below the first row of this table.`,
              })
            : emptyState('No thresholds', 'The DSA thresholds come from Part 12 of final.md. Run npm run setup.'),
          el('p', {
            class: 'text-sm muted measure',
            text: 'The count gets you past a screen. It is a filter, not a qualification, and no row in this table is a job offer.',
          }),
        ]
      ),
    ]);

    mount('#ld-resume', [
      section(
        'What goes on the resume, and when',
        [
          stages.length
            ? table({
                columns: [
                  { key: 'stage', label: 'Stage' },
                  { key: 'headline', label: 'The headline you can honestly write' },
                  {
                    key: 'available',
                    label: 'Available',
                    render: (r) =>
                      el('span', {
                        class: `badge ${r.available ? 'badge--green' : 'badge--outline'}`,
                        text: r.available ? 'Yes' : 'Not yet',
                      }),
                  },
                ],
                rows: stages,
                rowCurrent: (r) => r === furthestStage,
              })
            : emptyState('No resume stages', 'They come from Part 12 of final.md. Run npm run setup.'),
          el('p', {
            class: 'text-sm muted measure',
            text: 'A stage becomes available when its gate is marked passed with evidence. Writing the later headline early is the one lie on a resume that gets checked.',
          }),
        ]
      ),
    ]);
  } catch (err) {
    mount('#ld-callout', errorCard(err.message));
    for (const id of ['#ld-list', '#ld-dsa', '#ld-resume']) mount(id, []);
  }
}

await main();
