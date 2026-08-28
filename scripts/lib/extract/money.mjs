/**
 * Extractors for Part 17 (the money hour) and Part 18 (the tracking contract).
 */

import { ParseError, parseDate, plain } from '../md.mjs';
import { assertCount, assertCount as need, rupeeBand, weekInside } from './util.mjs';

/* -------------------------------------------------------------- Part 17.1 */

export function moneyRules(doc) {
  const out = [];
  const add = (group, sect) => {
    sect.ordered().forEach((it, i) => {
      out.push({
        id: out.length + 1,
        group_key: group,
        ord: i + 1,
        rule: it.text,
        line: it.line,
      });
    });
  };
  const survivable = doc.section('17.1 ', { level: 3 });
  add('survivable', survivable);
  if (out.length !== 5) throw new ParseError(`Part 17.1 has ${out.length} rules, expected 5`, survivable.startLine);
  const protection = doc.section('17.8 ', { level: 3 });
  add('protection', protection);
  if (out.length !== 12) {
    throw new ParseError(`Part 17.8 has ${out.length - 5} rules, expected 7`, protection.startLine);
  }
  return out;
}

/* -------------------------------------------------------------- Part 17.3 */

export function moneyLanes(doc) {
  const s = doc.section('17.3 ', { level: 3 });
  const t = s.tableWith('Lane', 'What it is').rectangular('Part 17.3 lanes');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    lane: plain(get('Lane')),
    what_it_is: get('What it is'),
    time_to_first_rupee: get('Time to first rupee'),
    ceiling: get('Ceiling'),
    use_it_for: get('Use it for'),
    line,
  }));
  return assertCount(rows, 3, 'money_lanes', t.line);
}

/* -------------------------------------------------------------- Part 17.4 */

export function offers(doc) {
  const s = doc.section('17.4 ', { level: 3 });
  const t = s.tableWith('#', 'Offer', 'Delivery', 'Price band').rectangular('Part 17.4 offers');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('#'));
    if (code !== `O${ord}`) throw new ParseError(`Offer code is "${code}", expected O${ord}`, line);
    const band = rupeeBand(get('Price band'), line);
    if (band.low <= 0 || band.high < band.low) {
      throw new ParseError(`Offer ${code} has an unusable price band "${get('Price band')}"`, line);
    }
    const delivery = get('Delivery');
    return {
      code,
      ord,
      name: get('Offer'),
      scope: get('Scope, exactly'),
      delivery,
      price_band_text: get('Price band'),
      price_low: band.low,
      price_high: band.high,
      is_recurring: /per month/i.test(get('Price band')) ? 1 : 0,
      unlocked_from_week: weekInside(delivery),
      line,
    };
  });
  assertCount(rows, 8, 'offers', t.line);
  const locked = rows.filter((r) => r.unlocked_from_week !== null);
  if (locked.length !== 1 || locked[0].code !== 'O7' || locked[0].unlocked_from_week !== 17) {
    throw new ParseError(
      `Expected exactly O7 locked to week 17, found ${locked.map((l) => `${l.code}@${l.unlocked_from_week}`).join(', ') || 'none'}`,
      t.line
    );
  }
  return rows;
}

/* -------------------------------------------------------------- Part 17.5 */

export function moneyHourShape(doc) {
  const s = doc.section('17.5 ', { level: 3 });
  const t = s.tableWith('Day').rectangular('Part 17.5 hour shape');
  const rows = t.map(({ cells, get, ord, line }) => ({
    id: ord,
    ord,
    day_name: plain(get('Day')),
    first_forty: cells[1],
    last_twenty: cells[2],
    line,
  }));
  return assertCount(rows, 6, 'money_hour_shape', t.line);
}

/* -------------------------------------------------------------- Part 17.6 */

export function leadSources(doc) {
  const s = doc.section('17.6 ', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, source: b.text, line: b.line }));
  if (rows.length === 0) throw new ParseError('Part 17.6 has no lead sources', s.startLine);
  return rows;
}

/* -------------------------------------------------------------- Part 17.7 */

