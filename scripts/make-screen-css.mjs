/**
 * make-screen-css.mjs | one off generator for the per screen stylesheets.
 *
 * Most screens are built entirely from components.css. The rules below are only
 * the ones a specific screen genuinely needs, so nothing is duplicated.
 *
 *   node scripts/make-screen-css.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'public', 'css', 'screens');

const FILES = {
  calendar: `/* Month grid: six study columns plus a distinct Sunday column, Monday first. */

.calgrid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1.05fr);
  gap: 6px;
}

.calgrid__head {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 0 var(--s1) var(--s1);
}

.calgrid__head--sunday {
  color: var(--blue);
}

.calcell {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 2px;
  min-height: 82px;
  padding: var(--s2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--canvas);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease), background var(--dur) var(--ease);
}

.calcell:hover {
  border-color: var(--blue);
}

.calcell--empty {
  background: transparent;
  border-color: transparent;
  cursor: default;
  min-height: 0;
}

.calcell--sunday {
  background: var(--soft);
}

.calcell--rest {
  border-style: dashed;
}

.calcell--gate {
  border-color: var(--orange);
  border-width: 2px;
}

.calcell--launch {
  background: var(--blue-soft);
}

.calcell--today {
  box-shadow: 0 0 0 2px var(--blue);
}

.calcell--future .calcell__date {
  color: var(--muted);
}

.calcell__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.calcell__date {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
  font-variant-numeric: tabular-nums;
}

.calcell__week {
  font-size: 10px;
  color: var(--muted);
  font-family: var(--mono);
}

.calcell__mid {
  font-size: var(--text-xs);
  color: var(--muted);
  overflow: hidden;
}

.calcell__bottom {
  display: flex;
  align-items: center;
  gap: 4px;
}

.calcell__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--surface);
}

.calcell__dot--green { background: var(--green); }
.calcell__dot--amber { background: var(--orange); }
.calcell__dot--red { background: var(--red); }
.calcell__dot--neutral { background: var(--border); }

.calcell__dsa {
  font-size: 10px;
  font-family: var(--mono);
  color: var(--muted);
  margin-left: auto;
}

.calcell__push {
  width: 12px;
  height: 12px;
  stroke: var(--green);
  stroke-width: 2;
  fill: none;
}

.calmonth {
  margin-bottom: var(--s5);
}

.calmonth__title {
  font-size: var(--text-md);
  margin-bottom: var(--s2);
}

/* Week strip and single day views. */
.weekstrip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.dayview .calcell {
  min-height: 160px;
}

@media (max-width: 860px) {
  .calgrid,
  .weekstrip {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .calgrid__head {
    display: none;
  }
  .calcell--empty {
    display: none;
  }
}

@media (max-width: 480px) {
  .calgrid,
  .weekstrip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media print {
  .calgrid {
    grid-template-columns: repeat(7, 1fr);
  }
  .calcell {
    min-height: 120px;
    break-inside: avoid;
  }
}
`,

  weeks: `/* 21 cards in six phase colour groups. */

.phasegroup {
  margin-bottom: var(--s6);
}

.phasegroup__head {
  display: flex;
  align-items: baseline;
  gap: var(--s2);
  margin-bottom: var(--s3);
}

.phasegroup__code {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  background: var(--phase, var(--muted));
  color: #fff;
  font-weight: var(--weight-bold);
  font-size: var(--text-sm);
  flex: 0 0 auto;
}

.weekcard {
  display: grid;
  gap: var(--s2);
  padding: var(--s4);
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  border-top: 3px solid var(--phase, var(--border));
  text-decoration: none;
  color: var(--ink);
  transition: border-color var(--dur) var(--ease), transform var(--dur) var(--ease);
}

.weekcard:hover {
  text-decoration: none;
  transform: translateY(-1px);
  border-color: var(--blue);
}

.weekcard--current {
  box-shadow: 0 0 0 2px var(--blue);
}

.weekcard__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
}

.weekcard__n {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  font-variant-numeric: tabular-nums;
}

.weekcard__dates {
  font-size: var(--text-xs);
  color: var(--muted);
}

.weekcard__title {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  line-height: 1.35;
}

.weekcard__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s2);
  font-size: var(--text-xs);
  color: var(--muted);
}

