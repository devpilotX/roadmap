/**
 * verify-seed.mjs
 *
 * The count contract, enforced against the live database. Exit code 1 on any
 * mismatch, which is what makes "nothing was skipped" a testable statement.
 *
 * Two sources of truth are checked, and they must agree:
 *   1. Appendix E of data/final.md, read at run time, never hardcoded.
 *   2. Section 9.2 of the build prompt, which names a few tables Appendix E
 *      leaves out. Those are listed below with that provenance.
 *
 *   node scripts/verify-seed.mjs
 *   node scripts/verify-seed.mjs --strict   also re-runs the parser and asserts
 *                                           byte identical SQL output
 */

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../src/config.mjs';
import { closePool, query, scalar } from '../src/db/pool.mjs';
import { MdDoc } from './lib/md.mjs';
import { seedContract } from './lib/extract/appendix.mjs';

const args = new Set(process.argv.slice(2));

/** Named in section 9.2 of the build prompt but not in Appendix E of final.md. */
const EXTRA_CONTRACT = [
  { table: 'skills', expected: 25, source: 'build prompt section 9.2, Part 12 skill matrix' },
  { table: 'costs', expected: 4, source: 'build prompt section 9.2, Part 14' },
];

const failures = [];
const passes = [];

function check(label, actual, expected, extra = '') {
  const ok = actual === expected;
  (ok ? passes : failures).push({ label, actual, expected, extra });
  const mark = ok ? 'ok  ' : 'FAIL';
  const suffix = ok ? '' : `   expected ${expected}, got ${actual}`;
  console.log(`  ${mark} ${label.padEnd(58)} ${String(actual).padStart(6)}${suffix}${extra ? `  ${extra}` : ''}`);
}

function checkTrue(label, ok, detail = '') {
  (ok ? passes : failures).push({ label, actual: ok, expected: true, extra: detail });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(58)} ${ok ? '' : detail}`);
}

async function count(table) {
  return Number(await scalar(`SELECT COUNT(*) AS c FROM \`${table}\``));
}

