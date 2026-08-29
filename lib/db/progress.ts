/**
 * progress.ts | every read and write of a user's progress.
 *
 * Two rules hold this file together:
 *   1. day_colour is computed here on every write and is never accepted from the
 *      client. Neither are pushes or money_touches, which are counted from
 *      github_pushes and lead_touches so they cannot be typed in.
 *   2. Retroactive editing beyond 7 days is refused here, in the validator, and
 *      by a database trigger. Three layers, because a false green day removes the
 *      only instrument this person has.
 */

import { one, query, run, transaction, type Row, type SqlParam, type Tx } from './pool';
import { getCalendarDays, getSundays, getWeeks } from './reference';
import {
  currentStreak,
  dayColour,
  longestStreak,
  type Colour,
  type ColourExtra,
  type Condition,
  type LongestStreak,
} from '../streaks';
import { addDays, isEditableDate, todayInTz } from '../dates';
import { ruleViolation } from '../errors';
import { config } from '../config';

/** Columns a client may set on a day log. Everything else is derived. */
export const WRITABLE_DAY_FIELDS = [
  'dsa_solved',
  'dsa_minutes',
  'learn_done',
  'learn_minutes',
  'build_done',
  'build_minutes',
  'close_done',
  'close_log_line',
  'close_tomorrow_dsa',
  'close_tomorrow_build',
  'money_done',
  'money_minutes',
  'night_anki_done',
  'night_spoken_done',
  'night_spoken_aloud',
  'night_tomorrow_done',
  'anki_overdue',
  'video_minutes',
  'blocked_on',
  'notes',
] as const;

const EMPTY_LOG = Object.freeze({
  dsa_solved: 0,
  dsa_minutes: 0,
  learn_done: 0,
  learn_minutes: 0,
  build_done: 0,
  build_minutes: 0,
  close_done: 0,
  close_log_line: null,
  close_tomorrow_dsa: null,
  close_tomorrow_build: null,
  money_done: 0,
  money_minutes: 0,
  money_touches: 0,
  night_anki_done: 0,
  night_spoken_done: 0,
  night_spoken_aloud: 0,
  night_tomorrow_done: 0,
  anki_overdue: 0,
  video_minutes: 0,
  pushes: 0,
  day_colour: 'red',
  conditions_met: 0,
  blocked_on: null,
  notes: null,
});

/* -------------------------------------------------------------- reading */

export async function calendarMap(): Promise<Map<string, Row>> {
  const days = await getCalendarDays();
  return new Map(days.map((d) => [d.cal_date as string, d]));
}

export async function getDayLog(userId: number, date: string): Promise<Record<string, any>> {
  const row = await one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [userId, date]);
  return row ?? { ...EMPTY_LOG, user_id: userId, log_date: date, exists: false };
}

export async function getDayLogs(userId: number, from: string, to: string): Promise<Row[]> {
  return query(
    'SELECT * FROM day_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? ORDER BY log_date',
    [userId, from, to]
  );
}

export async function getSundayLogs(userId: number): Promise<Row[]> {
  return query('SELECT week_n, completed, hours, notes FROM sunday_logs WHERE user_id = ?', [userId]);
}

/** Pushes counted from github_pushes, only from repositories that count. */
export async function pushesByDate(
  userId: number,
  from: string,
  to: string
): Promise<Map<string, { pushes: number; commits: number }>> {
  const rows = await query(
    `SELECT p.push_date, SUM(p.commit_count) AS commits, COUNT(*) AS pushes
       FROM github_pushes p
       JOIN github_repos r ON r.id = p.repo_id
      WHERE p.user_id = ? AND r.counts_to_target = 1 AND p.push_date BETWEEN ? AND ?
      GROUP BY p.push_date`,
    [userId, from, to]
  );
  return new Map(
    rows.map((r) => [r.push_date as string, { pushes: Number(r.pushes), commits: Number(r.commits) }])
  );
}

export async function touchesByDate(
  userId: number,
  from: string,
  to: string
): Promise<Map<string, { touches: number; replies: number }>> {
  const rows = await query(
    `SELECT touched_on, COUNT(*) AS n, SUM(reply) AS replies
       FROM lead_touches WHERE user_id = ? AND touched_on BETWEEN ? AND ?
      GROUP BY touched_on`,
    [userId, from, to]
  );
  return new Map(
    rows.map((r) => [r.touched_on as string, { touches: Number(r.n), replies: Number(r.replies) }])
  );
}

