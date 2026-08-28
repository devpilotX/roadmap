/**
 * Extractors for Part 12 (roles), 13 (the ladder), 14 (skip and cost),
 * 15 (after January 2027), 16 (New Zealand) and 19 (eligibility).
 */

import { ParseError, parseDate, plain } from '../md.mjs';
import {
  ROLE_CODES_ALL,
  ROLE_CODES_EARLY,
  ROLE_CODES_MAIN,
  assertCount,
  dashes,
  dateInside,
  lakhBand,
  roleCodesIn,
  subsections,
  tupleBullet,
  weekInside,
} from './util.mjs';

const GATE3_DATE = '2026-12-13';

/* ----------------------------------------------------------------- Part 12 */

export function roles(doc) {
  const part12 = doc.section('Part 12 |', { level: 2 });
  const codeTable = part12.tableWith('Code', 'Role').rectangular('Part 12 role codes');
  const codes = codeTable.map(({ get, ord, line }) => ({
    code: plain(get('Code')),
    name: plain(get('Role')),
    rank_order: ord,
    line,
  }));
  assertCount(codes, 7, 'roles', codeTable.line);
  const expected = ROLE_CODES_MAIN.join(',');
  const actual = codes.map((c) => c.code).join(',');
  if (actual !== expected) {
    throw new ParseError(`Part 12 role codes are [${actual}], expected [${expected}]`, codeTable.line);
  }

  const detailSections = subsections(doc, part12).filter((s) => {
    try {
      s.tableWith('Field', 'Detail');
      return true;
    } catch {
      return false;
    }
  });
  assertCount(detailSections, 7, 'Part 12 role detail sections', part12.startLine);

  const rows = codes.map((c, i) => {
    const sect = detailSections[i];
    const firstWord = c.name.split(/[\s/]/)[0].toLowerCase();
    if (!sect.heading.toLowerCase().startsWith(firstWord)) {
      throw new ParseError(
        `Role ${c.code} ("${c.name}") does not line up with the section "${sect.heading}"`,
        sect.startLine
      );
    }
    const t = sect.tableWith('Field', 'Detail').rectangular(`Role ${c.code}`);
    const byField = new Map();
    t.map(({ get, line }) => byField.set(plain(get('Field')).toLowerCase(), { value: get('Detail'), line }));
    const need = (field) => {
      const hit = byField.get(field);
      if (!hit) {
        throw new ParseError(
          `Role ${c.code} is missing the "${field}" field, has [${[...byField.keys()].join(', ')}]`,
          sect.startLine
        );
      }
      return hit.value;
    };
    const entry_band = need('entry band, india');
    const band = lakhBand(entry_band);
    return {
      code: c.code,
      name: sect.heading,
      short_name: c.name,
      entry_band,
      band_low_lakh: band ? band.low : null,
      band_high_lakh: band ? band.high : null,
      ceiling: need('ceiling'),
      verdict: need('verdict'),
      what_they_test: need('what they actually test'),
      which_project: need('which project carries it'),
      rank_order: c.rank_order,
      line: sect.startLine,
    };
  });
  return rows;
}

export function skills(doc) {
  const s = doc.section('Skill matrix', { level: 3 });
  const t = s.tableWith('Skill', 'Roles that require it').rectangular('Part 12 skill matrix');
  const rows = t.map(({ get, ord, line }) => {
    const rolesText = get('Roles that require it');
    const codes = /all roles/i.test(rolesText) ? [...ROLE_CODES_MAIN] : roleCodesIn(rolesText);
    if (codes.length === 0) throw new ParseError(`Skill "${get('Skill')}" names no role code`, line);
    return {
      id: ord,
      ord,
      name: get('Skill'),
      roles_text: rolesText,
      roles_csv: codes.join(','),
      where_built: get('Where it is built'),
      week_n: weekInside(get('Where it is built')),
      line,
    };
  });
  return assertCount(rows, 25, 'skills', t.line);
}

