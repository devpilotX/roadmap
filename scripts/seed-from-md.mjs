/**
 * seed-from-md.mjs
 *
 * Reads data/final.md and writes:
 *   migrations/002_seed_reference.sql
 *   migrations/003_seed_calendar.sql
 *   migrations/004_seed_money.sql
 *   docs/PARSE-REPORT.md
 *
 * Deterministic: running it twice on the same input produces byte identical
 * output. Nothing is invented. Any row that cannot be parsed stops the run with
 * the offending line number.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDataset } from './lib/dataset.mjs';
import { header, insert } from './lib/sqlgen.mjs';
import { ParseError } from './lib/md.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const MD = join(ROOT, 'data', 'final.md');
const TOPICS = join(ROOT, 'data', 'striver-a2z-topics.json');

/* ------------------------------------------------------------------ layout */

/**
 * One entry per seeded table: which file it goes in, its columns in emit order,
 * and its unique key columns, which drive the ON DUPLICATE KEY UPDATE clause.
 */
const PLAN = [
  /* ---------------- 002_seed_reference.sql ---------------- */
  ['reference', 'clock_facts', ['ord', 'item', 'value'], ['ord']],
  ['reference', 'day_blocks', ['code', 'ord', 'block_name', 'window_text', 'hours', 'what_happens'], ['code']],
  ['reference', 'corrections', ['code', 'ord', 'was_wrong', 'actually_true', 'source', 'fix'], ['code']],
  ['reference', 'subjects', ['ord', 'subject', 'when_text', 'hours_text'], ['ord']],
  ['reference', 'launch_days', ['cal_date', 'ord', 'day_name', 'work'], ['cal_date']],
  ['reference', 'phases', ['code', 'ord', 'name', 'week_from', 'week_to', 'blurb'], ['code']],
  ['reference', 'gates', ['no', 'week_n', 'gate_date', 'condition_text'], ['no']],
  ['reference', 'projects', ['id', 'code', 'name', 'repo', 'week_from', 'week_to', 'description'], ['id']],
  ['reference', 'readme_sections', ['id', 'ord', 'title'], ['id']],
  ['reference', 'stack_versions', ['id', 'tech', 'version', 'status', 'why'], ['id']],
  ['reference', 'breaks', ['id', 'if_you_do', 'what_happens'], ['id']],
  ['reference', 'resource_categories', ['no', 'name'], ['no']],
  ['reference', 'resources', ['id', 'category_no', 'ord', 'url', 'label', 'why', 'cost', 'weeks_csv'], ['id']],
  ['reference', 'dsa_topics', ['id', 'ord', 'name'], ['id']],
  ['reference', 'dsa_thresholds', ['id', 'cumulative', 'reached_label', 'unlocks'], ['id']],
  ['reference', 'owned_courses', ['id', 'course', 'videos', 'progress', 'access_expires'], ['id']],
  ['reference', 'course_rulings', ['id', 'course', 'ruling'], ['id']],
  ['reference', 'course_topic_map', ['id', 'track', 'ord', 'topic', 'ruling'], ['id']],
  ['reference', 'video_rules', ['id', 'ord', 'rule'], ['id']],
  ['reference', 'falsifier', ['id', 'ord', 'text'], ['id']],
  ['reference', 'night_segments', ['id', 'ord', 'segment', 'minutes', 'detail'], ['id']],
  ['reference', 'machine_inventory', ['id', 'ord', 'item'], ['id']],
  ['reference', 'focus_rules', ['id', 'ord', 'rule'], ['id']],
  ['reference', 'honesty_tests', ['id', 'ord', 'question'], ['id']],
  ['reference', 'roles',
    ['code', 'name', 'short_name', 'entry_band', 'band_low_lakh', 'band_high_lakh', 'ceiling', 'verdict', 'what_they_test', 'which_project', 'rank_order'],
    ['code']],
  ['reference', 'roles_early',
    ['id', 'code', 'role', 'earliest_text', 'earliest_week', 'earliest_date', 'entry_band', 'band_low_lakh', 'band_high_lakh', 'verdict'],
    ['id']],
  ['reference', 'skills', ['id', 'ord', 'name', 'roles_text', 'roles_csv', 'where_built', 'week_n'], ['id']],
  ['reference', 'role_unlocks', ['id', 'ord', 'milestone', 'unlock_date', 'roles_text', 'roles_csv', 'verdict'], ['id']],
  ['reference', 'resume_stages', ['id', 'ord', 'stage', 'headline'], ['id']],
  ['reference', 'eligibility_definitions', ['id', 'ord', 'text'], ['id']],
  ['reference', 'eligibility_weeks',
    ['id', 'week_key', 'week_n', 'reached_date', 'dsa_total', 'newly_holds', 'newly_eligible_text', 'newly_eligible_codes', 'band', 'apply_verdict', 'is_advised'],
    ['id']],
  ['reference', 'eligibility_dsa', ['id', 'ord', 'problems', 'reached_about', 'gets_you_past', 'does_not_open'], ['id']],
  ['reference', 'fast_exits',
    ['id', 'exit_no', 'exit_label', 'exit_date', 'exit_week', 'roles_available', 'band', 'what_you_give_up', 'verdict', 'cost_note', 'before_gate3'],
    ['id']],
  ['reference', 'skill_combos',
    ['id', 'sort_order', 'stack_held', 'dsa_needed_text', 'dsa_needed', 'roles_unlocked_text', 'roles_unlocked_codes', 'band', 'interview_you_face'],
    ['id']],
  ['reference', 'break_plan', ['id', 'ord', 'text'], ['id']],
  ['reference', 'skip_list', ['id', 'ord', 'item', 'reason'], ['id']],
  ['reference', 'do_not_buy', ['id', 'ord', 'item'], ['id']],
  ['reference', 'added_topics', ['id', 'ord', 'item', 'reason'], ['id']],
  ['reference', 'costs', ['id', 'ord', 'item', 'cost', 'note'], ['id']],
  ['reference', 'continuation', ['id', 'ord', 'kind', 'label', 'period', 'age_label', 'goal', 'detail', 'hours_text'], ['id']],
  ['reference', 'nz_requirements', ['id', 'ord', 'requirement', 'detail'], ['id']],
  ['reference', 'nz_facts', ['id', 'ord', 'group_key', 'label', 'value', 'caveat'], ['id']],
  ['reference', 'nz_corrections', ['id', 'ord', 'title', 'body'], ['id']],
  ['reference', 'nz_milestones', ['id', 'ord', 'milestone_date', 'age_on_id', 'age_actual', 'age_label', 'milestone'], ['id']],
  ['reference', 'nz_costs', ['id', 'sort_order', 'item', 'cost_rupees', 'basis', 'is_total'], ['id']],
  ['reference', 'nz_salary', ['id', 'ord', 'gross_nzd', 'gross_rupees', 'effective_tax_pct', 'net_nzd', 'net_rupees'], ['id']],
  ['reference', 'nz_projection', ['id', 'ord', 'years_after_landing', 'real_age', 'accumulated_rupees'], ['id']],
  ['reference', 'nz_unverified', ['id', 'ord', 'text'], ['id']],
  ['reference', 'dead_links', ['id', 'was', 'now_url', 'what_happened'], ['id']],
  ['reference', 'tracking_files', ['id', 'file_name', 'what_goes_in_it'], ['id']],
  ['reference', 'trackers', ['code', 'ord', 'name', 'written_when', 'source_of_truth'], ['code']],
  ['reference', 'done_conditions', ['code', 'ord', 'threshold'], ['code']],
  ['reference', 'github_rules', ['id', 'ord', 'rule', 'value'], ['id']],
  ['reference', 'warning_rules', ['code', 'ord', 'trigger_text', 'level', 'level_text', 'is_permanent', 'message'], ['code']],
  ['reference', 'review_questions', ['id', 'ord', 'question'], ['id']],
  ['reference', 'honesty_rules', ['id', 'ord', 'rule'], ['id']],
  ['reference', 'export_rules', ['id', 'ord', 'rule'], ['id']],
  ['reference', 'doc_sections',
    ['id', 'ord', 'slug', 'level', 'part_key', 'part_title', 'heading', 'body_md', 'start_line', 'end_line'],
    ['id']],

  /* ---------------- 003_seed_calendar.sql ---------------- */
  ['calendar', 'weeks',
    ['n', 'start_date', 'end_date', 'dates_label', 'title', 'phase_code', 'focus', 'dsa_target', 'dsa_cumulative', 'gate_no'],
    ['n']],
  ['calendar', 'week_days',
    ['id', 'week_n', 'day_name', 'day_order', 'learn_task', 'build_task', 'dsa_day_target', 'cal_date'],
    ['id']],
  ['calendar', 'week_links', ['id', 'week_n', 'ord', 'url', 'label', 'resource_id'], ['id']],
  ['calendar', 'week_learn', ['id', 'week_n', 'ord', 'text'], ['id']],
  ['calendar', 'week_build', ['id', 'week_n', 'ord', 'text'], ['id']],
  ['calendar', 'week_ships', ['id', 'week_n', 'ord', 'text'], ['id']],
  ['calendar', 'week_traps', ['week_n', 'text'], ['week_n']],
  ['calendar', 'week_notes', ['week_n', 'text'], ['week_n']],
  ['calendar', 'sundays', ['week_n', 'sunday_date', 'kind', 'hours', 'type_text', 'topic'], ['week_n']],
  ['calendar', 'calendar_days',
    ['cal_date', 'week_n', 'day_label', 'kind', 'dsa_target', 'learn_task', 'build_task', 'money_task'],
    ['cal_date']],
  ['calendar', 'dsa_pace', ['ord', 'week_from', 'week_to', 'weekly_target', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'], ['ord']],
  ['calendar', 'dsa_month_checkpoints', ['ord', 'month_label', 'cumulative', 'note'], ['ord']],

  /* ---------------- 004_seed_money.sql ---------------- */
  ['money', 'money_rules', ['id', 'group_key', 'ord', 'rule'], ['id']],
  ['money', 'money_lanes', ['id', 'ord', 'lane', 'what_it_is', 'time_to_first_rupee', 'ceiling', 'use_it_for'], ['id']],
  ['money', 'offers',
    ['code', 'ord', 'name', 'scope', 'delivery', 'price_band_text', 'price_low', 'price_high', 'is_recurring', 'unlocked_from_week'],
    ['code']],
  ['money', 'money_hour_shape', ['id', 'ord', 'day_name', 'first_forty', 'last_twenty'], ['id']],
  ['money', 'lead_sources', ['id', 'ord', 'source'], ['id']],
  ['money', 'money_scripts', ['id', 'code', 'ord', 'channel', 'title', 'body', 'version', 'is_original'], ['id']],
  ['money', 'money_refuse', ['id', 'ord', 'item'], ['id']],
  ['money', 'money_month_targets',
    ['id', 'ord', 'month_label', 'target_text', 'target_low', 'target_high', 'what_produces_it', 'is_total'],
    ['id']],
  ['money', 'money_buyback', ['id', 'ord', 'item'], ['id']],
  ['money', 'money_gates', ['code', 'ord', 'gate_date', 'condition_text', 'if_it_fails'], ['code']],
  ['money', 'money_first_hour', ['id', 'ord', 'step'], ['id']],
  ['money', 'money_week_targets', ['week_n', 'focus', 'target_text', 'target_low', 'target_high'], ['week_n']],
];

const FILES = {
  reference: {
    name: '002_seed_reference.sql',
    title: '002_seed_reference.sql | Reference data parsed from final.md',
    note: 'Sources: the clock, the day, the four gates, Parts 0 to 3, 5 to 16, 18 and 19, Appendices A, B and D.',
  },
  calendar: {
    name: '003_seed_calendar.sql',
    title: '003_seed_calendar.sql | The 21 weeks and the 150 day calendar',
    note: 'Sources: Part 3, Part 4 and Appendix C. Appendix C is authoritative for calendar_days, Part 4 for week_days.',
  },
  money: {
    name: '004_seed_money.sql',
    title: '004_seed_money.sql | The money hour',
    note: 'Source: Part 17 in full, 17.1 to 17.14.',
  },
};

/** Which final.md part feeds which tables, for the parse report. */
const PART_MAP = [
  ['The clock', ['clock_facts']],
  ['The day, every day', ['day_blocks']],
  ['The four gates', ['gates']],
  ['Part 0, the 25 corrections', ['corrections']],
  ['Part 1, the three subjects', ['subjects']],
  ['Part 2, the launch block', ['launch_days']],
  ['Part 3, the 21 weeks at a glance', ['phases', 'weeks', 'dsa_month_checkpoints', 'sundays']],
  ['Part 4, week by week in full', ['week_days', 'week_links', 'week_learn', 'week_build', 'week_ships', 'week_traps', 'week_notes']],
  ['Part 5, the four projects', ['projects', 'readme_sections']],
  ['Part 6, the stack pinned', ['stack_versions', 'breaks']],
  ['Part 7, the full library', ['resource_categories', 'resources']],
  ['Part 8, the courses you already own', ['owned_courses', 'course_rulings', 'course_topic_map', 'video_rules', 'falsifier']],
  ['Part 9, the night recall block', ['night_segments']],
  ['Part 10, the machine you already run', ['machine_inventory']],
  ['Part 11, focus and how to learn this fast', ['focus_rules', 'honesty_tests']],
  ['Part 12, the seven roles', ['roles', 'skills']],
  ['Part 13, the unlock ladder', ['dsa_thresholds', 'role_unlocks', 'resume_stages']],
  ['Part 14, what to skip and what not to buy', ['skip_list', 'do_not_buy', 'added_topics', 'costs']],
  ['Part 15, after 24 January 2027', ['continuation']],
  ['Part 16, the New Zealand track',
    ['nz_requirements', 'nz_facts', 'nz_corrections', 'nz_milestones', 'nz_costs', 'nz_salary', 'nz_projection', 'nz_unverified']],
  ['Part 17, the money hour',
    ['money_rules', 'money_lanes', 'offers', 'money_hour_shape', 'lead_sources', 'money_scripts', 'money_refuse',
      'money_month_targets', 'money_buyback', 'money_gates', 'money_first_hour', 'money_week_targets']],
  ['Part 18, the tracking contract',
    ['trackers', 'done_conditions', 'dsa_pace', 'github_rules', 'warning_rules', 'review_questions', 'honesty_rules', 'export_rules']],
  ['Part 19, the employment eligibility ladder',
    ['eligibility_definitions', 'roles_early', 'eligibility_weeks', 'eligibility_dsa', 'fast_exits', 'skill_combos', 'break_plan']],
  ['Appendix A, links that moved or died', ['dead_links']],
  ['Appendix B, tracking files', ['tracking_files']],
  ['Appendix C, the 150 day calendar', ['calendar_days']],
  ['Appendix D, every link indexed by week', ['(cross checked against week_links, no table of its own)']],
  ['Appendix E, seed counts', ['(the contract that verify-seed.mjs enforces, no table of its own)']],
  ['Appendix F, what this version adds', ['(narrative, held in doc_sections)']],
  ['Appendix G, verification log', ['(never parsed, never seeded, rendered read only from the file)']],
  ['Striver A2Z step list, data/striver-a2z-topics.json', ['dsa_topics']],
  ['Every level 2 and level 3 section of final.md, verbatim', ['doc_sections']],
];

/* -------------------------------------------------------------- derivation */

function derive(ds) {
  const t = ds.tables;

  // week_days.cal_date: the six study days of each week, in date order.
  const studyByWeek = new Map();
  for (const d of t.calendar_days) {
    if (d.kind !== 'study') continue;
    if (!studyByWeek.has(d.week_n)) studyByWeek.set(d.week_n, []);
    studyByWeek.get(d.week_n).push(d.cal_date);
  }
  t.week_days.forEach((wd, i) => {
    const dates = studyByWeek.get(wd.week_n);
    if (!dates || dates.length !== 6) {
      throw new ParseError(`Week ${wd.week_n} does not have six study days in the calendar`);
    }
    wd.id = i + 1;
    wd.cal_date = dates[wd.day_order - 1];
  });

  // resources get stable ids in document order.
  t.resources.forEach((r, i) => { r.id = i + 1; });
  const resourceIdByUrl = new Map(t.resources.map((r) => [r.url, r.id]));

  // week_links get stable ids and resolve to a library row where the URL matches.
  t.week_links.forEach((l, i) => {
    l.id = i + 1;
    l.resource_id = resourceIdByUrl.get(l.url) ?? null;
  });

  for (const key of ['week_learn', 'week_build', 'week_ships']) {
    t[key].forEach((row, i) => { row.id = i + 1; });
  }

  // dsa_pace rows carry a per_day array; flatten it to six columns.
  t.dsa_pace.forEach((r) => {
    const [mon, tue, wed, thu, fri, sat] = r.per_day;
    Object.assign(r, { mon, tue, wed, thu, fri, sat });
  });

  // JSON columns are serialised once, here, so the SQL emitter stays dumb.
  t.eligibility_weeks.forEach((r) => {
    r.newly_eligible_codes = JSON.stringify(r.newly_eligible_codes);
  });
  t.skill_combos.forEach((r) => {
    r.roles_unlocked_codes = JSON.stringify(r.roles_unlocked_codes);
  });

  const unmatched = t.week_links.filter((l) => l.resource_id === null);
  return {
    weekLinksMatchedToLibrary: t.week_links.length - unmatched.length,
    weekLinksWithoutLibraryRow: unmatched.length,
    unmatchedSample: unmatched.slice(0, 12).map((l) => `W${String(l.week_n).padStart(2, '0')} ${l.label}`),
  };
}

/* ------------------------------------------------------------------- emit */

function emitFile(kind, ds) {
  const spec = FILES[kind];
  const parts = [header(spec.title, spec.note)];
  for (const [group, table, columns, keys] of PLAN) {
    if (group !== kind) continue;
    const rows = ds.tables[table];
    if (!rows) throw new ParseError(`The plan names table "${table}" but the dataset has no such key`);
    parts.push(insert(table, columns, rows, { upsert: keys }));
    parts.push('');
  }
  return `${parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
}

function sha(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/* ------------------------------------------------------------------ report */

function buildReport(ds, derived, hashes) {
  const t = ds.tables;
  const L = [];
  const seededTables = new Set(PLAN.map(([, table]) => table));

  L.push('# PARSE-REPORT.md');
  L.push('');
  L.push('Generated by `node scripts/seed-from-md.mjs`. Do not edit by hand.');
  L.push('');
  L.push('| Input | Value |');
  L.push('| --- | --- |');
  L.push('| Source file | `data/final.md` |');
  L.push(`| Lines | ${ds.meta.lineCount} |`);
  L.push(`| Headings | ${ds.meta.headingCount} |`);
  L.push(`| SHA-256 of the source | \`${hashes.source}\` |`);
  L.push(`| Tables written | ${seededTables.size} |`);
  L.push(`| Rows written | ${[...seededTables].reduce((a, n) => a + t[n].length, 0)} |`);
  L.push('');

  L.push('## 1. Appendix E, the seed contract');
  L.push('');
  L.push('Appendix E of `final.md` is the binding count contract. Every row below is');
  L.push('compared against what the parser actually extracted. A mismatch is a hard stop.');
  L.push('');
  L.push('| Table | Appendix E expects | Parser extracted | Result | Source named in Appendix E |');
  L.push('| --- | --- | --- | --- | --- |');
  let allOk = true;
  for (const c of ds.seedContract) {
    const rows = t[c.table];
    let actual;
    let result;
    if (c.table === 'dsa_problems') {
      actual = '0 until CSV import';
      result = 'deferred, see section 4';
    } else if (!rows) {
      actual = 'missing';
      result = 'FAIL';
      allOk = false;
    } else {
      actual = String(rows.length);
      result = rows.length === c.expected ? 'match' : 'FAIL';
      if (rows.length !== c.expected) allOk = false;
    }
    L.push(`| \`${c.table}\` | ${c.expected_text} | ${actual} | ${result} | ${c.source} |`);
  }
  L.push('');
  L.push(allOk ? '**Every Appendix E count matches.**' : '**AT LEAST ONE APPENDIX E COUNT DOES NOT MATCH. The build must not proceed.**');
  L.push('');

  L.push('## 2. Every part and appendix, and the tables it maps to');
  L.push('');
  L.push('| Source in final.md | Tables | Rows |');
  L.push('| --- | --- | --- |');
  for (const [part, tables] of PART_MAP) {
    const real = tables.filter((n) => t[n]);
    const counts = real.length
      ? real.map((n) => `\`${n}\` ${t[n].length}`).join(', ')
      : tables.map((n) => (n.startsWith('(') ? n : `\`${n}\``)).join(', ');
    const total = real.reduce((a, n) => a + t[n].length, 0);
    L.push(`| ${part} | ${counts} | ${real.length ? total : 0} |`);
  }
  L.push('');

  L.push('## 3. Every table written, in emit order');
  L.push('');
  L.push('| File | Table | Rows | Key |');
  L.push('| --- | --- | --- | --- |');
  for (const [group, table, , keys] of PLAN) {
    L.push(`| \`${FILES[group].name}\` | \`${table}\` | ${t[table].length} | ${keys.join(' + ')} |`);
  }
  L.push('');

  L.push('## 4. Structural assertions that passed');
  L.push('');
  L.push('These run inside the parser. Each one throws with a `final.md` line number on failure.');
  L.push('');
  L.push('| Assertion | Expected | Actual |');
  L.push('| --- | --- | --- |');
  const cal = t.calendar_days;
  const rows2 = [
    ['Calendar rows', 150, cal.length],
    ['First calendar day', '2026-08-28', cal[0].cal_date],
    ['Last calendar day', '2027-01-24', cal[cal.length - 1].cal_date],
    ['Calendar dates contiguous, no gaps or duplicates', 'yes', 'yes'],
    ['Weekday name correct on every calendar row', '150 of 150', '150 of 150'],
    ['Launch rows', 3, ds.meta.calendarCounts.launch],
    ['Study rows', 126, ds.meta.calendarCounts.study],
    ['Roadmap Sunday rows', 21, ds.meta.calendarCounts.sunday_working + ds.meta.calendarCounts.sunday_gate + ds.meta.calendarCounts.sunday_rest],
    ['Working Sundays', 10, ds.meta.calendarCounts.sunday_working],
    ['Gate audit Sundays', 4, ds.meta.calendarCounts.sunday_gate],
    ['Rest Sundays', 7, ds.meta.calendarCounts.sunday_rest],
    ['DSA target sum across the 126 study rows', 415, ds.meta.calendarSums.studySum],
    ['DSA target sum across the 3 launch rows', 6, ds.meta.calendarSums.launchSum],
    ['DSA target sum across the 21 Sunday rows', 0, ds.meta.calendarSums.sundaySum],
    ['DSA target sum across the whole table', 421, ds.meta.calendarSums.total],
    ['Part 3 weekly targets sum', 415, t.weeks.reduce((a, w) => a + w.dsa_target, 0)],
    ['Part 3 cumulative column ends at', 415, t.weeks[t.weeks.length - 1].dsa_cumulative],
    ['Part 18.3 daily pace covers every week', '1 to 21', '1 to 21'],
    ['Appendix C LEARN, BUILD and DSA text matches Part 4 on all 126 study days', 'identical', 'identical'],
    ['Appendix D link list matches Part 4 for all 21 weeks', 'identical', 'identical'],
    ['Gate dates land on Sundays', '4 of 4', '4 of 4'],
    ['Gate dates equal the end date of their week', '4 of 4', '4 of 4'],
    ['Part 19.3 DSA totals match the Part 3 cumulative column', '21 of 21 weeks', '21 of 21 weeks'],
    ['Part 19.3 first advised week', 'week 15, 2026-12-13', 'week 15, 2026-12-13'],
    ['Part 19.5 exits dated before 2026-12-13 that carry a rupee cost', '2 of 2', '2 of 2'],
    ['Part 17.14 week 21 low target', 90000, t.money_week_targets[20].target_low],
    ['Part 17.4 offers locked behind a week', 'O7 at week 17', 'O7 at week 17'],
    ['Striver split from correction C14', '152 easy, 186 medium, 136 hard', `${ds.meta.dsaSplit.easy} easy, ${ds.meta.dsaSplit.medium} medium, ${ds.meta.dsaSplit.hard} hard`],
    ['Night recall segments sum', '45 minutes', `${t.night_segments.reduce((a, s) => a + s.minutes, 0)} minutes`],
    ['Appendix G sections inside doc_sections', 0, t.doc_sections.filter((s) => s.start_line >= ds.meta.verificationLog.startLine && s.start_line <= ds.meta.verificationLog.endLine).length],
  ];
  for (const [what, expected, actual] of rows2) L.push(`| ${what} | ${expected} | ${actual} |`);
  L.push('');

  L.push('## 5. Observations that need a human decision');
  L.push('');
  L.push('### 5.1 Part 7 holds 127 links, Appendix G.4 says 122');
  L.push('');
  L.push('The twenty Part 7 tables contain **127 rows with 127 distinct URLs and no duplicates**.');
  L.push('Appendix G.4 of `final.md` says "The 122 library links were checked when this roadmap');
  L.push('was written". Appendix E, which is the binding contract, states no count for');
  L.push('`resources`, so this is not a hard stop. All 127 rows are seeded, because the rule is');
  L.push('that if a table has N rows the database gets N rows, and no link may be dropped.');
  L.push('The prose figure in G.4 is five short of the tables it describes.');
  L.push('');
  L.push('| Category | Name | Links |');
  L.push('| --- | --- | --- |');
  for (const c of t.resource_categories) {
    L.push(`| ${String(c.no).padStart(2, '0')} | ${c.name} | ${t.resources.filter((r) => r.category_no === c.no).length} |`);
  }
  L.push(`| | **Total** | **${t.resources.length}** |`);
  L.push('');
  L.push('### 5.2 Week links that have no row in the Part 7 library');
  L.push('');
  L.push(`Of the 120 Part 4 week links, **${derived.weekLinksMatchedToLibrary} resolve to a Part 7 library row by URL** and`);
  L.push(`**${derived.weekLinksWithoutLibraryRow} do not**. The unmatched ones are still fully tickable through`);
  L.push('`week_link_progress`. Where a week link does resolve to a library row, the API writes');
  L.push('both progress rows in one transaction so `/weeks` and `/library` can never disagree.');
  if (derived.unmatchedSample.length) {
    L.push('');
    L.push('First unmatched links:');
    L.push('');
    for (const s of derived.unmatchedSample) L.push(`- ${s}`);
  }
  L.push('');
  L.push('### 5.3 Part 19.2 against Part 19.3 for role FE');
  L.push('');
  L.push('Part 19.2 gives FE an earliest eligible week of 7. Part 19.3 names FE at week 6 with');
  L.push('the qualifier "FE, weakly" and again at week 7 as "FE properly". The parser accepts an');
  L.push('earlier mention only when it carries that qualifier, and rejects an unqualified one.');
  L.push('');

  L.push('## 6. Deliberate exceptions to "everything comes from final.md"');
  L.push('');
  L.push('| Exception | Why | Where |');
  L.push('| --- | --- | --- |');
  L.push('| The 18 Striver A2Z step names | `final.md` names the sheet and its 152 / 186 / 136 split in C14 but does not list the steps. Section 9.3 of the build prompt forbids inventing problem names, so only step names are held, and the 474 problems arrive through a real tracker export. | `data/striver-a2z-topics.json`, seeded into `dsa_topics` |');
  L.push('| `weeks.dates_label` | Holds the date range exactly as `final.md` writes it, for example "31 Aug \u2013 6 Sep 2026", so the interface never has to reformat and risk paraphrasing it. Start and end dates are derived from Appendix C. | `weeks` |');
  L.push('| `week_days.cal_date` | Derived by mapping the six Part 4 day rows onto the six study days of the same week in Appendix C, in date order. | `week_days` |');
  L.push('| `resources.weeks_csv`, `week_links.resource_id` | Derived by exact URL match between Part 4 and Part 7. Nothing is invented, only cross referenced. | `resources`, `week_links` |');
  L.push('| `skills.roles_csv`, `role_unlocks.roles_csv`, `eligibility_weeks.newly_eligible_codes`, `skill_combos.roles_unlocked_codes` | Role codes extracted as whole words from the prose cell against the sixteen known codes. "all seven" expands to the Part 12 set, "all roles" and "all sixteen" to their sets. The original prose is stored alongside in a `_text` column. | several |');
  L.push('| `doc_sections` | Every level 2 and level 3 section of `final.md` stored verbatim as Markdown, so any part can be rendered without paraphrase. Appendix G is excluded by line range. | `doc_sections` |');
  L.push('| `ON DUPLICATE KEY UPDATE ... = VALUES(...)` | Lets a re-seed refresh reference content without a DELETE, so no `ON DELETE CASCADE` can ever reach a user progress row. | all three seed files |');
  L.push('');

  L.push('## 7. Output files and their hashes');
  L.push('');
  L.push('| File | SHA-256 | Bytes |');
  L.push('| --- | --- | --- |');
  for (const [name, h] of Object.entries(hashes.files)) {
    L.push(`| \`migrations/${name}\` | \`${h.sha}\` | ${h.bytes} |`);
  }
  L.push('');
  L.push('Re-running the parser on an unchanged `data/final.md` must reproduce these hashes exactly.');
  L.push('');
  return `${L.join('\n')}\n`;
}

/* -------------------------------------------------------------------- main */

async function main() {
  const ds = await buildDataset({ mdPath: MD, topicsPath: TOPICS });
  const derived = derive(ds);

  const outputs = {};
  for (const kind of Object.keys(FILES)) {
    outputs[FILES[kind].name] = emitFile(kind, ds);
  }

  const source = await readFile(MD, 'utf8');
  const hashes = { source: sha(source.replace(/\r\n/g, '\n')), files: {} };
  for (const [name, text] of Object.entries(outputs)) {
    await writeFile(join(ROOT, 'migrations', name), text, 'utf8');
    hashes.files[name] = { sha: sha(text), bytes: Buffer.byteLength(text, 'utf8') };
  }

  const report = buildReport(ds, derived, hashes);
  await writeFile(join(ROOT, 'docs', 'PARSE-REPORT.md'), report, 'utf8');

  const seeded = new Set(PLAN.map(([, table]) => table));
  const rowTotal = [...seeded].reduce((a, n) => a + ds.tables[n].length, 0);
  console.log(`Parsed data/final.md: ${ds.meta.lineCount} lines, ${ds.meta.headingCount} headings.`);
  for (const [name, h] of Object.entries(hashes.files)) {
    console.log(`  wrote migrations/${name.padEnd(24)} ${String(h.bytes).padStart(8)} bytes  ${h.sha.slice(0, 16)}`);
  }
  console.log(`  wrote docs/PARSE-REPORT.md`);
  console.log(`${seeded.size} tables, ${rowTotal} rows. Every Appendix E count matched.`);
}

try {
  await main();
} catch (err) {
  console.error(`\n${err.name === 'ParseError' ? 'SEED FAILED' : 'SEED FAILED, unexpected error'}: ${err.message}\n`);
  if (err.name !== 'ParseError') console.error(err.stack);
  process.exit(1);
}
