/**
 * Extractors for Appendices A to E.
 * Appendix G is deliberately absent: final.md states that any parser which turns
 * it into rows is wrong. It is rendered read only straight from the file instead.
 */

import { ParseError, addDays, daysBetween, parseDate, plain, weekdayName } from '../md.mjs';
import { assertCount, bareUrl } from './util.mjs';

const FIRST_DAY = '2026-08-28';
const LAST_DAY = '2027-01-24';

/* ------------------------------------------------------------- Appendix A */

export function deadLinks(doc) {
  const t = doc.section('Appendix A', { level: 2 }).table(1).rectangular('Appendix A');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    was: get('Was'),
    now_url: get('Now'),
    what_happened: get('What happened'),
    line,
  }));
  return assertCount(rows, 7, 'dead_links', t.line);
}

/* ------------------------------------------------------------- Appendix B */

export function trackingFiles(doc) {
  const s = doc.section('Appendix B', { level: 2 });
  const t = s.table(1).rectangular('Appendix B');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    file_name: plain(get('File')),
    what_goes_in_it: get('What goes in it'),
    line,
  }));
  return assertCount(rows, 6, 'tracking_files', t.line);
}

/* ------------------------------------------------------------- Appendix C */

/**
 * The 150 day calendar. This is the single source of truth for calendar_days.
 * Every assertion here comes from Appendix C's own legend and from Appendix G.1.
 */
export function calendarDays(doc) {
  const s = doc.section('Appendix C', { level: 2 });
  const t = s
    .tableWith('Date', 'Day', 'Wk', 'DSA')
    .rectangular('Appendix C calendar');
  assertCount(t.rows, 150, 'calendar_days', t.line);

  const learnCol = t.header.findIndex((h) => /^LEARN/i.test(plain(h)));
  const buildCol = t.header.findIndex((h) => /^BUILD/i.test(plain(h)));
  const moneyCol = t.header.findIndex((h) => /^MONEY/i.test(plain(h)));
  if (learnCol === -1 || buildCol === -1 || moneyCol === -1) {
    throw new ParseError('Appendix C is missing a LEARN, BUILD or MONEY column', t.line);
  }

  const rows = t.map(({ cells, get, line }) => {
    const cal_date = parseDate(plain(get('Date')), line);
    const declaredDay = plain(get('Day'));
    const realDay = weekdayName(cal_date);
    if (declaredDay !== realDay) {
      throw new ParseError(
        `Appendix C says ${cal_date} is a ${declaredDay}, the real calendar says ${realDay}`,
        line
      );
    }
    const wkCell = plain(get('Wk'));
    let week_n = null;
    let isLaunch = false;
    if (wkCell === 'LAUNCH') {
      isLaunch = true;
    } else {
      const m = /^W(\d{2})$/.exec(wkCell);
      if (!m) throw new ParseError(`Unreadable week cell "${wkCell}"`, line);
      week_n = Number(m[1]);
      if (week_n < 1 || week_n > 21) throw new ParseError(`Week ${week_n} is out of range`, line);
    }

    const learn_task = cells[learnCol];
    const build_task = cells[buildCol];
    const money_task = cells[moneyCol];

    let kind;
    if (isLaunch) {
      kind = 'launch';
    } else if (realDay === 'Sunday') {
      const lt = plain(learn_task);
      if (!/^SUNDAY,/.test(lt)) {
        throw new ParseError(`Sunday ${cal_date} LEARN cell does not start with SUNDAY,`, line);
      }
      if (/^SUNDAY,\s*Working/i.test(lt)) kind = 'sunday_working';
      else if (/^SUNDAY,\s*Gate audit/i.test(lt)) kind = 'sunday_gate';
      else if (/^SUNDAY,\s*Rest/i.test(lt)) kind = 'sunday_rest';
      else throw new ParseError(`Unknown Sunday type on ${cal_date}: "${lt}"`, line);
    } else {
      kind = 'study';
    }

    const dsa_target = Number(plain(get('DSA')));
    if (!Number.isInteger(dsa_target) || dsa_target < 0) {
      throw new ParseError(`Bad DSA target "${get('DSA')}" on ${cal_date}`, line);
    }

    return {
      cal_date,
      week_n,
      day_label: declaredDay,
      kind,
      dsa_target,
      learn_task,
      build_task,
      money_task,
      line,
    };
  });

  /* --- Contiguity and boundaries --- */
  if (rows[0].cal_date !== FIRST_DAY) {
    throw new ParseError(`Calendar starts ${rows[0].cal_date}, expected ${FIRST_DAY}`, rows[0].line);
  }
  if (rows[rows.length - 1].cal_date !== LAST_DAY) {
    throw new ParseError(
      `Calendar ends ${rows[rows.length - 1].cal_date}, expected ${LAST_DAY}`,
      rows[rows.length - 1].line
    );
  }
  const span = daysBetween(FIRST_DAY, LAST_DAY) + 1;
  if (span !== 150) throw new ParseError(`${FIRST_DAY} to ${LAST_DAY} is ${span} days, expected 150`);
  for (let i = 1; i < rows.length; i += 1) {
    const expected = addDays(rows[i - 1].cal_date, 1);
    if (rows[i].cal_date !== expected) {
      throw new ParseError(
        `Calendar gap or duplicate: ${rows[i - 1].cal_date} is followed by ${rows[i].cal_date}, expected ${expected}`,
        rows[i].line
      );
    }
  }

  /* --- Row type mix, from Appendix G.1 check 4 --- */
  const counts = { launch: 0, study: 0, sunday_working: 0, sunday_gate: 0, sunday_rest: 0 };
  rows.forEach((r) => { counts[r.kind] += 1; });
  const sundayTotal = counts.sunday_working + counts.sunday_gate + counts.sunday_rest;
  if (counts.launch !== 3) throw new ParseError(`Calendar has ${counts.launch} launch rows, expected 3`);
  if (counts.study !== 126) throw new ParseError(`Calendar has ${counts.study} study rows, expected 126`);
  if (sundayTotal !== 21) throw new ParseError(`Calendar has ${sundayTotal} roadmap Sunday rows, expected 21`);
  if (counts.sunday_working !== 10 || counts.sunday_gate !== 4 || counts.sunday_rest !== 7) {
    throw new ParseError(
      `Sunday mix is ${counts.sunday_working} working / ${counts.sunday_gate} gate / ${counts.sunday_rest} rest, expected 10 / 4 / 7`
    );
  }

  /* --- DSA sums, from Appendix C's own legend and section 9.2 --- */
  const sum = (pred) => rows.filter(pred).reduce((a, r) => a + r.dsa_target, 0);
  const launchSum = sum((r) => r.kind === 'launch');
  const studySum = sum((r) => r.kind === 'study');
  const sundaySum = sum((r) => r.kind.startsWith('sunday_'));
  const total = launchSum + studySum + sundaySum;
  if (studySum !== 415) throw new ParseError(`Study day DSA targets sum to ${studySum}, expected 415`);
  if (launchSum !== 6) throw new ParseError(`Launch day DSA targets sum to ${launchSum}, expected 6`);
  if (sundaySum !== 0) throw new ParseError(`Sunday DSA targets sum to ${sundaySum}, expected 0`);
  if (total !== 421) throw new ParseError(`Calendar DSA targets sum to ${total}, expected 421`);

  /* --- Every week holds exactly seven days, six study plus one Sunday --- */
  for (let n = 1; n <= 21; n += 1) {
    const week = rows.filter((r) => r.week_n === n);
    if (week.length !== 7) throw new ParseError(`Week ${n} has ${week.length} calendar days, expected 7`);
    const studies = week.filter((r) => r.kind === 'study').length;
    if (studies !== 6) throw new ParseError(`Week ${n} has ${studies} study days, expected 6`);
    if (week[6].day_label !== 'Sunday') throw new ParseError(`Week ${n} does not end on a Sunday`);
  }

  return { rows, sums: { launchSum, studySum, sundaySum, total }, counts };
}

