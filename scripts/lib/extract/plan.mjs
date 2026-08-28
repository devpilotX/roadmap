/**
 * Extractors for the front matter and Parts 0 to 6.
 * Nothing in this file contains roadmap content. Everything is read from final.md.
 */

import { ParseError, parseDate, plain, weekdayName } from '../md.mjs';
import { assertCount, bareUrl, dashes, weekRange } from './util.mjs';

/* -------------------------------------------------------------- The clock */

export function clockFacts(doc) {
  const t = doc.section('The clock', { level: 2 }).table(1).rectangular('The clock');
  return t.map(({ get, ord, line }) => ({
    ord,
    item: get('Item'),
    value: get('Value'),
    line,
  }));
}

export function dayBlocks(doc) {
  const t = doc.section('The day, every day', { level: 2 }).table(1).rectangular('The day');
  const CODES = {
    DSA: 'DSA', LEARN: 'LEARN', BUILD: 'BUILD', CLOSE: 'CLOSE',
    BREAK: 'BREAK', MONEY: 'MONEY', 'NIGHT RECALL': 'NIGHT',
  };
  return t.map(({ get, ord, line }) => {
    const name = plain(get('Block')).toUpperCase();
    const code = CODES[name];
    if (!code) throw new ParseError(`Unknown block name "${name}"`, line);
    return {
      code,
      ord,
      block_name: get('Block'),
      window_text: get('Time'),
      hours: Number(dashes(get('Hours'))),
      what_happens: get('What happens'),
      line,
    };
  });
}

export function gates(doc) {
  const t = doc.section('The four gates', { level: 2 }).table(1).rectangular('The four gates');
  const rows = t.map(({ get, line }) => {
    const noMatch = /GATE\s+(\d)/i.exec(plain(get('Gate')));
    if (!noMatch) throw new ParseError(`Cannot read a gate number from "${get('Gate')}"`, line);
    const gate_date = parseDate(plain(get('Date')), line);
    if (weekdayName(gate_date) !== 'Sunday') {
      throw new ParseError(`Gate ${noMatch[1]} date ${gate_date} is not a Sunday`, line);
    }
    return {
      no: Number(noMatch[1]),
      week_n: Number(plain(get('Week'))),
      gate_date,
      condition_text: get('Condition to pass'),
      line,
    };
  });
  return assertCount(rows, 4, 'gates', t.line);
}

/* ------------------------------------------------------------------ Part 0 */

export function corrections(doc) {
  const t = doc.section('Part 0 |', { level: 2 }).table(1).rectangular('Part 0 corrections');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('#'));
    if (!/^C\d{2}$/.test(code)) throw new ParseError(`Bad correction code "${code}"`, line);
    return {
      ord,
      code,
      was_wrong: get('What the old plan said'),
      actually_true: get('What is actually true'),
      source: get('Source'),
      fix: get('Fix applied'),
      line,
    };
  });
  return assertCount(rows, 25, 'corrections', t.line);
}

/* ------------------------------------------------------------------ Part 1 */

export function subjects(doc) {
  const t = doc.section('Part 1 |', { level: 2 }).table(1).rectangular('Part 1 subjects');
  const rows = t.map(({ get, ord, line }) => ({
    ord,
    subject: get('Subject'),
    when_text: get('When'),
    hours_text: get('Hours'),
    line,
  }));
  return assertCount(rows, 3, 'subjects', t.line);
}

/* ------------------------------------------------------------------ Part 2 */

export function launchDays(doc) {
  const t = doc.section('Part 2 |', { level: 2 }).table(1).rectangular('Part 2 launch block');
  const rows = t.map(({ get, ord, line }) => {
    const cal_date = parseDate(plain(get('Date')), line);
    const dayName = plain(get('Day'));
    if (weekdayName(cal_date) !== dayName) {
      throw new ParseError(
        `Launch day ${cal_date} is a ${weekdayName(cal_date)}, final.md says ${dayName}`,
        line
      );
    }
    return { ord, cal_date, day_name: dayName, work: get('Work'), line };
  });
  return assertCount(rows, 3, 'launch_days', t.line);
}

/* ------------------------------------------------------------------ Part 3 */

