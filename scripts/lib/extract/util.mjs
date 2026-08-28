import { ParseError, parseDate, plain } from '../md.mjs';

/** The sixteen role codes: seven from Part 12, nine from Part 19.2. */
export const ROLE_CODES_MAIN = ['AAE', 'FDE', 'FS', 'BE', 'ASE', 'PLAT', 'DE'];
export const ROLE_CODES_EARLY = ['WEB', 'SUP', 'FE', 'AUTO', 'JRT', 'INT', 'QA', 'DEVREL', 'PROMPT'];
export const ROLE_CODES_ALL = [...ROLE_CODES_MAIN, ...ROLE_CODES_EARLY];

/** Normalise en and em dashes to a hyphen. Used only for numeric range parsing. */
export function dashes(text) {
  return String(text).replaceAll('\u2013', '-').replaceAll('\u2014', '-').replaceAll('\u2212', '-');
}

/** A bare host path from final.md becomes an absolute https URL. */
export function bareUrl(text, line) {
  const t = plain(text).trim().replace(/[.,;]$/, '');
  if (!t) throw new ParseError('Empty link', line);
  if (/^https?:\/\//i.test(t)) return t;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+/i.test(t)) {
    throw new ParseError(`Not a recognisable link: "${text}"`, line);
  }
  return `https://${t}`;
}

/** "Rs 2,500 to Rs 6,000" gives { low: 2500, high: 6000 }. "0" gives { low: 0, high: 0 }. */
export function rupeeBand(text, line) {
  const t = dashes(String(text)).replace(/\bRs\.?\s*/gi, '');
  const nums = (t.match(/\d[\d,]*/g) ?? []).map((s) => Number(s.replaceAll(',', '')));
  if (nums.length === 0) throw new ParseError(`No rupee figure in "${text}"`, line);
  if (nums.length === 1) return { low: nums[0], high: nums[0] };
  return { low: nums[0], high: nums[1] };
}

/** "Rs 1.8 to 4 lakh" gives { low: 1.8, high: 4 }. Returns null when there is no band. */
export function lakhBand(text) {
  const t = dashes(String(text));
  const m = /(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*lakh/i.exec(t);
  if (m) return { low: Number(m[1]), high: Number(m[2]) };
  const one = /(\d+(?:\.\d+)?)\s*lakh/i.exec(t);
  if (one) return { low: Number(one[1]), high: Number(one[1]) };
  return null;
}

/** "Weeks 1-4", "3 to 7" and "Weeks 20-21" all give { from, to }. */
export function weekRange(text, line) {
  const t = dashes(String(text)).replace(/weeks?/i, '').trim();
  const m = /(\d+)\s*(?:to|-)\s*(\d+)/.exec(t);
  if (m) return { from: Number(m[1]), to: Number(m[2]) };
  const one = /(\d+)/.exec(t);
  if (one) return { from: Number(one[1]), to: Number(one[1]) };
  throw new ParseError(`Cannot read a week range from "${text}"`, line);
}

/** Pull the first "12 Jan 2027" style date out of a longer cell. */
export function dateInside(text, line) {
  const m = /(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/.exec(String(text));
  if (!m) throw new ParseError(`No date inside "${text}"`, line);
  return parseDate(`${m[1]} ${m[2]} ${m[3]}`, line);
}

/** Pull "Week 7" out of a longer cell. Returns null when absent. */
export function weekInside(text) {
  const m = /week\s+(\d{1,2})/i.exec(String(text));
  return m ? Number(m[1]) : null;
}

/**
 * Role codes named in a free text cell, matched as whole words against the
 * sixteen known codes. "all sixteen" expands to every code, in canonical order.
 */
export function roleCodesIn(text) {
  const t = String(text);
  if (/all sixteen/i.test(t)) return [...ROLE_CODES_ALL];
  const found = [];
  for (const code of ROLE_CODES_ALL) {
    if (new RegExp(`(^|[^A-Za-z])${code}([^A-Za-z]|$)`).test(t)) found.push(code);
  }
  // Canonical order, not order of appearance, so output is deterministic.
  return ROLE_CODES_ALL.filter((c) => found.includes(c));
}

/** Parse the ('item', 'reason') bullet form used in Part 14. */
export function tupleBullet(text, line) {
  const m = /^\(\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\)$/s.exec(String(text).trim());
  if (!m) throw new ParseError(`Bullet is not an ('item', 'reason') pair: ${text}`, line);
  const unq = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  return { item: unq(m[1]), reason: unq(m[2]) };
}

/** Level 3 sections that live inside a parent section, in document order. */
export function subsections(doc, parent, { level = 3, match = null } = {}) {
  return doc.headings
    .filter(
      (h) =>
        h.level === level &&
        h.line > parent.startLine &&
        h.line <= parent.endLine &&
        (match === null || match(h.text))
    )
    .map((h) => doc.sectionAt(h));
}

/** Strip a trailing full stop, used to normalise bold labels. */
export function label(text) {
  return plain(text).replace(/\.$/, '').trim();
}

/** Assert a parsed count, naming the source so the failure is actionable. */
export function assertCount(rows, expected, what, line) {
  if (rows.length !== expected) {
    throw new ParseError(`${what}: expected ${expected} rows, extracted ${rows.length}`, line);
  }
  return rows;
}
