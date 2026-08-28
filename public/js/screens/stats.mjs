/**
 * stats.mjs | Stats. Numbers only, no adjectives.
 *
 * Part 18, the tracking contract, asks for the plan and the actual side by side
 * rather than a single encouraging figure. So the DSA block draws the Part 3
 * cumulative target against what has actually been solved, and stops the actual
 * line at the last week that has finished, because drawing a line into the future
 * would invent data.
 *
 * The thirty minute video cap is a real limit, not advice. Every day that went
 * over it is listed by date at the bottom of this screen and none of them are
 * folded away.
 *
 * Source: GET /api/stats. There are no writes on this screen.
 */

import { api } from '../api.mjs';
import { el, emptyState, int, minutesLabel, pct, rupees, shortDate } from '../ui.mjs';
import { barChart, errorCard, lineChart, meter, mount, section, statGrid } from '../render.mjs';

/** The six tracked blocks, in the order the day runs. */
const BLOCKS = [
  { code: 'DSA', label: 'DSA, 06:30 to 09:00' },
  { code: 'LEARN', label: 'Learn, 09:30 to 12:30' },
  { code: 'BUILD', label: 'Build, 14:00 to 16:00' },
  { code: 'CLOSE', label: 'Close, 16:00 to 16:30' },
  { code: 'MONEY', label: 'Money, 17:00 to 18:00' },
  { code: 'NIGHT', label: 'Night, Anki and spoken' },
];

const PHASE_VAR = { A: '--phase-a', B: '--phase-b', C: '--phase-c', D: '--phase-d', E: '--phase-e', F: '--phase-f' };

/** The application funnel, in the order an application actually travels. */
const FUNNEL = [
  { key: 'applied', label: 'Applied' },
  { key: 'screen', label: 'Screen' },
  { key: 'tech', label: 'Technical' },
  { key: 'onsite', label: 'Onsite' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'ghosted', label: 'Ghosted' },
];

/* --------------------------------------------------------------- st-summary */

function drawSummary(d) {
  const dsaPercent = pct(d.dsa_solved, d.dsa_target);
  const moneyPercent = pct(d.money.total, d.money.target);
  const logged = d.day_history.filter((x) => x.colour !== 'neutral').length;

  mount('#st-summary', [
    section(
      'Where the numbers actually stand',
      [
        statGrid([
          {
            value: `${int(d.dsa_solved)} of ${int(d.dsa_target)}`,
            label: 'DSA problems solved against the target for 24 January',
            sub: `${dsaPercent}% of the way`,
            tone: dsaPercent >= 100 ? 'green' : '',
            hero: true,
          },
          {
            value: `${int(d.streak.current)} d`,
            label: 'current green streak',
            sub: `the longest so far is ${int(d.streak.longest)} days`,
            tone: d.streak.current ? 'green' : 'red',
          },
          {
            value: `${int(d.colours.green)} green`,
            label: `of ${int(logged)} days that could be coloured`,
            sub: `${int(d.colours.amber)} amber, ${int(d.colours.red)} red, ${int(d.colours.neutral)} neutral`,
          },
          {
            value: rupees(d.money.total),
            label: `received of ${rupees(d.money.target)}`,
            sub: `${moneyPercent}% of the money target`,
            tone: moneyPercent >= 100 ? 'green' : '',
          },
        ]),
        statGrid(
          [
            {
              value: `${int(d.applications.total)} of ${int(d.applications.target)}`,
              label: 'applications sent against Gate 4',
            },
            { value: int(d.video.days_over_cap), label: `days over the ${d.video.cap} minute video cap`, tone: d.video.days_over_cap ? 'red' : 'green' },
            { value: int(d.money.touches.touches), label: 'money touches logged', sub: `${d.money.touches.reply_rate}% replied` },
            { value: `${d.money.care_plans.count}`, label: 'care plans running', sub: `${rupees(d.money.care_plans.monthly)} a month` },
          ],
          { columns: 4 }
        ),
        el('p', { class: 'text-xs muted', text: `Everything on this page is as of ${d.today}.` }),
      ]
    ),
  ]);
}

/* ------------------------------------------------------------------- st-dsa */