export interface SolvedTotal {
  total: number;
  source: 'problems' | 'day_logs';
  problemCount: number;
}

/**
 * The single authoritative solved count.
 * Once a real 474 row problem list is imported, dsa_progress is the truth.
 * Before that, the per day counts are, because there is nothing else to count.
 */
export async function dsaSolvedTotal(userId: number): Promise<SolvedTotal> {
  const problemCount = Number((await one('SELECT COUNT(*) AS c FROM dsa_problems'))?.c ?? 0);
  if (problemCount > 0) {
    const row = await one(
      "SELECT COUNT(*) AS c FROM dsa_progress WHERE user_id = ? AND status = 'solved'",
      [userId]
    );
    return { total: Number(row?.c ?? 0), source: 'problems', problemCount };
  }
  const row = await one('SELECT COALESCE(SUM(dsa_solved), 0) AS c FROM day_logs WHERE user_id = ?', [
    userId,
  ]);
  return { total: Number(row?.c ?? 0), source: 'day_logs', problemCount: 0 };
}

/* ------------------------------------------------------ the start date */

/**
 * The day this person actually started, from profiles.roadmap_start.
 *
 * The 150 day window itself comes from final.md and cannot move: Appendix C
 * lists every date, the four gates are on fixed dates, and Appendix E verifies
 * the counts. What can move is the day the person begins. Days inside the window
 * but before that date are neutral rather than red, so a roadmap that starts on a
 * Saturday does not open with a failure it never had a chance to avoid.
 *
 * Defaults to the first day of the window, which is what the seed sets, so this
 * changes nothing for anyone who has not moved it.
 */
export async function startedOn(userId: number): Promise<string> {
  const row = await one('SELECT roadmap_start FROM profiles WHERE user_id = ?', [userId]);
  const value = (row?.roadmap_start as string) ?? config.roadmap.firstDay;
  // Never allow it outside the window: a start date after the last day would
  // mark all 150 days neutral and quietly switch the tracker off.
  if (value < config.roadmap.firstDay) return config.roadmap.firstDay;
  if (value > config.roadmap.lastDay) return config.roadmap.lastDay;
  return value;
}

/* ------------------------------------------------------------- writing */

export interface RecomputeResult {
  colour: Colour;
  met: number;
  total: number;
  conditions: Condition[];
  pushes: number;
  touches: number;
}

/**
 * Recomputes the day colour for one date and stores it. Also refreshes the
 * derived pushes and money_touches counts from their source tables.
 */
export async function recomputeDay(
  userId: number,
  date: string,
  tx: Tx | null = null
): Promise<RecomputeResult | null> {
  const exec = tx ?? { run, one, query };
  const cal = await calendarMap();
  const day = cal.get(date);
  if (!day) return null;

  const log = await exec.one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [
    userId,
    date,
  ]);
  if (!log) return null;

  const pushRow = await exec.one(
    `SELECT COALESCE(SUM(p.commit_count), 0) AS commits, COUNT(*) AS pushes
       FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
      WHERE p.user_id = ? AND p.push_date = ? AND r.counts_to_target = 1`,
    [userId, date]
  );
  const touchRow = await exec.one(
    'SELECT COUNT(*) AS n FROM lead_touches WHERE user_id = ? AND touched_on = ?',
    [userId, date]
  );

  const pushes = Number(pushRow?.pushes ?? 0);
  const touches = Number(touchRow?.n ?? 0);

  const extra: ColourExtra = {};
  if (day.kind === 'sunday_working' || day.kind === 'sunday_gate') {
    const sundays = await getSundays();
    const meta = sundays.find((s) => s.sunday_date === date);
    const slog = await exec.one(
      'SELECT completed, hours FROM sunday_logs WHERE user_id = ? AND week_n = ?',
      [userId, meta?.week_n ?? 0]
    );
    extra.sundayCompleted = slog?.completed ?? 0;
    extra.sundayHours = slog?.hours ?? 0;
    extra.sundayRequiredHours = meta?.hours ?? 0;
  }
  extra.beforeStart = date < (await startedOn(userId));

  const merged = { ...log, pushes, money_touches: touches };
  const result = dayColour(day as { kind: string; dsa_target?: number }, merged, extra);

  await exec.run(
    'UPDATE day_logs SET pushes = ?, money_touches = ?, day_colour = ?, conditions_met = ?, week_n = ? WHERE user_id = ? AND log_date = ?',
    [pushes, touches, result.colour, result.met, day.week_n, userId, date]
  );
  return { ...result, pushes, touches };
}

