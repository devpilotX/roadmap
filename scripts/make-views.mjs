/**
 * make-views.mjs | one off generator for the screen shells.
 *
 * Every screen is a server rendered shell plus a module that fetches JSON. The
 * shells are structurally identical, so they are written from one place rather
 * than copied twenty times. Run once; the output is committed source.
 *
 *   node scripts/make-views.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWS = join(ROOT, 'views', 'screens');

/** [file, title, lede, regions] where a region is [id, className, label] */
const SCREENS = [
  ['calendar', 'Calendar', 'Every day, every task, one click from the material.', [
    ['c-toolbar', 'stack-sm', 'Calendar controls'],
    ['c-grid', '', 'The month grid'],
    ['c-foot', 'stack', 'Calendar notes'],
  ]],
  ['weeks', 'The 21 weeks', 'Six phases, twenty one weeks, four gates.', [
    ['w-summary', 'stack', 'Week summary'],
    ['w-phases', 'stack-lg', 'The weeks, grouped by phase'],
  ]],
  ['week-detail', 'Week', 'Focus, learn, build, the six days, ships, the trap, the note, and every link.', [
    ['wd-head', 'stack', 'Week header'],
    ['wd-body', 'stack', 'Week detail'],
  ]],
  ['dsa', 'DSA tracker', '474 problems on the Striver A2Z sheet. 415 of them by 24 January 2027.', [
    ['d-summary', 'stack', 'DSA summary'],
    ['d-chart', 'stack', 'Cumulative against plan'],
    ['d-failed', 'stack', 'Failed twice'],
    ['d-filters', 'stack-sm', 'Filters'],
    ['d-list', 'stack', 'Problems and topics'],
  ]],
  ['library', 'Resource library', 'Every link in Part 7, all twenty categories, each one tickable.', [
    ['l-summary', 'stack', 'Library summary'],
    ['l-filters', 'stack-sm', 'Filters'],
    ['l-list', 'stack', 'The links'],
  ]],
  ['projects', 'Projects', 'One problem taken three times, then a second problem.', [
    ['p-summary', 'stack', 'Project summary'],
    ['p-list', 'stack-lg', 'The four projects'],
  ]],
  ['gates', 'Gates', 'Four gates and four money gates. A gate is not a checkpoint you hope to reach.', [
    ['g-gates', 'stack', 'The four gates'],
    ['g-money', 'stack', 'The four money gates'],
  ]],
  ['sundays', 'Sundays', 'Ten working, four gate audits, seven rest. Rest is load bearing.', [
    ['s-summary', 'stack', 'Sunday summary'],
    ['s-list', 'stack', 'The 21 Sundays'],
  ]],
  ['pushes', 'GitHub pushes', 'The one signal a recruiter can verify without talking to you.', [
    ['gh-banner', 'stack-sm', 'Push warnings'],
    ['gh-summary', 'stack', 'Push summary'],
    ['gh-grid', 'stack', 'The 150 day grid'],
    ['gh-repos', 'stack', 'Repositories'],
    ['gh-manual', 'stack', 'Manual entry'],
  ]],
  ['money', 'Money hour', '17:00 to 18:00, six days a week, on top of the eight. Never inside them.', [
    ['m-strip', 'stack', 'Money at a glance'],
    ['m-today', 'stack', "Today's fifteen"],
    ['m-board', 'stack', 'The pipeline'],
    ['m-deals', 'stack', 'Deals'],
    ['m-offers', 'stack', 'Offers'],
    ['m-plan', 'stack', 'The weekly plan'],
    ['m-gates', 'stack', 'Money gates'],
    ['m-charts', 'stack', 'Charts'],
    ['m-scripts', 'stack', 'Scripts'],
    ['m-rules', 'stack', 'Rules'],
  ]],
  ['applications', 'Applications', 'One hundred is the floor, not the target.', [
    ['a-banner', 'stack-sm', 'Application warnings'],
    ['a-summary', 'stack', 'The counter'],
    ['a-form', 'stack', 'Add an application'],
    ['a-board', 'stack', 'The funnel'],
    ['a-extra', 'stack', 'Mocks and writeups'],
  ]],
  ['ladder', 'Unlock ladder', 'What each milestone actually qualifies you for.', [
    ['ld-callout', 'stack-sm', 'The part you will not like'],
    ['ld-list', 'stack', 'The real ladder'],
    ['ld-dsa', 'stack', 'The DSA threshold table'],
    ['ld-resume', 'stack', 'What goes on the resume'],
  ]],
  ['roles', 'The seven roles', 'Ranked, with the band, the ceiling and what they actually test.', [
    ['r-list', 'stack-lg', 'The seven roles'],
    ['r-early', 'stack', 'The nine earlier roles'],
    ['r-skills', 'stack', 'The skill matrix'],
  ]],
  ['eligibility', 'Eligibility', 'What can I apply for today.', [
    ['e-banner', 'stack-sm', 'The rule'],
    ['e-headline', 'stack', 'The number'],
    ['e-now', 'stack', 'Eligible now'],
    ['e-next', 'stack', 'Next unlock'],
    ['e-dsa', 'stack', 'The DSA only ladder'],
    ['e-combos', 'stack', 'The skill combination matrix'],
    ['e-exits', 'stack', 'The four exits'],
    ['e-break', 'stack', 'When to break this plan'],
  ]],
  ['after', 'After January 2027', 'Gate 4 is not the finish line. It is where the plan changes shape.', [
    ['af-branches', 'stack', 'The three branches'],
    ['af-bridge', 'stack', 'February to March 2027'],
    ['af-shape', 'stack', 'The weekday shape when employed'],
    ['af-years', 'stack-lg', 'Year one, two and three'],
  ]],
  ['newzealand', 'New Zealand', 'Software Engineer 261313 is Tier 1 on the Green List.', [
    ['nz-tier', 'stack', 'What Tier 1 requires'],
    ['nz-wages', 'stack', 'Wage thresholds and what New Zealand pays'],
    ['nz-corrections', 'stack', 'Three corrections'],
    ['nz-timeline', 'stack', 'The timeline'],
    ['nz-cost', 'stack', 'What the move costs'],
    ['nz-salary', 'stack', 'What the salary is worth'],
    ['nz-projection', 'stack', 'Projection, not promise'],
    ['nz-unverified', 'stack', 'What could not be verified'],
  ]],
  ['everything', 'Everything A to Z', 'Every trackable item in the roadmap, in one list.', [
    ['ev-summary', 'stack', 'The global number'],
    ['ev-filters', 'stack-sm', 'Filters and search'],
    ['ev-groups', 'stack', 'Per group'],
    ['ev-list', 'stack', 'Every item'],
  ]],
  ['stats', 'Stats', 'Numbers only. No adjectives.', [
    ['st-summary', 'stack', 'Headline numbers'],
    ['st-dsa', 'stack', 'DSA against plan'],
    ['st-hours', 'stack', 'Hours by block by week'],
    ['st-days', 'stack', 'Day colours and streaks'],
    ['st-phases', 'stack', 'Completion by phase'],
    ['st-funnel', 'stack', 'Application funnel'],
    ['st-money', 'stack', 'Money received by month'],
    ['st-video', 'stack', 'Video minutes against the cap'],
  ]],
  ['profile', 'Profile', 'Your details, your links, your GitHub token and your password.', [
    ['pf-form', 'stack', 'Profile'],
    ['pf-links', 'stack', 'Your links'],
    ['pf-github', 'stack', 'GitHub'],
    ['pf-password', 'stack', 'Password'],
    ['pf-data', 'stack', 'Your data'],
  ]],
  ['review', 'Saturday review', 'Seven questions. Written, not thought about.', [
    ['rv-numbers', 'stack', 'This week in numbers'],
    ['rv-questions', 'stack', 'The seven questions'],
  ]],
  ['reference', 'Reference', 'The corrections, the pins, the skip list, and the verification log.', [
    ['rf-nav', 'stack-sm', 'Jump to'],
    ['rf-body', 'stack-lg', 'Reference tables'],
  ]],
  ['print-week', 'Printable week sheet', 'One clean week per page, for days without power.', [
    ['pw-controls', 'stack-sm', 'Choose a week'],
    ['pw-sheet', 'stack', 'The sheet'],
  ]],
];