/* Week detail: the six day table. */
.daytable td:first-child {
  white-space: nowrap;
  font-weight: var(--weight-semibold);
}

.daytable .tick {
  margin: 0;
  min-height: 32px;
}
`,

  dsa: `.dsatopic {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  overflow: hidden;
}

.dsatopic + .dsatopic {
  margin-top: var(--s2);
}

.dsatopic__head {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  gap: var(--s3);
  align-items: center;
  padding: var(--s3) var(--s4);
  min-height: var(--tap);
  cursor: pointer;
  list-style: none;
}

.dsatopic__head::-webkit-details-marker {
  display: none;
}

.dsatopic__ord {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--muted);
  width: 22px;
}

.dsatopic__meter {
  width: 110px;
}

.dsatopic__body {
  padding: 0 var(--s4) var(--s4);
}

.difficulty {
  font-family: var(--mono);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
}

.difficulty--Easy { color: var(--green); }
.difficulty--Medium { color: var(--orange); }
.difficulty--Hard { color: var(--red); }
`,

  library: `.catcard {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  overflow: hidden;
}

.catcard + .catcard {
  margin-top: var(--s3);
}

.catcard__head {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  min-height: var(--tap);
  cursor: pointer;
  list-style: none;
  background: var(--soft);
}

.catcard__head::-webkit-details-marker {
  display: none;
}

.catcard__no {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--muted);
}

.catcard__body {
  padding: 0 var(--s4) var(--s3);
}
`,

  projects: `.projcard {
  padding: var(--s5);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
}

.projcard--active {
  border-color: var(--blue);
  border-width: 2px;
}

.projcard__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--s3);
  flex-wrap: wrap;
  margin-bottom: var(--s3);
}

.projcard__code {
  font-family: var(--mono);
  font-size: var(--text-sm);
  font-weight: var(--weight-bold);
  color: var(--muted);
}

.readmelist {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 2px;
}
`,

  gates: `.gatecard {
  padding: var(--s5);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  display: grid;
  gap: var(--s3);
}

.gatecard--passed {
  border-left: 3px solid var(--green);
}

.gatecard--overdue {
  border-left: 3px solid var(--red);
}

.gatecard--soon {
  border-left: 3px solid var(--orange);
}

.gatecard__no {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
}

.gatecard__days {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  line-height: 1;
}
`,

  sundays: `.sundayrow {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  gap: var(--s3);
  align-items: center;
  padding: var(--s3);
  border-bottom: 1px solid var(--border);
}

.sundayrow:last-child {
  border-bottom: 0;
}

.sundayrow--rest {
  background: var(--soft);
}

.sundayrow--gate {
  background: var(--orange-soft);
}

.sundayrow__week {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--muted);
  width: 34px;
}
`,

  pushes: `.heatgrid {
  width: 100%;
  max-width: 760px;
}

.heatcell {
  fill: var(--surface);
  stroke: transparent;
}

.heatcell--l1 { fill: color-mix(in srgb, var(--green) 25%, var(--surface)); }
.heatcell--l2 { fill: color-mix(in srgb, var(--green) 50%, var(--surface)); }
.heatcell--l3 { fill: color-mix(in srgb, var(--green) 75%, var(--surface)); }
.heatcell--l4 { fill: var(--green); }
.heatcell--flag { fill: var(--orange); }
.heatcell--today { stroke: var(--blue); }

.repolist {
  display: grid;
  gap: var(--s2);
}

.repolist__row {
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  gap: var(--s3);
  align-items: center;
  padding: var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--canvas);
}

.repolist__row--client {
  opacity: 0.75;
  border-style: dashed;
}
`,

  money: `.moneystrip {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--gap);
}

.scriptcard {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  overflow: hidden;
}

.scriptcard + .scriptcard {
  margin-top: var(--s2);
}

.scriptcard__head {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s3) var(--s4);
  min-height: var(--tap);
  cursor: pointer;
  list-style: none;
}

.scriptcard__head::-webkit-details-marker {
  display: none;
}

.scriptcard__body {
  padding: 0 var(--s4) var(--s4);
}