function drawDsa(d) {
  const curve = d.dsa_curve ?? [];
  const done = curve.filter((c) => c.actual !== null);
  const last = done[done.length - 1] ?? null;
  const gap = last ? Number(last.actual) - Number(last.plan) : 0;

  const points = curve.map((c) => ({ label: `W${c.week_n}`, plan: Number(c.plan ?? 0), actual: c.actual === null ? null : Number(c.actual) }));

  const minuteBars = curve
    .filter((c) => Number(c.minutes) > 0)
    .map((c) => ({ label: `W${c.week_n}`, value: Number(c.minutes) }));

  mount('#st-dsa', [
    section(
      'DSA, plan against actual',
      [
        el('div', { class: 'statsection stack-sm' }, [
          points.length
            ? lineChart({
                points,
                yLabel: 'problems, cumulative',
                summary: last
                  ? `The plan line is the Part 3 cumulative target. At the end of week ${last.week_n} the target was ${int(last.plan)} and the actual was ${int(last.actual)}, ${gap >= 0 ? `${int(gap)} ahead` : `${int(Math.abs(gap))} behind`}. The actual line stops there because later weeks have not finished.`
                  : 'No week has finished yet, so there is a plan line and no actual line.',
              })
            : emptyState('No DSA curve', 'The 21 week cumulative targets come from Part 3 of final.md. Run npm run setup.'),
        ]),
        minuteBars.length
          ? el('div', { class: 'statsection stack-sm' }, [
              el('p', { class: 'card__label', text: 'Minutes spent in the DSA block, by week' }),
              barChart(minuteBars, {
                summary: `${minutesLabel(minuteBars.reduce((a, b) => a + b.value, 0))} logged in the morning block across ${minuteBars.length} weeks.`,
                valueFormat: (v) => String(v),
              }),
            ])
          : el('div', { class: 'statsection' }, [
              emptyState('No DSA minutes logged yet', 'The morning block records its own minutes. Start the timer on Today and the bars fill in from the first week.'),
            ]),
      ],
      { lede: 'The target is a cumulative number on a date, not a daily average.' }
    ),
  ]);
}

/* ----------------------------------------------------------------- st-hours */

/** One week as a single bar split into its blocks. Widths are set in JS, never in markup. */
function hourBar(week) {
  const total = Number(week.total_minutes) || 0;
  const track = el('div', { class: 'hourbar__track' });

  for (const b of BLOCKS) {
    const minutes = Number(week.blocks[b.code] ?? 0);
    if (!minutes) continue;
    const seg = el('div', {
      class: `hourbar__seg hourbar__seg--${b.code}`,
      title: `${b.label}: ${minutesLabel(minutes)}`,
    });
    seg.style.setProperty('width', `${(minutes / total) * 100}%`);
    track.appendChild(seg);
  }

  return el('div', { class: 'hourbar' }, [
    el('span', { text: `W${String(week.week_n).padStart(2, '0')}` }),
    el('div', { class: 'row' }, [
      el('div', { class: 'grow' }, [track]),
      el('span', { class: 'text-xs muted', text: total ? minutesLabel(total) : 'nothing logged' }),
    ]),
  ]);
}

function drawHours(d) {
  const weeks = d.hours_by_block_by_week ?? [];
  const withTime = weeks.filter((w) => Number(w.total_minutes) > 0);

  const legend = el(
    'div',
    { class: 'row' },
    BLOCKS.map((b) => {
      // The swatch borrows the segment class so the colour can only ever come from
      // stats.css. Its size is set here because there is no class for a 10px box.
      const swatch = el('span', { class: `hourbar__seg hourbar__seg--${b.code}`, 'aria-hidden': 'true' });
      swatch.style.setProperty('width', '10px');
      swatch.style.setProperty('height', '10px');
      swatch.style.setProperty('border-radius', '2px');
      return el('span', { class: 'row' }, [swatch, el('span', { class: 'text-xs muted', text: b.label })]);
    })
  );

  mount('#st-hours', [
    section(
      'Hours by block, by week',
      [
        withTime.length
          ? el('div', { class: 'statsection stack-sm' }, [legend, ...weeks.map(hourBar)])
          : el('div', { class: 'statsection' }, [
              emptyState(
                'No minutes logged yet',
                'Every block on Today has a timer and a minutes field. As soon as one week has minutes in it, this becomes the honest picture of where the day actually went.'
              ),
            ]),
        withTime.length
          ? el('div', { class: 'statsection stack-sm' }, [
              el('p', { class: 'card__label', text: 'Total tracked minutes per week' }),
              barChart(
                weeks.map((w) => ({ label: `W${w.week_n}`, value: Number(w.total_minutes) })),
                {
                  summary: `${minutesLabel(weeks.reduce((a, w) => a + Number(w.total_minutes), 0))} tracked in total. The plan is eight hours a day across six days, which is 2,880 minutes in a full week.`,
                  valueFormat: (v) => String(v),
                }
              ),
            ])
          : null,
      ],
      { lede: 'Minutes come from the block timers, so an untracked hour shows as an untracked hour.' }
    ),
  ]);
}

/* ------------------------------------------------------------------ st-days */

