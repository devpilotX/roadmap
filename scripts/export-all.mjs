/**
 * export-all.mjs | the whole tracker on disk, in formats that outlive it.
 *
 * Part 18.8 of final.md is the reason this exists: the data belongs to the
 * person who entered it, and it must be readable without this application, this
 * database, or Node. So every export is plain CSV plus one JSON file, with a
 * MANIFEST.txt that explains what each file is.
 *
 * The table list is shared with `GET /api/export/:table.csv` through
 * src/lib/exportTables.mjs, so nothing can be exportable in the UI and missing
 * from the backup.
 *
 * Usage
 *   node scripts/export-all.mjs                      every active user, into ./backups
 *   node scripts/export-all.mjs --user=me@x.com      one user
 *   node scripts/export-all.mjs --out=D:/exports     somewhere else
 *   node scripts/export-all.mjs --format=csv         csv only, or json, or both
 *   node scripts/export-all.mjs --zip                also make a .zip if the OS can
 *   node scripts/export-all.mjs --dry-run            list what would be written
 *   node scripts/export-all.mjs --keep=14            prune export folders older than 14 days
 *
 * Cron, nightly at 03:40 Asia/Kolkata, after the link check:
 *   40 3 * * *  cd /srv/roadmap-tracker && /usr/bin/node scripts/export-all.mjs >> /var/log/roadmap/export.log 2>&1
 *
 * Every run appends a row to `backup_log` with kind='export', so /profile can
 * show when the last export actually happened rather than when it was intended.
 */

import { execFile } from 'node:child_process';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { config, ROOT } from '../src/config.mjs';
import { closePool, query, run } from '../src/db/pool.mjs';
import { EXPORTABLE, REFERENCE_TABLES, USER_TABLES, toCsv } from '../src/lib/exportTables.mjs';
import { todayInTz } from '../src/lib/dates.mjs';
import {
  banner, bad, good, info, intOption, parseArgv, runScript, say, sqlNow, step, table, warn,
} from './lib/cli.mjs';

const execFileAsync = promisify(execFile);

const { flags, values } = parseArgv(process.argv.slice(2), ['user', 'out', 'format', 'keep']);
const dryRun = flags.has('dry-run');
const format = (values.get('format') ?? 'both').toLowerCase();
if (!['csv', 'json', 'both'].includes(format)) {
  throw new Error(`--format must be csv, json or both, got "${format}"`);
}
const wantCsv = format === 'csv' || format === 'both';
const wantJson = format === 'json' || format === 'both';
const keepDays = intOption(values, 'keep', config.backupKeepDays, { min: 0, max: 3650 });

const outRoot = (() => {
  const raw = values.get('out') ?? config.backupDir;
  return isAbsolute(raw) ? resolve(raw) : resolve(join(ROOT, raw));
})();

const safeName = (s) => String(s).replace(/[^a-zA-Z0-9._@-]/g, '_');
const bytesText = (n) =>
  n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

async function logBackup(fileName, bytes, ok, message) {
  await run(
    'INSERT INTO backup_log (ran_at, kind, file_name, bytes, ok, message) VALUES (?, \'export\', ?, ?, ?, ?)',
    [sqlNow(), String(fileName).slice(0, 255), bytes, ok ? 1 : 0, message ? String(message).slice(0, 500) : null]
  );
}

/** Deletes export folders older than keepDays. Never touches .sql dumps. */
async function prune() {
  if (!keepDays) return [];
  const cutoff = Date.now() - keepDays * 86400000;
  const removed = [];
  let entries;
  try {
    entries = await readdir(outRoot, { withFileTypes: true });
  } catch {
    return removed;
  }
  for (const e of entries) {
    if (!e.isDirectory() || !/^export-\d{4}-\d{2}-\d{2}/.test(e.name)) continue;
    const full = join(outRoot, e.name);
    const st = await stat(full);
    if (st.mtimeMs < cutoff) {
      if (!dryRun) await rm(full, { recursive: true, force: true });
      removed.push(e.name);
    }
  }
  return removed;
}