export function phases(doc) {
  const s = doc.section('Phases', { level: 3 });
  const t = s.table(1).rectangular('Part 3 phases');
  const rows = t.map(({ get, ord, line }) => {
    const code = plain(get('Phase'));
    if (!/^[A-F]$/.test(code)) throw new ParseError(`Bad phase code "${code}"`, line);
    const r = weekRange(get('Weeks'), line);
    return {
      code,
      ord,
      name: get('Name'),
      week_from: r.from,
      week_to: r.to,
      blurb: get('What it does'),
      line,
    };
  });
  return assertCount(rows, 6, 'phases', t.line);
}

export function monthlyCheckpoints(doc) {
  const t = doc.section('Monthly DSA checkpoints', { level: 3 }).table(1).rectangular('checkpoints');
  const rows = t.map(({ get, ord, line }) => ({
    ord,
    month_label: get('End of month'),
    cumulative: Number(dashes(plain(get('Cumulative problems'))).match(/\d+/)[0]),
    note: plain(get('Cumulative problems')).replace(/^\d+\s*/, '') || null,
    line,
  }));
  return assertCount(rows, 7, 'dsa_month_checkpoints', t.line);
}

export function sundays(doc, phasesRows) {
  const t = doc.section('The Sundays', { level: 3 }).table(1).rectangular('Part 3 Sundays');
  const rows = t.map(({ get, line }) => {
    const week_n = Number(plain(get('After week')));
    const sunday_date = parseDate(plain(get('Date')), line);
    if (weekdayName(sunday_date) !== 'Sunday') {
      throw new ParseError(`Week ${week_n} Sunday ${sunday_date} is not a Sunday`, line);
    }
    const typeText = plain(get('Type'));
    let kind;
    let hours;
    if (/^working/i.test(typeText)) { kind = 'working'; hours = 6; }
    else if (/^gate audit/i.test(typeText)) { kind = 'gate'; hours = 3; }
    else if (/^rest/i.test(typeText)) { kind = 'rest'; hours = 0; }
    else throw new ParseError(`Unknown Sunday type "${typeText}"`, line);
    const declared = /(\d+)\s*h/.exec(typeText);
    if (declared && Number(declared[1]) !== hours) {
      throw new ParseError(`Sunday ${sunday_date} declares ${declared[1]} h, expected ${hours}`, line);
    }
    return { week_n, sunday_date, kind, hours, type_text: typeText, topic: get('What'), line };
  });
  assertCount(rows, 21, 'sundays', t.line);
  const counts = { working: 0, gate: 0, rest: 0 };
  rows.forEach((r) => { counts[r.kind] += 1; });
  if (counts.working !== 10 || counts.gate !== 4 || counts.rest !== 7) {
    throw new ParseError(
      `Sunday mix is ${counts.working} working / ${counts.gate} gate / ${counts.rest} rest, expected 10 / 4 / 7`,
      t.line
    );
  }
  if (phasesRows.length !== 6) throw new ParseError('phases must be extracted before sundays');
  return rows;
}

/**
 * The 21 weeks, assembled from three tables plus the Part 4 headings.
 * Start and end dates are derived from the calendar so the two can never drift.
 */
