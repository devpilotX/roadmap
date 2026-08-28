/**
 * roles.mjs | Part 12, and everything that sits around it.
 *
 * This screen answers four questions in one place, because answering them in
 * four places is how a person ends up guessing:
 *
 *   1. What are the roles, what do they pay, and what do they test?
 *   2. Where do I actually apply, and by what rules?
 *   3. How do I prepare for the interview each one runs?
 *   4. What goes on the resume right now, and when does each role open?
 *
 * Every sentence on this screen comes out of the database, which means out of
 * final.md. The boards are the five it names, the prep links are the six in Part 7
 * category 16, the apply rules are the seven bullets of the Week 21 LEARN block,
 * and the resume lines are Part 13. Nothing here is advice this app invented, and
 * where the roadmap gives a figure with a caveat, the caveat comes with it.
 */

import { api } from '../api.mjs';
import { toastError } from '../toast.mjs';
import { el, emptyState, hardenExternalLinks, int, shortDate, svgIcon } from '../ui.mjs';
import { errorCard, meter, mount, section, statGrid, table } from '../render.mjs';

const ICON = {
  ext: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  check: 'M4 12l5 5L20 6',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
};

const STATUS_BADGE = {
  done: ['badge--green', 'Done'],
  reading: ['badge--blue', 'Reading'],
  todo: ['badge--outline', 'Not started'],
};

function statusBadge(status) {
  const [cls, label] = STATUS_BADGE[status] ?? STATUS_BADGE.todo;
  return el('span', { class: `badge ${cls}`, text: label });
}

const NO_APPS = { total: 0, by_status: {} };

/**
 * Fills in anything the payload does not carry.
 *
 * This screen reads a good deal more from `GET /api/roles` than it used to. If the
 * running server is older than this file, the extra fields are simply absent, and
 * reaching into them would throw and replace the whole page with an error card.
 * Normalising once here means an old server produces a page missing some panels
 * rather than no page at all, and `stale` lets us say why in plain words instead of
 * showing "cannot read properties of undefined".
 */
function normalise(d) {
  const roles = (d.roles ?? []).map((r) => ({
    ...r,
    applications: r.applications ?? NO_APPS,
    skills_total: r.skills_total ?? 0,
    skills_have: r.skills_have ?? 0,
    skills_missing: r.skills_missing ?? [],
    unlocked_by: r.unlocked_by ?? null,
  }));

  const rolesEarly = (d.roles_early ?? []).map((r) => ({
    ...r,
    applications: r.applications ?? NO_APPS,
    is_open: r.is_open ?? null,
    days_away: r.days_away ?? null,
  }));

  const missing = [];
  if (!d.where_to_apply) missing.push('where to apply');
  if (!d.interview_prep) missing.push('interview preparation');
  if (!d.resume_stages) missing.push('the resume stages');
  if (!d.unlocks) missing.push('the unlock ladder');

  return {
    today: d.today ?? '',
    solved: d.solved ?? 0,
    roles,
    roles_early: rolesEarly,
    skills: d.skills ?? [],
    skills_have: d.skills_have ?? 0,
    skills_total: d.skills_total ?? 0,
    where_to_apply: d.where_to_apply ?? null,
    interview_prep: d.interview_prep ?? null,
    resume_stages: d.resume_stages ?? null,
    unlocks: d.unlocks ?? null,
    dsa_thresholds: d.dsa_thresholds ?? [],
    dsa_note: d.dsa_note ?? 'No number in this table unlocks a single role on its own.',
    missing,
    stale: missing.length > 0,
  };
}

/** Shown in place of a panel the server did not send. */
function staleCard(what) {
  return el('div', { class: 'callout callout--orange' }, [
    el('div', { class: 'callout__body' }, [
      el('p', { class: 'callout__title', text: `${what} is not in this server's response` }),
      el('p', {
        text:
          'The server is running an older version of GET /api/roles than this screen expects. ' +
          'Restart it and reload this page.',
      }),
    ]),
  ]);
}