async function main() {
  console.log('Reading the contract from Appendix E of data/final.md');
  const md = await readFile(join(ROOT, 'data', 'final.md'), 'utf8');
  const doc = new MdDoc(md);
  const contract = seedContract(doc);
  console.log(`  ${contract.length} rows in the Appendix E contract`);
  console.log('');

  /* ---------------------------------------------- 1. Row count contract */
  console.log('1. Row counts, Appendix E of final.md');
  for (const c of contract) {
    if (c.table === 'dsa_problems') continue; // handled in section 4
    check(`${c.table}`, await count(c.table), c.expected);
  }
  console.log('');
  console.log('2. Row counts, build prompt section 9.2 additions');
  for (const c of EXTRA_CONTRACT) {
    check(`${c.table}`, await count(c.table), c.expected, `(${c.source})`);
  }
  console.log('');

  /* ------------------------------------------------- 3. Calendar shape */
  console.log('3. The 150 day calendar');
  const cal = await query('SELECT cal_date, week_n, day_label, kind, dsa_target FROM calendar_days ORDER BY cal_date');
  check('calendar_days rows', cal.length, 150);
  checkTrue('starts 2026-08-28', cal[0]?.cal_date === '2026-08-28', `got ${cal[0]?.cal_date}`);
  checkTrue(
    'ends 2027-01-24',
    cal[cal.length - 1]?.cal_date === '2027-01-24',
    `got ${cal[cal.length - 1]?.cal_date}`
  );

  let gaps = 0;
  for (let i = 1; i < cal.length; i += 1) {
    const prev = new Date(`${cal[i - 1].cal_date}T00:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() + 1);
    if (prev.toISOString().slice(0, 10) !== cal[i].cal_date) gaps += 1;
  }
  check('gaps or duplicates in the date sequence', gaps, 0);

  const distinct = Number(await scalar('SELECT COUNT(DISTINCT cal_date) AS c FROM calendar_days'));
  check('distinct dates', distinct, 150);

  const byKind = Object.fromEntries(
    (await query('SELECT kind, COUNT(*) AS c FROM calendar_days GROUP BY kind')).map((r) => [r.kind, Number(r.c)])
  );
  check('launch rows', byKind.launch ?? 0, 3);
  check('study rows', byKind.study ?? 0, 126);
  check(
    'roadmap Sunday rows',
    (byKind.sunday_working ?? 0) + (byKind.sunday_gate ?? 0) + (byKind.sunday_rest ?? 0),
    21
  );
  check('working Sundays', byKind.sunday_working ?? 0, 10);
  check('gate audit Sundays', byKind.sunday_gate ?? 0, 4);
  check('rest Sundays', byKind.sunday_rest ?? 0, 7);

  const sums = await one2(
    `SELECT
       SUM(CASE WHEN kind = 'study' THEN dsa_target ELSE 0 END)  AS study_sum,
       SUM(CASE WHEN kind = 'launch' THEN dsa_target ELSE 0 END) AS launch_sum,
       SUM(CASE WHEN kind LIKE 'sunday_%' THEN dsa_target ELSE 0 END) AS sunday_sum,
       SUM(dsa_target) AS total_sum
     FROM calendar_days`
  );
  check('DSA target sum over the 126 study rows', Number(sums.study_sum), 415);
  check('DSA target sum over the 3 launch rows', Number(sums.launch_sum), 6);
  check('DSA target sum over the 21 Sunday rows', Number(sums.sunday_sum), 0);
  check('DSA target sum over the whole table', Number(sums.total_sum), 421);

  const weekdayWrong = cal.filter((r) => {
    const names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const d = new Date(`${r.cal_date}T00:00:00Z`);
    return names[(d.getUTCDay() + 6) % 7] !== r.day_label;
  });
  check('rows whose weekday name is wrong', weekdayWrong.length, 0);
  console.log('');

  /* ------------------------------------------------ 4. DSA problem set */
  console.log('4. The Striver A2Z problem set');
  const problems = await count('dsa_problems');
  check('dsa_topics rows', await count('dsa_topics'), 18, '(the 18 A2Z steps)');
  if (problems === 0) {
    console.log(
      '  note dsa_problems is empty. Section 9.3 permits this: final.md does not\n' +
        '       contain the 474 problem names and they are never invented. Run\n' +
        '       node scripts/import-dsa.mjs --file <export.csv> to fill it. Until then\n' +
        '       /dsa shows topic level progress and says so on the screen.'
    );
  } else {
    check('dsa_problems rows', problems, 474);
    const diff = Object.fromEntries(
      (await query('SELECT difficulty, COUNT(*) AS c FROM dsa_problems GROUP BY difficulty')).map((r) => [
        r.difficulty,
        Number(r.c),
      ])
    );
    check('Easy problems', diff.Easy ?? 0, 152);
    check('Medium problems', diff.Medium ?? 0, 186);
    check('Hard problems', diff.Hard ?? 0, 136);
  }
  console.log('');

  /* -------------------------------------------- 5. Cross table integrity */
  console.log('5. Cross table integrity');
  check(
    'weeks whose start or end date is not in calendar_days',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM weeks w
        WHERE NOT EXISTS (SELECT 1 FROM calendar_days c WHERE c.cal_date = w.start_date)
           OR NOT EXISTS (SELECT 1 FROM calendar_days c WHERE c.cal_date = w.end_date)`)
    ),
    0
  );
  check(
    'week_days whose cal_date is not a study day of the same week',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM week_days d
        LEFT JOIN calendar_days c ON c.cal_date = d.cal_date
        WHERE c.cal_date IS NULL OR c.kind <> 'study' OR c.week_n <> d.week_n`)
    ),
    0
  );
  check(
    'week_days whose text differs from Appendix C',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM week_days d
        JOIN calendar_days c ON c.cal_date = d.cal_date
        WHERE c.learn_task <> d.learn_task
           OR c.build_task <> d.build_task
           OR c.dsa_target <> d.dsa_day_target`)
    ),
    0
  );
  check(
    'gates whose date is not the end of their week',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM gates g
        LEFT JOIN weeks w ON w.n = g.week_n
        WHERE w.n IS NULL OR w.end_date <> g.gate_date`)
    ),
    0
  );
  check(
    'gate dates that are not a Sunday',
    Number(await scalar('SELECT COUNT(*) AS c FROM gates WHERE DAYOFWEEK(gate_date) <> 1')),
    0
  );
  check(
    'Sundays whose calendar kind disagrees with Part 3',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM sundays s
        LEFT JOIN calendar_days c ON c.cal_date = s.sunday_date
        WHERE c.cal_date IS NULL OR c.kind <> CONCAT('sunday_', s.kind) OR c.week_n <> s.week_n`)
    ),
    0
  );
  check(
    'weeks whose cumulative DSA figure breaks the running total',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM weeks w
        WHERE w.dsa_cumulative <> (SELECT SUM(x.dsa_target) FROM weeks x WHERE x.n <= w.n)`)
    ),
    0
  );
  check('week 21 cumulative DSA figure', Number(await scalar('SELECT dsa_cumulative FROM weeks WHERE n = 21')), 415);
  check(
    'eligibility_weeks rows whose DSA total disagrees with Part 3',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM eligibility_weeks e
        JOIN weeks w ON w.n = e.week_n
        WHERE e.dsa_total <> w.dsa_cumulative`)
    ),
    0
  );
  check(
    'weeks that do not hold exactly six day rows',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM (
        SELECT week_n FROM week_days GROUP BY week_n HAVING COUNT(*) <> 6
      ) AS bad`)
    ),
    0
  );
  check(
    'weeks with no links',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM weeks w
        WHERE NOT EXISTS (SELECT 1 FROM week_links l WHERE l.week_n = w.n)`)
    ),
    0
  );
  check(
    'week_links pointing at a resource that does not exist',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM week_links l
        WHERE l.resource_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM resources r WHERE r.id = l.resource_id)`)
    ),
    0
  );
  check(
    'links that are not absolute https URLs',
    Number(
      await scalar(`SELECT
        (SELECT COUNT(*) FROM resources WHERE url NOT LIKE 'https://%')
        + (SELECT COUNT(*) FROM week_links WHERE url NOT LIKE 'https://%') AS c`)
    ),
    0
  );
  check(
    'money_week_targets week 21 low target',
    Number(await scalar('SELECT target_low FROM money_week_targets WHERE week_n = 21')),
    90000
  );
  check(
    'offers locked behind a week',
    Number(await scalar('SELECT COUNT(*) AS c FROM offers WHERE unlocked_from_week IS NOT NULL')),
    1,
    '(O7 only)'
  );
  check(
    'O7 unlock week',
    Number(await scalar("SELECT unlocked_from_week FROM offers WHERE code = 'O7'")),
    17
  );
  check(
    'fast exits dated before Gate 3 that carry a rupee cost',
    Number(await scalar('SELECT COUNT(*) AS c FROM fast_exits WHERE before_gate3 = 1 AND cost_note IS NOT NULL')),
    2
  );
  check(
    'fast exits dated before Gate 3',
    Number(await scalar('SELECT COUNT(*) AS c FROM fast_exits WHERE before_gate3 = 1')),
    2
  );
  check(
    'first advised eligibility week',
    Number(await scalar('SELECT MIN(week_n) AS c FROM eligibility_weeks WHERE is_advised = 1')),
    15
  );
  check(
    'red warnings',
    Number(await scalar("SELECT COUNT(*) AS c FROM warning_rules WHERE level = 'red'")),
    6
  );
  check(
    'orange warnings',
    Number(await scalar("SELECT COUNT(*) AS c FROM warning_rules WHERE level = 'orange'")),
    4
  );
  check(
    'Appendix G sections stored in doc_sections',
    Number(await scalar("SELECT COUNT(*) AS c FROM doc_sections WHERE heading LIKE 'Appendix G%' OR heading LIKE 'G.%'")),
    0,
    '(final.md forbids seeding it)'
  );
  check(
    'resource categories with no links',
    Number(
      await scalar(`SELECT COUNT(*) AS c FROM resource_categories rc
        WHERE NOT EXISTS (SELECT 1 FROM resources r WHERE r.category_no = rc.no)`)
    ),
    0
  );
  console.log('');

  /* --------------------------------------------- 6. Counts with no contract */
  console.log('6. Tables with no count in Appendix E, reported for the record');
  const extras = [
    'resources', 'week_learn', 'week_build', 'week_ships', 'week_traps', 'week_notes',
    'clock_facts', 'day_blocks', 'subjects', 'launch_days', 'dsa_pace', 'dsa_month_checkpoints',
    'dsa_thresholds', 'role_unlocks', 'resume_stages', 'skip_list', 'do_not_buy', 'added_topics',
    'continuation', 'nz_requirements', 'nz_facts', 'nz_corrections', 'nz_milestones',
    'nz_unverified', 'money_rules', 'money_lanes', 'money_hour_shape', 'lead_sources',
    'money_scripts', 'money_refuse', 'money_month_targets', 'money_buyback', 'money_first_hour',
    'done_conditions', 'github_rules', 'review_questions', 'honesty_rules', 'export_rules',
    'eligibility_definitions', 'break_plan', 'owned_courses', 'course_rulings',
    'course_topic_map', 'video_rules', 'falsifier', 'night_segments', 'machine_inventory',
    'focus_rules', 'honesty_tests', 'tracking_files', 'doc_sections',
  ];
  for (const t of extras) {
    const c = await count(t);
    console.log(`       ${t.padEnd(30)} ${String(c).padStart(6)}`);
    if (c === 0) failures.push({ label: `${t} is empty`, actual: 0, expected: '> 0' });
  }
  console.log('');

  /* ------------------------------------------- 7. Byte identical seed output */
  if (args.has('--strict')) {
    console.log('7. Parser determinism, section 20.7');
    const before = {};
    for (const f of ['002_seed_reference.sql', '003_seed_calendar.sql', '004_seed_money.sql']) {
      before[f] = createHash('sha256')
        .update(await readFile(join(ROOT, 'migrations', f), 'utf8'), 'utf8')
        .digest('hex');
    }
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'seed-from-md.mjs')], { stdio: 'ignore' });
    for (const [f, hash] of Object.entries(before)) {
      const after = createHash('sha256')
        .update(await readFile(join(ROOT, 'migrations', f), 'utf8'), 'utf8')
        .digest('hex');
      checkTrue(`${f} is byte identical after a re-parse`, after === hash, `${hash} then ${after}`);
    }
    console.log('');
  }

  /* ------------------------------------------------------------ verdict */
  console.log('-'.repeat(78));
  if (failures.length === 0) {
    console.log(`SEED VERIFIED. ${passes.length} assertions passed, 0 failed.`);
    return 0;
  }
  console.log(`SEED VERIFICATION FAILED. ${passes.length} passed, ${failures.length} failed:`);
  for (const f of failures) {
    console.log(`  - ${f.label}: expected ${f.expected}, got ${f.actual} ${f.extra ?? ''}`);
  }
  return 1;
}

async function one2(sql) {
  const rows = await query(sql);
  return rows[0];
}

let code = 1;
try {
  code = await main();
} catch (err) {
  console.error(`\nVERIFY FAILED, unexpected error: ${err.message}`);
  console.error(err.stack);
  code = 1;
}
await closePool();
process.exit(code);