/* ----------------------------------------------------------------- Part 13 */

export function dsaThresholds(doc) {
  const s = doc.section('First, the part you will not like', { level: 3 });
  const t = s.tableWith('DSA cumulative', 'Reached').rectangular('Part 13 DSA thresholds');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    cumulative: Number(plain(get('DSA cumulative'))),
    reached_label: get('Reached'),
    unlocks: get('What the number gets you past'),
    line,
  }));
  if (rows.length === 0) throw new ParseError('Part 13 DSA threshold table is empty', t.line);
  return rows;
}

export function roleUnlocks(doc) {
  const s = doc.section('The real ladder', { level: 3 });
  const t = s.tableWith('Milestone', 'Date').rectangular('Part 13 real ladder');
  const rows = t.map(({ get, ord, line }) => {
    const rolesText = get('Roles you can honestly apply for');
    const codes = /all seven/i.test(rolesText) ? [...ROLE_CODES_MAIN] : roleCodesIn(rolesText);
    return {
      id: ord,
      ord,
      milestone: get('Milestone'),
      unlock_date: dateInside(get('Date'), line),
      roles_text: rolesText,
      roles_csv: codes.join(','),
      verdict: get('Verdict'),
      line,
    };
  });
  return assertCount(rows, 10, 'role_unlocks', t.line);
}

export function resumeStages(doc) {
  const s = doc.section('What goes on the resume at each stage', { level: 3 });
  const t = s.tableWith('Stage', 'Headline you can write').rectangular('Part 13 resume stages');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    stage: get('Stage'),
    headline: get('Headline you can write'),
    line,
  }));
  return assertCount(rows, 4, 'resume_stages', t.line);
}

/* ----------------------------------------------------------------- Part 14 */

export function skipList(doc) {
  const s = doc.section('The skip list', { level: 3 });
  const rows = s.bullets().map((b, i) => {
    const { item, reason } = tupleBullet(b.text, b.line);
    return { id: i + 1, ord: i + 1, item, reason, line: b.line };
  });
  if (rows.length === 0) throw new ParseError('Part 14 skip list is empty', s.startLine);
  return rows;
}

export function doNotBuy(doc) {
  const s = doc.section('Do not buy', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, item: b.text, line: b.line }));
  if (rows.length === 0) throw new ParseError('Part 14 do not buy list is empty', s.startLine);
  return rows;
}

export function addedTopics(doc) {
  const s = doc.section('Topics that were added, and why', { level: 3 });
  const rows = s.bullets().map((b, i) => {
    const { item, reason } = tupleBullet(b.text, b.line);
    return { id: i + 1, ord: i + 1, item, reason, line: b.line };
  });
  if (rows.length === 0) throw new ParseError('Part 14 added topics list is empty', s.startLine);
  return rows;
}

export function costs(doc) {
  const s = doc.section('What this actually costs', { level: 3 });
  const t = s.tableWith('Item', 'Cost').rectangular('Part 14 costs');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    item: get('Item'),
    cost: get('Cost'),
    note: get('Note'),
    line,
  }));
  return assertCount(rows, 4, 'costs', t.line);
}

/* ----------------------------------------------------------------- Part 15 */