export function moneyScripts(doc) {
  const s = doc.section('17.7 ', { level: 3 });
  const pairs = s.boldQuotePairs();
  const rows = pairs.map((p, i) => {
    let channel = 'message';
    if (/whatsapp/i.test(p.title)) channel = 'whatsapp';
    else if (/email/i.test(p.title)) channel = 'email';
    else if (/call/i.test(p.title)) channel = 'call';
    if (!p.body.trim()) throw new ParseError(`Script "${p.title}" has an empty body`, p.line);
    return {
      id: i + 1,
      code: `S${i + 1}`,
      ord: i + 1,
      channel,
      title: p.title,
      body: p.body,
      version: 1,
      is_original: 1,
      line: p.line,
    };
  });
  return assertCount(rows, 8, 'money_scripts', s.startLine);
}

/* -------------------------------------------------------------- Part 17.9 */

export function moneyRefuse(doc) {
  const s = doc.section('17.9 ', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, item: b.text, line: b.line }));
  if (rows.length === 0) throw new ParseError('Part 17.9 has no refusal bullets', s.startLine);
  return rows;
}

/* ------------------------------------------------------------- Part 17.10 */

export function moneyMonthTargets(doc) {
  const s = doc.section('17.10 ', { level: 3 });
  const t = s.tableWith('Month').rectangular('Part 17.10 month targets');
  const rows = t.map(({ cells, get, ord, line }) => {
    const band = rupeeBand(cells[1], line);
    return {
      id: ord,
      ord,
      month_label: plain(get('Month')),
      target_text: cells[1],
      target_low: band.low,
      target_high: band.high,
      what_produces_it: cells[2],
      is_total: /total/i.test(plain(get('Month'))) ? 1 : 0,
      line,
    };
  });
  assertCount(rows, 6, 'money_month_targets', t.line);
  if (rows[rows.length - 1].is_total !== 1) {
    throw new ParseError('The Part 17.10 five month total is not the last row', t.line);
  }
  return rows;
}

/* ------------------------------------------------------------- Part 17.11 */

export function moneyBuyback(doc) {
  const s = doc.section('17.11 ', { level: 3 });
  const rows = s.ordered().map((it, i) => ({ id: i + 1, ord: i + 1, item: it.text, line: it.line }));
  return assertCount(rows, 5, 'money_buyback', s.startLine);
}

/* ------------------------------------------------------------- Part 17.12 */

export function moneyGates(doc) {
  const s = doc.section('17.12 ', { level: 3 });
  const t = s.tableWith('Gate', 'Date', 'Condition').rectangular('Part 17.12 money gates');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('Gate'));
    if (code !== `M${ord}`) throw new ParseError(`Money gate code is "${code}", expected M${ord}`, line);
    return {
      code,
      ord,
      gate_date: parseDate(plain(get('Date')), line),
      condition_text: get('Condition'),
      if_it_fails: get('If it fails'),
      line,
    };
  });
  return assertCount(rows, 4, 'money_gates', t.line);
}

/* ------------------------------------------------------------- Part 17.13 */

export function moneyFirstHour(doc) {
  const s = doc.section('17.13 ', { level: 3 });
  const rows = s.ordered().map((it, i) => ({ id: i + 1, ord: i + 1, step: it.text, line: it.line }));
  return assertCount(rows, 4, 'money_first_hour', s.startLine);
}

/* ------------------------------------------------------------- Part 17.14 */

export function moneyWeekTargets(doc) {
  const s = doc.section('17.14 ', { level: 3 });
  const t = s.tableWith('Wk', 'Money focus').rectangular('Part 17.14 weekly plan');
  const rows = t.map(({ cells, get, ord, line }) => {
    const week_n = Number(plain(get('Wk')));
    if (week_n !== ord) throw new ParseError(`Part 17.14 row ${ord} is week ${week_n}`, line);
    const band = rupeeBand(cells[2], line);
    return {
      week_n,
      focus: get('Money focus'),
      target_text: cells[2],
      target_low: band.low,
      target_high: band.high,
      line,
    };
  });
  assertCount(rows, 21, 'money_week_targets', t.line);
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].target_low < rows[i - 1].target_low || rows[i].target_high < rows[i - 1].target_high) {
      throw new ParseError(
        `Part 17.14 week ${rows[i].week_n} target band falls below week ${rows[i - 1].week_n}`,
        rows[i].line
      );
    }
  }
  const last = rows[rows.length - 1];
  if (last.target_low !== 90000) {
    throw new ParseError(`Part 17.14 week 21 low target is ${last.target_low}, expected 90000`, last.line);
  }
  return rows;
}

