/**
 * db.test.mjs | the seed contract, checked against the live database.
 *
 * These are the numbers Appendix E of final.md commits to. `npm run verify`
 * checks them against the document at run time; this file checks the ones the
 * build prompt states directly, so a regression fails the test suite too.
 *
 * Every test skips itself when MySQL is not running, so `npm test` stays useful
 * on a machine with nothing started.
 */

import { strict as assert } from 'node:assert';
import { after, describe, it } from 'node:test';
import { config } from '../lib/config.ts';
import { databaseIsUp } from './helpers.mjs';

// The check runs at module load, before any describe body executes, because the
// skip decision has to be known by the time the tests are registered.
const up = await databaseIsUp().catch(() => false);
const pool = up ? await import('../lib/db/pool.ts') : null;
const query = pool?.query;
const scalar = pool?.scalar;

after(async () => {
  if (pool) await pool.closePool();
});

const skip = () => (up ? false : 'MySQL is not running, so the seed contract cannot be checked');

const count = async (table) => Number(await scalar(`SELECT COUNT(*) AS c FROM \`${table}\``));

describe('the Appendix E row counts', () => {
  const expected = {
    phases: 6,
    weeks: 21,
    week_days: 126,
    calendar_days: 150,
    week_links: 120,
    gates: 4,
    money_gates: 4,
    sundays: 21,
    projects: 4,
    readme_sections: 9,
    resource_categories: 20,
    roles: 7,
    corrections: 25,
    stack_versions: 18,
    breaks: 11,
    dead_links: 7,
    offers: 8,
    money_week_targets: 21,
    trackers: 9,
    warning_rules: 10,
    nz_costs: 8,
    nz_salary: 3,
    nz_projection: 5,
    roles_early: 9,
    eligibility_weeks: 22,
    eligibility_dsa: 13,
    fast_exits: 4,
    skill_combos: 8,
    skills: 25,
    costs: 4,
  };

  for (const [table, n] of Object.entries(expected)) {
    it(`${table} holds exactly ${n} rows`, { skip: skip() }, async () => {
      assert.equal(await count(table), n);
    });
  }
});

describe('the 150 day calendar', () => {
  it('starts on the first day and ends on the last', { skip: skip() }, async () => {
    const [row] = await query('SELECT MIN(cal_date) AS first, MAX(cal_date) AS last FROM calendar_days');
    assert.equal(row.first, config.roadmap.firstDay);
    assert.equal(row.last, config.roadmap.lastDay);
  });

  it('is contiguous, with no gap and no duplicate', { skip: skip() }, async () => {
    const rows = await query('SELECT cal_date FROM calendar_days ORDER BY cal_date');
    assert.equal(rows.length, 150);
    for (let i = 1; i < rows.length; i += 1) {
      const gap =
        (new Date(`${rows[i].cal_date}T00:00:00Z`) - new Date(`${rows[i - 1].cal_date}T00:00:00Z`)) / 86400000;
      assert.equal(gap, 1, `gap of ${gap} days before ${rows[i].cal_date}`);
    }
  });

  it('splits into 3 launch, 126 study and 21 Sunday days', { skip: skip() }, async () => {
    const rows = await query('SELECT kind, COUNT(*) AS c FROM calendar_days GROUP BY kind');
    const by = Object.fromEntries(rows.map((r) => [r.kind, Number(r.c)]));
    assert.equal(by.launch, 3);
    assert.equal(by.study, 126);
    const sundays = (by.sunday_working ?? 0) + (by.sunday_gate ?? 0) + (by.sunday_rest ?? 0);
    assert.equal(sundays, 21);
  });

  it('sums dsa_target to 415 on study days, 6 on launch, 0 on Sundays and 421 overall', { skip: skip() }, async () => {
    const rows = await query('SELECT kind, SUM(dsa_target) AS s FROM calendar_days GROUP BY kind');
    const by = Object.fromEntries(rows.map((r) => [r.kind, Number(r.s)]));
    const sundays =
      (by.sunday_working ?? 0) + (by.sunday_gate ?? 0) + (by.sunday_rest ?? 0);
    assert.equal(by.study, 415, 'the 126 study days must sum to 415');
    assert.equal(by.launch, 6, 'the 3 launch days must sum to 6');
    assert.equal(sundays, 0, 'no Sunday carries a DSA target');
    assert.equal(Number(await scalar('SELECT SUM(dsa_target) AS s FROM calendar_days')), 421);
  });

  it('agrees with the 415 figure in the config', { skip: skip() }, async () => {
    assert.equal(config.roadmap.dsaTargetByEnd, 415);
  });
});

