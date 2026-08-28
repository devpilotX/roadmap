/**
 * Splits a .sql file into executable statements.
 *
 * Handles single and double quoted strings, backtick identifiers, -- and #
 * line comments, C style block comments, and BEGIN ... END compound bodies so
 * that CREATE TRIGGER survives without a DELIMITER directive.
 *
 * Word boundaries are tested against the raw input index, not against the
 * output buffer, because whitespace between tokens would otherwise hide them.
 */

const WORD = /[A-Za-z0-9_$]/;

function wordAt(sql, i) {
  if (i > 0 && WORD.test(sql[i - 1])) return null; // mid identifier
  const m = /^[A-Za-z]+/.exec(sql.slice(i, i + 12));
  if (!m) return null;
  const end = i + m[0].length;
  if (end < sql.length && WORD.test(sql[end])) return null; // longer identifier
  return m[0].toUpperCase();
}

export function splitSql(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let beginDepth = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];

    // -- line comment, requires whitespace or end of line after the dashes
    if (ch === '-' && sql[i + 1] === '-' && (i + 2 >= n || /[\s]/.test(sql[i + 2]))) {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      if (buf.trim()) buf += '\n';
      continue;
    }
    // # line comment
    if (ch === '#') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    // /* block comment */
    if (ch === '/' && sql[i + 1] === '*') {
      const close = sql.indexOf('*/', i + 2);
      i = close === -1 ? n : close + 2;
      continue;
    }
    // Quoted strings and backtick identifiers
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      buf += ch;
      i += 1;
      while (i < n) {
        if (sql[i] === '\\' && quote !== '`') {
          buf += sql[i] + (sql[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            buf += quote + quote;
            i += 2;
            continue;
          }
          buf += quote;
          i += 1;
          break;
        }
        buf += sql[i];
        i += 1;
      }
      continue;
    }
    // BEGIN and END, tracked so a compound body is one statement
    const word = wordAt(sql, i);
    if (word === 'BEGIN') {
      // "BEGIN" opening a block, not "BEGIN" starting a transaction at depth 0
      // with nothing before it. Both are handled the same way here because a
      // bare BEGIN; is never emitted by this project's migrations.
      const after = sql.slice(i + 5).trimStart().toUpperCase();
      if (!after.startsWith('WORK') && !after.startsWith(';')) beginDepth += 1;
      buf += sql.slice(i, i + 5);
      i += 5;
      continue;
    }
    if (word === 'END') {
      const after = sql.slice(i + 3).trimStart().toUpperCase();
      const closesBlock = !/^(IF|WHILE|LOOP|CASE|REPEAT)\b/.test(after);
      if (closesBlock && beginDepth > 0) beginDepth -= 1;
      buf += sql.slice(i, i + 3);
      i += 3;
      continue;
    }
    if (ch === ';' && beginDepth === 0) {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}