/* --------------------------------------------------------------- Part 18.1 */

export function trackers(doc) {
  const s = doc.section('18.1 ', { level: 3 });
  const t = s.tableWith('#', 'Tracker').rectangular('Part 18.1 trackers');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('#'));
    if (code !== `T${ord}`) throw new ParseError(`Tracker code is "${code}", expected T${ord}`, line);
    return {
      code,
      ord,
      name: get('Tracker'),
      written_when: get('Written when'),
      source_of_truth: get('Source of truth'),
      line,
    };
  });
  return assertCount(rows, 9, 'trackers', t.line);
}

/* --------------------------------------------------------------- Part 18.2 */

const CONDITION_CODES = ['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT'];

export function doneConditions(doc) {
  const s = doc.section('18.2 ', { level: 3 });
  const t = s.tableWith('Condition', 'Threshold').rectangular('Part 18.2 done day');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('Condition')).toUpperCase();
    if (code !== CONDITION_CODES[ord - 1]) {
      throw new ParseError(`Done condition ${ord} is "${code}", expected ${CONDITION_CODES[ord - 1]}`, line);
    }
    return { code, ord, threshold: get('Threshold'), line };
  });
  return assertCount(rows, 6, 'done_conditions', t.line);
}

/* --------------------------------------------------------------- Part 18.4 */

export function githubRules(doc) {
  const s = doc.section('18.4 ', { level: 3 });
  const t = s.tableWith('Rule', 'Number').rectangular('Part 18.4 GitHub rules');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    rule: get('Rule'),
    value: get('Number'),
    line,
  }));
  return assertCount(rows, 7, 'github_rules', t.line);
}

/* --------------------------------------------------------------- Part 18.5 */

export function warningRules(doc) {
  const s = doc.section('18.5 ', { level: 3 });
  const t = s.tableWith('#', 'Trigger', 'Level').rectangular('Part 18.5 warnings');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('#'));
    if (code !== `W${ord}`) throw new ParseError(`Warning code is "${code}", expected W${ord}`, line);
    const levelText = plain(get('Level'));
    let level;
    if (/^red/i.test(levelText)) level = 'red';
    else if (/^orange/i.test(levelText)) level = 'orange';
    else throw new ParseError(`Warning ${code} has an unknown level "${levelText}"`, line);
    return {
      code,
      ord,
      trigger_text: get('Trigger'),
      level,
      level_text: levelText,
      is_permanent: /permanent/i.test(levelText) ? 1 : 0,
      message: get('Message'),
      line,
    };
  });
  assertCount(rows, 10, 'warning_rules', t.line);
  const reds = rows.filter((r) => r.level === 'red').length;
  const oranges = rows.filter((r) => r.level === 'orange').length;
  if (reds + oranges !== 10) throw new ParseError('Warning levels do not add up', t.line);
  return rows;
}

/* --------------------------------------------------------------- Part 18.6 */

export function reviewQuestions(doc) {
  const s = doc.section('18.6 ', { level: 3 });
  const rows = s.ordered().map((it, i) => ({ id: i + 1, ord: i + 1, question: it.text, line: it.line }));
  return assertCount(rows, 7, 'review_questions', s.startLine);
}

/* --------------------------------------------------------------- Part 18.7 */

export function honestyRules(doc) {
  const s = doc.section('18.7 ', { level: 3 });
  const rows = s.ordered().map((it, i) => ({ id: i + 1, ord: i + 1, rule: it.text, line: it.line }));
  return assertCount(rows, 6, 'honesty_rules', s.startLine);
}

/* --------------------------------------------------------------- Part 18.8 */

export function exportRules(doc) {
  const s = doc.section('18.8 ', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, rule: b.text, line: b.line }));
  return assertCount(rows, 4, 'export_rules', s.startLine);
}

export { need };
