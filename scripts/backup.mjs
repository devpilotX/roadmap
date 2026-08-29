/**
 * backup.mjs | the same backup as scripts/backup.sh, on any operating system.
 *
 * backup.sh is what cron calls inside the Linux container, because a shell
 * script is the right thing there and the build prompt names it. This file is
 * the equivalent for a Windows development machine, and for anyone who would
 * rather have one command that works everywhere. Both write the same
 * `backup_log` row, both verify the archive, and both prune on the same
 * retention window, so it does not matter which one ran.
 *
 * Usage
 *   node scripts/backup.mjs              dump, verify, prune, log
 *   node scripts/backup.mjs --no-prune   keep every dump
 *   node scripts/backup.mjs --quick      skip the archive verification
 *   node scripts/backup.mjs --out=D:/db  somewhere other than BACKUP_DIR
 *   node scripts/backup.mjs --keep=30    override BACKUP_KEEP_DAYS
 *   node scripts/backup.mjs --dry-run    say what it would do
 *
 * Exit codes match backup.sh: 0 written and verified, 1 the dump failed and the
 * failure is in backup_log, 2 the configuration is wrong.
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, unlink } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createGzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { config, ROOT } from '../lib/config.ts';
import { closePool, ping, run } from '../lib/db/pool.ts';
import {
  banner, bad, good, info, intOption, parseArgv, runScript, say, sqlNow, step, warn,
} from './lib/cli.mjs';

const { flags, values } = parseArgv(process.argv.slice(2), ['out', 'keep']);
const dryRun = flags.has('dry-run');
const verify = !flags.has('quick');
const prune = !flags.has('no-prune');
const keepDays = intOption(values, 'keep', config.backupKeepDays, { min: 0, max: 3650 });

const outDir = (() => {
  const raw = values.get('out') ?? config.backupDir;
  return isAbsolute(raw) ? resolve(raw) : resolve(join(ROOT, raw));
})();

const bytesText = (n) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

async function logRow(fileName, bytes, ok, message) {
  try {
    await run(
      'INSERT INTO backup_log (ran_at, kind, file_name, bytes, ok, message) VALUES (?, \'dump\', ?, ?, ?, ?)',
      [sqlNow(), String(fileName).slice(0, 255), bytes, ok ? 1 : 0, message ? String(message).slice(0, 500) : null]
    );
    return true;
  } catch (err) {
    warn(`could not write the backup_log row: ${err.message}. The dump itself is unaffected.`);
    return false;
  }
}

/**
 * Runs mysqldump and gzips its stdout straight to disk, so a large database
 * never has to fit in memory. The password goes in on stdin as a defaults file,
 * never on the command line, so it cannot leak into a process list.
 */
