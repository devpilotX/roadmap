/**
 * dates.ts
 *
 * Every calendar date in this application is a plain YYYY-MM-DD string. There is
 * no JavaScript Date object holding a user facing date anywhere, because a Date
 * carries a timezone and a calendar date does not.
 *
 * "Today" is always computed here, server side, in Asia/Kolkata. The client
 * clock is never trusted for anything that writes.
 *
 * India has no daylight saving. That is not relied upon: the wall clock is read
 * through Intl with an explicit timeZone, so a rule change would be picked up by
 * the runtime's own timezone database rather than silently breaking arithmetic.
 */

import { config } from './config';

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type BlockCode = 'DSA' | 'LEARN' | 'BUILD' | 'CLOSE' | 'BREAK' | 'MONEY' | 'NIGHT';

export interface Block {
  code: BlockCode;
  label: string;
  /** Minutes from midnight. */
  start: number;
  /** Minutes from midnight, exclusive. */
  end: number;
  window: string;
  tracked: boolean;
}

/**
 * The six tracked blocks plus the break, exactly as final.md states them.
 * Minutes are from midnight. end is exclusive.
 */
export const BLOCKS: readonly Block[] = [
  { code: 'DSA', label: 'DSA', start: 6 * 60 + 30, end: 9 * 60, window: '06:30 to 09:00', tracked: true },
  { code: 'LEARN', label: 'Learn', start: 9 * 60 + 30, end: 12 * 60 + 30, window: '09:30 to 12:30', tracked: true },
  { code: 'BUILD', label: 'Build', start: 14 * 60, end: 16 * 60, window: '14:00 to 16:00', tracked: true },
  { code: 'CLOSE', label: 'Close', start: 16 * 60, end: 16 * 60 + 30, window: '16:00 to 16:30', tracked: true },
  { code: 'BREAK', label: 'Break', start: 16 * 60 + 30, end: 17 * 60, window: '16:30 to 17:00', tracked: false },
  { code: 'MONEY', label: 'Money hour', start: 17 * 60, end: 18 * 60, window: '17:00 to 18:00', tracked: true },
  { code: 'NIGHT', label: 'Night recall', start: 21 * 60, end: 24 * 60, window: 'after 21:00', tracked: true },
];

export const TRACKED_BLOCKS = BLOCKS.filter((b) => b.tracked).map((b) => b.code);

/** Reminder times from build prompt section 16, in minutes from midnight. */
export const REMINDERS = [
  { code: 'DSA', at: 6 * 60 + 30 },
  { code: 'LEARN', at: 9 * 60 + 30 },
  { code: 'BUILD', at: 14 * 60 },
  { code: 'CLOSE', at: 16 * 60 },
  { code: 'MONEY', at: 17 * 60 },
  { code: 'NIGHT', at: 21 * 60 + 30 },
] as const;

/* ------------------------------------------------------------ wall clock */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface WallClock {
  date: string;
  hour: number;
  minute: number;
  second: number;
  /** Minutes from midnight. */
  minutes: number;
  /** HH:MM */
  time: string;
  isFake: boolean;
}

/**
 * The wall clock in a timezone, as plain strings and integers.
 * FAKE_TODAY and FAKE_TIME override the date and the time for tests.
 */
export function nowInTz(tz: string = config.timezone, at: Date = new Date()): WallClock {
  const parts = Object.fromEntries(
    formatter(tz)
      .formatToParts(at)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value])
  ) as Record<string, string>;

  let date = `${parts.year}-${parts.month}-${parts.day}`;
  let hour = Number(parts.hour) % 24;
  let minute = Number(parts.minute);
  let second = Number(parts.second);

  if (config.fakeToday) date = config.fakeToday;
  if (config.fakeTime) {
    const [h, m] = config.fakeTime.split(':').map(Number);
    hour = h;
    minute = m;
    second = 0;
  }

  return {
    date,
    hour,
    minute,
    second,
    minutes: hour * 60 + minute,
    time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    isFake: Boolean(config.fakeToday || config.fakeTime),
  };
}

/** Today's calendar date in the configured timezone. */
export function todayInTz(tz: string = config.timezone): string {
  return nowInTz(tz).date;
}

/** A MySQL DATETIME string for the current wall clock in the configured timezone. */
export function nowDateTime(tz: string = config.timezone): string {
  const n = nowInTz(tz);
  return `${n.date} ${String(n.hour).padStart(2, '0')}:${String(n.minute).padStart(2, '0')}:${String(
    n.second
  ).padStart(2, '0')}`;
}

/* ------------------------------------------------------- date arithmetic */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function assertIso(value: unknown, name = 'date'): asserts value is string {
  if (!isIsoDate(value)) {
    throw new TypeError(`${name} must be a real YYYY-MM-DD date, got ${JSON.stringify(value)}`);
  }
}

export function addDays(iso: string, n: number): string {
  assertIso(iso);
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b. Negative when b is before a. */
export function daysBetween(a: string, b: string): number {
  assertIso(a, 'from');
  assertIso(b, 'to');
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000
  );
}

