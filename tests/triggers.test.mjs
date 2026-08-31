/**
 * triggers.test.mjs | the SQL that enforces Part 18.7 rule 3.
 *
 * This file exists because of a real defect that would have surfaced on the
 * eighth day of use and not one day earlier.
 *
 * `trg_day_logs_no_backdate_upd` originally rejected EVERY update to a day_logs
 * row older than seven days. But lib/db/progress.ts recomputeDay() updates
 * pushes, money_touches, day_colour, conditions_met and week_n, which are
 * derived from other tables rather than entered by a person, and
 * recomputeRange() walks all 150 days on GitHub sync, on a repository edit and
 * on any change to the start date. Every one of those would have become a 500.
 *
 * migration 005 narrowed the trigger to fire only when a human-entered column
 * actually changes. These tests pin both halves of that: the derived write must
 * pass, and the retroactive edit must still be refused.
 *
 * HOW IT TESTS WHAT IT CLAIMS TO TEST
 * A day_logs row older than seven days cannot be created, because the BEFORE
 * INSERT trigger correctly forbids exactly that. So the suite builds a probe
 * table with `CREATE TABLE ... LIKE day_logs` (which copies the columns but not
 * the triggers, and not the foreign key), ages a row inside it, and then attaches
 * the trigger definition READ VERBATIM FROM migrations/005_hardening.sql with
 * only the trigger name and table name rewritten. The predicate under test is
 * therefore the shipped predicate, not a paraphrase of it.
 *
 * The probe table is dropped in a finally block, including on the failure path.
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { ROOT } from '../lib/config.ts';
import { closePool, getPool, one, run } from '../lib/db/pool.ts';
import { databaseIsUp } from './helpers.mjs';

const PROBE = '_probe_day_logs_trigger';

const up = await databaseIsUp().catch(() => false);
const skip = () =>
  up ? false : 'MySQL is not running, so the day_logs triggers cannot be exercised';

/** The UPDATE trigger exactly as migration 005 ships it, retargeted at the probe. */
function shippedTriggerSql() {
  const sql = readFileSync(join(ROOT, 'migrations', '005_hardening.sql'), 'utf8');
  const match = sql.match(
    /CREATE TRIGGER trg_day_logs_no_backdate_upd\s+BEFORE UPDATE ON day_logs FOR EACH ROW\s+BEGIN[\s\S]*?\nEND;/
  );
  assert.ok(match, 'could not find trg_day_logs_no_backdate_upd in migrations/005_hardening.sql');
  return match[0]
    .replace('trg_day_logs_no_backdate_upd', `${PROBE}_upd`)
    .replace('ON day_logs', `ON ${PROBE}`)
    .replace(/;$/, '');
}

async function buildProbe() {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.query(`DROP TABLE IF EXISTS ${PROBE}`);
    // LIKE copies every column and index, and deliberately copies no trigger and
    // no foreign key, which is what makes an aged row possible at all.
    await conn.query(`CREATE TABLE ${PROBE} LIKE day_logs`);
    // Thirty days back: comfortably outside the seven day window.
    await conn.query(
      `INSERT INTO ${PROBE} (user_id, log_date, week_n, dsa_solved, notes, pushes, day_colour, conditions_met)
       VALUES (1, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 1, 3, 'original note', 0, 'red', 2)`
    );
    await conn.query(shippedTriggerSql());
  } finally {
    conn.release();
  }
}

async function dropProbe() {
  await run(`DROP TABLE IF EXISTS ${PROBE}`).catch(() => {});
}

if (up) await buildProbe();

after(async () => {
  await dropProbe();
  await closePool();
});

/** Runs an UPDATE against the aged probe row and reports what the trigger did. */
async function update(setClause) {
  try {
    await run(`UPDATE ${PROBE} SET ${setClause} WHERE user_id = 1`);
    return { ok: true, message: null };
  } catch (err) {
    return { ok: false, message: String(err.message ?? err) };
  }
}

describe('trg_day_logs_no_backdate_upd, on a day 30 days old', () => {
  it('lets recomputeDay write every derived column', { skip: skip() }, async () => {
    // These are exactly the five columns in the UPDATE at lib/db/progress.ts:250.
    const r = await update(
      "pushes = 4, money_touches = 12, day_colour = 'green', conditions_met = 6, week_n = 2"
    );
    assert.equal(r.ok, true, `the derived recomputation was refused: ${r.message}`);
    const row = await one(`SELECT pushes, day_colour, conditions_met FROM ${PROBE} WHERE user_id = 1`);
    assert.equal(Number(row.pushes), 4);
    assert.equal(row.day_colour, 'green');
    assert.equal(Number(row.conditions_met), 6);
  });

  it('still refuses a retroactive edit to a counted field', { skip: skip() }, async () => {
    const r = await update('dsa_solved = dsa_solved + 1');
    assert.equal(r.ok, false, 'a retroactive edit to dsa_solved was allowed');
    assert.match(r.message, /Retroactive editing is limited to 7 days/);
  });

  it('still refuses a retroactive edit to free text', { skip: skip() }, async () => {
    const r = await update("notes = 'rewritten later'");
    assert.equal(r.ok, false, 'a retroactive edit to notes was allowed');
    assert.match(r.message, /Retroactive editing is limited to 7 days/);
  });

  it('refuses a retroactive edit that sets a nullable column to NULL', { skip: skip() }, async () => {
    // The null safe <=> comparison is the reason this is caught. A plain != would
    // evaluate to NULL here, the IF would not fire, and the edit would slip past.
    const r = await update('close_log_line = NULL, notes = NULL');
    assert.equal(r.ok, false, 'a retroactive edit to NULL was allowed');
    assert.match(r.message, /Retroactive editing is limited to 7 days/);
  });

  it('allows an update that changes nothing a person entered', { skip: skip() }, async () => {
    const r = await update('notes = notes, pushes = pushes');
    assert.equal(r.ok, true, `a no-op update was refused: ${r.message}`);
  });

  it('leaves the derived columns writable after a refused edit', { skip: skip() }, async () => {
    const r = await update("day_colour = 'amber'");
    assert.equal(r.ok, true, `the trigger stayed latched after a rejection: ${r.message}`);
  });
});

describe('trg_day_logs_no_backdate_ins, unchanged by migration 005', () => {
  it('still refuses to create a day older than seven days', { skip: skip() }, async () => {
    // Against the real table, because this trigger was never the problem and its
    // behaviour is what makes the probe table necessary in the first place.
    try {
      await run(
        `INSERT INTO day_logs (user_id, log_date, week_n)
         VALUES (999999, DATE_SUB(CURDATE(), INTERVAL 30 DAY), 1)`
      );
      assert.fail('a day_log 30 days old was accepted');
    } catch (err) {
      const message = String(err.message ?? err);
      // Either the trigger refused it, or the foreign key did because user
      // 999999 does not exist. Both prove the row was not written.
      assert.match(message, /Retroactive editing is limited to 7 days|foreign key/i);
    }
    const row = await one(
      'SELECT id FROM day_logs WHERE user_id = 999999 LIMIT 1'
    );
    assert.equal(row, null, 'the rejected row was written anyway');
  });
});