.scriptbody {
  white-space: pre-wrap;
  font-family: var(--font);
  background: var(--soft);
  border-left: 3px solid var(--border);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  padding: var(--s3);
  margin: 0 0 var(--s3);
  max-width: var(--measure);
}

.offercard {
  display: grid;
  gap: var(--s2);
  padding: var(--s4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
}

.offercard--locked {
  border-style: dashed;
  background: var(--soft);
}

.offercard__code {
  font-family: var(--mono);
  font-weight: var(--weight-bold);
  font-size: var(--text-sm);
}

.offercard__price {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.touchrow {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--s3);
  align-items: center;
  padding: var(--s3) 0;
  border-bottom: 1px solid var(--border);
}

.touchrow:last-child {
  border-bottom: 0;
}
`,

  applications: `.funnelbar {
  display: grid;
  gap: var(--s2);
}

.funnelbar__row {
  display: grid;
  grid-template-columns: 100px 1fr 56px;
  gap: var(--s3);
  align-items: center;
  font-size: var(--text-sm);
}

.appcounter {
  display: grid;
  gap: var(--s2);
}

.appcounter__value {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  line-height: 1;
}
`,

  ladder: `.milestone {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--s4);
  padding: var(--s4) 0;
  border-bottom: 1px solid var(--border);
}

.milestone:last-child {
  border-bottom: 0;
}

.milestone__marker {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid var(--border);
  background: var(--canvas);
  flex: 0 0 auto;
}

.milestone__marker svg {
  width: 15px;
  height: 15px;
  stroke: var(--muted);
  stroke-width: 2.2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.milestone--unlocked .milestone__marker {
  border-color: var(--green);
  background: var(--green);
}

.milestone--unlocked .milestone__marker svg {
  stroke: #fff;
}

.milestone--gate .milestone__marker {
  border-width: 3px;
}
`,

  roles: `.rolecard {
  padding: var(--s5);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  display: grid;
  gap: var(--s3);
}

.rolecard--primary {
  border-color: var(--blue);
  border-width: 2px;
}

.rolecard__rank {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--muted);
}

.rolecard__band {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
}

.skillrow__have {
  color: var(--green);
  font-weight: var(--weight-semibold);
}

.skillrow__not {
  color: var(--muted);
}
`,

  eligibility: `.eligbanner {
  padding: var(--s4) var(--s5);
  border-radius: var(--radius);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
}

.eligbanner--red {
  background: var(--red-soft);
  color: color-mix(in srgb, var(--red) 82%, var(--ink));
  border: 1px solid color-mix(in srgb, var(--red) 30%, transparent);
}

.eligbanner--green {
  background: var(--green-soft);
  color: color-mix(in srgb, var(--green) 82%, var(--ink));
  border: 1px solid color-mix(in srgb, var(--green) 30%, transparent);
}

.eligheadline {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  line-height: 1.1;
  letter-spacing: -0.02em;
  max-width: 30ch;
}

.eligchips {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--s2);
}

.eligchip {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--s3);
  align-items: center;
  padding: var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
}

.eligchip--weak {
  border-style: dashed;
}

.exitcard {
  padding: var(--s4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  display: grid;
  gap: var(--s2);
}

.exitcard--costly {
  border-color: color-mix(in srgb, var(--red) 40%, transparent);
  background: var(--red-soft);
}

.exitcost {
  font-weight: var(--weight-semibold);
  color: color-mix(in srgb, var(--red) 82%, var(--ink));
}

.costheading {
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  color: color-mix(in srgb, var(--red) 82%, var(--ink));
}

@media (max-width: 640px) {
  .eligheadline {
    font-size: var(--text-xl);
  }
}
`,

  after: `.branchcard {
  padding: var(--s4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  display: grid;
  gap: var(--s2);
}

.branchcard__letter {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  line-height: 1;
}
`,

  newzealand: `.nzsplit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--gap);
  align-items: stretch;
}

@media (max-width: 820px) {
  .nzsplit {
    grid-template-columns: minmax(0, 1fr);
  }
}

.nztotal {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  line-height: 1.05;
}

.nzinvestor {
  background: var(--red-soft);
  border-color: color-mix(in srgb, var(--red) 30%, transparent);
}

.nzinvestor__figure {
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
}

