/**
 * Extractors for Part 7 (the library), Part 8 (owned courses), Part 9, 10 and 11.
 */

import { ParseError, plain } from '../md.mjs';
import { assertCount, bareUrl, subsections } from './util.mjs';

/* ------------------------------------------------------------------ Part 7 */

export function resourceLibrary(doc) {
  const part7 = doc.section('Part 7 |', { level: 2 });
  const cats = subsections(doc, part7, { level: 3, match: (h) => /^\d{2}\s/.test(h) });
  assertCount(cats, 20, 'resource_categories', part7.startLine);

  const categories = [];
  const resources = [];
  cats.forEach((sect, i) => {
    const m = /^(\d{2})\s+(.*)$/.exec(sect.heading);
    if (!m) throw new ParseError(`Part 7 heading is malformed: ${sect.heading}`, sect.startLine);
    const no = Number(m[1]);
    if (no !== i + 1) {
      throw new ParseError(`Part 7 category ${no} is out of order, expected ${i + 1}`, sect.startLine);
    }
    categories.push({ no, name: m[2].trim(), line: sect.startLine });

    const t = sect.tableWith('Link', 'Why this one', 'Cost').rectangular(`Part 7 category ${no}`);
    if (t.rows.length === 0) throw new ParseError(`Part 7 category ${no} has no links`, t.line);
    t.map(({ get, index, line }) => {
      resources.push({
        category_no: no,
        ord: index + 1,
        url: bareUrl(get('Link'), line),
        label: plain(get('Link')),
        why: get('Why this one'),
        cost: get('Cost'),
        line,
      });
    });
  });
  return { categories, resources };
}

/* ------------------------------------------------------------------ Part 8 */

export function ownedCourses(doc) {
  const s = doc.section('What you own, and its real status', { level: 3 });
  const t = s.table(1).rectangular('Part 8 owned courses');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    course: get('Course'),
    videos: Number(plain(get('Videos')).replace(/\D/g, '')),
    progress: get('Progress'),
    access_expires: get('Access expires'),
    line,
  }));
  return assertCount(rows, 5, 'owned_courses', t.line);
}

export function courseRulings(doc) {
  const s = doc.section('Per course ruling', { level: 3 });
  const t = s.table(1).rectangular('Part 8 course rulings');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    course: get('Course'),
    ruling: get('Ruling'),
    line,
  }));
  return assertCount(rows, 5, 'course_rulings', t.line);
}

export function courseTopicMap(doc) {
  const web = doc.section('Web development: 13 of 16 topics', { level: 3 });
  const wt = web.table(1).rectangular('Part 8 web topic map');
  const webRows = wt.map(({ get, ord, line }) => ({
    id: ord,
    track: 'web',
    ord,
    topic: get('Bootcamp topic'),
    ruling: get('Where it lives here'),
    line,
  }));
  assertCount(webRows, 16, 'course_topic_map web rows', wt.line);

  const ops = doc.section('DevOps: you already run four', { level: 3 });
  const ot = ops.table(1).rectangular('Part 8 devops topic map');
  const opsRows = ot.map(({ get, ord, line }) => ({
    id: webRows.length + ord,
    track: 'devops',
    ord,
    topic: get('Bootcamp topic'),
    ruling: get('Ruling'),
    line,
  }));
  assertCount(opsRows, 14, 'course_topic_map devops rows', ot.line);
  return [...webRows, ...opsRows];
}

export function videoRules(doc) {
  const s = doc.section('The daily rule', { level: 3 });
  const items = s.ordered();
  const rows = items.map((it, i) => ({ id: i + 1, ord: i + 1, rule: it.text, line: it.line }));
  return assertCount(rows, 6, 'video_rules', s.startLine);
}

export function falsifier(doc) {
  const s = doc.section('The falsifier', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, text: b.text, line: b.line }));
  return assertCount(rows, 2, 'falsifier', s.startLine);
}

/* ------------------------------------------------------------------ Part 9 */

export function nightSegments(doc) {
  const s = doc.section('Part 9 |', { level: 2 });
  const t = s.table(1).rectangular('Part 9 night recall');
  const rows = t.map(({ get, ord, line }) => ({
    id: ord,
    ord,
    segment: get('Segment'),
    minutes: Number(plain(get('Minutes'))),
    detail: get('What'),
    line,
  }));
  assertCount(rows, 3, 'night_segments', t.line);
  const total = rows.reduce((a, r) => a + r.minutes, 0);
  if (total !== 45) throw new ParseError(`Night recall segments sum to ${total} minutes, expected 45`, t.line);
  return rows;
}

/* ----------------------------------------------------------------- Part 10 */

export function machineInventory(doc) {
  const s = doc.section('Part 10 |', { level: 2 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, item: b.text, line: b.line }));
  if (rows.length === 0) throw new ParseError('Part 10 has no inventory bullets', s.startLine);
  return rows;
}

/* ----------------------------------------------------------------- Part 11 */

export function focusRules(doc) {
  const s = doc.section('11.1', { level: 3 });
  const rows = s.ordered().map((it, i) => ({ id: i + 1, ord: i + 1, rule: it.text, line: it.line }));
  return assertCount(rows, 7, 'focus_rules', s.startLine);
}

export function honestyTests(doc) {
  const s = doc.section('11.4', { level: 3 });
  const rows = s.bullets().map((b, i) => ({ id: i + 1, ord: i + 1, question: b.text, line: b.line }));
  return assertCount(rows, 4, 'honesty_tests', s.startLine);
}