async function main() {
  banner(
    'export-all.mjs | every table this tracker owns, as CSV and JSON',
    dryRun ? 'dry run, nothing is written' : `into ${outRoot}`
  );

  const rules = await query('SELECT ord, rule FROM export_rules ORDER BY ord');
  if (rules.length) {
    step('The export rules from Part 18.8 of final.md');
    for (const r of rules) info(`${r.ord}. ${r.rule}`);
  }

  const users = values.has('user')
    ? await query('SELECT id, email, display_name FROM users WHERE email = ?', [values.get('user')])
    : await query('SELECT id, email, display_name FROM users WHERE is_active = 1 ORDER BY id');

  if (!users.length) {
    say('');
    warn(values.has('user') ? `No user with the email ${values.get('user')}.` : 'There are no active users to export.');
    return 0;
  }

  step(`${Object.keys(EXPORTABLE).length} tables: ${USER_TABLES.length} owned by the user, ${REFERENCE_TABLES.length} reference tables from final.md`);
  info(`${users.length} user${users.length === 1 ? '' : 's'} to export`);
  info(wantCsv && wantJson ? 'writing CSV and JSON' : wantCsv ? 'writing CSV only' : 'writing JSON only');

  // Reference tables are identical for everybody, so they are read once.
  const referenceRows = {};
  for (const t of REFERENCE_TABLES) {
    referenceRows[t] = await query(`SELECT * FROM \`${t}\``);
  }

  const today = todayInTz();
  const runStamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
  let totalBytes = 0;
  let totalFiles = 0;
  const perUser = [];

  for (const user of users) {
    const dirName = `export-${today}-${runStamp}-${safeName(user.email)}`;
    const dir = join(outRoot, dirName);
    step(`${user.email}`);
    info(`folder ${dirName}`);
    if (!dryRun) await mkdir(dir, { recursive: true });

    const manifest = [
      'The Roadmap Tracker, full export',
      '',
      `user            ${user.display_name} <${user.email}>`,
      `exported at     ${new Date().toISOString()} (${config.timezone} date ${today})`,
      `roadmap window  ${config.roadmap.firstDay} to ${config.roadmap.lastDay}`,
      `database        ${config.db.database}`,
      '',
      'Every file is UTF-8. CSV files use CRLF line endings and RFC 4180 quoting,',
      'so they open in Excel, Numbers, LibreOffice, pandas and sqlite as they are.',
      'An empty cell is a NULL. Dates are YYYY-MM-DD and never carry a timezone.',
      '',
      'This export is deliberately readable without this application. If the app is',
      'gone, the CSV files are still the record of what happened between',
      `${config.roadmap.firstDay} and ${config.roadmap.lastDay}.`,
      '',
      'FILES',
      '',
    ];

    const written = [];
    const rowsByTable = {};

    for (const [name, spec] of Object.entries(EXPORTABLE)) {
      const rows = spec.user
        ? await query(`SELECT * FROM \`${name}\` WHERE user_id = ?`, [user.id])
        : referenceRows[name];
      rowsByTable[name] = rows;

      if (wantCsv) {
        const csv = toCsv(rows);
        const fileName = `${spec.user ? 'mine' : 'plan'}-${name}.csv`;
        const bytes = Buffer.byteLength(csv, 'utf8');
        if (!dryRun) await writeFile(join(dir, fileName), csv, 'utf8');
        written.push({ file: fileName, table: name, scope: spec.user ? 'mine' : 'plan', rows: rows.length, bytes });
        manifest.push(
          `  ${fileName.padEnd(38)} ${String(rows.length).padStart(6)} rows  ${spec.user ? 'your data' : 'from final.md'}`
        );
        totalBytes += bytes;
        totalFiles += 1;
      }
    }

    if (wantJson) {
      const payload = {
        exported_at: new Date().toISOString(),
        user: { id: user.id, email: user.email, display_name: user.display_name },
        roadmap: { first_day: config.roadmap.firstDay, last_day: config.roadmap.lastDay },
        counts: Object.fromEntries(Object.entries(rowsByTable).map(([k, v]) => [k, v.length])),
        tables: rowsByTable,
      };
      const json = JSON.stringify(payload, null, 2);
      const bytes = Buffer.byteLength(json, 'utf8');
      if (!dryRun) await writeFile(join(dir, 'all.json'), json, 'utf8');
      written.push({ file: 'all.json', table: 'everything', scope: 'both', rows: Object.values(rowsByTable).reduce((a, b) => a + b.length, 0), bytes });
      manifest.push(`  ${'all.json'.padEnd(38)} ${String(Object.keys(rowsByTable).length).padStart(6)} tables  the same data in one file`);
      totalBytes += bytes;
      totalFiles += 1;
    }

    if (!dryRun) {
      await writeFile(join(dir, 'MANIFEST.txt'), manifest.join('\n') + '\n', 'utf8');
      totalFiles += 1;
    }

    const rowTotal = Object.values(rowsByTable).reduce((a, b) => a + b.length, 0);
    const byteTotal = written.reduce((a, b) => a + b.bytes, 0);
    const emptyTables = Object.entries(rowsByTable).filter(([, v]) => v.length === 0).map(([k]) => k);

    table(
      written
        .filter((w) => w.rows > 0 || w.file === 'all.json')
        .map((w) => ({ file: w.file, rows: w.rows, size: bytesText(w.bytes) })),
      ['file', 'rows', 'size']
    );
    if (emptyTables.length) {
      info(`${emptyTables.length} table${emptyTables.length === 1 ? '' : 's'} exported empty, which is normal on day one: ${emptyTables.slice(0, 8).join(', ')}${emptyTables.length > 8 ? ', ...' : ''}`);
    }
    good(`${written.length} data files, ${rowTotal} rows, ${bytesText(byteTotal)}`);

    let zipPath = null;
    if (flags.has('zip') && !dryRun) {
      zipPath = `${dir}.zip`;
      try {
        if (process.platform === 'win32') {
          await execFileAsync('powershell', [
            '-NoProfile', '-Command',
            `Compress-Archive -Path '${dir}\\*' -DestinationPath '${zipPath}' -Force`,
          ]);
        } else {
          await execFileAsync('zip', ['-rq', zipPath, dirName], { cwd: outRoot });
        }
        const st = await stat(zipPath);
        good(`zipped to ${dirName}.zip, ${bytesText(st.size)}`);
      } catch (err) {
        warn(`could not zip: ${err.message}. The folder is still there, which is what matters.`);
        zipPath = null;
      }
    }

    if (!dryRun) {
      await logBackup(zipPath ? `${dirName}.zip` : dirName, byteTotal, true, `${written.length} files, ${rowTotal} rows`);
    }

    perUser.push({ user: user.email, files: written.length, rows: rowTotal, size: bytesText(byteTotal) });
  }

  const pruned = await prune();
  if (pruned.length) {
    step(`Pruned ${pruned.length} export folder${pruned.length === 1 ? '' : 's'} older than ${keepDays} days`);
    for (const p of pruned) info(dryRun ? `would remove ${p}` : `removed ${p}`);
  }

  step('Summary');
  table(perUser, ['user', 'files', 'rows', 'size']);
  info(`${totalFiles} files, ${bytesText(totalBytes)} in total`);
  say('');
  if (dryRun) {
    info('Dry run: no file was written and no backup_log row was added.');
  } else {
    good(`Written under ${outRoot}`);
    info('Every run is recorded in backup_log, so /profile can show the real last export time.');
  }
  return 0;
}

await runScript('export-all.mjs', main, { closePool });