/** An external link that always opens safely. */
function extLink(url, label, cls = '') {
  return el('span', { class: 'row-tight' }, [
    el('a', { class: cls, href: url, text: label, target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' }),
    svgIcon(ICON.ext, 'extlink__icon'),
  ]);
}

/* --------------------------------------------------------------- the seven */

function roleCard(r) {
  const open = r.unlocked_by ? r.unlocked_by.is_past : true;
  const pct = r.skills_total ? Math.round((r.skills_have / r.skills_total) * 100) : 0;

  return el('div', { class: `rolecard ${Number(r.rank_order) === 1 ? 'rolecard--primary' : ''}` }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'rolecard__rank', text: String(r.rank_order) }),
        el('div', {}, [
          el('h2', { class: 'card__title', text: r.short_name }),
          el('p', { class: 'text-xs muted', text: `${r.code}  ·  ${r.name}` }),
        ]),
      ]),
      el('div', { class: 'right' }, [
        el('div', { class: 'rolecard__band', text: r.entry_band }),
        el('div', { class: 'text-xs muted', text: `ceiling ${r.ceiling}` }),
      ]),
    ]),

    el('p', { class: 'measure', text: r.verdict }),

    el('div', { class: 'card__foot stack-sm' }, [
      el('p', { class: 'card__label', text: 'What the interview actually tests' }),
      el('p', { class: 'measure text-sm', text: r.what_they_test }),
      el('p', { class: 'card__label', text: 'Which of your projects carries it' }),
      el('p', { class: 'measure text-sm', text: r.which_project }),
    ]),

    el('div', { class: 'card__foot stack-sm' }, [
      el('div', { class: 'between' }, [
        el('span', { class: 'card__label', text: `Skills held for this role, ${r.skills_have} of ${r.skills_total}` }),
        r.applications.total
          ? el('span', { class: 'badge badge--blue', text: `${int(r.applications.total)} applications sent` })
          : el('span', { class: 'badge badge--outline', text: 'no applications yet' }),
      ]),
      meter(pct, pct === 100 ? 'green' : ''),
      r.skills_missing.length
        ? el('details', { class: 'acc' }, [
            el('summary', { class: 'acc__summary', text: `Still missing ${r.skills_missing.length}` }),
            el('div', { class: 'acc__body' }, [
              el('ul', { class: 'linklist' }, r.skills_missing.map((s) => el('li', { class: 'text-sm', text: s }))),
            ]),
          ])
        : el('p', { class: 'text-sm muted', text: 'Every skill this role names is held.' }),
    ]),

    r.unlocked_by
      ? el('div', { class: `callout ${open ? 'callout--green' : 'callout--blue'}` }, [
          svgIcon(open ? ICON.check : ICON.lock, 'callout__icon'),
          el('div', { class: 'callout__body' }, [
            el('p', {
              class: 'callout__title',
              text: open
                ? `Open since ${shortDate(r.unlocked_by.unlock_date)}`
                : `Opens ${shortDate(r.unlocked_by.unlock_date)}, ${r.unlocked_by.days_away} days away`,
            }),
            el('p', { text: r.unlocked_by.milestone.replace(/\*\*/g, '') }),
          ]),
        ])
      : null,
  ]);
}

/* ---------------------------------------------------------- where to apply */

function whereToApply(d) {
  const w = d.where_to_apply;
  const boardRows = w.boards ?? [];
  const ruleRows = w.rules ?? [];

  const boards = table({
    columns: [
      { key: 'label', label: 'Where', render: (r) => extLink(r.url, r.label) },
      { key: 'why', label: 'Why this one' },
      { key: 'cost', label: 'Cost' },
      {
        key: 'status',
        label: 'You',
        render: (r) =>
          el('span', { class: 'row-tight' }, [
            statusBadge(r.status),
            r.is_alive === false ? el('span', { class: 'badge badge--red', text: 'link check failed' }) : null,
          ]),
      },
    ],
    rows: boardRows,
  });

  const rules = el('ol', { class: 'linklist' }, ruleRows.map((r) =>
    el('li', { class: 'linklist__row' }, [el('p', { class: 'measure text-sm', text: r.text })])
  ));

  return section(
    'Where to apply',
    [
      el('p', { class: 'measure', text: w.note ?? '' }),
      boardRows.length ? boards : emptyState('No boards on file', 'They come from Part 7, category 19 of final.md.'),
      el('div', { class: 'card__foot stack-sm' }, [
        el('p', { class: 'card__label', text: `The rules, from ${w.rules_source ?? 'Part 4, Week 21'}` }),
        ruleRows.length
          ? rules
          : emptyState('No apply rules on file', 'They come from the Week 21 LEARN block. Run npm run setup.'),
      ]),
      el('div', { class: 'row' }, [
        el('a', { class: 'btn btn--sm', href: '/applications', text: 'Track an application' }),
        el('a', { class: 'btn btn--sm btn--ghost', href: '/weeks/21', text: 'Read Week 21 in full' }),
        el('a', { class: 'btn btn--sm btn--ghost', href: '/eligibility', text: 'Am I advised to apply yet?' }),
      ]),
    ],
    { lede: 'The five places final.md names, and the seven rules it gives for using them.' }
  );
}

