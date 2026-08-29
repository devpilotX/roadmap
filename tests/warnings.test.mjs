/**
 * warnings.test.mjs | W1 to W10 from Part 18.5.
 *
 * evaluateWarnings is pure, so every rule can be pinned to a fixture. These are
 * the tests that stop a warning from quietly becoming dismissible.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { WARNING_CODES, evaluateWarnings, notifiableGateCountdowns } from '../lib/warnings.ts';
import { quietContext } from './helpers.mjs';

const codes = (ctx) => evaluateWarnings(ctx).map((w) => w.code);
const find = (ctx, code) => evaluateWarnings(ctx).find((w) => w.code === code);

describe('the warning set', () => {
  it('is exactly W1 to W10', () => {
    assert.deepEqual(WARNING_CODES, ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10']);
  });

  it('says nothing when there is nothing to say', () => {
    assert.deepEqual(codes(quietContext()), []);
  });

  it('sorts red before orange', () => {
    const list = evaluateWarnings(
      quietContext({
        dsaSolvedTotal: 0, // W1, red
        todayLog: { video_minutes: 90, anki_overdue: 0 }, // W4, orange
      })
    );
    const levels = list.map((w) => w.level);
    assert.deepEqual([...levels].sort((a, b) => (a === 'red' ? -1 : 1)), levels);
    assert.equal(levels[0], 'red');
  });

  it('gives every warning a title and a message', () => {
    for (const w of evaluateWarnings(quietContext({ dsaSolvedTotal: 0, daysSinceLastTouch: 9 }))) {
      assert.ok(w.title, `${w.code} has no title`);
      assert.ok(w.message, `${w.code} has no message`);
    }
  });
});

describe('W1, DSA behind', () => {
  it('stays quiet at exactly ten behind', () => {
    assert.equal(codes(quietContext({ dsaSolvedTotal: 14 })).includes('W1'), false);
  });

  it('fires at eleven behind', () => {
    const w = find(quietContext({ dsaSolvedTotal: 13 }), 'W1');
    assert.ok(w);
    assert.equal(w.deficit, 11);
    assert.equal(w.level, 'red');
  });

  it('states the per day pace needed to recover', () => {
    const w = find(
      quietContext({ today: '2026-09-02', dsaSolvedTotal: 0, week: { n: 1, dsa_cumulative: 24, end_date: '2026-09-06' } }),
      'W1'
    );
    assert.equal(w.deficit, 24);
    assert.equal(w.days_left, 4);
    assert.equal(w.per_day_to_recover, 6);
    assert.match(w.message, /24 problems behind/);
  });

  it('is silent outside the roadmap, where there is no week', () => {
    assert.equal(codes(quietContext({ week: null, dsaSolvedTotal: 0 })).includes('W1'), false);
  });
});

describe('W2, no GitHub push', () => {
  it('stays quiet at 47 hours', () => {
    assert.equal(codes(quietContext({ lastPush: { repo: 'r', pushed_at: 'x', hours_since: 47 } })).includes('W2'), false);
  });

  it('fires at 48 hours and does not cancel the streak yet', () => {
    const w = find(quietContext({ lastPush: { repo: 'itc-reclaim', pushed_at: '2026-08-31 09:00:00', hours_since: 48 } }), 'W2');
    assert.ok(w);
    assert.equal(w.streak_cancelled, false);
    assert.equal(w.hours_since, 48);
  });

  it('cancels the streak at 72 hours and says so plainly', () => {
    const w = find(quietContext({ lastPush: { repo: 'itc-reclaim', pushed_at: '2026-08-30 09:00:00', hours_since: 72 } }), 'W2');
    assert.equal(w.streak_cancelled, true);
    assert.match(w.message, /cancelled at 72 hours/);
  });

  it('fires when there is no push on record at all', () => {
    const w = find(quietContext({ lastPush: null }), 'W2');
    assert.ok(w);
    assert.equal(w.hours_since, null);
    assert.match(w.message, /no push on record/);
  });

  it('is silent on a rest Sunday', () => {
    const ctx = quietContext({ lastPush: null, calendarDay: { kind: 'sunday_rest' } });
    assert.equal(codes(ctx).includes('W2'), false);
  });
});

describe('W3, a gate is close and not started', () => {
  const gate = { no: 1, gate_date: '2026-09-27', condition_text: 'Two sites live.', started: 0, passed: 0 };

  it('fires inside fourteen days', () => {
    const w = find(quietContext({ today: '2026-09-20', gates: [gate] }), 'W3');
    assert.ok(w);
    assert.equal(w.days_remaining, 7);
    assert.match(w.message, /Two sites live/);
  });

  it('stays quiet at fifteen days', () => {
    assert.equal(codes(quietContext({ today: '2026-09-12', gates: [gate] })).includes('W3'), false);
  });

  it('fires on the day itself', () => {
    const w = find(quietContext({ today: '2026-09-27', gates: [gate] }), 'W3');
    assert.equal(w.days_remaining, 0);
    assert.match(w.message, /today/);
  });

  it('is silent once the gate is started or passed', () => {
    assert.equal(codes(quietContext({ today: '2026-09-20', gates: [{ ...gate, started: 1 }] })).includes('W3'), false);
    assert.equal(codes(quietContext({ today: '2026-09-20', gates: [{ ...gate, passed: 1 }] })).includes('W3'), false);
  });
});

describe('W4, the video cap', () => {
  it('stays quiet at exactly thirty minutes', () => {
    assert.equal(codes(quietContext({ todayLog: { video_minutes: 30 } })).includes('W4'), false);
  });

  it('fires at thirty one and says how far over', () => {
    const w = find(quietContext({ todayLog: { video_minutes: 31 } }), 'W4');
    assert.equal(w.over_by, 1);
    assert.equal(w.level, 'orange');
    assert.equal(w.can_snooze, true);
  });

  it('can be snoozed, because it is orange', () => {
    const ctx = quietContext({ todayLog: { video_minutes: 90 }, snoozed: new Set(['W4']) });
    assert.equal(codes(ctx).includes('W4'), false);
  });
});

describe('W5, Anki overdue', () => {
  it('is silent before 22:00 however many cards are due', () => {
    assert.equal(codes(quietContext({ nowMinutes: 21 * 60 + 59, todayLog: { anki_overdue: 40 } })).includes('W5'), false);
  });

  it('fires from 22:00', () => {
    const w = find(quietContext({ nowMinutes: 22 * 60, todayLog: { anki_overdue: 40 } }), 'W5');
    assert.equal(w.overdue, 40);
  });

  it('is silent at zero overdue', () => {
    assert.equal(codes(quietContext({ nowMinutes: 23 * 60, todayLog: { anki_overdue: 0 } })).includes('W5'), false);
  });
});

describe('W6, no money touch', () => {
  it('stays quiet at two days', () => {
    assert.equal(codes(quietContext({ daysSinceLastTouch: 2 })).includes('W6'), false);
  });

  it('fires at three days', () => {
    const w = find(quietContext({ daysSinceLastTouch: 3 }), 'W6');
    assert.equal(w.days_since, 3);
  });

  it('fires when there has never been a touch, and says so', () => {
    const w = find(quietContext({ daysSinceLastTouch: -1 }), 'W6');
    assert.equal(w.days_since, null);
    assert.match(w.message, /has ever been logged/);
  });

  it('names the next leads when there are some', () => {
    const w = find(quietContext({ daysSinceLastTouch: 5, nextLeads: [{ name: 'Acme' }, { name: 'Borel' }] }), 'W6');
    assert.deepEqual(w.next_leads, ['Acme', 'Borel']);
    assert.match(w.message, /Acme, Borel/);
  });

  it('points at Part 17.13 when the list is empty', () => {
    const w = find(quietContext({ daysSinceLastTouch: 5, nextLeads: [] }), 'W6');
    assert.match(w.message, /30 rows/);
  });
});

describe('W7, applications have not started', () => {
  it('is silent before 13 December 2026', () => {
    assert.equal(codes(quietContext({ today: '2026-12-12', applicationCount: 0 })).includes('W7'), false);
  });

  it('fires on 13 December 2026 with zero applications', () => {
    const w = find(quietContext({ today: '2026-12-13', applicationCount: 0 }), 'W7');
    assert.ok(w);
    assert.match(w.message, /Gate 3/);
  });

  it('is silent once even one application exists', () => {
    assert.equal(codes(quietContext({ today: '2026-12-20', applicationCount: 1 })).includes('W7'), false);
  });
});

describe('W8, failed twice', () => {
  it('is silent with an empty list', () => {
    assert.equal(codes(quietContext({ failedTwice: [] })).includes('W8'), false);
  });

  it('names the problems and counts them', () => {
    const w = find(quietContext({ failedTwice: [{ name: 'Median of two sorted arrays' }, { name: 'LRU cache' }] }), 'W8');
    assert.equal(w.count, 2);
    assert.match(w.message, /Median of two sorted arrays, LRU cache/);
    assert.match(w.message, /solved cold/);
  });

  it('truncates a long list rather than printing all of it', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ name: `P${i}` }));
    const w = find(quietContext({ failedTwice: many }), 'W8');
    assert.equal(w.count, 9);
    assert.match(w.message, /and more/);
  });
});

describe('W9, two red days in one week', () => {
  it('is silent on one red day', () => {
    const ctx = quietContext({ weekDays: [{ cal_date: '2026-09-01', colour: 'red' }] });
    assert.equal(codes(ctx).includes('W9'), false);
  });

  it('fires on two, and applies the Wednesday cut point', () => {
    // 2026-09-02 is a Wednesday.
    const w = find(
      quietContext({
        today: '2026-09-02',
        weekDays: [
          { cal_date: '2026-08-31', colour: 'red' },
          { cal_date: '2026-09-01', colour: 'red' },
        ],
      }),
      'W9'
    );
    assert.ok(w);
    assert.match(w.message, /CUT POINT applies now/);
  });

  it('says the cut point has passed later in the week', () => {
    // 2026-09-04 is a Friday.
    const w = find(
      quietContext({
        today: '2026-09-04',
        weekDays: [
          { cal_date: '2026-08-31', colour: 'red' },
          { cal_date: '2026-09-01', colour: 'red' },
        ],
      }),
      'W9'
    );
    assert.match(w.message, /has passed/);
  });

  it('ignores red days that have not happened yet', () => {
    const ctx = quietContext({
      today: '2026-09-01',
      weekDays: [
        { cal_date: '2026-09-01', colour: 'red' },
        { cal_date: '2026-09-04', colour: 'red' },
      ],
    });
    assert.equal(codes(ctx).includes('W9'), false);
  });
});

describe('W10, a week ended with LEARN unfinished', () => {
  it('fires once per week, and names the count', () => {
    const list = evaluateWarnings(
      quietContext({ unfinishedLearnWeeks: [{ week_n: 3, missing: 2 }, { week_n: 5, missing: 1 }] })
    ).filter((w) => w.code === 'W10');
    assert.equal(list.length, 2);
    assert.match(list[0].message, /Week 3 ended with 2 LEARN rows/);
    assert.match(list[1].message, /Week 5 ended with 1 LEARN row/);
    assert.match(list[0].message, /never into the next week/);
  });
});

describe('red cannot be dismissed', () => {
  it('marks every red warning as not snoozable', () => {
    const list = evaluateWarnings(
      quietContext({
        dsaSolvedTotal: 0,
        lastPush: null,
        today: '2026-12-13',
        applicationCount: 0,
        failedTwice: [{ name: 'X' }],
      })
    );
    for (const w of list.filter((x) => x.level === 'red')) {
      assert.equal(w.can_snooze, false, `${w.code} should not be snoozable`);
    }
    assert.ok(list.some((w) => w.level === 'red'));
  });

  it('ignores a snooze on a red warning', () => {
    const ctx = quietContext({ dsaSolvedTotal: 0, snoozed: new Set(['W1']) });
    assert.equal(codes(ctx).includes('W1'), true);
  });
});

describe('gate notifications', () => {
  const gates = [
    { no: 1, gate_date: '2026-09-27', condition_text: 'Two sites live.', passed: 0 },
    { no: 2, gate_date: '2026-11-01', condition_text: 'Project one live.', passed: 0 },
  ];

  it('fires at fourteen, seven and one day out, and nowhere else', () => {
    assert.equal(notifiableGateCountdowns(gates, '2026-09-13').length, 1);
    assert.equal(notifiableGateCountdowns(gates, '2026-09-20').length, 1);
    assert.equal(notifiableGateCountdowns(gates, '2026-09-26').length, 1);
    assert.equal(notifiableGateCountdowns(gates, '2026-09-25').length, 0);
    assert.equal(notifiableGateCountdowns(gates, '2026-09-27').length, 0);
  });

  it('says nothing about a gate already passed', () => {
    assert.equal(notifiableGateCountdowns([{ ...gates[0], passed: 1 }], '2026-09-20').length, 0);
  });

  it('carries the condition as the notification body', () => {
    const [n] = notifiableGateCountdowns(gates, '2026-09-20');
    assert.equal(n.body, 'Two sites live.');
    assert.match(n.title, /Gate 1 in 7 days/);
  });
});
