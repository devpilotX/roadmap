/**
 * cli.mjs | the small amount of plumbing every operational script needs.
 *
 * No dependency is added for this. Node's own util.parseArgs is deliberately not
 * used either, because these scripts accept `--key=value`, `--key value` and
 * bare flags interchangeably, and a cron line should never fail on a form of
 * argument that looks obviously correct to the person writing it.
 */

/**
 * Parses argv into { flags, values, positional }.
 *
 *   --dry-run            flags.has('dry-run')
 *   --user=a@b.com       values.get('user')
 *   --user a@b.com       values.get('user')
 *   path/to/file.csv     positional[0]
 *
 * `known` lists the options that take a value, so `--dry-run file.csv` is not
 * misread as `--dry-run=file.csv`.
 */
export function parseArgv(argv, known = []) {
  const takesValue = new Set(known);
  const flags = new Set();
  const values = new Map();
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const body = arg.slice(2);
    const eq = body.indexOf('=');
    if (eq !== -1) {
      values.set(body.slice(0, eq), body.slice(eq + 1));
      continue;
    }
    if (takesValue.has(body) && i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      values.set(body, argv[i + 1]);
      i += 1;
      continue;
    }
    flags.add(body);
  }
  return { flags, values, positional };
}

/** An integer option with a floor, a ceiling and a fallback. */
export function intOption(values, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!values.has(name)) return fallback;
  const n = Number(values.get(name));
  if (!Number.isFinite(n)) {
    throw new Error(`--${name} must be a number, got "${values.get(name)}"`);
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/* ------------------------------------------------------------------ output */

const stamp = () => new Date().toISOString().slice(11, 19);

export const say = (...parts) => console.log(...parts);
export const step = (text) => console.log(`\n${text}`);
export const info = (text) => console.log(`  ${text}`);
export const good = (text) => console.log(`  ok   ${text}`);
export const warn = (text) => console.log(`  warn ${text}`);
export const bad = (text) => console.log(`  FAIL ${text}`);
export const tick = (text) => console.log(`  ${stamp()}  ${text}`);

/** A single line title block, so cron logs are readable when they are grepped. */
export function banner(title, subtitle = '') {
  const line = '-'.repeat(Math.max(title.length, 40));
  console.log(line);
  console.log(title);
  if (subtitle) console.log(subtitle);
  console.log(line);
}

/** A fixed width table, used by every script's summary. */
export function table(rows, headers) {
  if (!rows.length) return;
  const cols = headers ?? Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length))
  );
  const render = (cells) => '  ' + cells.map((v, i) => String(v ?? '').padEnd(widths[i])).join('  ');
  console.log(render(cols));
  console.log(render(widths.map((w) => '-'.repeat(w))));
  for (const r of rows) console.log(render(cols.map((c) => r[c])));
}

/* --------------------------------------------------------------------- csv */

/** RFC 4180 CSV, with CRLF line endings, which is what Excel expects. */
export function toCsv(rows, columns = null) {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : []);
  if (!cols.length) return '';
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n'
  );
}

/**
 * RFC 4180 CSV reader. Handles quoted fields, embedded commas, embedded
 * newlines, escaped double quotes, CRLF or LF, and a UTF-8 BOM.
 * Returns an array of arrays of strings. Never guesses types.
 */
export function parseCsv(text) {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
      started = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      started = true;
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\n') {
      row.push(field);
      if (row.length > 1 || row[0] !== '' || started) rows.push(row);
      row = [];
      field = '';
      started = false;
      continue;
    }
    field += ch;
    started = true;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // A trailing blank line is not a record.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** Header row plus data rows, turned into objects keyed by the raw header text. */
export function csvToObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { headers: rows[0] ?? [], records: [] };
  const headers = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = (r[i] ?? '').trim();
    });
    return o;
  });
  return { headers, records };
}

/* ------------------------------------------------------------------- misc */

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** MySQL DATETIME for right now, in the process timezone offset given. */
export function sqlNow(offsetHours = 5.5) {
  return new Date(Date.now() + offsetHours * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Wraps a script body so every script exits with a real code, closes the pool,
 * and prints a readable error instead of an unhandled rejection trace.
 */
export async function runScript(name, body, { closePool } = {}) {
  const started = Date.now();
  let code = 0;
  try {
    const result = await body();
    if (result === false) code = 1;
    if (typeof result === 'number') code = result;
  } catch (err) {
    console.error(`\n${name} failed: ${err.message}`);
    if (process.env.DEBUG) console.error(err.stack);
    code = 1;
  } finally {
    if (closePool) {
      try {
        await closePool();
      } catch {
        // A pool that will not close is not the interesting error.
      }
    }
  }
  console.log(`\n${name} finished in ${((Date.now() - started) / 1000).toFixed(1)}s, exit ${code}`);
  process.exit(code);
}