/* ------------------------------------------------------------- Appendix E */

/** Appendix E is the seed contract. Table names are normalised to schema names. */
const CONTRACT_ALIASES = new Map([
  ['dsa_topics and problems', 'dsa_problems'],
  ['money_weekly_targets', 'money_week_targets'],
  ['warnings', 'warning_rules'],
]);

export function seedContract(doc) {
  const t = doc.section('Appendix E', { level: 2 }).table(1).rectangular('Appendix E');
  const rows = t.map(({ get, line }) => {
    const rawName = plain(get('Table'));
    const table = CONTRACT_ALIASES.get(rawName) ?? rawName;
    const expectedText = plain(get('Expected rows'));
    const first = /\d+/.exec(expectedText);
    if (!first) throw new ParseError(`Appendix E row "${rawName}" has no row count`, line);
    return {
      table,
      raw_name: rawName,
      expected: Number(first[0]),
      expected_text: expectedText,
      source: get('Source in this file'),
      line,
    };
  });
  assertCount(rows, 29, 'Appendix E contract rows', t.line);
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.table)) throw new ParseError(`Appendix E names ${r.table} twice`, r.line);
    seen.add(r.table);
  }
  return rows;
}

/* ------------------------------------------- read only Appendix G passthrough */

/** The Appendix G markdown, returned untouched for read only rendering. */
export function verificationLogMarkdown(doc) {
  const s = doc.section('Appendix G', { level: 2 });
  return { markdown: s.text, startLine: s.startLine, endLine: s.endLine };
}

export { FIRST_DAY, LAST_DAY, bareUrl };