.nzgap {
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  color: color-mix(in srgb, var(--red) 82%, var(--ink));
}
`,

  everything: `.evrow {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--s3);
  align-items: start;
  padding: var(--s2) var(--s3);
  border-bottom: 1px solid var(--border);
}

.evrow:last-child {
  border-bottom: 0;
}

.evrow__state {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  margin-top: 3px;
  flex: 0 0 auto;
  background: var(--surface);
}

.evrow__state--done { background: var(--green); }
.evrow__state--partial { background: var(--orange); }
.evrow__state--todo { background: var(--surface); border: 1px solid var(--border); }
.evrow__state--reference { background: transparent; border: 1px dashed var(--border); }

.evrow__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
}

.evrow__text {
  font-size: var(--text-xs);
  color: var(--muted);
}

.evgroups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: var(--s2);
}

.evgroup {
  display: grid;
  gap: var(--s1);
  padding: var(--s3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--canvas);
}

.evglobal {
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  line-height: 1;
}
`,

  stats: `.statsection {
  padding: var(--s5);
}

.hourbar {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: var(--s3);
  align-items: center;
  font-size: var(--text-xs);
}

.hourbar__track {
  display: flex;
  height: 14px;
  border-radius: var(--radius-pill);
  overflow: hidden;
  background: var(--surface);
}

.hourbar__seg {
  height: 100%;
}

.hourbar__seg--DSA { background: var(--blue); }
.hourbar__seg--LEARN { background: var(--green); }
.hourbar__seg--BUILD { background: var(--phase-d); }
.hourbar__seg--CLOSE { background: var(--phase-b); }
.hourbar__seg--MONEY { background: var(--orange); }
.hourbar__seg--NIGHT { background: var(--muted); }

.colourstrip {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}

.colourstrip__day {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--surface);
}

.colourstrip__day--green { background: var(--green); }
.colourstrip__day--amber { background: var(--orange); }
.colourstrip__day--red { background: var(--red); }
.colourstrip__day--neutral { background: var(--border); }
`,

  profile: `.avatarrow {
  display: flex;
  align-items: center;
  gap: var(--s4);
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--surface);
  display: grid;
  place-items: center;
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--muted);
  overflow: hidden;
  flex: 0 0 auto;
}

.linklist {
  display: grid;
  gap: var(--s2);
}

.linklist__row {
  display: grid;
  grid-template-columns: 20px 1fr;
  gap: var(--s3);
  align-items: center;
  font-size: var(--text-sm);
}

.linklist__icon {
  width: 18px;
  height: 18px;
  stroke: var(--muted);
  stroke-width: 1.7;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
`,

  review: `.qcard {
  padding: var(--s4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--canvas);
  display: grid;
  gap: var(--s2);
}

.qcard__n {
  font-family: var(--mono);
  font-size: var(--text-xs);
  color: var(--muted);
}

.qcard__q {
  font-weight: var(--weight-medium);
}
`,

  reference: `.refnav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  position: sticky;
  top: 56px;
  z-index: 10;
  padding: var(--s3);
  background: color-mix(in srgb, var(--soft) 92%, transparent);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.refsection {
  scroll-margin-top: 120px;
}
`,

  'print-week': `.sheet {
  background: var(--canvas);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: var(--s6);
  max-width: 900px;
}

.sheet__head {
  border-bottom: 2px solid var(--ink);
  padding-bottom: var(--s3);
  margin-bottom: var(--s4);
}

.sheet__title {
  font-size: var(--text-xl);
}

.sheet table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.sheet th,
.sheet td {
  border: 1px solid var(--border);
  padding: var(--s2);
  text-align: left;
  vertical-align: top;
}

.sheet__box {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1.5px solid var(--ink);
  border-radius: 3px;
  vertical-align: middle;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }
  .sheet {
    border: 0;
    padding: 0;
    max-width: none;
    break-after: page;
  }
  .page-head,
  .no-print {
    display: none !important;
  }
}
`,
};

await mkdir(DIR, { recursive: true });
let n = 0;
for (const [name, css] of Object.entries(FILES)) {
  await writeFile(join(DIR, `${name}.css`), css, 'utf8');
  n += 1;
}
console.log(`Wrote ${n} screen stylesheets into public/css/screens.`);