export function continuation(doc) {
  const out = [];
  let ord = 0;
  const push = (row) => { ord += 1; out.push({ id: ord, ord, ...row }); };

  const branchSect = doc.section('The three branches', { level: 3 });
  const bt = branchSect.tableWith('Branch', 'Condition').rectangular('Part 15 branches');
  assertCount(bt.rows, 3, 'Part 15 branches', bt.line);
  bt.map(({ get, line }) => {
    push({
      kind: 'branch',
      label: plain(get('Branch')),
      period: 'February 2027 onward',
      age_label: '',
      goal: get('Condition'),
      detail: get('Where the hours go'),
      hours_text: get('Weekday hours available'),
      line,
    });
  });

  const bridge = doc.section('February to March 2027', { level: 3 });
  bridge.bullets().forEach((b) => {
    push({
      kind: 'bridge',
      label: 'February to March 2027',
      period: 'February to March 2027',
      age_label: '',
      goal: b.text,
      detail: '',
      hours_text: '',
      line: b.line,
    });
  });

  const shape = doc.section('The weekday shape when you are employed', { level: 3 });
  const st = shape.tableWith('Time', 'Block').rectangular('Part 15 weekday shape');
  assertCount(st.rows, 5, 'Part 15 weekday shape', st.line);
  st.map(({ get, line }) => {
    push({
      kind: 'weekday',
      label: plain(get('Block')),
      period: plain(get('Time')),
      age_label: '',
      goal: plain(get('Block')),
      detail: '',
      hours_text: plain(get('Hours')),
      line,
    });
  });

  const years = subsections(doc, doc.section('Part 15 |', { level: 2 })).filter((s) =>
    /^Year (one|two|three)\b/i.test(s.heading)
  );
  assertCount(years, 3, 'Part 15 year sections', doc.section('Part 15 |', { level: 2 }).startLine);
  years.forEach((sect) => {
    const parts = sect.heading.split('|').map((p) => p.trim());
    const goal = sect.paragraphAfter('Goal:');
    push({
      kind: 'year',
      label: parts[0],
      period: parts[1] ?? '',
      age_label: parts[2] ?? '',
      goal: goal ? goal.text : sect.heading,
      detail: '',
      hours_text: '',
      line: sect.startLine,
    });
    let quarterTable = null;
    try {
      quarterTable = sect.tableWith('Quarter', 'Target');
    } catch {
      quarterTable = null;
    }
    if (quarterTable) {
      quarterTable.rectangular('Part 15 year one quarters');
      quarterTable.map(({ get, line }) => {
        push({
          kind: 'quarter',
          label: plain(get('Quarter')),
          period: parts[1] ?? '',
          age_label: parts[2] ?? '',
          goal: get('Target'),
          detail: '',
          hours_text: '',
          line,
        });
      });
    }
    sect.bullets().forEach((b) => {
      push({
        kind: 'year_detail',
        label: parts[0],
        period: parts[1] ?? '',
        age_label: parts[2] ?? '',
        goal: b.text,
        detail: '',
        hours_text: '',
        line: b.line,
      });
    });
  });

  return out;
}

/* ----------------------------------------------------------------- Part 16 */

export function nzRequirements(doc) {
  const s = doc.section('What Tier 1 actually requires', { level: 3 });
  const t = s.tableWith('Requirement', 'Detail').rectangular('Part 16 Tier 1');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    requirement: get('Requirement'),
    detail: get('Detail'),
    line,
  }));
  return assertCount(rows, 8, 'nz_requirements', t.line);
}

export function nzFacts(doc) {
  const out = [];
  let id = 0;
  const wage = doc.section('The wage thresholds, verified', { level: 3 });
  const wt = wage.tableWith('Threshold').rectangular('Part 16 wage thresholds');
  assertCount(wt.rows, 3, 'Part 16 wage thresholds', wt.line);
  wt.map(({ cells, get, line }) => {
    id += 1;
    out.push({
      id,
      ord: id,
      group_key: 'wage',
      label: get('Threshold'),
      value: cells[1],
      caveat: cells[2] ?? '',
      line,
    });
  });

  const pay = doc.section('What New Zealand actually pays software engineers', { level: 3 });
  const pt = pay.tableWith('Source', 'Figure', 'Caveat').rectangular('Part 16 salary sources');
  assertCount(pt.rows, 6, 'Part 16 salary sources', pt.line);
  pt.map(({ get, line }) => {
    id += 1;
    out.push({
      id,
      ord: id,
      group_key: 'salary',
      label: get('Source'),
      value: get('Figure'),
      caveat: get('Caveat'),
      line,
    });
  });
  return assertCount(out, 9, 'nz_facts');
}