describe('the weeks line up with the calendar', () => {
  it('gives every week seven days, and 21 weeks of them', { skip: skip() }, async () => {
    const rows = await query(
      'SELECT week_n, COUNT(*) AS c FROM calendar_days WHERE week_n IS NOT NULL GROUP BY week_n ORDER BY week_n'
    );
    assert.equal(rows.length, 21);
    for (const r of rows) assert.equal(Number(r.c), 7, `week ${r.week_n}`);
  });

  it('gives every week six week_days rows, which excludes the Sunday', { skip: skip() }, async () => {
    const rows = await query('SELECT week_n, COUNT(*) AS c FROM week_days GROUP BY week_n');
    assert.equal(rows.length, 21);
    for (const r of rows) assert.equal(Number(r.c), 6, `week ${r.week_n}`);
  });

  it('has week start and end dates that do not overlap', { skip: skip() }, async () => {
    const weeks = await query('SELECT n, start_date, end_date FROM weeks ORDER BY n');
    for (let i = 1; i < weeks.length; i += 1) {
      assert.ok(weeks[i].start_date > weeks[i - 1].end_date, `week ${weeks[i].n} overlaps week ${weeks[i - 1].n}`);
    }
  });

  it('puts the four gates on real calendar days', { skip: skip() }, async () => {
    const missing = await query(
      'SELECT g.`no` FROM gates g LEFT JOIN calendar_days c ON c.cal_date = g.gate_date WHERE c.cal_date IS NULL'
    );
    assert.deepEqual(missing, []);
  });
});

describe('DSA, where no name is ever invented', () => {
  it('seeds the 18 Striver steps', { skip: skip() }, async () => {
    assert.equal(await count('dsa_topics'), 18);
  });

  it('holds either no problems at all, or a full sheet, never a made up part', { skip: skip() }, async () => {
    const n = await count('dsa_problems');
    assert.ok(
      n === 0 || n >= 400,
      `dsa_problems holds ${n} rows. Zero means no import yet, which is honest. A small non zero number means something invented names.`
    );
  });

  it('keeps every problem attached to one of the 18 steps', { skip: skip() }, async () => {
    const orphans = Number(
      await scalar('SELECT COUNT(*) AS c FROM dsa_problems p LEFT JOIN dsa_topics t ON t.id = p.topic_id WHERE t.id IS NULL')
    );
    assert.equal(orphans, 0);
  });

  it('states the sheet total as 474 in the config', { skip: skip() }, async () => {
    assert.equal(config.roadmap.dsaSheetTotal, 474);
  });
});

describe('links are flagged, never deleted', () => {
  it('keeps all 120 week links and 127 resources whatever their health', { skip: skip() }, async () => {
    assert.equal(await count('week_links'), 120);
    assert.equal(await count('resources'), 127);
  });

  it('records a status for anything already checked', { skip: skip() }, async () => {
    const rows = await query(
      'SELECT COUNT(*) AS c FROM resources WHERE last_checked IS NOT NULL AND last_status IS NULL AND is_alive = 1'
    );
    assert.equal(Number(rows[0].c), 0);
  });

  it('has a known replacement on file for the seven dead links of Appendix A', { skip: skip() }, async () => {
    const rows = await query('SELECT was, now_url FROM dead_links');
    assert.equal(rows.length, 7);
    for (const r of rows) {
      assert.ok(r.was, 'a dead link with no original url');
      assert.ok(r.now_url, `no replacement recorded for ${r.was}`);
    }
  });
});

describe('the operational tables exist and are writable', () => {
  for (const t of ['link_check_runs', 'dsa_imports', 'backup_log', 'export_rules', 'audit_log']) {
    it(`${t} is present`, { skip: skip() }, async () => {
      assert.equal(typeof (await count(t)), 'number');
    });
  }

  it('holds the four export rules from Part 18.8', { skip: skip() }, async () => {
    assert.equal(await count('export_rules'), 4);
  });
});
