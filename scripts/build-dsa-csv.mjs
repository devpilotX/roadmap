/**
 * build-dsa-csv.mjs
 *
 * Turns data/striver-a2z-sheet.json into the CSV that scripts/import-dsa.mjs eats.
 *
 *   npx tsx scripts/build-dsa-csv.mjs                  writes data/striver-a2z.csv
 *   npx tsx scripts/build-dsa-csv.mjs --out=other.csv
 *   npx tsx scripts/import-dsa.mjs --file=data/striver-a2z.csv
 *
 * WHY THIS EXISTS
 *
 * `final.md` names the Striver A2Z sheet and its split of 474 problems into 152
 * easy, 186 medium and 136 hard, but it does not list the 474 problem names, so
 * `dsa_problems` shipped empty and `/dsa` could only track the 18 steps. The
 * importer was written to take a real export rather than let anybody invent
 * problem names. This script is the bridge: it converts a real export into that
 * CSV, and it refuses to do so if the export does not match what the document
 * claims.
 *
 * PROVENANCE, which matters more than the code here
 *
 *   data/striver-a2z-sheet.json was taken from
 *     github.com/Shubh-153/academic-dashboard, seed/dsa-a2z-sheet.json,
 *     pinned at commit ee2efebd73cb6e972c109ba0ca667b6e40e2000b
 *   and that file states its own origin as
 *     takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z
 *
 * It was verified against the live sheet page on 2026-08-31, and every one of the
 * eighteen per-step counts matched:
 *
 *   54, 7, 40, 32, 15, 31, 25, 18, 30, 12, 17, 15, 38, 16, 53, 55, 7, 9  = 474
 *
 * The difficulty split in the file is 152 easy, 186 medium, 136 hard, which is
 * exactly what `final.md` records. The live page now shows 151/187/136, so one
 * problem's label was changed on the site after this export was taken. The file is
 * kept as it is, because it agrees with the document the whole application is
 * derived from, and `verify-seed.mjs` checks against that document.
 *
 * ASSERTIONS BELOW ARE THE POINT. If the source file is ever replaced and the
 * numbers move, this script fails loudly rather than importing a sheet that
 * quietly disagrees with the plan.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, config } from '../lib/config.ts';
import { bad, banner, good, info, parseArgv, runScript, say, step, table } from './lib/cli.mjs';

const { values } = parseArgv(process.argv.slice(2), ['out', 'source']);

const SOURCE = values.get('source') ?? join(ROOT, 'data', 'striver-a2z-sheet.json');
const OUT = values.get('out') ?? join(ROOT, 'data', 'striver-a2z.csv');

/** The per-step counts read off takeuforward.org on 2026-08-31. */
const OFFICIAL_STEP_COUNTS = [54, 7, 40, 32, 15, 31, 25, 18, 30, 12, 17, 15, 38, 16, 53, 55, 7, 9];

/** What final.md's Appendix, and import-dsa.mjs's own CONTRACT, require. */
const CONTRACT = { total: 474, Easy: 152, Medium: 186, Hard: 136 };