export function nzCorrections(doc) {
  const s = doc.section('Three corrections to what you currently believe', { level: 3 });
  const rows = [];
  const lines = s.lines;
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^\*\*(\d)\.\s*(.+?)\*\*\s*$/.exec(lines[i].trim());
    if (!m) continue;
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\*\*\d\.\s/.test(lines[j].trim())) break;
      if (lines[j].trim() === '') { if (body.length) body.push(''); continue; }
      body.push(lines[j].trim());
    }
    rows.push({
      id: Number(m[1]),
      ord: Number(m[1]),
      title: m[2].trim(),
      body: body.join('\n').replace(/\n+$/, ''),
      line: s.startLine + i,
    });
  }
  return assertCount(rows, 3, 'nz_corrections', s.startLine);
}

export function nzMilestones(doc) {
  const s = doc.section('The timeline that actually works', { level: 3 });
  const t = s.tableWith('Date', 'Age on ID').rectangular('Part 16 timeline');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    milestone_date: plain(get('Date')),
    age_on_id: plain(get('Age on ID')),
    age_actual: plain(get('Actual age')),
    age_label: `${plain(get('Age on ID'))} on ID, ${plain(get('Actual age'))} actual`,
    milestone: get('Milestone'),
    line,
  }));
  return assertCount(rows, 7, 'nz_milestones', t.line);
}

export function nzCosts(doc) {
  const s = doc.section('What the move actually costs', { level: 3 });
  const t = s.tableWith('Item', 'Cost in rupees', 'Basis').rectangular('Part 16 move costs');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    sort_order: ord,
    item: plain(get('Item')),
    cost_rupees: plain(get('Cost in rupees')),
    basis: plain(get('Basis')),
    is_total: /^total$/i.test(plain(get('Item'))) ? 1 : 0,
    line,
  }));
  assertCount(rows, 8, 'nz_costs', t.line);
  const totals = rows.filter((r) => r.is_total);
  if (totals.length !== 1) {
    throw new ParseError(`Part 16 move costs has ${totals.length} total rows, expected exactly 1`, t.line);
  }
  if (rows[rows.length - 1].is_total !== 1) {
    throw new ParseError('The Part 16 move cost total is not the last row', t.line);
  }
  return rows;
}

export function nzSalary(doc) {
  const s = doc.section('What the salary is actually worth', { level: 3 });
  const t = s.tableWith('Gross', 'In rupees').rectangular('Part 16 net salary');
  const rows = t.map(({ cells, ord, line }) => ({
    id: ord,
    ord,
    gross_nzd: plain(cells[0]),
    gross_rupees: plain(cells[1]),
    effective_tax_pct: plain(cells[2]),
    net_nzd: plain(cells[3]),
    net_rupees: plain(cells[4]),
    line,
  }));
  return assertCount(rows, 3, 'nz_salary', t.line);
}

export function nzProjection(doc) {
  const s = doc.section('Where the crores actually come from', { level: 3 });
  const t = s.tableWith('Years after landing').rectangular('Part 16 projection');
  const rows = t.map(({ cells, ord, line }) => ({
    id: ord,
    ord,
    years_after_landing: Number(plain(cells[0])),
    real_age: plain(cells[1]),
    accumulated_rupees: plain(cells[2]),
    line,
  }));
  return assertCount(rows, 5, 'nz_projection', t.line);
}

export function nzUnverified(doc) {
  const s = doc.section('What I could not verify', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, text: b.text, line: b.line }));
  return assertCount(rows, 5, 'nz_unverified', s.startLine);
}

/* ----------------------------------------------------------------- Part 19 */

export function eligibilityDefinitions(doc) {
  const s = doc.section('19.1', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, text: b.text, line: b.line }));
  return assertCount(rows, 2, 'eligibility_definitions', s.startLine);
}

