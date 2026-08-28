/**
 * Structural Markdown reader for final.md.
 *
 * Rules this module exists to enforce:
 *   1. Tables are parsed structurally. No content is ever hardcoded here.
 *   2. Escaped pipes (\| and \\|) unescape to a literal | and never split a cell.
 *   3. Anything that cannot be parsed raises a ParseError carrying the 1-based
 *      line number, so the seed run fails loudly instead of inventing a row.
 */

const PIPE_SENTINEL = '\u0000PIPE\u0000';

export class ParseError extends Error {
  constructor(message, line) {
    super(line ? `${message} (final.md line ${line})` : message);
    this.name = 'ParseError';
    this.line = line ?? null;
  }
}

/** Split one Markdown table row into trimmed cells, honouring escaped pipes. */
export function splitRow(raw, line) {
  let s = raw.trim();
  if (!s.startsWith('|')) throw new ParseError(`Table row does not start with a pipe: ${raw}`, line);
  // Order matters: the two-backslash form must be replaced before the one-backslash form.
  s = s.replaceAll('\\\\|', PIPE_SENTINEL).replaceAll('\\|', PIPE_SENTINEL);
  const parts = s.split('|');
  // A well formed row is "| a | b |", so the first and last fragments are empty.
  if (parts.length < 3) throw new ParseError(`Table row has no cells: ${raw}`, line);
  parts.shift();
  if (parts[parts.length - 1].trim() === '') parts.pop();
  return parts.map((c) => c.replaceAll(PIPE_SENTINEL, '|').trim());
}

function isSeparatorRow(raw) {
  return /^\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(raw.trim());
}

/** Strip Markdown emphasis and inline code from a cell, leaving the plain words. */
export function plain(cell) {
  return String(cell)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*(?!\*)(.+?)\*(?=[\s.,)]|$)/g, '$1$2')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim();
}

export class MdTable {
  constructor(header, rows, line) {
    this.header = header;
    this.rows = rows; // [{ cells: string[], line: number }]
    this.line = line;
  }

  get width() {
    return this.header.length;
  }

  /** Assert the exact row count, or fail loudly. */
  expect(count, label) {
    if (this.rows.length !== count) {
      throw new ParseError(
        `${label}: expected ${count} rows, parsed ${this.rows.length}`,
        this.line
      );
    }
    return this;
  }

  /** Assert every row has the same number of cells as the header. */
  rectangular(label) {
    for (const r of this.rows) {
      if (r.cells.length !== this.header.length) {
        throw new ParseError(
          `${label}: row has ${r.cells.length} cells, header has ${this.header.length}`,
          r.line
        );
      }
    }
    return this;
  }

  /** Column index by exact or prefix header match. Throws when absent. */
  col(name) {
    const want = name.toLowerCase();
    let i = this.header.findIndex((h) => plain(h).toLowerCase() === want);
    if (i === -1) i = this.header.findIndex((h) => plain(h).toLowerCase().startsWith(want));
    if (i === -1) {
      throw new ParseError(
        `Column "${name}" not found in header [${this.header.join(' | ')}]`,
        this.line
      );
    }
    return i;
  }

  /** Map every row to an object, exposing cells, a cell getter and the line number. */
  map(fn) {
    return this.rows.map((r, index) => {
      const get = (name) => r.cells[this.col(name)];
      return fn({ cells: r.cells, get, line: r.line, index, ord: index + 1 });
    });
  }
}

export class Section {
  constructor(doc, heading, startLine, endLine) {
    this.doc = doc;
    this.heading = heading;
    this.startLine = startLine; // 1-based line of the heading itself
    this.endLine = endLine; // 1-based inclusive last line of the section
  }

  get lines() {
    return this.doc.lines.slice(this.startLine - 1, this.endLine);
  }

  get text() {
    return this.lines.join('\n');
  }

  /** Every table in this section, in document order. */
  tables() {
    return parseTables(this.doc.lines, this.startLine, this.endLine);
  }

  /** The nth (1-based) table in this section. */
  table(n = 1) {
    const all = this.tables();
    if (all.length < n) {
      throw new ParseError(
        `Section "${this.heading}" has ${all.length} tables, wanted table ${n}`,
        this.startLine
      );
    }
    return all[n - 1];
  }