/** RFC 4180: quote when the value holds a comma, a quote or a newline. */
function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  banner('build-dsa-csv');

  step('Reading the export');
  const sheet = JSON.parse(readFileSync(SOURCE, 'utf8'));
  info(`source     ${SOURCE.replace(ROOT, '.')}`);
  info(`states     ${sheet.sourceLabel ?? 'no source label'}`);
  info(`declares   ${sheet.totalProblems} problems`);

  step('Reading the 18 step names this application recognises');
  // The step names come from the application's own file, never from the export.
  // The export decorates them ("Binary Search [1D, 2D Arrays, Search Space]") and
  // names two different steps "Strings", so matching by name would be ambiguous.
  // Order is the only unambiguous key, and both lists are in sheet order.
  const topics = JSON.parse(
    readFileSync(join(ROOT, 'data', 'striver-a2z-topics.json'), 'utf8')
  ).topics;
  if (topics.length !== 18) throw new Error(`expected 18 steps, found ${topics.length}`);
  if (sheet.sections.length !== 18) {
    throw new Error(`the export has ${sheet.sections.length} sections, expected 18`);
  }
  good('18 steps, 18 sections, matched by order');

  step('Validating the export against the document');
  const rows = [];
  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  const perStep = [];
  const seen = new Set();
  let duplicates = 0;

  sheet.sections.forEach((section, index) => {
    const topic = topics[index].name;
    let n = 0;
    for (const sub of section.subcategories ?? []) {
      for (const problem of sub.problems ?? []) {
        const difficulty = problem.difficulty;
        if (!(difficulty in counts)) {
          throw new Error(`unknown difficulty "${difficulty}" on "${problem.name}"`);
        }
        counts[difficulty] += 1;
        n += 1;

        // A name repeated inside one step would collide on the unique key the
        // importer relies on. Across steps it is legitimate: "Pow(x,n)" genuinely
        // appears under both Recursion and Bit Manipulation on the real sheet.
        const key = `${index}:${String(problem.name).trim().toLowerCase()}`;
        if (seen.has(key)) duplicates += 1;
        seen.add(key);

        rows.push({
          topic,
          sub_step: sub.name?.replace(/\s+/g, ' ').trim() ?? '',
          name: String(problem.name).replace(/\s+/g, ' ').trim(),
          difficulty,
          // LeetCode first because that is where the problem is actually solved;
          // the takeuforward article is the fallback for the ones LeetCode has not
          // got. `practice` is a relative path on their site and is not a URL.
          link: problem.leetcode ?? problem.article ?? '',
        });
      }
    }
    perStep.push(n);
  });

  table(
    ['#', 'step', 'in export', 'official', ''],
    perStep.map((n, i) => [
      String(i + 1),
      topics[i].name,
      String(n),
      String(OFFICIAL_STEP_COUNTS[i]),
      n === OFFICIAL_STEP_COUNTS[i] ? 'ok' : 'MISMATCH',
    ])
  );

  const stepProblems = perStep.reduce((a, b) => a + b, 0);
  const failures = [];
  perStep.forEach((n, i) => {
    if (n !== OFFICIAL_STEP_COUNTS[i]) {
      failures.push(`step ${i + 1} has ${n} problems, the published sheet has ${OFFICIAL_STEP_COUNTS[i]}`);
    }
  });
  if (stepProblems !== CONTRACT.total) {
    failures.push(`total is ${stepProblems}, final.md requires ${CONTRACT.total}`);
  }
  for (const level of ['Easy', 'Medium', 'Hard']) {
    if (counts[level] !== CONTRACT[level]) {
      failures.push(`${level} is ${counts[level]}, final.md requires ${CONTRACT[level]}`);
    }
  }
  if (duplicates > 0) {
    failures.push(`${duplicates} problem name(s) repeat inside a single step`);
  }
  if (sheet.totalProblems !== CONTRACT.total) {
    failures.push(`the export declares ${sheet.totalProblems}, final.md requires ${CONTRACT.total}`);
  }

  if (failures.length) {
    for (const f of failures) bad(f);
    throw new Error(
      `${failures.length} check(s) failed. The export does not match what final.md records, ` +
        'so it is NOT written. Fix the source rather than the contract.'
    );
  }
  good(`474 problems, ${counts.Easy} easy / ${counts.Medium} medium / ${counts.Hard} hard`);
  good('every per-step count matches the published sheet');
  good('no duplicate problem name within any step');

  step('Writing the CSV');
  const header = ['topic', 'sub_step', 'name', 'difficulty', 'link'];
  const lines = [header.join(',')];
  for (const r of rows) lines.push(header.map((h) => csvCell(r[h])).join(','));
  // CRLF, because RFC 4180 says so and because Excel opens it without complaint.
  writeFileSync(OUT, lines.join('\r\n') + '\r\n', 'utf8');
  good(`${OUT.replace(ROOT, '.')}, ${rows.length} rows, ${(lines.join('\r\n').length / 1024).toFixed(1)} KB`);

  say('Next');
  info(`npx tsx scripts/import-dsa.mjs ${OUT.replace(ROOT, '.')}            (dry run, reports only)`);
  info(`npx tsx scripts/import-dsa.mjs ${OUT.replace(ROOT, '.')} --write    (writes dsa_problems)`);
  info(`then check the totals against ${config.roadmap.dsaSheetTotal} on /dsa`);
  return 0;
}

await runScript('build-dsa-csv', main);