/** Monday is index 0, Sunday is 6. */
export function weekdayIndex(iso: string): number {
  assertIso(iso);
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekdayName(iso: string): string {
  return WEEKDAYS[weekdayIndex(iso)];
}

export function isSunday(iso: string): boolean {
  return weekdayIndex(iso) === 6;
}

/** The Monday of the week containing iso. */
export function mondayOf(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

/** "Friday, 28 August 2026", the form the Today header uses. */
export function longDate(iso: string): string {
  assertIso(iso);
  const [y, m, d] = iso.split('-').map(Number);
  return `${weekdayName(iso)}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "28 Aug 2026", the compact form used in tables and chips. */
export function shortDate(iso: string): string {
  assertIso(iso);
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/** "2026-08" for grouping by month. */
export function monthKey(iso: string): string {
  assertIso(iso);
  return iso.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/* ------------------------------------------------------------- the blocks */

export function blockByCode(code: string): Block | null {
  return BLOCKS.find((b) => b.code === code) ?? null;
}

export interface BlockNow {
  current: Block | null;
  next: Block | null;
  minutesToNext: number | null;
  minutesToTomorrowFirst: number | null;
}

/**
 * Which block owns a wall clock time, and what comes next.
 *
 * Outside every window, current is null and next carries the countdown, which is
 * exactly what the Today screen renders in that case.
 */
export function blockForMinutes(minutes: number): BlockNow {
  const current = BLOCKS.find((b) => minutes >= b.start && minutes < b.end) ?? null;
  const upcoming = BLOCKS.filter((b) => b.start > minutes).sort((a, b) => a.start - b.start);
  const next = upcoming.length ? upcoming[0] : null;
  return {
    current,
    next,
    minutesToNext: next ? next.start - minutes : null,
    // After the night block there is nothing left today.
    minutesToTomorrowFirst: next ? null : 24 * 60 - minutes + BLOCKS[0].start,
  };
}

/** blockForMinutes for the current server clock. */
export function blockForNow(tz: string = config.timezone): BlockNow & { now: WallClock } {
  const n = nowInTz(tz);
  return { ...blockForMinutes(n.minutes), now: n };
}

/**
 * The block a study session may be filed under at a given time.
 * Part 17.1 rule 1: MONEY may not start before 16:30, and a study block may not
 * start inside 17:00 to 18:00. The same rule is enforced by a database trigger.
 */
export function blockAllowedAt(
  code: string,
  minutes: number
): { ok: boolean; message: string | null } {
  if (code === 'MONEY' && minutes < 16 * 60 + 30) {
    return {
      ok: false,
      message:
        'The money hour never borrows from study. If client work overruns, the client waits two days. The roadmap does not wait one hour.',
    };
  }
  if (['DSA', 'LEARN', 'BUILD', 'CLOSE'].includes(code) && minutes >= 17 * 60 && minutes < 18 * 60) {
    return {
      ok: false,
      message: 'A study block cannot be logged inside the money hour, 17:00 to 18:00.',
    };
  }
  return { ok: true, message: null };
}

/* ------------------------------------------------------------- the roadmap */

/** The week number for a date, from a list of { n, start_date, end_date }. */
export function weekForDate(
  iso: string,
  weeks: { n: number; start_date: string; end_date: string }[]
): number | null {
  assertIso(iso);
  for (const w of weeks) {
    if (iso >= w.start_date && iso <= w.end_date) return w.n;
  }
  return null;
}

export function isInRoadmap(iso: string): boolean {
  return isIsoDate(iso) && iso >= config.roadmap.firstDay && iso <= config.roadmap.lastDay;
}

/** Day 1 is 2026-08-28. Returns null outside the window. */
export function roadmapDayNumber(iso: string): number | null {
  if (!isInRoadmap(iso)) return null;
  return daysBetween(config.roadmap.firstDay, iso) + 1;
}

export function daysRemaining(iso: string = todayInTz()): number {
  return daysBetween(iso, config.roadmap.lastDay);
}

/**
 * Part 18.7 rule 3: retroactive editing is limited to 7 days, and a day cannot
 * be logged before it happens. Enforced here, in zod, and in a SQL trigger.
 */
export function isEditableDate(
  iso: string,
  today: string = todayInTz()
): { ok: boolean; reason: string | null } {
  if (!isIsoDate(iso)) return { ok: false, reason: 'That is not a real date.' };
  if (iso > today) return { ok: false, reason: 'A day cannot be logged before it happens.' };
  if (daysBetween(iso, today) > 7) {
    return {
      ok: false,
      reason: 'Retroactive editing is limited to 7 days. History is not rewritten.',
    };
  }
  return { ok: true, reason: null };
}

/** Human countdown, for example "2 h 15 m" or "45 m". */
export function humanMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined) return '';
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} m` : `${h} h`;
}

/** Every date from a to b inclusive. */
export function dateRange(a: string, b: string): string[] {
  assertIso(a, 'from');
  assertIso(b, 'to');
  const out: string[] = [];
  let cur = a;
  while (cur <= b) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}