function drawDays(d) {
  const history = d.day_history ?? [];
  const strip = el('div', { class: 'colourstrip' });
  for (const day of history) {
    const cell = el('span', {
      class: `colourstrip__day colourstrip__day--${day.colour}`,
      title: `${day.date}: ${day.colour}, ${day.met} of ${day.total} conditions met`,
    });
    strip.appendChild(cell);
  }

  const coloured = history.filter((x) => x.colour !== 'neutral').length;

  mount('#st-days', [
    section(
      'Day colours and streaks',
      [
        el('div', { class: 'statsection stack-sm' }, [
          history.length ? strip : null,
          history.length
            ? el('p', {
                class: 'text-xs muted',
                text: `${history.length} days from the start of the roadmap to today, oldest first. Hover a square for the date and how many of the day conditions it met.`,
              })
            : null,
          history.length
            ? null
            : emptyState(
                'No days coloured yet',
                'A day gets its colour from the conditions in Part 18, counted at the end of it. Nothing is coloured until something is logged.'
              ),
        ]),
        statGrid([
          { value: d.colours.green, label: 'green days', tone: 'green', sub: coloured ? `${pct(d.colours.green, coloured)}% of coloured days` : '' },
          { value: d.colours.amber, label: 'amber days', tone: d.colours.amber ? 'orange' : '' },
          { value: d.colours.red, label: 'red days', tone: d.colours.red ? 'red' : '' },
          { value: d.colours.neutral, label: 'neutral days', sub: 'the rest Sundays, which have nothing to tick' },
        ]),
        el('p', {
          class: 'text-sm muted measure',
          text: 'A red day is data, not a verdict. The pattern of reds is the most useful thing on this page, which is why none of them are removed.',
        }),
      ]
    ),
  ]);
}

/* ---------------------------------------------------------------- st-phases */

function phaseRow(p) {
  const dot = el('span', { class: 'phasedot', 'aria-hidden': 'true' });
  const bar = el('div', { class: 'phasebar' });
  if (PHASE_VAR[p.phase_code]) {
    const value = `var(${PHASE_VAR[p.phase_code]})`;
    dot.style.setProperty('--phase', value);
    bar.style.setProperty('--phase', value);
  }
  const ticks = Number(p.learn_done) + Number(p.build_done);
  const possible = Number(p.day_rows) * 2;

  return el('div', { class: 'stack-sm' }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [dot, el('strong', { text: `Phase ${p.phase_code}` })]),
      el('span', { class: 'text-sm muted', text: `${ticks} of ${possible} ticks, ${p.percent}%` }),
    ]),
    bar,
    meter(p.percent, p.percent === 100 ? 'green' : ''),
    el('span', {
      class: 'text-xs muted',
      text: `${int(p.day_rows)} week days in this phase, each with a learn row and a build row.`,
    }),
  ]);
}

function drawPhases(d) {
  const phases = d.phases ?? [];
  mount('#st-phases', [
    section(
      'Completion by phase',
      [
        phases.length
          ? el('div', { class: 'statsection stack' }, phases.map(phaseRow))
          : el('div', { class: 'statsection' }, [
              emptyState('No phases', 'The six phases come from Part 3 of final.md. Run npm run setup.'),
            ]),
      ],
      { lede: 'Two ticks per week day, one for learn and one for build. The API returns the phase codes only, so the phase names are on the weeks screen.' }
    ),
  ]);
}

/* ---------------------------------------------------------------- st-funnel */

function drawFunnel(d) {
  const a = d.applications;
  const max = Math.max(1, ...FUNNEL.map((f) => Number(a.by_status[f.key] ?? 0)));

  const rows = FUNNEL.map((f) => {
    const n = Number(a.by_status[f.key] ?? 0);
    return el('div', { class: 'funnelbar__row' }, [
      el('span', { class: 'text-sm', text: f.label }),
      meter(Math.round((n / max) * 100), f.key === 'offer' && n ? 'green' : ''),
      el('span', { class: 'right text-sm', text: int(n) }),
    ]);
  });

  mount('#st-funnel', [
    section(
      'The application funnel',
      [
        el('div', { class: 'statsection stack-sm' }, [
          a.total
            ? el('div', { class: 'funnelbar' }, rows)
            : emptyState(
                'No applications yet',
                `Gate 4 asks for ${a.target} applications. The realistic number is two to four hundred, and none of them exist until they are recorded on the applications screen.`
              ),
        ]),
        statGrid([
          { value: `${int(a.total)} of ${int(a.target)}`, label: 'applications recorded against Gate 4', tone: a.total >= a.target ? 'green' : '' },
          { value: `${a.conversion.to_screen}%`, label: 'reached a screen' },
          { value: `${a.conversion.to_offer}%`, label: 'reached an offer' },
          { value: int(a.by_status.ghosted ?? 0), label: 'ghosted, which is the normal outcome' },
        ]),
      ]
    ),
  ]);
}

