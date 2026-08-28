/**
 * start-date.test.mjs | the day the roadmap starts for this person.
 *
 * The 150 day window is fixed by final.md: Appendix C lists every date, the four
 * gates sit on named dates, and Appendix E verifies the counts. It cannot move.
 *
 * What can move is the day scoring begins. A day inside the window but before
 * that date is neutral: it does not break a streak, it is not red, and the time
 * based warnings stay quiet about it. These tests pin that, and pin the part that
 * matters just as much: that nothing changes for someone who has not moved it.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { conditionsFor, currentStreak, dayColour, longestStreak } from '../src/lib/streaks.mjs';
import { evaluateWarnings } from '../src/lib/warnings.mjs';
import { config } from '../src/config.mjs';
import { perfectStudyLog, quietContext, studyDay } from './helpers.mjs';

describe('the window itself does not move', () => {
  it('still runs 28 August 2026 to 24 January 2027', () => {
    assert.equal(config.roadmap.firstDay, '2026-08-28');
    assert.equal(config.roadmap.lastDay, '2027-01-24');
    assert.equal(config.roadmap.totalDays, 150);
  });

  it('still puts Gate 3 on 13 December 2026', () => {
    assert.equal(config.roadmap.gate3Date, '2026-12-13');
  });
});

describe('a day before the start date', () => {
  it('has no conditions to judge', () => {
    assert.deepEqual(conditionsFor(studyDay(), {}, { beforeStart: true }), []);
  });

  it('is neutral, not red', () => {
    const r = dayColour(studyDay(), {}, { beforeStart: true });
    assert.equal(r.colour, 'neutral');
    assert.equal(r.total, 0);
    assert.equal(r.before_start, true);
  });

  it('is neutral even on a day that would otherwise be green', () => {
    const r = dayColour(studyDay(), perfectStudyLog(), { beforeStart: true });
    assert.equal(r.colour, 'neutral');
  });

  it('overrides every other kind of day', () => {
    for (const kind of ['study', 'launch', 'sunday_working', 'sunday_gate', 'sunday_rest']) {
      const r = dayColour(studyDay({ kind }), perfectStudyLog(), {
        beforeStart: true,
        sundayCompleted: 1,
        sundayHours: 4,
        sundayRequiredHours: 4,
      });
      assert.equal(r.colour, 'neutral', `${kind} should be neutral before the start`);
    }
  });
});

describe('nothing changes when the start date has not been moved', () => {
  it('scores a study day exactly as before', () => {
    assert.equal(dayColour(studyDay(), perfectStudyLog()).colour, 'green');
    assert.equal(dayColour(studyDay(), perfectStudyLog({ money_touches: 0 })).colour, 'amber');
    assert.equal(dayColour(studyDay(), {}).colour, 'red');
  });

  it('still returns the six conditions', () => {
    assert.equal(conditionsFor(studyDay(), perfectStudyLog()).length, 6);
    assert.equal(conditionsFor(studyDay(), perfectStudyLog(), { beforeStart: false }).length, 6);
  });
});

describe('the streak is counted from the start date', () => {
  const mk = (entries) => new Map(entries.map(([date, colour]) => [date, { kind: 'study', colour }]));

  it('is not broken by neutral days before the start', () => {
    // Started on the 31st. The 28th to the 30th are neutral, not red.
    const byDate = mk([
      ['2026-08-28', 'neutral'],
      ['2026-08-29', 'neutral'],
      ['2026-08-30', 'neutral'],
      ['2026-08-31', 'green'],
      ['2026-09-01', 'green'],
    ]);
    assert.equal(currentStreak('2026-09-01', byDate, '2026-08-31'), 2);
  });

  it('would have been broken if those days had been red', () => {
    const byDate = mk([
      ['2026-08-30', 'red'],
      ['2026-08-31', 'green'],
      ['2026-09-01', 'green'],
    ]);
    assert.equal(currentStreak('2026-09-01', byDate, '2026-08-28'), 2, 'the run still stops at the red day');
  });

  it('does not walk back past the start date', () => {
    const byDate = mk([
      ['2026-08-28', 'green'],
      ['2026-08-29', 'green'],
    ]);
    // Counting from a start of the 29th must not reach the 28th.
    assert.equal(currentStreak('2026-08-29', byDate, '2026-08-29'), 1);
  });

  it('leaves the longest run unaffected by neutral days', () => {
    const days = [
      { cal_date: '2026-08-28', colour: 'neutral' },
      { cal_date: '2026-08-29', colour: 'neutral' },
      { cal_date: '2026-08-30', colour: 'green' },
      { cal_date: '2026-08-31', colour: 'green' },
    ];
    assert.equal(longestStreak(days).length, 2);
  });
});

describe('the time based warnings stay quiet before the start', () => {
  const codes = (ctx) => evaluateWarnings(ctx).map((w) => w.code);

  it('says nothing about DSA being behind', () => {
    const ctx = quietContext({ notStarted: true, dsaSolvedTotal: 0 });
    assert.equal(codes(ctx).includes('W1'), false);
  });

  it('says nothing about a missing push', () => {
    const ctx = quietContext({ notStarted: true, lastPush: null });
    assert.equal(codes(ctx).includes('W2'), false);
  });

  it('says nothing about a missing money touch', () => {
    const ctx = quietContext({ notStarted: true, daysSinceLastTouch: -1 });
    assert.equal(codes(ctx).includes('W6'), false);
  });

  it('ignores red days that sit before the start', () => {
    const ctx = quietContext({
      today: '2026-09-02',
      weekDays: [
        { cal_date: '2026-08-31', colour: 'red', before_start: true },
        { cal_date: '2026-09-01', colour: 'red', before_start: true },
      ],
    });
    assert.equal(codes(ctx).includes('W9'), false);
  });

  it('still counts red days from the start onwards', () => {
    const ctx = quietContext({
      today: '2026-09-02',
      weekDays: [
        { cal_date: '2026-08-31', colour: 'red', before_start: false },
        { cal_date: '2026-09-01', colour: 'red', before_start: false },
      ],
    });
    assert.equal(codes(ctx).includes('W9'), true);
  });
});

describe('the warnings that are true whenever they happened still fire', () => {
  const codes = (ctx) => evaluateWarnings(ctx).map((w) => w.code);

  it('still reports video over the cap', () => {
    const ctx = quietContext({ notStarted: true, todayLog: { video_minutes: 90 } });
    assert.equal(codes(ctx).includes('W4'), true);
  });

  it('still reports Anki overdue after 22:00', () => {
    const ctx = quietContext({ notStarted: true, nowMinutes: 23 * 60, todayLog: { anki_overdue: 12 } });
    assert.equal(codes(ctx).includes('W5'), true);
  });

  it('still reports a problem that beat you twice', () => {
    const ctx = quietContext({ notStarted: true, failedTwice: [{ name: 'LRU cache' }] });
    assert.equal(codes(ctx).includes('W8'), true);
  });

  it('still reports a gate that is close and not started', () => {
    const ctx = quietContext({
      notStarted: true,
      today: '2026-09-20',
      gates: [{ no: 1, gate_date: '2026-09-27', condition_text: 'Two sites live.', started: 0, passed: 0 }],
    });
    assert.equal(codes(ctx).includes('W3'), true);
  });
});

describe('a started roadmap warns exactly as it did before', () => {
  it('fires everything it used to once notStarted is false', () => {
    const ctx = quietContext({ notStarted: false, dsaSolvedTotal: 0, lastPush: null, daysSinceLastTouch: -1 });
    const list = evaluateWarnings(ctx).map((w) => w.code);
    assert.ok(list.includes('W1'), 'W1 should fire');
    assert.ok(list.includes('W2'), 'W2 should fire');
    assert.ok(list.includes('W6'), 'W6 should fire');
  });

  it('treats a missing notStarted flag as started', () => {
    const ctx = quietContext({ dsaSolvedTotal: 0 });
    delete ctx.notStarted;
    assert.ok(evaluateWarnings(ctx).map((w) => w.code).includes('W1'));
  });
});
