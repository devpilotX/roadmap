/**
 * dates.test.mjs | the calendar, which is the part that has to be right.
 *
 * Section 20.6 of the build prompt names the boundaries that matter: the first
 * day, the last day, Gate 3, the block edges, and the seven day retroactive
 * limit. A date bug here would silently move the whole roadmap, so these are
 * the tests that run first.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  BLOCKS,
  TRACKED_BLOCKS,
  addDays,
  blockAllowedAt,
  blockForMinutes,
  daysBetween,
  dateRange,
  humanMinutes,
  isEditableDate,
  isInRoadmap,
  isIsoDate,
  isSunday,
  longDate,
  mondayOf,
  monthKey,
  monthLabel,
  nowInTz,
  roadmapDayNumber,
  shortDate,
  weekdayIndex,
  weekdayName,
  weekForDate,
} from '../lib/dates.ts';
import { config } from '../lib/config.ts';
import { FIRST_DAY, GATE3, LAST_DAY } from './helpers.mjs';

describe('the roadmap window', () => {
  it('runs from 28 August 2026 to 24 January 2027', () => {
    assert.equal(config.roadmap.firstDay, FIRST_DAY);
    assert.equal(config.roadmap.lastDay, LAST_DAY);
  });

  it('is exactly 150 days long, counted inclusively', () => {
    assert.equal(daysBetween(FIRST_DAY, LAST_DAY) + 1, 150);
    assert.equal(config.roadmap.totalDays, 150);
    assert.equal(dateRange(FIRST_DAY, LAST_DAY).length, 150);
  });

  it('numbers the first day 1 and the last day 150', () => {
    assert.equal(roadmapDayNumber(FIRST_DAY), 1);
    assert.equal(roadmapDayNumber(LAST_DAY), 150);
  });

  it('returns null one day either side of the window', () => {
    assert.equal(roadmapDayNumber('2026-08-27'), null);
    assert.equal(roadmapDayNumber('2027-01-25'), null);
    assert.equal(isInRoadmap('2026-08-27'), false);
    assert.equal(isInRoadmap(FIRST_DAY), true);
    assert.equal(isInRoadmap(LAST_DAY), true);
    assert.equal(isInRoadmap('2027-01-25'), false);
  });

  it('puts Gate 3 on 13 December 2026, a Sunday, on day 108', () => {
    assert.equal(config.roadmap.gate3Date, GATE3);
    assert.equal(weekdayName(GATE3), 'Sunday');
    assert.equal(roadmapDayNumber(GATE3), 108);
  });
});

describe('date arithmetic never drifts', () => {
  it('crosses a month end', () => {
    assert.equal(addDays('2026-08-31', 1), '2026-09-01');
    assert.equal(addDays('2026-09-01', -1), '2026-08-31');
  });

  it('crosses a year end, which the roadmap does once', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
    assert.equal(addDays('2027-01-01', -1), '2026-12-31');
  });

  it('handles February in a non leap year', () => {
    assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  });

  it('handles 29 February in a leap year', () => {
    assert.equal(addDays('2024-02-28', 1), '2024-02-29');
    assert.equal(addDays('2024-02-29', 1), '2024-03-01');
  });

  it('is symmetric', () => {
    for (const n of [1, 7, 30, 149, 365]) {
      assert.equal(daysBetween(FIRST_DAY, addDays(FIRST_DAY, n)), n);
      assert.equal(daysBetween(addDays(FIRST_DAY, n), FIRST_DAY), -n);
    }
  });

  it('rejects anything that is not a real date', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '26-08-28', '2026-8-28', 'today', '', null, undefined, 20260828]) {
      assert.equal(isIsoDate(bad), false, `${bad} should not be a valid date`);
      assert.throws(() => addDays(bad, 1), TypeError);
    }
  });

  it('accepts a real date', () => {
    assert.equal(isIsoDate('2026-08-28'), true);
    assert.equal(isIsoDate('2024-02-29'), true);
  });
});

describe('weekdays', () => {
  it('treats Monday as index 0 and Sunday as 6', () => {
    assert.equal(weekdayIndex('2026-08-31'), 0);
    assert.equal(weekdayName('2026-08-31'), 'Monday');
    assert.equal(weekdayIndex('2026-09-06'), 6);
    assert.equal(weekdayName('2026-09-06'), 'Sunday');
    assert.equal(isSunday('2026-09-06'), true);
    assert.equal(isSunday('2026-09-05'), false);
  });

  it('knows the roadmap starts on a Friday', () => {
    assert.equal(weekdayName(FIRST_DAY), 'Friday');
  });

  it('knows the roadmap ends on a Sunday', () => {
    assert.equal(weekdayName(LAST_DAY), 'Sunday');
  });

  it('finds the Monday of any week, and is idempotent on a Monday', () => {
    assert.equal(mondayOf('2026-09-06'), '2026-08-31');
    assert.equal(mondayOf('2026-08-31'), '2026-08-31');
    assert.equal(mondayOf(FIRST_DAY), '2026-08-24');
  });
});

describe('formatting', () => {
  it('writes the long form the Today header uses', () => {
    assert.equal(longDate(FIRST_DAY), 'Friday, 28 August 2026');
    assert.equal(longDate(LAST_DAY), 'Sunday, 24 January 2027');
  });

  it('writes the compact form chips use', () => {
    assert.equal(shortDate(FIRST_DAY), '28 Aug 2026');
    assert.equal(shortDate('2026-12-13'), '13 Dec 2026');
  });

  it('groups by month', () => {
    assert.equal(monthKey(FIRST_DAY), '2026-08');
    assert.equal(monthLabel('2026-08'), 'August 2026');
    assert.equal(monthLabel('2027-01'), 'January 2027');
  });

  it('writes countdowns the way the Today screen does', () => {
    assert.equal(humanMinutes(45), '45 m');
    assert.equal(humanMinutes(60), '1 h');
    assert.equal(humanMinutes(135), '2 h 15 m');
    assert.equal(humanMinutes(0), '0 m');
    assert.equal(humanMinutes(null), '');
  });
});

describe('the six blocks', () => {
  it('has the windows final.md states, and five tracked plus night', () => {
    const byCode = Object.fromEntries(BLOCKS.map((b) => [b.code, b]));
    assert.equal(byCode.DSA.window, '06:30 to 09:00');
    assert.equal(byCode.LEARN.window, '09:30 to 12:30');
    assert.equal(byCode.BUILD.window, '14:00 to 16:00');
    assert.equal(byCode.CLOSE.window, '16:00 to 16:30');
    assert.equal(byCode.BREAK.window, '16:30 to 17:00');
    assert.equal(byCode.MONEY.window, '17:00 to 18:00');
    assert.equal(byCode.NIGHT.window, 'after 21:00');
    assert.equal(byCode.BREAK.tracked, false);
    assert.deepEqual(TRACKED_BLOCKS, ['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT']);
  });

  it('opens a block on its first minute and closes it on its last', () => {
    assert.equal(blockForMinutes(6 * 60 + 30).current.code, 'DSA');
    assert.equal(blockForMinutes(8 * 60 + 59).current.code, 'DSA');
    assert.equal(blockForMinutes(9 * 60).current, null, '09:00 is the gap before LEARN');
    assert.equal(blockForMinutes(9 * 60 + 30).current.code, 'LEARN');
    assert.equal(blockForMinutes(12 * 60 + 29).current.code, 'LEARN');
    assert.equal(blockForMinutes(12 * 60 + 30).current, null);
  });

  it('names the next block and the minutes to it inside a gap', () => {
    const at9 = blockForMinutes(9 * 60);
    assert.equal(at9.next.code, 'LEARN');
    assert.equal(at9.minutesToNext, 30);
  });

  it('rolls over to tomorrow after the night block', () => {
    const late = blockForMinutes(23 * 60 + 59);
    assert.equal(late.current.code, 'NIGHT');
    const after = blockForMinutes(24 * 60 - 1);
    assert.equal(after.next, null);
    assert.equal(after.minutesToTomorrowFirst, 1 + 6 * 60 + 30);
  });

  it('refuses a money hour before 16:30, because it never borrows from study', () => {
    assert.equal(blockAllowedAt('MONEY', 16 * 60 + 29).ok, false);
    assert.equal(blockAllowedAt('MONEY', 16 * 60 + 30).ok, true);
    assert.match(blockAllowedAt('MONEY', 12 * 60).message, /never borrows from study/);
  });

  it('refuses a study block inside 17:00 to 18:00', () => {
    for (const code of ['DSA', 'LEARN', 'BUILD', 'CLOSE']) {
      assert.equal(blockAllowedAt(code, 17 * 60).ok, false, `${code} at 17:00`);
      assert.equal(blockAllowedAt(code, 17 * 60 + 59).ok, false, `${code} at 17:59`);
      assert.equal(blockAllowedAt(code, 18 * 60).ok, true, `${code} at 18:00`);
      assert.equal(blockAllowedAt(code, 16 * 60 + 59).ok, true, `${code} at 16:59`);
    }
  });

  it('lets the night block sit after the money hour', () => {
    assert.equal(blockAllowedAt('NIGHT', 21 * 60 + 30).ok, true);
  });
});

describe('the seven day retroactive limit', () => {
  const today = '2026-09-10';

  it('allows today', () => {
    assert.equal(isEditableDate(today, today).ok, true);
  });

  it('allows exactly seven days back', () => {
    assert.equal(isEditableDate('2026-09-03', today).ok, true);
  });

  it('refuses eight days back', () => {
    const r = isEditableDate('2026-09-02', today);
    assert.equal(r.ok, false);
    assert.match(r.reason, /seven days|7 days/i);
  });

  it('refuses tomorrow, because a day cannot be logged before it happens', () => {
    const r = isEditableDate('2026-09-11', today);
    assert.equal(r.ok, false);
    assert.match(r.reason, /before it happens/);
  });

  it('refuses a nonsense date', () => {
    assert.equal(isEditableDate('2026-02-30', today).ok, false);
  });
});

describe('week lookup', () => {
  const weeks = [
    { n: 1, start_date: '2026-08-31', end_date: '2026-09-06' },
    { n: 2, start_date: '2026-09-07', end_date: '2026-09-13' },
    { n: 21, start_date: '2027-01-18', end_date: '2027-01-24' },
  ];

  it('finds the week a date falls in, at both edges', () => {
    assert.equal(weekForDate('2026-08-31', weeks), 1);
    assert.equal(weekForDate('2026-09-06', weeks), 1);
    assert.equal(weekForDate('2026-09-07', weeks), 2);
    assert.equal(weekForDate('2027-01-24', weeks), 21);
  });

  it('returns null for the three launch days, which belong to no week', () => {
    assert.equal(weekForDate('2026-08-28', weeks), null);
    assert.equal(weekForDate('2026-08-30', weeks), null);
  });
});

describe('the clock is read in Asia/Kolkata', () => {
  it('reads the same instant as a different date either side of midnight IST', () => {
    // 2026-08-27 18:45 UTC is 2026-08-28 00:15 in Asia/Kolkata.
    const ist = nowInTz('Asia/Kolkata', new Date('2026-08-27T18:45:00Z'));
    const utc = nowInTz('UTC', new Date('2026-08-27T18:45:00Z'));
    assert.equal(ist.date, '2026-08-28');
    assert.equal(ist.time, '00:15');
    assert.equal(utc.date, '2026-08-27');
    assert.equal(utc.time, '18:45');
  });

  it('carries the offset of five and a half hours, not five', () => {
    const at = new Date('2026-08-28T00:00:00Z');
    const ist = nowInTz('Asia/Kolkata', at);
    assert.equal(ist.minutes, 5 * 60 + 30);
  });

  it('exposes minutes from midnight consistently with the time string', () => {
    const ist = nowInTz('Asia/Kolkata', new Date('2026-08-28T11:05:00Z'));
    const [h, m] = ist.time.split(':').map(Number);
    assert.equal(ist.minutes, h * 60 + m);
  });
});