/* ------------------------------------------------------ interview prep */

function interviewPrep(d) {
  const p = d.interview_prep;
  const resources = p.resources ?? [];
  const whatTests = p.what_they_test ?? [];
  const mocks = p.mocks ?? [];

  const links = table({
    columns: [
      { key: 'label', label: 'Resource', render: (r) => extLink(r.url, r.label) },
      { key: 'why', label: 'Why this one' },
      { key: 'cost', label: 'Cost' },
      { key: 'weeks', label: 'Weeks', render: (r) => ((r.weeks ?? []).length ? r.weeks.join(', ') : 'any') },
      { key: 'status', label: 'You', render: (r) => statusBadge(r.status) },
    ],
    rows: resources,
  });

  const perRole = table({
    columns: [
      { key: 'code', label: 'Role' },
      { key: 'short_name', label: 'Name' },
      { key: 'what_they_test', label: 'What the interview tests' },
      { key: 'which_project', label: 'What you answer it with' },
    ],
    rows: whatTests,
  });

  const mockRows = mocks.length
    ? table({
        columns: [
          { key: 'held_on', label: 'Held', render: (m) => shortDate(m.held_on) },
          { key: 'kind', label: 'Kind' },
          { key: 'platform', label: 'Platform' },
          { key: 'topic', label: 'Topic' },
          { key: 'score', label: 'Score', num: true, render: (m) => (m.score === null ? '' : `${m.score}`) },
          { key: 'what_broke', label: 'What broke' },
        ],
        rows: mocks,
      })
    : emptyState(
        'No mocks logged yet',
        'Week 20 is the mock week. Log them on the Applications screen and they appear here with what broke, which is the only part worth re-reading.'
      );

  const kinds = Object.entries(p.mocks_by_kind ?? {});

  return section(
    'Interview preparation',
    [
      el('p', {
        class: 'measure',
        text:
          'Two halves. The six links below are the ones final.md picks, and the table under them is what each of the ' +
          'seven roles actually asks you in the room, taken from Part 12 rather than from a blog post.',
      }),
      resources.length ? links : emptyState('No prep links on file', `They come from ${p.category ?? 'Part 7, category 16'}.`),
      el('div', { class: 'card__foot stack-sm' }, [
        el('p', { class: 'card__label', text: 'What each role tests, and what you answer it with' }),
        whatTests.length ? perRole : emptyState('No roles on file', 'They come from Part 12.'),
      ]),
      el('div', { class: 'card__foot stack-sm' }, [
        el('div', { class: 'between' }, [
          el('p', { class: 'card__label', text: `Your mocks, ${mocks.length}` }),
          el('div', { class: 'row' }, kinds.map(([k, n]) => el('span', { class: 'badge badge--outline', text: `${k} ${n}` }))),
        ]),
        mockRows,
        el('div', { class: 'row' }, [
          el('a', { class: 'btn btn--sm', href: '/applications', text: 'Log a mock interview' }),
          el('a', { class: 'btn btn--sm btn--ghost', href: '/library', text: 'Open the full library' }),
        ]),
      ]),
    ],
    { lede: 'Part 7, category 16, plus what Part 12 says each role tests.' }
  );
}

/* ----------------------------------------------------------- the resume */

function resumeCard(d) {
  return section(
    'What goes on the resume, at each gate',
    [
      el('p', {
        class: 'measure',
        text:
          'Part 13. The first line is the one people skip: at Gate 1 the honest answer is that there is nothing to send yet. ' +
          'A resume with nothing behind it is the fastest way to be filtered out before there is anything to filter.',
      }),
      table({
        columns: [
          { key: 'stage', label: 'At' },
          { key: 'headline', label: 'What the resume says' },
          {
            key: 'passed',
            label: 'Gate',
            render: (r) =>
              r.passed
                ? el('span', { class: 'badge badge--green', text: 'passed' })
                : el('span', { class: 'badge badge--outline', text: 'not yet' }),
          },
        ],
        rows: d.resume_stages,
        rowCurrent: (r) => !r.passed && d.resume_stages.filter((x) => !x.passed)[0]?.ord === r.ord,
      }),
      el('div', { class: 'row' }, [el('a', { class: 'btn btn--sm btn--ghost', href: '/gates', text: 'Open the gates' })]),
    ],
    { lede: 'The resume is a consequence of the gates, not a separate project.' }
  );
}

