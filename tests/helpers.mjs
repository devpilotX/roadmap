/**
 * helpers.mjs | fixtures and small utilities shared by the test files.
 *
 * Nothing here touches the network. The only tests that touch MySQL are the ones
 * in db.test.mjs and http.test.mjs, and both skip themselves cleanly when the
 * database is not running, so `npm test` is useful on a laptop with nothing
 * started and still meaningful on a machine with everything up.
 */

import { config } from '../lib/config.ts';

export const FIRST_DAY = '2026-08-28';
export const LAST_DAY = '2027-01-24';
export const GATE3 = '2026-12-13';

/** A day_logs row where every one of the six conditions is met. */
export function perfectStudyLog(overrides = {}) {
  return {
    dsa_solved: 4,
    dsa_minutes: 120,
    learn_done: 1,
    learn_minutes: 150,
    build_done: 1,
    build_minutes: 100,
    pushes: 1,
    close_done: 1,
    close_log_line: 'Finished the array section and pushed the parser.',
    close_tomorrow_dsa: 'Two sum, sorted variant',
    close_tomorrow_build: 'Wire the CSV importer to the form',
    money_done: 1,
    money_minutes: 60,
    money_touches: 15,
    night_anki_done: 1,
    night_spoken_done: 1,
    night_spoken_aloud: 1,
    night_tomorrow_done: 1,
    anki_overdue: 0,
    video_minutes: 20,
    ...overrides,
  };
}

/** A calendar_days row for an ordinary study day. */
export function studyDay(overrides = {}) {
  return { cal_date: '2026-08-31', kind: 'study', dsa_target: 4, week_n: 1, ...overrides };
}

/** The minimum context evaluateWarnings needs to return nothing at all. */
export function quietContext(overrides = {}) {
  return {
    today: '2026-09-02',
    nowMinutes: 12 * 60,
    rules: [],
    week: { n: 1, dsa_cumulative: 24, end_date: '2026-09-06' },
    calendarDay: { kind: 'study' },
    dsaSolvedTotal: 24,
    lastPush: { repo: 'itc-reclaim', pushed_at: '2026-09-02 08:00:00', hours_since: 4 },
    gates: [],
    todayLog: { video_minutes: 10, anki_overdue: 0 },
    daysSinceLastTouch: 0,
    nextLeads: [],
    applicationCount: 0,
    failedTwice: [],
    weekDays: [],
    unfinishedLearnWeeks: [],
    snoozed: new Set(),
    ...overrides,
  };
}

/** True when a MySQL server answers on the configured host and port. */
export async function databaseIsUp() {
  try {
    const { ping, closePool } = await import('../lib/db/pool.ts');
    const ok = await ping();
    if (!ok) await closePool();
    return ok;
  } catch {
    return false;
  }
}

export { config };