export function rolesEarly(doc) {
  const s = doc.section('19.2', { level: 3 });
  const t = s.tableWith('Code', 'Role', 'Earliest eligible').rectangular('Part 19.2');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('Code'));
    if (!ROLE_CODES_EARLY.includes(code)) {
      throw new ParseError(`Part 19.2 names unexpected role code "${code}"`, line);
    }
    const earliestText = plain(get('Earliest eligible'));
    const band = lakhBand(get('Entry band, India'));
    if (!band) throw new ParseError(`Role ${code} has no lakh band`, line);
    return {
      id: ord,
      code,
      role: get('Role'),
      earliest_text: earliestText,
      earliest_week: weekInside(earliestText) ?? 0,
      earliest_date: dateInside(earliestText, line),
      entry_band: get('Entry band, India'),
      band_low_lakh: band.low,
      band_high_lakh: band.high,
      verdict: get('Honest verdict'),
      line,
    };
  });
  assertCount(rows, 9, 'roles_early', t.line);
  const order = rows.map((r) => r.code).join(',');
  if (order !== ROLE_CODES_EARLY.join(',')) {
    throw new ParseError(`Part 19.2 codes are [${order}], expected [${ROLE_CODES_EARLY.join(',')}]`, t.line);
  }
  return rows;
}

export function eligibilityWeeks(doc, weekRows) {
  const s = doc.section('19.3', { level: 3 });
  const t = s.tableWith('Wk', 'Reached', 'DSA').rectangular('Part 19.3');
  const cumulativeByWeek = new Map(weekRows.map((w) => [w.n, w.dsa_cumulative]));
  const rows = t.map(({ get, ord, line }) => {
    const week_key = plain(get('Wk'));
    const isLaunch = week_key.toUpperCase() === 'LAUNCH';
    const week_n = isLaunch ? 0 : Number(week_key);
    if (!isLaunch && (!Number.isInteger(week_n) || week_n < 1 || week_n > 21)) {
      throw new ParseError(`Part 19.3 row has an unreadable week key "${week_key}"`, line);
    }
    const dsa_total = Number(plain(get('DSA')));
    if (isLaunch) {
      if (dsa_total !== 6) throw new ParseError(`Part 19.3 LAUNCH row says ${dsa_total} problems, expected 6`, line);
    } else if (cumulativeByWeek.get(week_n) !== dsa_total) {
      throw new ParseError(
        `Part 19.3 week ${week_n} says ${dsa_total} problems, Part 3 cumulative is ${cumulativeByWeek.get(week_n)}`,
        line
      );
    }
    const applyText = get('Apply?');
    const is_advised = /^\s*(\*\*)?yes\b/i.test(plain(applyText)) ? 1 : 0;
    const newlyText = get('Newly eligible');
    const codes = /^none/i.test(plain(newlyText)) ? [] : roleCodesIn(newlyText);
    return {
      id: ord,
      week_key: isLaunch ? 'LAUNCH' : String(week_n),
      week_n,
      reached_date: dateInside(get('Reached'), line),
      dsa_total,
      newly_holds: get('What you newly hold'),
      newly_eligible_text: newlyText,
      newly_eligible_codes: codes,
      band: get('Realistic band'),
      apply_verdict: applyText,
      is_advised,
      line,
    };
  });
  assertCount(rows, 22, 'eligibility_weeks', t.line);
  if (rows[0].week_key !== 'LAUNCH') throw new ParseError('Part 19.3 does not start with the LAUNCH row', t.line);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].week_n !== i) {
      throw new ParseError(`Part 19.3 row ${i + 1} is week ${rows[i].week_n}, expected ${i}`, rows[i].line);
    }
  }
  // Every code named across the ladder must be one of the sixteen.
  const seen = new Set();
  rows.forEach((r) => r.newly_eligible_codes.forEach((c) => seen.add(c)));
  for (const c of seen) {
    if (!ROLE_CODES_ALL.includes(c)) throw new ParseError(`Part 19.3 names unknown role code ${c}`, t.line);
  }
  // The line: applications open on the Gate 3 week and never before it.
  const firstAdvised = rows.find((r) => r.is_advised === 1);
  if (!firstAdvised || firstAdvised.week_n !== 15) {
    throw new ParseError(
      `Part 19.3 first advised week is ${firstAdvised ? firstAdvised.week_n : 'none'}, expected 15`,
      t.line
    );
  }
  if (firstAdvised.reached_date !== GATE3_DATE) {
    throw new ParseError(
      `Part 19.3 week 15 is reached ${firstAdvised.reached_date}, expected ${GATE3_DATE}`,
      firstAdvised.line
    );
  }
  return rows;
}