/* ------------------------------------------------------- the nine early */

function earlyRoles(d) {
  return section(
    `The nine earlier roles, from Part 19.2`,
    [
      el('p', {
        class: 'measure',
        text:
          'These open before the seven do. They pay less and they are real. The date on each one is the earliest it is ' +
          'honestly available, not the date you should take it.',
      }),
      el('div', { class: 'grid grid--3' }, d.roles_early.map((r) =>
        el('div', { class: `rolechip ${r.is_open ? '' : 'offercard--locked'}` }, [
          el('div', { class: 'between' }, [
            el('span', { class: 'rolechip__code', text: r.code }),
            r.is_open
              ? el('span', { class: 'badge badge--green', text: 'open' })
              : el('span', { class: 'badge badge--outline', text: `${r.days_away} days` }),
          ]),
          el('span', { class: 'rolechip__name', text: r.role }),
          el('span', { class: 'rolechip__band', text: r.entry_band }),
          // earliest_text already reads "Week 3, 20 Sep 2026", so the date is not
          // appended again.
          el('p', { class: 'text-xs muted', text: `Earliest ${r.earliest_text}` }),
          el('p', { class: 'text-sm measure', text: r.verdict }),
          r.applications.total
            ? el('span', { class: 'badge badge--blue', text: `${int(r.applications.total)} sent` })
            : null,
        ])
      )),
    ],
    { lede: 'Ordered as final.md orders them, earliest first.' }
  );
}

/* ------------------------------------------------------ the skill matrix */

function skillMatrix(d) {
  return section(
    `The skill matrix, ${d.skills_have} of ${d.skills_total} held`,
    [
      el('p', {
        class: 'measure',
        text:
          'A skill counts as held when the week that builds it is finished in full, six LEARN ticks and six BUILD ticks. ' +
          'Reading about it is not holding it.',
      }),
      meter(d.skills_total ? Math.round((d.skills_have / d.skills_total) * 100) : 0, d.skills_have === d.skills_total ? 'green' : ''),
      table({
        columns: [
          {
            key: 'have',
            label: 'Held',
            render: (s) =>
              el('span', { class: s.have ? 'skillrow__have' : 'skillrow__not', text: s.have ? 'yes' : 'no' }),
          },
          { key: 'name', label: 'Skill' },
          { key: 'roles_text', label: 'Which roles want it' },
          { key: 'where_built', label: 'Where you build it' },
          { key: 'week_n', label: 'Week', num: true, render: (s) => (s.week_n ? `W${s.week_n}` : '') },
        ],
        rows: d.skills,
        rowClass: (s) => (s.have ? 'card--done' : ''),
      }),
    ],
    { lede: 'Part 12. Twenty five skills, each tied to the week that builds it.' }
  );
}

/* --------------------------------------------------------- the unlocks */

function unlockLadder(d) {
  const rows = d.unlocks ?? [];
  const thresholds = d.dsa_thresholds ?? [];
  return section(
    'When each role opens',
    [
      rows.length
        ? table({
            columns: [
              { key: 'unlock_date', label: 'Date', render: (u) => shortDate(u.unlock_date) },
              { key: 'milestone', label: 'Milestone', render: (u) => String(u.milestone ?? '').replace(/\*\*/g, '') },
              {
                key: 'codes',
                label: 'Roles it opens',
                render: (u) =>
                  (u.codes ?? []).length
                    ? el('div', { class: 'row-tight' }, u.codes.map((c) => el('span', { class: 'badge badge--outline', text: c })))
                    : el('span', { class: 'muted text-sm', text: 'none on its own' }),
              },
              { key: 'verdict', label: 'What it means' },
              {
                key: 'is_past',
                label: 'Reached',
                render: (u) =>
                  u.is_past
                    ? el('span', { class: 'badge badge--green', text: 'yes' })
                    : el('span', { class: 'badge badge--outline', text: `${u.days_away} days` }),
              },
            ],
            rows,
            rowCurrent: (u) => !u.is_past && rows.filter((x) => !x.is_past)[0]?.ord === u.ord,
          })
        : emptyState('No unlock ladder', 'It comes from Part 13 of final.md.'),
      el('div', { class: 'card__foot stack-sm' }, [
        el('div', { class: 'callout callout--red' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: d.dsa_note }),
            el('p', {
              text: `You are at ${int(d.solved)} problems. The table below is what the number alone buys you, which is a screen, not an offer.`,
            }),
          ]),
        ]),
        thresholds.length
          ? table({
              columns: [
                { key: 'cumulative', label: 'Problems', num: true },
                { key: 'reached_label', label: 'Reached about' },
                { key: 'unlocks', label: 'What it unlocks' },
                {
                  key: 'reached',
                  label: 'You',
                  render: (t) =>
                    t.reached
                      ? el('span', { class: 'badge badge--green', text: 'reached' })
                      : el('span', { class: 'badge badge--outline', text: `${t.cumulative - d.solved} to go` }),
                },
              ],
              rows: thresholds,
            })
          : emptyState('No DSA thresholds', 'They come from Part 13.'),
      ]),
    ],
    { lede: 'Part 13, the unlock ladder, against today.' }
  );
}