export function weeks(doc, { phases: phaseRows, gates: gateRows, calendarDays }) {
  const oneLine = doc
    .section('Every week, one line', { level: 3 })
    .table(1)
    .rectangular('Part 3 every week');
  const targets = doc
    .section('DSA weekly targets', { level: 3 })
    .table(1)
    .rectangular('Part 3 DSA weekly targets');
  assertCount(oneLine.rows, 21, 'weeks (Every week, one line)', oneLine.line);
  assertCount(targets.rows, 21, 'weeks (DSA weekly targets)', targets.line);

  const targetByWeek = new Map();
  targets.map(({ get, line }) => {
    const n = Number(plain(get('Wk')));
    targetByWeek.set(n, {
      dsa_target: Number(plain(get('Problems this week'))),
      dsa_cumulative: Number(plain(get('Cumulative'))),
      dates_label: get('Dates'),
      line,
    });
  });

  const part4 = doc.sections('Week ', { level: 3 }).filter((s) => /^Week \d{2} \|/.test(s.heading));
  assertCount(part4, 21, 'Part 4 week sections');

  const gateByWeek = new Map(gateRows.map((g) => [g.week_n, g.no]));

  const rows = oneLine.map(({ get, line }) => {
    const n = Number(plain(get('Wk')));
    const tgt = targetByWeek.get(n);
    if (!tgt) throw new ParseError(`Week ${n} has no row in the DSA weekly targets table`, line);
    if (tgt.dates_label !== get('Dates')) {
      throw new ParseError(
        `Week ${n} dates disagree: "${get('Dates')}" against "${tgt.dates_label}"`,
        line
      );
    }
    const sect = part4[n - 1];
    const parts = sect.heading.split('|').map((p) => p.trim());
    if (parts.length !== 3) throw new ParseError(`Week heading is malformed: ${sect.heading}`, sect.startLine);
    if (Number(parts[0].replace(/\D/g, '')) !== n) {
      throw new ParseError(`Part 4 section ${sect.heading} is out of order, expected week ${n}`, sect.startLine);
    }
    if (parts[2] !== get('Subject')) {
      throw new ParseError(
        `Week ${n} title disagrees. Part 3 says "${get('Subject')}", Part 4 says "${parts[2]}"`,
        sect.startLine
      );
    }

    const phaseLine = sect.lines.find((l) => /^\*\*Phase [A-F]/.test(l.trim()));
    if (!phaseLine) throw new ParseError(`Week ${n} has no phase line`, sect.startLine);
    const pm = /Phase ([A-F])/.exec(phaseLine);
    const phase_code = pm[1];
    if (!phaseRows.some((p) => p.code === phase_code)) {
      throw new ParseError(`Week ${n} names unknown phase ${phase_code}`, sect.startLine);
    }
    const dsaLine = /DSA this week (\d+), cumulative (\d+)/.exec(phaseLine);
    if (!dsaLine) throw new ParseError(`Week ${n} phase line has no DSA figures`, sect.startLine);
    if (Number(dsaLine[1]) !== tgt.dsa_target || Number(dsaLine[2]) !== tgt.dsa_cumulative) {
      throw new ParseError(
        `Week ${n} DSA figures disagree. Part 3 says ${tgt.dsa_target}/${tgt.dsa_cumulative}, Part 4 says ${dsaLine[1]}/${dsaLine[2]}`,
        sect.startLine
      );
    }

    const focus = sect.paragraphAfter('Focus.');
    if (!focus) throw new ParseError(`Week ${n} has no Focus paragraph`, sect.startLine);

    const days = calendarDays.filter((d) => d.week_n === n);
    if (days.length !== 7) {
      throw new ParseError(`Week ${n} has ${days.length} calendar days, expected 7`, sect.startLine);
    }
    const start_date = days[0].cal_date;
    const end_date = days[days.length - 1].cal_date;

    const gateFromText = /GATE (\d)/.exec(plain(get('Gate')));
    const gate_no = gateFromText ? Number(gateFromText[1]) : null;
    if (gate_no !== (gateByWeek.get(n) ?? null)) {
      throw new ParseError(
        `Week ${n} gate disagrees. Part 3 says ${gate_no}, the gate table says ${gateByWeek.get(n) ?? 'none'}`,
        line
      );
    }

    return {
      n,
      start_date,
      end_date,
      dates_label: get('Dates'),
      title: get('Subject'),
      phase_code,
      focus: focus.text,
      dsa_target: tgt.dsa_target,
      dsa_cumulative: tgt.dsa_cumulative,
      gate_no,
      section: sect,
      line,
    };
  });

  // The cumulative column must be arithmetically correct and end at 415.
  let running = 0;
  for (const w of rows) {
    running += w.dsa_target;
    if (running !== w.dsa_cumulative) {
      throw new ParseError(
        `Week ${w.n} cumulative is ${w.dsa_cumulative}, running total is ${running}`,
        w.line
      );
    }
  }
  if (running !== 415) throw new ParseError(`Weekly DSA targets sum to ${running}, expected 415`, oneLine.line);
  return rows;
}