export function eligibilityDsa(doc) {
  const s = doc.section('19.4', { level: 3 });
  const t = s.tableWith('Problems', 'Reached about').rectangular('Part 19.4');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    problems: Number(plain(get('Problems'))),
    reached_about: get('Reached about'),
    gets_you_past: get('What the number alone gets you past'),
    does_not_open: get('What it still does not open'),
    line,
  }));
  assertCount(rows, 13, 'eligibility_dsa', t.line);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].problems <= rows[i - 1].problems) {
      throw new ParseError(`Part 19.4 problem counts are not ascending at ${rows[i].problems}`, rows[i].line);
    }
  }
  return rows;
}

export function fastExits(doc) {
  const s = doc.section('19.5', { level: 3 });
  const t = s.tableWith('Exit', 'Date').rectangular('Part 19.5');
  const rows = t.map(({ get, ord, line }) => {
    const label = plain(get('Exit'));
    const m = /Exit\s+(\d)/i.exec(label);
    if (!m) throw new ParseError(`Cannot read an exit number from "${label}"`, line);
    const exit_date = dateInside(get('Date'), line);
    const verdict = get('Verdict');
    const costSentence = verdict
      .split(/(?<=\.)\s+/)
      .find((sn) => /\bcosts?\b/i.test(sn) && /Rs/.test(sn));
    return {
      id: ord,
      exit_no: Number(m[1]),
      exit_label: label,
      exit_date,
      exit_week: weekInside(get('Date')),
      roles_available: get('What you could take'),
      band: get('Offer band'),
      what_you_give_up: get('What you give up'),
      verdict,
      cost_note: costSentence ? costSentence.trim() : null,
      before_gate3: exit_date < GATE3_DATE ? 1 : 0,
      line,
    };
  });
  assertCount(rows, 4, 'fast_exits', t.line);
  const early = rows.filter((r) => r.before_gate3);
  if (early.length !== 2) {
    throw new ParseError(`${early.length} exits fall before ${GATE3_DATE}, expected 2`, t.line);
  }
  for (const e of early) {
    if (!e.cost_note) {
      throw new ParseError(
        `Exit ${e.exit_no} is dated before ${GATE3_DATE} but its verdict names no rupee cost`,
        e.line
      );
    }
  }
  return rows;
}

export function skillCombos(doc) {
  const s = doc.section('19.6', { level: 3 });
  const t = s.tableWith('Stack you hold', 'DSA needed').rectangular('Part 19.6');
  const rows = t.map(({ get, ord, line }) => {
    const unlocked = get('Roles it unlocks');
    const codes = roleCodesIn(unlocked);
    if (codes.length === 0) throw new ParseError(`Part 19.6 row ${ord} names no role code`, line);
    return {
      id: ord,
      sort_order: ord,
      stack_held: get('Stack you hold'),
      dsa_needed_text: get('DSA needed'),
      dsa_needed: Number(dashes(plain(get('DSA needed'))).match(/\d+/)[0]),
      roles_unlocked_text: unlocked,
      roles_unlocked_codes: codes,
      band: get('Realistic band'),
      interview_you_face: get('The interview you would face'),
      line,
    };
  });
  return assertCount(rows, 8, 'skill_combos', t.line);
}

export function breakPlan(doc) {
  const s = doc.section('19.7', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, text: b.text, line: b.line }));
  if (rows.length === 0) throw new ParseError('Part 19.7 has no bullets', s.startLine);
  return rows;
}

export { GATE3_DATE };
