/**
 * Deterministic SQL emitter.
 *
 * Everything here produces byte identical output for identical input, which is
 * what section 20.7 of the build prompt asserts. No Date.now(), no Math.random(),
 * no Map iteration order that depends on anything but insertion order.
 */

import { ParseError } from './md.mjs';

/** MySQL string literal. Escapes the five characters that matter plus NUL. */
export function lit(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new ParseError(`Refusing to emit non finite number ${value}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  const s = String(value);
  let out = '';
  for (const ch of s) {
    switch (ch) {
      case '\\': out += '\\\\'; break;
      case "'": out += "\\'"; break;
      case '"': out += '\\"'; break;
      case '\n': out += '\\n'; break;
      case '\r': out += '\\r'; break;
      case '\t': out += '\\t'; break;
      case '\u0000': out += '\\0'; break;
      case '\u001a': out += '\\Z'; break;
      default: out += ch;
    }
  }
  return `'${out}'`;
}

/** JSON column value, emitted as a MySQL string literal holding compact JSON. */
export function json(value) {
  return lit(JSON.stringify(value));
}

/**
 * Multi row INSERT for one table.
 * Rows are arrays of objects keyed by column name. Column order comes from the
 * explicit columns argument so output never depends on object key order.
 *
 * upsert adds ON DUPLICATE KEY UPDATE for every non key column, which is what
 * makes a re-seed safe: reference content is refreshed without a DELETE, so no
 * ON DELETE CASCADE ever reaches a user's progress rows.
 */
export function insert(table, columns, rows, { upsert = [] } = {}) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new ParseError(`insert(${table}) called with no columns`);
  }
  if (rows.length === 0) return `-- ${table}: 0 rows\n`;
  const head = `INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES`;
  const body = rows
    .map((row) => {
      const cells = columns.map((c) => {
        if (!(c in row)) throw new ParseError(`Row for ${table} is missing column "${c}"`);
        const v = row[c];
        return v && typeof v === 'object' && v.__raw ? v.__raw : lit(v);
      });
      return `  (${cells.join(', ')})`;
    })
    .join(',\n');
  const keys = new Set(upsert);
  const updatable = columns.filter((c) => !keys.has(c));
  const tail =
    upsert.length && updatable.length
      ? `\nON DUPLICATE KEY UPDATE\n${updatable.map((c) => `  \`${c}\` = VALUES(\`${c}\`)`).join(',\n')}`
      : '';
  return `-- ${table}: ${rows.length} rows\n${head}\n${body}${tail};\n`;
}

/** Wrap a pre-escaped SQL fragment so insert() emits it verbatim. */
export function raw(sql) {
  return { __raw: sql };
}

export function header(title, sourceNote) {
  return [
    '-- ------------------------------------------------------------------',
    `-- ${title}`,
    '--',
    `-- ${sourceNote}`,
    '-- GENERATED FILE. Do not edit by hand.',
    '-- Regenerate with: node scripts/seed-from-md.mjs',
    '-- ------------------------------------------------------------------',
    'SET NAMES utf8mb4;',
    'SET SESSION sql_mode = CONCAT(@@sql_mode, ",STRICT_ALL_TABLES");',
    '',
  ].join('\n');
}