/** The daily DSA pace table from Part 18.3, keyed by week number. */
export function dsaPace(doc) {
  const t = doc.section('18.3', { level: 3 }).table(1).rectangular('Part 18.3 daily pace');
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const rows = t.map(({ get, ord, line }) => {
    const r = weekRange(get('Weeks'), line);
    const weekly = Number(plain(get('Weekly target')));
    const perDay = DAYS.map((d) => Number(plain(get(d))));
    const sum = perDay.reduce((a, b) => a + b, 0);
    if (sum !== weekly) {
      throw new ParseError(`Pace row "${get('Weeks')}" sums to ${sum}, weekly target is ${weekly}`, line);
    }
    return { ord, week_from: r.from, week_to: r.to, weekly_target: weekly, per_day: perDay, line };
  });
  assertCount(rows, 6, 'dsa_pace', t.line);
  const byWeek = new Map();
  for (const r of rows) {
    for (let n = r.week_from; n <= r.week_to; n += 1) {
      if (byWeek.has(n)) throw new ParseError(`Week ${n} appears twice in the pace table`, r.line);
      byWeek.set(n, r.per_day);
    }
  }
  for (let n = 1; n <= 21; n += 1) {
    if (!byWeek.has(n)) throw new ParseError(`Week ${n} is missing from the Part 18.3 pace table`, t.line);
  }
  return { rows, byWeek };
}

/** The 126 day rows, six per week, from the Part 4 six day tables. */
export function weekDays(doc, weekRows, paceByWeek) {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const out = [];
  for (const w of weekRows) {
    const t = w.section
      .tableWith('Day', 'LEARN block (09:30 to 12:30)')
      .rectangular(`Week ${w.n} six days`);
    assertCount(t.rows, 6, `Week ${w.n} six day table`, t.line);
    const pace = paceByWeek.get(w.n);
    t.map(({ get, index, line }) => {
      const day_name = plain(get('Day'));
      if (day_name !== DAYS[index]) {
        throw new ParseError(`Week ${w.n} day ${index + 1} is "${day_name}", expected ${DAYS[index]}`, line);
      }
      out.push({
        week_n: w.n,
        day_name,
        day_order: index + 1,
        learn_task: get('LEARN block (09:30 to 12:30)'),
        build_task: get('BUILD block (14:00 to 16:00)'),
        dsa_day_target: pace[index],
        line,
      });
    });
  }
  return assertCount(out, 126, 'week_days');
}

export function weekLinks(doc, weekRows) {
  const out = [];
  for (const w of weekRows) {
    const bullets = w.section.bulletsUnder('Links for this week.');
    if (bullets.length === 0) throw new ParseError(`Week ${w.n} has no links`, w.section.startLine);
    bullets.forEach((b, i) => {
      out.push({
        week_n: w.n,
        ord: i + 1,
        url: bareUrl(b.text, b.line),
        label: plain(b.text),
        line: b.line,
      });
    });
  }
  return assertCount(out, 120, 'week_links');
}

export function weekProse(doc, weekRows) {
  const learn = [];
  const build = [];
  const ships = [];
  const traps = [];
  const notes = [];
  for (const w of weekRows) {
    w.section.bulletsUnder('Learn.').forEach((b, i) =>
      learn.push({ week_n: w.n, ord: i + 1, text: b.text, line: b.line })
    );
    w.section.bulletsUnder('Build.').forEach((b, i) =>
      build.push({ week_n: w.n, ord: i + 1, text: b.text, line: b.line })
    );
    const shipBullets = w.section.bulletsUnder('Ships at the end of this week.');
    if (shipBullets.length === 0) throw new ParseError(`Week ${w.n} has no ships`, w.section.startLine);
    shipBullets.forEach((b, i) =>
      ships.push({ week_n: w.n, ord: i + 1, text: b.text, line: b.line })
    );
    const trap = w.section.paragraphAfter('The trap.');
    if (!trap) throw new ParseError(`Week ${w.n} has no trap`, w.section.startLine);
    traps.push({ week_n: w.n, text: trap.text, line: trap.line });
    const note = w.section.paragraphAfter('Note.');
    if (!note) throw new ParseError(`Week ${w.n} has no note`, w.section.startLine);
    notes.push({ week_n: w.n, text: note.text, line: note.line });
  }
  if (learn.length === 0 || build.length === 0) throw new ParseError('Week learn or build lists are empty');
  return { learn, build, ships, traps, notes };
}

/* ------------------------------------------------------------------ Part 5 */