/* ----------------------------------------------------------------- st-money */

function drawMoney(d) {
  const m = d.money;
  const months = m.by_month ?? [];
  const percent = pct(m.total, m.target);

  mount('#st-money', [
    section(
      'Money received by month',
      [
        el('div', { class: 'statsection stack-sm' }, [
          months.length
            ? barChart(
                months.map((x) => ({ label: x.label.slice(0, 3), value: x.amount })),
                {
                  summary: `${rupees(m.total)} received in total, which is ${percent}% of the ${rupees(m.target)} target. Counted from dated cash events only.`,
                  valueFormat: (v) => String(v),
                }
              )
            : emptyState(
                'No money received yet',
                'A bar appears the first time an advance, a balance or a care plan invoice has a date on it. A deal ticked as paid with no dates is not money.'
              ),
          meter(percent, percent >= 100 ? 'green' : ''),
        ]),
        statGrid([
          { value: rupees(m.total), label: `of ${rupees(m.target)} by 24 January 2027`, tone: percent >= 100 ? 'green' : '' },
          { value: `${m.deals.won} of ${m.deals.quoted}`, label: 'deals taken past the advance', sub: `${m.deals.win_rate}% win rate` },
          { value: int(m.touches.touches), label: 'touches logged', sub: `${int(m.touches.replies)} replies, ${m.touches.reply_rate}%` },
          { value: m.care_plans.count, label: 'care plans running', sub: `${rupees(m.care_plans.monthly)} a month, the recurring floor` },
        ]),
      ],
      { lede: 'The money hour is 17:00 to 18:00 and it never borrows from study, so these numbers were earned on top of the eight hours.' }
    ),
  ]);
}

/* ----------------------------------------------------------------- st-video */

function drawVideo(d) {
  const v = d.video;
  const rows = v.rows ?? [];
  const over = rows.filter((r) => Number(r.video_minutes) > v.cap);

  const rowNode = (r) => {
    const minutes = Number(r.video_minutes);
    const isOver = minutes > v.cap;
    return el('div', { class: 'videorow between' }, [
      el('span', { class: 'text-sm', text: shortDate(r.log_date) }),
      el('span', { class: 'text-sm', text: minutesLabel(minutes) }),
      isOver
        ? el('span', { class: 'badge badge--red', text: `${minutes - v.cap} minutes over the cap` })
        : el('span', { class: 'badge badge--green', text: 'Inside the cap' }),
    ]);
  };

  mount('#st-video', [
    section(
      `Video minutes against the ${v.cap} minute cap`,
      [
        over.length
          ? el('div', { class: 'callout callout--red' }, [
              el('div', { class: 'callout__body' }, [
                el('p', { class: 'callout__title', text: `${over.length} days went over the ${v.cap} minute cap` }),
                el('p', {
                  class: 'measure',
                  text: 'The cap is a limit, not a guideline. Watching is not building, and every minute over it came out of the block that was supposed to produce something.',
                }),
              ]),
            ])
          : null,
        statGrid([
          { value: int(v.days_over_cap), label: `days over the ${v.cap} minute cap`, tone: v.days_over_cap ? 'red' : 'green', hero: true },
          { value: minutesLabel(v.total_minutes), label: 'video watched in total' },
          { value: int(rows.length), label: 'days with any video at all' },
          {
            value: rows.length ? minutesLabel(Math.round(v.total_minutes / rows.length)) : '0 m',
            label: 'average on a day that had video',
          },
        ]),
        rows.length
          ? el('div', { class: 'statsection stack-sm' }, [
              el('p', { class: 'card__label', text: 'Every day that had video, oldest first' }),
              ...rows.map(rowNode),
            ])
          : el('div', { class: 'statsection' }, [
              emptyState(
                'No video minutes recorded',
                `Nothing has been logged against the ${v.cap} minute cap yet. The field is on the Learn block on Today, and days over the cap will appear here by date.`
              ),
            ]),
      ]
    ),
  ]);
}

/* -------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/stats');
    drawSummary(d);
    drawDsa(d);
    drawHours(d);
    drawDays(d);
    drawPhases(d);
    drawFunnel(d);
    drawMoney(d);
    drawVideo(d);
  } catch (err) {
    mount('#st-summary', errorCard(err.message));
    for (const id of ['#st-dsa', '#st-hours', '#st-days', '#st-phases', '#st-funnel', '#st-money', '#st-video']) {
      mount(id, []);
    }
  }
}

await main();
