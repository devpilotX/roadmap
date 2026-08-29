/**
 * streaks.test.mjs | Part 18.2, the six conditions and the colour they produce.
 *
 * The rule that gets tested hardest is the one that is easiest to soften by
 * accident: six of six is green, and five of six is not.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  COLOURS,
  THRESHOLDS,
  colourTally,
  conditionsFor,
  currentStreak,
  dayColour,
  longestStreak,
} from '../lib/streaks.ts';
import { perfectStudyLog, studyDay } from './helpers.mjs';

describe('the six conditions of a study day', () => {
  it('is exactly six, in the order final.md states them', () => {
    const codes = conditionsFor(studyDay(), perfectStudyLog()).map((c) => c.code);
    assert.deepEqual(codes, ['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT']);
  });

  it('holds the thresholds Part 18.2 names', () => {
    assert.equal(THRESHOLDS.learnMinutes, 150);
    assert.equal(THRESHOLDS.buildMinutes, 100);
    assert.equal(THRESHOLDS.buildPushes, 1);
    assert.equal(THRESHOLDS.videoMinutesCap, 30);
  });

  it('meets all six on a full day', () => {
    const c = conditionsFor(studyDay(), perfectStudyLog());
    assert.equal(c.filter((x) => x.met).length, 6);
  });

  it('fails DSA one problem short', () => {
    const c = conditionsFor(studyDay({ dsa_target: 4 }), perfectStudyLog({ dsa_solved: 3 }));
    assert.equal(c.find((x) => x.code === 'DSA').met, false);
  });

  it('fails LEARN when it is ticked but the minutes are not there', () => {
    const c = conditionsFor(studyDay(), perfectStudyLog({ learn_minutes: 149 }));
    assert.equal(c.find((x) => x.code === 'LEARN').met, false);
  });

  it('fails BUILD without the push, however many minutes were spent', () => {
    const c = conditionsFor(studyDay(), perfectStudyLog({ pushes: 0, build_minutes: 400 }));
    assert.equal(c.find((x) => x.code === 'BUILD').met, false);
  });

  it('fails CLOSE when any one of the three fields is blank', () => {
    for (const field of ['close_log_line', 'close_tomorrow_dsa', 'close_tomorrow_build']) {
      const c = conditionsFor(studyDay(), perfectStudyLog({ [field]: '   ' }));
      assert.equal(c.find((x) => x.code === 'CLOSE').met, false, `${field} blank`);
    }
  });

  it('fails MONEY when the hour is ticked with zero touches', () => {
    const c = conditionsFor(studyDay(), perfectStudyLog({ money_touches: 0 }));
    assert.equal(c.find((x) => x.code === 'MONEY').met, false);
  });

  it('fails NIGHT unless all three parts are done', () => {
    for (const field of ['night_anki_done', 'night_spoken_done', 'night_tomorrow_done']) {
      const c = conditionsFor(studyDay(), perfectStudyLog({ [field]: 0 }));
      assert.equal(c.find((x) => x.code === 'NIGHT').met, false, `${field} missing`);
    }
  });

  it('treats an empty log as nothing met, not as an error', () => {
    const c = conditionsFor(studyDay(), {});
    assert.equal(c.length, 6);
    assert.equal(c.filter((x) => x.met).length, 0);
  });

  it('never reports a DSA target of zero as met on a study day', () => {
    const c = conditionsFor(studyDay({ dsa_target: 0 }), perfectStudyLog({ dsa_solved: 0 }));
    assert.equal(c.find((x) => x.code === 'DSA').met, false);
  });
});

describe('day colour', () => {
  it('only ever returns one of the four colours', () => {
    for (const kind of ['study', 'launch', 'sunday_working', 'sunday_gate', 'sunday_rest']) {
      const { colour } = dayColour(studyDay({ kind }), perfectStudyLog(), {
        sundayCompleted: 1, sundayHours: 4, sundayRequiredHours: 4,
      });
      assert.ok(COLOURS.includes(colour), `${kind} gave ${colour}`);
    }
  });

  it('is green on six of six', () => {
    assert.equal(dayColour(studyDay(), perfectStudyLog()).colour, 'green');
  });

  it('is amber on five of six, which is not a good day', () => {
    const r = dayColour(studyDay(), perfectStudyLog({ money_touches: 0 }));
    assert.equal(r.met, 5);
    assert.equal(r.colour, 'amber');
  });

  it('is amber on four of six', () => {
    const r = dayColour(studyDay(), perfectStudyLog({ money_touches: 0, night_anki_done: 0 }));
    assert.equal(r.met, 4);
    assert.equal(r.colour, 'amber');
  });

  it('is red on three of six', () => {
    const r = dayColour(
      studyDay(),
      perfectStudyLog({ money_touches: 0, night_anki_done: 0, close_done: 0 })
    );
    assert.equal(r.met, 3);
    assert.equal(r.colour, 'red');
  });

  it('is red on an unlogged day', () => {
    assert.equal(dayColour(studyDay(), {}).colour, 'red');
  });

  it('is always neutral on a rest Sunday, whatever the log says', () => {
    const r = dayColour(studyDay({ kind: 'sunday_rest' }), perfectStudyLog());
    assert.equal(r.colour, 'neutral');
    assert.equal(r.total, 0);
    assert.deepEqual(r.conditions, []);
  });

  it('judges a working Sunday on completion and hours', () => {
    const done = dayColour(studyDay({ kind: 'sunday_working' }), {}, {
      sundayCompleted: 1, sundayHours: 4, sundayRequiredHours: 4,
    });
    assert.equal(done.colour, 'green');
    // A Sunday has two conditions, so "more than half" cannot be satisfied by
    // one of them. Marked complete with the hours missing is red, not amber,
    // which is the honest answer rather than the flattering one.
    const halfway = dayColour(studyDay({ kind: 'sunday_working' }), {}, {
      sundayCompleted: 1, sundayHours: 1, sundayRequiredHours: 4,
    });
    assert.equal(halfway.met, 1);
    assert.equal(halfway.total, 2);
    assert.equal(halfway.colour, 'red');
    const nothing = dayColour(studyDay({ kind: 'sunday_working' }), {}, {
      sundayCompleted: 0, sundayHours: 0, sundayRequiredHours: 4,
    });
    assert.equal(nothing.colour, 'red');
  });

  it('judges a launch day on its own conditions, not on the six', () => {
    const c = conditionsFor(studyDay({ kind: 'launch', dsa_target: 2 }), perfectStudyLog({ dsa_solved: 2 }));
    assert.deepEqual(c.map((x) => x.code), ['DSA', 'LEARN', 'BUILD', 'MONEY']);
    assert.equal(dayColour(studyDay({ kind: 'launch', dsa_target: 2 }), perfectStudyLog({ dsa_solved: 2 })).colour, 'green');
  });
});

describe('the streak', () => {
  const mk = (entries) => new Map(entries.map(([date, colour]) => [date, { kind: 'study', colour }]));

  it('counts green days backwards from today', () => {
    const byDate = mk([
      ['2026-09-01', 'green'],
      ['2026-09-02', 'green'],
      ['2026-09-03', 'green'],
    ]);
    assert.equal(currentStreak('2026-09-03', byDate, '2026-08-28'), 3);
  });

  it('is broken by a red day', () => {
    const byDate = mk([
      ['2026-09-01', 'green'],
      ['2026-09-02', 'red'],
      ['2026-09-03', 'green'],
    ]);
    assert.equal(currentStreak('2026-09-03', byDate, '2026-08-28'), 1);
  });

  it('is held but not extended by amber', () => {
    const byDate = mk([
      ['2026-09-01', 'green'],
      ['2026-09-02', 'amber'],
      ['2026-09-03', 'green'],
    ]);
    assert.equal(currentStreak('2026-09-03', byDate, '2026-08-28'), 2);
  });

  it('is neither broken nor extended by a rest Sunday', () => {
    const byDate = mk([
      ['2026-09-04', 'green'],
      ['2026-09-05', 'green'],
      ['2026-09-06', 'neutral'],
    ]);
    assert.equal(currentStreak('2026-09-06', byDate, '2026-08-28'), 2);
  });

  it('stops at a day that was never logged', () => {
    const byDate = mk([['2026-09-01', 'green'], ['2026-09-03', 'green']]);
    assert.equal(currentStreak('2026-09-03', byDate, '2026-08-28'), 1);
  });

  it('never runs before the first day of the roadmap', () => {
    const byDate = mk([['2026-08-28', 'green'], ['2026-08-27', 'green']]);
    assert.equal(currentStreak('2026-08-28', byDate, '2026-08-28'), 1);
  });

  it('is zero when today is red', () => {
    assert.equal(currentStreak('2026-09-03', mk([['2026-09-03', 'red']]), '2026-08-28'), 0);
  });
});

describe('the longest streak and the tally', () => {
  const days = [
    { cal_date: '2026-08-31', colour: 'green' },
    { cal_date: '2026-09-01', colour: 'green' },
    { cal_date: '2026-09-02', colour: 'red' },
    { cal_date: '2026-09-03', colour: 'green' },
    { cal_date: '2026-09-04', colour: 'amber' },
    { cal_date: '2026-09-05', colour: 'green' },
    { cal_date: '2026-09-06', colour: 'neutral' },
    { cal_date: '2026-09-07', colour: 'green' },
  ];

  it('finds the longest run, with amber holding it open', () => {
    const r = longestStreak(days);
    assert.equal(r.length, 3);
    assert.equal(r.from, '2026-09-03');
    assert.equal(r.to, '2026-09-07');
  });

  it('returns zero on an empty set', () => {
    assert.deepEqual(longestStreak([]), { length: 0, from: null, to: null });
  });

  it('tallies every colour, and the total matches the input', () => {
    const t = colourTally(days);
    assert.deepEqual(t, { green: 5, amber: 1, red: 1, neutral: 1 });
    assert.equal(Object.values(t).reduce((a, b) => a + b, 0), days.length);
  });
});