  /** The first table whose header contains all the given column names. */
  tableWith(...columns) {
    const wanted = columns.map((c) => c.toLowerCase());
    for (const t of this.tables()) {
      const heads = t.header.map((h) => plain(h).toLowerCase());
      if (wanted.every((w) => heads.some((h) => h === w || h.startsWith(w)))) return t;
    }
    throw new ParseError(
      `Section "${this.heading}" has no table with columns [${columns.join(', ')}]`,
      this.startLine
    );
  }

  /** Top level "- " bullets in this section, excluding nested list items. */
  bullets() {
    const out = [];
    for (let i = this.startLine - 1; i < this.endLine; i += 1) {
      const raw = this.doc.lines[i];
      const m = /^[-*]\s+(.*)$/.exec(raw);
      if (m) out.push({ text: m[1].trim(), line: i + 1 });
    }
    return out;
  }

  /** Ordered list items, accepting both "1." and repeated "1." numbering. */
  ordered() {
    const out = [];
    for (let i = this.startLine - 1; i < this.endLine; i += 1) {
      const m = /^\d+[.)]\s+(.*)$/.exec(this.doc.lines[i]);
      if (m) out.push({ text: m[1].trim(), line: i + 1 });
    }
    return out;
  }

  /** Bullets under a bold sub label such as "**Learn.**". */
  bulletsUnder(label) {
    const idx = this.lines.findIndex((l) => plain(l).replace(/\.$/, '') === plain(label).replace(/\.$/, ''));
    if (idx === -1) return [];
    const out = [];
    for (let i = idx + 1; i < this.lines.length; i += 1) {
      const raw = this.lines[i];
      if (raw.trim() === '') continue;
      const m = /^[-*]\s+(.*)$/.exec(raw);
      if (m) {
        out.push({ text: m[1].trim(), line: this.startLine + i });
        continue;
      }
      if (out.length) break; // list finished
      if (/^(\*\*|#|\|)/.test(raw.trim())) break; // next label reached with no list
    }
    return out;
  }

  /**
   * The single paragraph that follows a bold label, with the label removed.
   * Only lines that actually begin with ** are considered, so a sentence that
   * happens to start with the same word cannot be mistaken for the label.
   */
  paragraphAfter(label) {
    const wanted = plain(label).replace(/\.$/, '').toLowerCase();
    for (let i = 0; i < this.lines.length; i += 1) {
      if (!this.lines[i].trimStart().startsWith('**')) continue;
      const p = plain(this.lines[i]);
      if (p.toLowerCase().startsWith(wanted)) {
        const inline = p.slice(wanted.length).replace(/^[.:]\s*/, '').trim();
        if (inline) return { text: inline, line: this.startLine + i };
        for (let j = i + 1; j < this.lines.length; j += 1) {
          if (this.lines[j].trim() === '') continue;
          return { text: plain(this.lines[j]).trim(), line: this.startLine + j + 1 };
        }
      }
    }
    return null;
  }

  /**
   * Every "**Label.**" line paired with the blockquote that follows it.
   * Used for the Part 17.7 scripts, which must be stored verbatim.
   */
  boldQuotePairs() {
    const out = [];
    for (let i = this.startLine - 1; i < this.endLine; i += 1) {
      const raw = this.doc.lines[i];
      const m = /^\*\*(.+?)\*\*\s*$/.exec(raw.trim());
      if (!m) continue;
      const body = [];
      let j = i + 1;
      let started = false;
      while (j < this.endLine) {
        const next = this.doc.lines[j];
        if (next.startsWith('>')) {
          started = true;
          body.push(next.replace(/^>\s?/, ''));
        } else if (next.trim() === '') {
          if (started && !this.doc.lines[j + 1]?.startsWith('>')) break;
          if (started) body.push('');
        } else {
          break;
        }
        j += 1;
      }
      if (started) {
        out.push({
          title: m[1].trim(),
          body: body.join('\n').replace(/^\n+|\n+$/g, ''),
          line: i + 1,
        });
      }
    }
    return out;
  }

  /** Blockquote blocks, each returned as one joined string with > stripped. */
  blockquotes() {
    const out = [];
    let buf = null;
    for (let i = this.startLine - 1; i < this.endLine; i += 1) {
      const raw = this.doc.lines[i];
      if (raw.startsWith('>')) {
        const body = raw.replace(/^>\s?/, '');
        if (!buf) buf = { lines: [], line: i + 1 };
        buf.lines.push(body);
      } else if (buf && raw.trim() === '' && this.doc.lines[i + 1]?.startsWith('>')) {
        buf.lines.push('');
      } else if (buf) {
        out.push({ text: buf.lines.join('\n').replace(/\n+$/, ''), line: buf.line });
        buf = null;
      }
    }
    if (buf) out.push({ text: buf.lines.join('\n').replace(/\n+$/, ''), line: buf.line });
    return out;
  }
}

/** Collect Markdown tables between two 1-based line bounds. */
export function parseTables(lines, fromLine, toLine) {
  const tables = [];
  let i = fromLine - 1;
  const end = Math.min(toLine, lines.length);
  while (i < end) {
    const raw = lines[i];
    if (raw.trim().startsWith('|') && i + 1 < end && isSeparatorRow(lines[i + 1])) {
      const headerLine = i + 1;
      const header = splitRow(raw, headerLine);
      const rows = [];
      let j = i + 2;
      while (j < end && lines[j].trim().startsWith('|') && !isSeparatorRow(lines[j])) {
        rows.push({ cells: splitRow(lines[j], j + 1), line: j + 1 });
        j += 1;
      }
      tables.push(new MdTable(header, rows, headerLine));
      i = j;
      continue;
    }
    i += 1;
  }
  return tables;
}

export class MdDoc {
  constructor(text) {
    this.raw = text.replace(/\r\n/g, '\n');
    this.lines = this.raw.split('\n');
    this.headings = [];
    this.lines.forEach((l, idx) => {
      const m = /^(#{1,6})\s+(.*)$/.exec(l);
      if (m) this.headings.push({ level: m[1].length, text: m[2].trim(), line: idx + 1 });
    });
    if (this.headings.length === 0) throw new ParseError('final.md contains no headings');
  }

  /** Find one section by heading prefix. Fails loudly on zero or many matches. */
  section(prefix, { level = null } = {}) {
    const want = prefix.toLowerCase();
    const hits = this.headings.filter(
      (h) => (level === null || h.level === level) && h.text.toLowerCase().startsWith(want)
    );
    if (hits.length === 0) throw new ParseError(`Heading not found: "${prefix}"`);
    if (hits.length > 1) {
      throw new ParseError(
        `Heading "${prefix}" is ambiguous, matched ${hits.length} headings at lines ${hits
          .map((h) => h.line)
          .join(', ')}`
      );
    }
    return this.sectionAt(hits[0]);
  }

  /** Every section whose heading starts with the prefix, in document order. */
  sections(prefix, { level = null } = {}) {
    const want = prefix.toLowerCase();
    return this.headings
      .filter((h) => (level === null || h.level === level) && h.text.toLowerCase().startsWith(want))
      .map((h) => this.sectionAt(h));
  }

  sectionAt(heading) {
    const next = this.headings.find((h) => h.line > heading.line && h.level <= heading.level);
    const endLine = next ? next.line - 1 : this.lines.length;
    return new Section(this, heading.text, heading.line, endLine);
  }

  /** Raw text of a section including its heading, used for read only rendering. */
  rawSection(prefix) {
    return this.section(prefix).text;
  }
}

/* ---------------------------------------------------------------------- */
/* Dates                                                                   */
/* ---------------------------------------------------------------------- */

const MONTHS = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function monthNumber(name, line) {
  const n = MONTHS[String(name).toLowerCase().replace(/\.$/, '')];
  if (!n) throw new ParseError(`Unknown month name "${name}"`, line);
  return n;
}

const ISO_WEEKDAYS = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

/** "28 Aug 2026" or "3 January 2003" to "2026-08-28". Calendar dates only, no timezone. */
export function parseDate(text, line) {
  const m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(String(text).trim());
  if (!m) throw new ParseError(`Cannot parse date "${text}"`, line);
  const day = Number(m[1]);
  const month = monthNumber(m[2], line);
  const year = Number(m[3]);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const probe = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.getUTCDate() !== day) {
    throw new ParseError(`Date "${text}" is not a real calendar date`, line);
  }
  return iso;
}

/** Weekday name for an ISO date, computed from the proleptic Gregorian calendar. */
export function weekdayName(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return ISO_WEEKDAYS[(d.getUTCDay() + 6) % 7];
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86400000);
}

/** First integer in a cell, for example "Rs 2,500 to 6,000" gives 2500. */
export function firstInt(text, line) {
  const m = /-?\d[\d,]*/.exec(String(text));
  if (!m) throw new ParseError(`No number found in "${text}"`, line);
  return Number(m[0].replaceAll(',', ''));
}

/** Every integer in a cell, commas removed. */
export function allInts(text) {
  return (String(text).match(/-?\d[\d,]*/g) ?? []).map((s) => Number(s.replaceAll(',', '')));
}
