/**
 * migrate.mjs
 *
 * Applies every migrations/*.sql in filename order, once each, recording the
 * filename and its SHA-256 in migrations_applied. Re-running is a no-op.
 *
 * A migration whose content changed after being applied is a hard stop: silently
 * running a different file under the same name is how databases drift.
 *
 *   node scripts/migrate.mjs            apply pending migrations
 *   node scripts/migrate.mjs --status   list what is applied and what is pending
 *   node scripts/migrate.mjs --force    re-apply changed files, use with care
 */

import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT, config } from '../lib/config.ts';
import { closePool, getPool, query, run } from '../lib/db/pool.ts';
import { splitSql } from './lib/sqlsplit.mjs';

const MIGRATIONS = join(ROOT, 'migrations');
const args = new Set(process.argv.slice(2));

function sha(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function ensureLedger() {
  await run(`
    CREATE TABLE IF NOT EXISTS migrations_applied (
      filename   VARCHAR(160) NOT NULL PRIMARY KEY,
      sha256     CHAR(64) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function main() {
  const files = (await readdir(MIGRATIONS)).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) throw new Error('No .sql files found in migrations/');

  console.log(`Database ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
  await ensureLedger();
  const applied = new Map(
    (await query('SELECT filename, sha256, applied_at FROM migrations_applied')).map((r) => [
      r.filename,
      r,
    ])
  );

  if (args.has('--status')) {
    for (const f of files) {
      const text = await readFile(join(MIGRATIONS, f), 'utf8');
      const hit = applied.get(f);
      if (!hit) console.log(`  pending  ${f}`);
      else if (hit.sha256 !== sha(text)) console.log(`  CHANGED  ${f}  applied ${hit.applied_at}`);
      else console.log(`  applied  ${f}  ${hit.applied_at}`);
    }
    return;
  }

  let ranAny = false;
  for (const f of files) {
    const text = await readFile(join(MIGRATIONS, f), 'utf8');
    const digest = sha(text);
    const hit = applied.get(f);
    if (hit && hit.sha256 === digest) {
      console.log(`  skip     ${f}`);
      continue;
    }
    if (hit && hit.sha256 !== digest && !args.has('--force')) {
      throw new Error(
        `${f} has changed since it was applied on ${hit.applied_at}.\n` +
          '  Applying a different file under the same name causes silent drift.\n' +
          '  Either restore the original file, or re-run with --force if you know the change is safe.'
      );
    }

    const statements = splitSql(text);
    if (statements.length === 0) throw new Error(`${f} contains no statements`);
    const conn = await getPool().getConnection();
    const started = Date.now();
    try {
      // DDL is not transactional in MySQL, so a failure is reported with the
      // exact statement index rather than pretending it can be rolled back.
      let i = 0;
      for (const stmt of statements) {
        i += 1;
        try {
          await conn.query(stmt);
        } catch (err) {
          const preview = stmt.replace(/\s+/g, ' ').slice(0, 160);
          throw new Error(
            `${f} failed at statement ${i} of ${statements.length}\n  ${preview}\n  ${err.message}`
          );
        }
      }
      await conn.query(
        'INSERT INTO migrations_applied (filename, sha256) VALUES (?, ?) ' +
          'ON DUPLICATE KEY UPDATE sha256 = VALUES(sha256), applied_at = CURRENT_TIMESTAMP',
        [f, digest]
      );
      const ms = Date.now() - started;
      console.log(`  applied  ${f}  ${statements.length} statements in ${ms} ms`);
      ranAny = true;
    } finally {
      conn.release();
    }
  }
  if (!ranAny) console.log('Nothing to do. The database is already up to date.');
}

try {
  await main();
  await closePool();
} catch (err) {
  console.error(`\nMIGRATION FAILED\n${err.message}\n`);
  await closePool();
  process.exit(1);
}