function shell(file, title, lede, regions) {
  const head = file === 'reference'
    ? "<%- include('../partials/head') %>"
    : "<%- include('../partials/head') %>";
  const body = regions
    .map(
      ([id, cls, label]) =>
        `<section class="${cls}" id="${id}" aria-label="${label}">\n  <div class="card"><p class="muted">Loading ${label.toLowerCase()}.</p></div>\n</section>`
    )
    .join('\n\n');
  const extra =
    file === 'reference'
      ? `\n\n<section class="stack" id="rf-appendix-g" aria-label="Verification log">\n  <div class="card">\n    <div class="card__head">\n      <h2 class="card__title">Verification log</h2>\n      <span class="badge badge--outline">Read only, Appendix G</span>\n    </div>\n    <p class="text-sm muted">\n      Appendix G of final.md is a record, not seed data. It is never parsed into rows\n      and never stored in the database. It is rendered here straight from the file.\n    </p>\n    <% if (verificationLogFound) { %>\n    <div class="md md--wide"><%- verificationLogHtml %></div>\n    <% } else { %>\n    <p class="muted">Appendix G was not found in data/final.md.</p>\n    <% } %>\n  </div>\n</section>`
      : '';
  const drawer =
    file === 'calendar'
      ? `\n\n<div class="scrim" id="c-scrim" data-open="0"></div>\n<aside class="drawer" id="c-drawer" data-open="0" role="dialog" aria-modal="true" aria-labelledby="c-drawer-title" tabindex="-1">\n  <div class="drawer__head">\n    <div class="grow">\n      <h2 class="drawer__title" id="c-drawer-title">A day</h2>\n      <p class="drawer__sub" id="c-drawer-sub"></p>\n    </div>\n    <button type="button" class="iconbtn" id="c-drawer-close" aria-label="Close the day">\n      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>\n    </button>\n  </div>\n  <div class="drawer__body" id="c-drawer-body"></div>\n</aside>`
      : '';

  return `${head}

<div class="page-head">
  <h1 class="page-head__title">${title}</h1>
  <p class="page-head__lede">${lede}</p>
</div>

${body}${extra}${drawer}

<%- include('../partials/foot') %>
`;
}

await mkdir(VIEWS, { recursive: true });
let written = 0;
for (const [file, title, lede, regions] of SCREENS) {
  await writeFile(join(VIEWS, `${file}.ejs`), shell(file, title, lede, regions), 'utf8');
  written += 1;
}
console.log(`Wrote ${written} screen shells into views/screens.`);