/* --------------------------------------------------------------------- main */

async function main() {
  try {
    const d = normalise(await api.get('/api/roles'));

    const openNow = d.roles.filter((r) => !r.unlocked_by || r.unlocked_by.is_past).length;
    const earlyOpen = d.roles_early.filter((r) => r.is_open).length;
    const nextRole = d.roles.find((r) => r.unlocked_by && !r.unlocked_by.is_past) ?? null;
    const totalApps = [...d.roles, ...d.roles_early].reduce((a, r) => a + (r.applications?.total ?? 0), 0);

    mount('#r-summary', [
      d.stale
        ? el('div', { class: 'callout callout--orange' }, [
            el('div', { class: 'callout__body' }, [
              el('p', { class: 'callout__title', text: 'This server is older than this screen' }),
              el('p', {
                text:
                  `It did not send ${d.missing.join(', ')}. Restart the server and reload, and those panels will fill. ` +
                  'Everything below is drawn from what it did send.',
              }),
            ]),
          ])
        : null,
      statGrid([
        {
          value: `${d.skills_have} of ${d.skills_total}`,
          label: 'skills held, from finished weeks',
          tone: d.skills_total && d.skills_have === d.skills_total ? 'green' : '',
          hero: true,
        },
        { value: `${openNow} of ${d.roles.length}`, label: 'of the seven open today', tone: openNow ? 'green' : '' },
        { value: `${earlyOpen} of ${d.roles_early.length}`, label: 'of the nine earlier roles open today' },
        {
          value: nextRole ? nextRole.code : 'All open',
          label: nextRole ? `opens ${shortDate(nextRole.unlocked_by.unlock_date)}` : 'nothing left to unlock',
          sub: totalApps ? `${int(totalApps)} applications sent` : 'no applications yet',
        },
      ]),
      el('p', {
        class: 'text-sm muted measure',
        text:
          'Eligible is not a reason to apply. Eligible plus advised is, and whether you are advised is on the Eligibility screen. ' +
          'This page is what the roles are, where they live and how they are tested.',
      }),
    ]);

    mount('#r-list', d.roles.length
      ? d.roles.map(roleCard)
      : emptyState('No roles', 'The seven roles come from Part 12 of final.md. Run npm run setup.'));

    // Each panel is mounted independently, so one missing field cannot take the
    // rest of the page with it.
    mount('#r-apply', d.where_to_apply ? [whereToApply(d)] : [staleCard('Where to apply')]);
    mount('#r-prep', d.interview_prep ? [interviewPrep(d)] : [staleCard('Interview preparation')]);
    mount('#r-resume', d.resume_stages ? [resumeCard(d)] : [staleCard('The resume at each gate')]);
    mount('#r-early', d.roles_early.length ? [earlyRoles(d)] : emptyState('No earlier roles', 'They come from Part 19.2.'));
    mount('#r-skills', d.skills.length ? [skillMatrix(d)] : emptyState('No skills', 'They come from Part 12.'));
    mount('#r-unlocks', d.unlocks ? [unlockLadder(d)] : [staleCard('The unlock ladder')]);

    hardenExternalLinks(document);
  } catch (err) {
    mount('#r-summary', errorCard(err.message));
    for (const id of ['#r-list', '#r-apply', '#r-prep', '#r-resume', '#r-early', '#r-skills', '#r-unlocks']) {
      mount(id, []);
    }
    toastError(err.message);
  }
}

await main();
