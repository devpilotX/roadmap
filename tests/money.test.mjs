/**
 * money.test.mjs | Part 17 arithmetic.
 *
 * The rule being defended is the one stated at the top of src/lib/money.mjs:
 * money received is counted from cash events with dates, not from a deal that
 * someone ticked as paid. A deal marked paid with no dates is not money.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { sumBetween, sumByMonth, totalReceived, touchTargetFromTask } from '../lib/money.ts';
import { config } from '../lib/config.ts';

const events = [
  { on: '2026-08-29', amount: 3000, kind: 'advance', label: 'Acme advance, S1' },
  { on: '2026-09-05', amount: 3000, kind: 'balance', label: 'Acme balance, S1' },
  { on: '2026-09-30', amount: 8000, kind: 'advance', label: 'Borel advance, S3' },
  { on: '2026-10-01', amount: 1500, kind: 'care_plan', label: 'Acme care plan' },
  { on: '2026-11-01', amount: 1500, kind: 'care_plan', label: 'Acme care plan' },
];

describe('the target', () => {
  it('is ninety thousand rupees by 24 January 2027', () => {
    assert.equal(config.roadmap.moneyTargetRupees, 90000);
  });
});

describe('summing a window', () => {
  it('includes both edges of the range', () => {
    assert.equal(sumBetween(events, '2026-08-29', '2026-08-29'), 3000);
    assert.equal(sumBetween(events, '2026-09-05', '2026-09-30'), 11000);
  });

  it('excludes what falls outside it', () => {
    assert.equal(sumBetween(events, '2026-09-06', '2026-09-29'), 0);
  });

  it('is zero on an empty list', () => {
    assert.equal(sumBetween([], '2026-08-01', '2027-01-24'), 0);
  });

  it('never double counts', () => {
    const whole = sumBetween(events, '2026-08-01', '2027-01-31');
    const halves =
      sumBetween(events, '2026-08-01', '2026-09-30') + sumBetween(events, '2026-10-01', '2027-01-31');
    assert.equal(whole, halves);
    assert.equal(whole, 17000);
  });
});

describe('grouping by month', () => {
  it('keys on YYYY-MM and totals each month', () => {
    const m = sumByMonth(events);
    assert.equal(m.get('2026-08'), 3000);
    assert.equal(m.get('2026-09'), 11000);
    assert.equal(m.get('2026-10'), 1500);
    assert.equal(m.get('2026-11'), 1500);
    assert.equal(m.has('2026-12'), false);
  });

  it('sums to the same total as the whole window', () => {
    const total = [...sumByMonth(events).values()].reduce((a, b) => a + b, 0);
    assert.equal(total, totalReceived(events));
  });
});

describe('total received', () => {
  it('counts everything with no cut off', () => {
    assert.equal(totalReceived(events), 17000);
  });

  it('respects a cut off date, inclusively', () => {
    assert.equal(totalReceived(events, '2026-09-05'), 6000);
    assert.equal(totalReceived(events, '2026-08-28'), 0);
  });
});

describe('the daily touch target is read from the roadmap, not hardcoded', () => {
  it('reads the number final.md actually writes', () => {
    assert.equal(touchTargetFromTask('15 first touches'), 15);
    assert.equal(touchTargetFromTask('10 first touches, then 5 follow ups'), 10);
    assert.equal(touchTargetFromTask('Money hour: 20 first touches'), 20);
  });

  it('returns something sensible for a day that is delivery only', () => {
    const v = touchTargetFromTask('Delivery only');
    assert.equal(typeof v, 'number');
    assert.equal(v >= 0, true);
  });

  it('does not throw on empty or missing text', () => {
    assert.equal(typeof touchTargetFromTask(''), 'number');
    assert.equal(typeof touchTargetFromTask(null), 'number');
    assert.equal(typeof touchTargetFromTask(undefined), 'number');
  });
});