/** Makes sure a day log row exists, honouring the 7 day rule. */
async function ensureDayRow(tx: Tx, userId: number, date: string, today: string): Promise<void> {
  const editable = isEditableDate(date, today);
  if (!editable.ok) throw ruleViolation(editable.reason!);
  const cal = await calendarMap();
  const day = cal.get(date);
  await tx.run(
    'INSERT INTO day_logs (user_id, log_date, week_n) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE week_n = VALUES(week_n)',
    [userId, date, day?.week_n ?? null]
  );
}

/**
 * Writes a patch onto a day log and recomputes its colour.
 * Only WRITABLE_DAY_FIELDS are accepted. day_colour, pushes and money_touches
 * are computed, never received.
 */
export async function writeDayLog(
  userId: number,
  date: string,
  patch: Record<string, any>,
  { today = todayInTz() }: { today?: string } = {}
): Promise<{ log: Row | null; colour: RecomputeResult | null }> {
  const allowed = WRITABLE_DAY_FIELDS as readonly string[];
  const fields = Object.keys(patch).filter((k) => allowed.includes(k));
  return transaction(async (tx) => {
    await ensureDayRow(tx, userId, date, today);
    const before = await tx.one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [
      userId,
      date,
    ]);

    if (fields.length) {
      const sets = fields.map((f) => `${f} = ?`);
      const params: SqlParam[] = fields.map((f) => {
        const v = patch[f];
        if (typeof v === 'boolean') return v ? 1 : 0;
        return v;
      });
      params.push(userId, date);
      await tx.run(
        `UPDATE day_logs SET ${sets.join(', ')} WHERE user_id = ? AND log_date = ?`,
        params
      );
    }

    const colour = await recomputeDay(userId, date, tx);
    const after = await tx.one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [
      userId,
      date,
    ]);

    await tx.run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
       VALUES (?, 'day_logs', ?, ?, CAST(? AS JSON), CAST(? AS JSON))`,
      [
        userId,
        date,
        before?.id ? 'update' : 'insert',
        JSON.stringify(before ?? {}),
        JSON.stringify(patch),
      ]
    );
    return { log: after, colour };
  });
}

/** Recomputes a range of days. Used after a GitHub sync or a lead import. */
export async function recomputeRange(userId: number, from: string, to: string): Promise<number> {
  const dates = await query(
    'SELECT log_date FROM day_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?',
    [userId, from, to]
  );
  for (const d of dates) {
    await recomputeDay(userId, d.log_date as string);
  }
  return dates.length;
}

/* ---------------------------------------------------------- the streak */

export interface StreakStateDay {
  cal_date: string;
  kind: string;
  week_n: number | null;
  colour: Colour;
  met: number;
  total: number;
  conditions: Condition[];
  logged: boolean;
  before_start: boolean;
}

export interface StreakState {
  days: StreakStateDay[];
  byDate: Map<string, StreakStateDay>;
  started_on: string;
  not_started_yet: boolean;
  current: number;
  longest: LongestStreak;
}

/**
 * Builds the colour map for every roadmap day up to `upTo`, then the streak.
 * Days with no log at all count as red once they are in the past, because a day
 * that was never logged was not a green day. Missed days stay visible by rule.
 */
export async function streakState(
  userId: number,
  upTo: string = todayInTz()
): Promise<StreakState> {
  const [cal, logs, sundays, sundayLogs, start] = await Promise.all([
    getCalendarDays(),
    getDayLogs(userId, config.roadmap.firstDay, upTo),
    getSundays(),
    getSundayLogs(userId),
    startedOn(userId),
  ]);
  const logByDate = new Map(logs.map((l) => [l.log_date as string, l]));
  const sundayByDate = new Map(sundays.map((s) => [s.sunday_date as string, s]));
  const sundayLogByWeek = new Map(sundayLogs.map((s) => [s.week_n as number, s]));

  const days: StreakStateDay[] = [];
  for (const d of cal) {
    if ((d.cal_date as string) > upTo) break;
    const log = logByDate.get(d.cal_date as string) ?? EMPTY_LOG;
    let extra: ColourExtra = { beforeStart: (d.cal_date as string) < start };
    const meta = sundayByDate.get(d.cal_date as string);
    if (meta) {
      const sl = sundayLogByWeek.get(meta.week_n as number);
      extra = {
        ...extra,
        sundayCompleted: sl?.completed ?? 0,
        sundayHours: sl?.hours ?? 0,
        sundayRequiredHours: meta.hours,
      };
    }
    const res = dayColour(d as { kind: string; dsa_target?: number }, log, extra);
    days.push({
      cal_date: d.cal_date as string,
      kind: d.kind as string,
      week_n: (d.week_n as number | null) ?? null,
      colour: res.colour,
      met: res.met,
      total: res.total,
      conditions: res.conditions,
      logged: logByDate.has(d.cal_date as string),
      before_start: (d.cal_date as string) < start,
    });
  }

  const byDate = new Map(days.map((d) => [d.cal_date, d]));
  return {
    days,
    byDate,
    started_on: start,
    not_started_yet: upTo < start,
    // The streak is counted from the start date, not from the first day of the
    // window, so days before it can never break it.
    current: currentStreak(upTo, byDate, start),
    longest: longestStreak(days),
  };
}

/* -------------------------------------------------- week completion */

export interface WeekProgress {
  week_n: number;
  learn_done: number;
  build_done: number;
  day_rows: number;
  complete: boolean;
  percent: number;
}

/**
 * Which weeks are complete, from week_day_progress. A week counts as complete
 * when all twelve ticks are on: six LEARN and six BUILD. /eligibility reads this
 * rather than storing anything.
 */
export async function completedWeeks(userId: number): Promise<{
  perWeek: WeekProgress[];
  complete: number[];
  highestConsecutive: number;
}> {
  const rows = await query(
    `SELECT d.week_n,
            SUM(CASE WHEN p.learn_done = 1 THEN 1 ELSE 0 END) AS learn_done,
            SUM(CASE WHEN p.build_done = 1 THEN 1 ELSE 0 END) AS build_done,
            COUNT(*) AS day_rows
       FROM week_days d
       LEFT JOIN week_day_progress p ON p.week_day_id = d.id AND p.user_id = ?
      GROUP BY d.week_n
      ORDER BY d.week_n`,
    [userId]
  );
  const perWeek: WeekProgress[] = rows.map((r) => ({
    week_n: Number(r.week_n),
    learn_done: Number(r.learn_done),
    build_done: Number(r.build_done),
    day_rows: Number(r.day_rows),
    complete: Number(r.learn_done) === 6 && Number(r.build_done) === 6,
    percent: Math.round(
      ((Number(r.learn_done) + Number(r.build_done)) / (Number(r.day_rows) * 2)) * 100
    ),
  }));
  const complete = perWeek.filter((w) => w.complete).map((w) => w.week_n);
  return {
    perWeek,
    complete,
    highestConsecutive: (() => {
      let n = 0;
      for (let w = 1; w <= 21; w += 1) {
        if (complete.includes(w)) n = w;
        else break;
      }
      return n;
    })(),
  };
}

/* ------------------------------------------------------ small readers */

export async function failedTwice(userId: number): Promise<Row[]> {
  return query(
    `SELECT p.problem_id, pr.name, pr.difficulty, pr.url, t.name AS topic, p.times_failed, p.notes
       FROM dsa_progress p
       JOIN dsa_problems pr ON pr.id = p.problem_id
       JOIN dsa_topics t ON t.id = pr.topic_id
      WHERE p.user_id = ? AND p.status = 'failed_twice'
      ORDER BY t.ord, pr.ord`,
    [userId]
  );
}

export interface YesterdaySummary {
  date: string;
  exists: boolean;
  line: string | null;
  colour: string | null;
  blocked_on?: string | null;
  dsa_solved?: number;
}

export async function yesterdaySummary(
  userId: number,
  today: string = todayInTz()
): Promise<YesterdaySummary> {
  const date = addDays(today, -1);
  const log = await one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [userId, date]);
  if (!log) return { date, exists: false, line: null, colour: null };
  return {
    date,
    exists: true,
    line: log.close_log_line,
    blocked_on: log.blocked_on,
    colour: log.day_colour,
    dsa_solved: log.dsa_solved,
  };
}

export async function openSession(userId: number): Promise<Row | null> {
  return one(
    `SELECT id, block, session_date, resource_id, week_link_id, started_at, source
       FROM study_sessions WHERE user_id = ? AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [userId]
  );
}

export async function weekForDateDb(date: string): Promise<Row | null> {
  const weeks = await getWeeks();
  return weeks.find((w) => date >= w.start_date && date <= w.end_date) ?? null;
}
