/**
 * cli.test.mjs | the CSV reader and writer, and the argument parser.
 *
 * The CSV reader is the front door for problem names coming out of a Striver or
 * Codolio export, so a field with a comma in it has to survive intact. Everything
 * here is a round trip or a boundary.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  csvToObjects, intOption, parseArgv, parseCsv, sqlNow, toCsv,
} from '../scripts/lib/cli.mjs';
import { EXPORTABLE, REFERENCE_TABLES, USER_TABLES, toCsv as exportCsv } from '../src/lib/exportTables.mjs';

describe('parseCsv', () => {
  it('reads a plain file', () => {
    assert.deepEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  });

  it('reads CRLF the same as LF', () => {
    assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  });

  it('keeps a comma inside a quoted field', () => {
    assert.deepEqual(parseCsv('name,diff\n"Frog jump, with K distances",Medium\n'), [
      ['name', 'diff'],
      ['Frog jump, with K distances', 'Medium'],
    ]);
  });

  it('keeps a newline inside a quoted field', () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\n');
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], 'line one\nline two');
  });

  it('unescapes a doubled double quote', () => {
    assert.deepEqual(parseCsv('a\n"He said ""no"""\n'), [['a'], ['He said "no"']]);
  });

  it('preserves empty fields rather than dropping them', () => {
    assert.deepEqual(parseCsv('a,b,c\n1,,3\n'), [['a', 'b', 'c'], ['1', '', '3']]);
  });

  it('strips a UTF-8 byte order mark, which Excel adds', () => {
    assert.deepEqual(parseCsv('\ufeffa,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
  });

  it('does not invent a row from a trailing newline', () => {
    assert.equal(parseCsv('a,b\n1,2\n').length, 2);
    assert.equal(parseCsv('a,b\n1,2\n\n').length, 2);
  });

  it('reads a file with no trailing newline', () => {
    assert.deepEqual(parseCsv('a,b\n1,2'), [['a', 'b'], ['1', '2']]);
  });

  it('returns nothing for empty input', () => {
    assert.deepEqual(parseCsv(''), []);
    assert.deepEqual(parseCsv('\n'), []);
  });
});

describe('toCsv', () => {
  it('writes a header and CRLF endings', () => {
    assert.equal(toCsv([{ a: 1, b: 2 }]), 'a,b\r\n1,2\r\n');
  });

  it('quotes a value that contains a comma, a quote or a newline', () => {
    assert.equal(toCsv([{ a: 'x,y' }]), 'a\r\n"x,y"\r\n');
    assert.equal(toCsv([{ a: 'say "hi"' }]), 'a\r\n"say ""hi"""\r\n');
    assert.equal(toCsv([{ a: 'one\ntwo' }]), 'a\r\n"one\ntwo"\r\n');
  });

  it('writes a null as an empty cell, never as the word null', () => {
    assert.equal(toCsv([{ a: null, b: undefined, c: 0 }]), 'a,b,c\r\n,,0\r\n');
  });

  it('is empty for no rows', () => {
    assert.equal(toCsv([]), '');
  });

  it('round trips through parseCsv without losing anything', () => {
    const rows = [
      { name: 'Frog jump, with K distances', difficulty: 'Medium', note: 'said "hard"' },
      { name: 'Plain one', difficulty: 'Easy', note: '' },
      { name: 'Two\nlines', difficulty: 'Hard', note: null },
    ];
    const back = parseCsv(toCsv(rows));
    assert.deepEqual(back[0], ['name', 'difficulty', 'note']);
    assert.deepEqual(back[1], ['Frog jump, with K distances', 'Medium', 'said "hard"']);
    assert.deepEqual(back[2], ['Plain one', 'Easy', '']);
    assert.deepEqual(back[3], ['Two\nlines', 'Hard', '']);
  });
});

describe('csvToObjects', () => {
  it('keys rows by the header and trims the cells', () => {
    const { headers, records } = csvToObjects('Step No, Problem \n1, Count digits \n');
    assert.deepEqual(headers, ['Step No', 'Problem']);
    assert.deepEqual(records, [{ 'Step No': '1', Problem: 'Count digits' }]);
  });

  it('fills a short row with empty strings rather than undefined', () => {
    const { records } = csvToObjects('a,b,c\n1\n');
    assert.deepEqual(records[0], { a: '1', b: '', c: '' });
  });

  it('returns no records for a header only file', () => {
    const { headers, records } = csvToObjects('a,b\n');
    assert.deepEqual(headers, ['a', 'b']);
    assert.deepEqual(records, []);
  });
});

describe('parseArgv', () => {
  it('reads a bare flag', () => {
    const { flags } = parseArgv(['--dry-run']);
    assert.equal(flags.has('dry-run'), true);
  });

  it('reads --key=value', () => {
    const { values } = parseArgv(['--limit=20']);
    assert.equal(values.get('limit'), '20');
  });

  it('reads --key value when the option is declared as taking one', () => {
    const { values } = parseArgv(['--user', 'me@example.com'], ['user']);
    assert.equal(values.get('user'), 'me@example.com');
  });

  it('does not swallow the next argument for an undeclared option', () => {
    const { flags, positional } = parseArgv(['--dry-run', 'export.csv'], ['user']);
    assert.equal(flags.has('dry-run'), true);
    assert.deepEqual(positional, ['export.csv']);
  });

  it('collects positional arguments in order', () => {
    const { positional } = parseArgv(['a.csv', '--write', 'b.csv']);
    assert.deepEqual(positional, ['a.csv', 'b.csv']);
  });

  it('keeps an equals sign inside a value', () => {
    const { values } = parseArgv(['--map=topic=Step No,name=Problem']);
    assert.equal(values.get('map'), 'topic=Step No,name=Problem');
  });

  it('lets a later value win', () => {
    const { values } = parseArgv(['--limit=1', '--limit=2']);
    assert.equal(values.get('limit'), '2');
  });
});

describe('intOption', () => {
  const v = new Map([['a', '5'], ['big', '9999'], ['small', '-3'], ['junk', 'abc'], ['float', '7.9']]);

  it('falls back when the option is absent', () => {
    assert.equal(intOption(v, 'missing', 42), 42);
  });

  it('reads an integer', () => {
    assert.equal(intOption(v, 'a', 1), 5);
  });

  it('clamps to the floor and the ceiling', () => {
    assert.equal(intOption(v, 'small', 1, { min: 0 }), 0);
    assert.equal(intOption(v, 'big', 1, { max: 100 }), 100);
  });

  it('truncates rather than rounding, so a limit is never exceeded', () => {
    assert.equal(intOption(v, 'float', 1), 7);
  });

  it('throws on something that is not a number', () => {
    assert.throws(() => intOption(v, 'junk', 1), /must be a number/);
  });
});

describe('sqlNow', () => {
  it('produces a MySQL DATETIME, with no timezone marker', () => {
    assert.match(sqlNow(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('offsets by five and a half hours for Asia/Kolkata by default', () => {
    const utc = new Date().toISOString().slice(0, 13);
    const ist = sqlNow().slice(0, 13);
    assert.notEqual(typeof ist, 'undefined');
    assert.equal(ist.length, utc.length);
  });
});

describe('the export table list', () => {
  it('is shared by the API and the export script, and is not empty', () => {
    assert.ok(Object.keys(EXPORTABLE).length >= 40);
  });

  it('splits cleanly into user owned and reference tables', () => {
    assert.equal(USER_TABLES.length + REFERENCE_TABLES.length, Object.keys(EXPORTABLE).length);
    assert.equal(new Set([...USER_TABLES, ...REFERENCE_TABLES]).size, Object.keys(EXPORTABLE).length);
  });

  it('marks every user table as user scoped and no reference table as such', () => {
    for (const t of USER_TABLES) assert.equal(EXPORTABLE[t].user, true, t);
    for (const t of REFERENCE_TABLES) assert.equal(EXPORTABLE[t].user, false, t);
  });

  it('uses only safe table identifiers, since they reach a query', () => {
    for (const t of Object.keys(EXPORTABLE)) {
      assert.match(t, /^[a-z][a-z0-9_]*$/, `${t} is not a plain identifier`);
    }
  });

  it('includes the tables a person would be upset to lose', () => {
    for (const t of ['day_logs', 'dsa_progress', 'applications', 'deals', 'github_pushes', 'study_sessions']) {
      assert.ok(t in EXPORTABLE, `${t} is missing from the export`);
    }
  });

  it('writes CSV identically to the script helper', () => {
    const rows = [{ a: 'x,y', b: null }];
    assert.equal(exportCsv(rows), toCsv(rows));
  });
});