export function projects(doc) {
  const s = doc.section('Part 5 |', { level: 2 });
  const t = s.tableWith('Project', 'Repo').rectangular('Part 5 projects');
  const rows = t.map(({ get, ord, line }) => {
    const cell = plain(get('Project'));
    const m = /^Project\s+(\d)\s*\|\s*(.+)$/.exec(cell);
    if (!m) throw new ParseError(`Cannot read a project name from "${cell}"`, line);
    const r = weekRange(get('Weeks'), line);
    return {
      id: ord,
      code: `P${m[1]}`,
      name: m[2].trim(),
      repo: plain(get('Repo')),
      week_from: r.from,
      week_to: r.to,
      description: get('What it is'),
      line,
    };
  });
  return assertCount(rows, 4, 'projects', t.line);
}

export function readmeSections(doc) {
  const s = doc.section('The README, nine sections, every project', { level: 3 });
  const items = s.ordered();
  const rows = items.map((it, i) => ({ id: i + 1, ord: i + 1, title: it.text, line: it.line }));
  return assertCount(rows, 9, 'readme_sections', s.startLine);
}

/* ------------------------------------------------------------------ Part 6 */

export function stackVersions(doc) {
  const s = doc.section('Part 6 |', { level: 2 });
  const t = s.tableWith('Technology', 'Version you use').rectangular('Part 6 stack');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    tech: get('Technology'),
    version: get('Version you use'),
    status: get('Status'),
    why: get('Why it matters'),
    line,
  }));
  return assertCount(rows, 18, 'stack_versions', t.line);
}

export function breaks(doc) {
  const s = doc.section('What breaks if you follow an older tutorial', { level: 3 });
  const t = s.table(1).rectangular('Part 6 breaks');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    if_you_do: get('What you will do'),
    what_happens: get('What happens'),
    line,
  }));
  return assertCount(rows, 11, 'breaks', t.line);
}

/* ------------------------------------------------------- shared assertions */

export function crossCheckAppendixD(doc, weekLinkRows) {
  const s = doc.section('Appendix D', { level: 2 });
  const t = s.table(1).rectangular('Appendix D');
  assertCount(t.rows, 21, 'Appendix D rows', t.line);
  const byWeek = new Map();
  for (const l of weekLinkRows) {
    if (!byWeek.has(l.week_n)) byWeek.set(l.week_n, []);
    byWeek.get(l.week_n).push(l.label);
  }
  t.map(({ get, line }) => {
    const n = Number(plain(get('Wk')));
    const listed = plain(get('Every link for that week'))
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const fromPart4 = byWeek.get(n) ?? [];
    if (listed.length !== fromPart4.length || listed.some((v, i) => v !== fromPart4[i])) {
      throw new ParseError(
        `Week ${n} links disagree between Part 4 and Appendix D.\n  Part 4:     ${fromPart4.join(', ')}\n  Appendix D: ${listed.join(', ')}`,
        line
      );
    }
  });
  return t.rows.length;
}

export function crossCheckWeekDaysAgainstCalendar(weekDayRows, calendarDays) {
  const study = calendarDays.filter((d) => d.kind === 'study');
  if (study.length !== 126) {
    throw new ParseError(`Calendar has ${study.length} study days, expected 126`);
  }
  for (let i = 0; i < 126; i += 1) {
    const cal = study[i];
    const wd = weekDayRows[i];
    if (cal.week_n !== wd.week_n) {
      throw new ParseError(
        `Study day ${cal.cal_date} is week ${cal.week_n}, the Part 4 row at the same position is week ${wd.week_n}`
      );
    }
    if (cal.learn_task !== wd.learn_task) {
      throw new ParseError(
        `LEARN text differs on ${cal.cal_date}.\n  Appendix C: ${cal.learn_task}\n  Part 4:     ${wd.learn_task}`,
        cal.line
      );
    }
    if (cal.build_task !== wd.build_task) {
      throw new ParseError(
        `BUILD text differs on ${cal.cal_date}.\n  Appendix C: ${cal.build_task}\n  Part 4:     ${wd.build_task}`,
        cal.line
      );
    }
    if (cal.dsa_target !== wd.dsa_day_target) {
      throw new ParseError(
        `DSA target differs on ${cal.cal_date}. Appendix C says ${cal.dsa_target}, Part 18.3 says ${wd.dsa_day_target}`,
        cal.line
      );
    }
  }
  return 126;
}