function dump(target) {
  return new Promise((resolve_, reject) => {
    const args = [
      `--defaults-file=/dev/stdin`,
      '--single-transaction',
      '--quick',
      '--routines',
      '--triggers',
      '--events',
      '--default-character-set=utf8mb4',
      '--set-gtid-purged=OFF',
      config.db.database,
    ];
    // /dev/stdin is not a thing on Windows, so the flag is dropped there and the
    // password is passed through the environment instead, which mysqldump reads
    // and which does not appear in the process list either.
    const onWindows = process.platform === 'win32';
    if (onWindows) args.shift();

    const child = spawn(config.mysqldumpBin, onWindows
      ? [
          `--host=${config.db.host}`,
          `--port=${config.db.port}`,
          `--user=${config.db.user}`,
          ...args,
        ]
      : args, {
      env: onWindows ? { ...process.env, MYSQL_PWD: config.db.password } : process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (!onWindows) {
      child.stdin.write(
        `[client]\nhost=${config.db.host}\nport=${config.db.port}\nuser=${config.db.user}\npassword=${config.db.password}\n`
      );
    }
    child.stdin.end();

    let stderr = '';
    child.stderr.on('data', (d) => {
      const s = String(d);
      // mysqldump warns about the password on stdin even when it is correct.
      if (!/Using a password on the command line/i.test(s)) stderr += s;
    });

    const out = createWriteStream(target);
    pipeline(child.stdout, createGzip({ level: 9 }), out).catch(reject);

    child.on('error', (err) =>
      reject(
        new Error(
          `${config.mysqldumpBin} could not be run: ${err.message}. Set MYSQLDUMP_BIN in .env to the full path.`
        )
      )
    );
    child.on('close', (code) => {
      out.on('close', () => (code === 0 ? resolve_({ stderr }) : reject(Object.assign(new Error(stderr.trim() || `mysqldump exited ${code}`), { code }))));
    });
  });
}

/** Reads the gzip back and proves it is complete, which is the whole point. */
async function verifyArchive(target) {
  let tables = 0;
  let inserts = 0;
  let completed = false;
  const rl = createInterface({
    input: createReadStream(target).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.startsWith('CREATE TABLE')) tables += 1;
    else if (line.startsWith('INSERT INTO')) inserts += 1;
    else if (line.startsWith('-- Dump completed')) completed = true;
  }
  return { tables, inserts, completed };
}

async function pruneOld(prefix) {
  if (!prune || !keepDays) return [];
  const cutoff = Date.now() - keepDays * 86400000;
  const removed = [];
  let entries;
  try {
    entries = await readdir(outDir);
  } catch {
    return removed;
  }
  for (const name of entries) {
    if (!name.startsWith(prefix) || !name.endsWith('.sql.gz')) continue;
    const full = join(outDir, name);
    const st = await stat(full);
    if (st.mtimeMs < cutoff) {
      if (!dryRun) await unlink(full);
      removed.push(name);
    }
  }
  return removed;
}

async function main() {
  const stamp = new Date(Date.now() + 5.5 * 3600 * 1000)
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '');
  const fileName = `${config.db.database}-${stamp}.sql.gz`;
  const target = join(outDir, fileName);

  banner(
    `backup.mjs | mysqldump of ${config.db.database}`,
    dryRun ? 'dry run, nothing is written' : `-> ${target}`
  );

  info(`server     ${config.db.host}:${config.db.port}`);
  info(`mysqldump  ${config.mysqldumpBin}`);
  info(`retention  ${keepDays ? `${keepDays} days` : 'keep everything'}`);
  info(`verify     ${verify ? 'yes, the archive is read back' : 'no, --quick was given'}`);

  if (!(await ping())) {
    bad('The database is not answering, so there is nothing to dump.');
    return 2;
  }

  if (dryRun) {
    step('Would run');
    info(`${config.mysqldumpBin} --single-transaction --quick --routines --triggers --events ${config.db.database} | gzip -9 > ${fileName}`);
    const would = await pruneOld(`${config.db.database}-`);
    if (would.length) info(`would prune ${would.length} dump(s) older than ${keepDays} days: ${would.join(', ')}`);
    say('');
    info('Dry run: no dump, no prune, no backup_log row.');
    return 0;
  }

  await mkdir(outDir, { recursive: true });

  step('Dumping');
  try {
    await dump(target);
  } catch (err) {
    bad(err.message);
    await rm(target, { force: true });
    await logRow(fileName, null, false, err.message);
    info('The failure is recorded in backup_log, so /profile will not claim a backup that never happened.');
    return 1;
  }

  const st = await stat(target);
  good(`${fileName}, ${bytesText(st.size)}`);

  let note = `ok, ${bytesText(st.size)}`;
  if (verify) {
    step('Verifying');
    const v = await verifyArchive(target);
    if (!v.completed) {
      bad('The archive has no "Dump completed" marker, so it was cut short. That is not a backup.');
      await logRow(fileName, st.size, false, 'truncated dump, no completion marker');
      return 1;
    }
    good(`gzip readable, dump completed, ${v.tables} tables, ${v.inserts} insert statements`);
    note = `ok, ${v.tables} tables, ${v.inserts} inserts, retention ${keepDays}d`;
  }

  const pruned = await pruneOld(`${config.db.database}-`);
  if (pruned.length) {
    step(`Pruned ${pruned.length} dump(s) older than ${keepDays} days`);
    for (const p of pruned) info(p);
  }

  const kept = (await readdir(outDir)).filter(
    (n) => n.startsWith(`${config.db.database}-`) && n.endsWith('.sql.gz')
  );
  info(`${kept.length} dump(s) now in ${outDir}`);

  await logRow(fileName, st.size, true, `${note}, pruned ${pruned.length}`);
  good('backup_log row written');

  step('Restore, which is the only reason this exists');
  info(`gunzip -c "${target}" | mysql -h ${config.db.host} -P ${config.db.port} -u ${config.db.user} -p ${config.db.database}`);
  info('On Windows, 7-Zip or gzip -d will unpack it and the MySQL client will read it the same way.');
  return 0;
}

await runScript('backup.mjs', main, { closePool });
