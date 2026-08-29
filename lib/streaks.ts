/**
 * streaks.ts | day colour and the streak.
 *
 * Part 18.2 defines a done day as six conditions, all six or the day is not
 * green. Six of six is green, four or five is amber, three or fewer is red.
 * The streak counts green days only. Amber does not break it, red does. A rest
 * Sunday is neutral: it neither breaks a streak nor extends one.
 *
 * The six conditions describe a study day, because they reference the day's
 * LEARN and BUILD rows from Part 4 and there is no BUILD block on a Sunday.
 * Sundays and the three launch days therefore get their own condition sets,
 * derived from what final.md actually asks of those days. Every set is returned
 * in full so the interface can show exactly which condition is unmet.
 */

export const THRESHOLDS = Object.freeze({
  learnMinutes: 150,
  buildMinutes: 100,
  buildPushes: 1,
  videoMinutesCap: 30,
});

export type Colour = 'green' | 'amber' | 'red' | 'neutral';

export const COLOURS: readonly Colour[] = Object.freeze(['green', 'amber', 'red', 'neutral']);

export interface Condition {
  code: string;
  label: string;
  met: boolean;
  detail: string;
}

/** The shape of a calendar_days row that colour depends on. */
export interface ColourDay {
  kind: string;
  dsa_target?: number | string | null;
}

/** The shape of a day_logs row that colour depends on. Every field is optional. */
export type ColourLog = Record<string, any>;

export interface ColourExtra {
  sundayCompleted?: number | boolean | null;
  sundayHours?: number | string | null;
  sundayRequiredHours?: number | string | null;
  beforeStart?: boolean;
}

const n = (v: unknown): number => Number(v ?? 0);
const b = (v: unknown): boolean => Number(v ?? 0) === 1 || v === true;

export function conditionsFor(
  day: ColourDay,
  log: ColourLog = {},
  extra: ColourExtra = {}
): Condition[] {
  // A day that falls inside the 150 day window but before the day this person
  // actually started has nothing to judge. The window comes from final.md and
  // cannot move; the start date is the person's own, and it is honoured here so
  // that a day they never agreed to is not scored as a failure.
  if (extra.beforeStart) return [];

  if (day.kind === 'sunday_rest') return [];

  if (day.kind === 'sunday_working' || day.kind === 'sunday_gate') {
    const required = n(extra.sundayRequiredHours);
    const hours = n(extra.sundayHours);
    const completed = b(extra.sundayCompleted);
    return [
      {
        code: 'SUNDAY',
        label: day.kind === 'sunday_gate' ? 'Gate audit done' : 'Working Sunday done',
        met: completed,
        detail: completed ? 'Marked complete.' : 'Not marked complete yet.',
      },
      {
        code: 'HOURS',
        label: `${required} hours logged`,
        met: hours >= required && required > 0,
        detail: `${hours} of ${required} hours.`,
      },
    ];
  }

  if (day.kind === 'launch') {
    const out: Condition[] = [];
    if (n(day.dsa_target) > 0) {
      out.push({
        code: 'DSA',
        label: `${day.dsa_target} problems solved`,
        met: n(log.dsa_solved) >= n(day.dsa_target),
        detail: `${n(log.dsa_solved)} of ${n(day.dsa_target)}.`,
      });
    }
    out.push(
      {
        code: 'LEARN',
        label: 'Launch task done',
        met: b(log.learn_done),
        detail: b(log.learn_done) ? 'Done.' : 'Not done.',
      },
      {
        code: 'BUILD',
        label: 'Launch build done',
        met: b(log.build_done),
        detail: b(log.build_done) ? 'Done.' : 'Not done.',
      },
      {
        code: 'MONEY',
        label: 'Money hour done',
        met: b(log.money_done),
        detail: b(log.money_done) ? 'Done.' : 'Not done.',
      }
    );
    return out;
  }

  // A study day. The six conditions from Part 18.2, in order.
  const closeComplete =
    b(log.close_done) &&
    Boolean(String(log.close_log_line ?? '').trim()) &&
    Boolean(String(log.close_tomorrow_dsa ?? '').trim()) &&
    Boolean(String(log.close_tomorrow_build ?? '').trim());

  return [
    {
      code: 'DSA',
      label: `DSA target of ${n(day.dsa_target)} met`,
      met: n(log.dsa_solved) >= n(day.dsa_target) && n(day.dsa_target) > 0,
      detail: `${n(log.dsa_solved)} of ${n(day.dsa_target)} solved.`,
    },
    {
      code: 'LEARN',
      label: `Learn done, ${THRESHOLDS.learnMinutes} minutes`,
      met: b(log.learn_done) && n(log.learn_minutes) >= THRESHOLDS.learnMinutes,
      detail: b(log.learn_done)
        ? `Marked done, ${n(log.learn_minutes)} of ${THRESHOLDS.learnMinutes} minutes logged.`
        : 'Not marked done.',
    },
    {
      code: 'BUILD',
      label: `Build done, ${THRESHOLDS.buildMinutes} minutes, one push`,
      met:
        b(log.build_done) &&
        n(log.build_minutes) >= THRESHOLDS.buildMinutes &&
        n(log.pushes) >= THRESHOLDS.buildPushes,
      detail: `${b(log.build_done) ? 'Done' : 'Not done'}, ${n(log.build_minutes)} of ${
        THRESHOLDS.buildMinutes
      } minutes, ${n(log.pushes)} pushes.`,
    },
    {
      code: 'CLOSE',
      label: 'Close done, all three fields',
      met: closeComplete,
      detail: closeComplete
        ? 'Log line written, tomorrow decided.'
        : 'Needs a log line, tomorrow first DSA problem and tomorrow first build task.',
    },
    {
      code: 'MONEY',
      label: 'Money task done, touches logged',
      met: b(log.money_done) && n(log.money_touches) > 0,
      detail: `${b(log.money_done) ? 'Done' : 'Not done'}, ${n(log.money_touches)} touches.`,
    },
    {
      code: 'NIGHT',
      label: 'Night recall, all three',
      met: b(log.night_anki_done) && b(log.night_spoken_done) && b(log.night_tomorrow_done),
      detail: [
        b(log.night_anki_done) ? 'Anki clear' : 'Anki overdue',
        b(log.night_spoken_done)
          ? `spoken${b(log.night_spoken_aloud) ? ' aloud' : ''}`
          : 'not spoken',
        b(log.night_tomorrow_done) ? 'tomorrow decided' : 'tomorrow not decided',
      ].join(', '),
    },
  ];
}

export interface ColourResult {
  colour: Colour;
  met: number;
  total: number;
  conditions: Condition[];
  before_start?: boolean;
}

/**
 * The colour for a day. A rest Sunday is always neutral, and so is a day before
 * the person started, because neither is a day they failed to do.
 */
export function dayColour(
  day: ColourDay,
  log: ColourLog = {},
  extra: ColourExtra = {}
): ColourResult {
  if (extra.beforeStart) {
    return { colour: 'neutral', met: 0, total: 0, conditions: [], before_start: true };
  }
  if (day.kind === 'sunday_rest') {
    return { colour: 'neutral', met: 0, total: 0, conditions: [] };
  }
  const conditions = conditionsFor(day, log, extra);
  const total = conditions.length;
  const met = conditions.filter((c) => c.met).length;

  if (total === 0) return { colour: 'neutral', met, total, conditions };

  // A study day has six conditions and the thresholds are stated directly.
  if (total === 6) {
    const colour: Colour = met === 6 ? 'green' : met >= 4 ? 'amber' : 'red';
    return { colour, met, total, conditions };
  }
  // Fewer conditions, so the same shape is applied proportionally: all is green,
  // more than half is amber, anything less is red.
  if (met === total) return { colour: 'green', met, total, conditions };
  if (met > total / 2) return { colour: 'amber', met, total, conditions };
  return { colour: 'red', met, total, conditions };
}

export interface StreakDay {
  cal_date: string;
  colour: Colour;
  [key: string]: any;
}

/**
 * The current streak, counted backwards from `from`.
 *
 * @param from ISO date to count back from, usually today
 * @param byDate map of ISO date to a day carrying a colour
 * @param firstDay the day counting stops at, which is the person's start date
 */
export function currentStreak(
  from: string,
  byDate: Map<string, { colour: Colour }>,
  firstDay: string
): number {
  let streak = 0;
  let cursor = from;
  while (cursor >= firstDay) {
    const day = byDate.get(cursor);
    if (!day) break;
    if (day.colour === 'neutral') {
      // A rest Sunday neither breaks nor extends.
    } else if (day.colour === 'green') {
      streak += 1;
    } else if (day.colour === 'amber') {
      // Does not break, does not extend.
    } else {
      break; // red
    }
    const d = new Date(`${cursor}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return streak;
}

export interface LongestStreak {
  length: number;
  from: string | null;
  to: string | null;
}

/** The longest green run in a set of days, and the window it covers. */
export function longestStreak(days: StreakDay[]): LongestStreak {
  let best = 0;
  let run = 0;
  let bestFrom: string | null = null;
  let bestTo: string | null = null;
  let runFrom: string | null = null;
  for (const d of days) {
    if (d.colour === 'neutral') continue;
    if (d.colour === 'green') {
      if (run === 0) runFrom = d.cal_date;
      run += 1;
      if (run > best) {
        best = run;
        bestFrom = runFrom;
        bestTo = d.cal_date;
      }
    } else if (d.colour === 'amber') {
      // Held, not extended.
    } else {
      run = 0;
      runFrom = null;
    }
  }
  return { length: best, from: bestFrom, to: bestTo };
}

export type ColourTally = Record<Colour, number>;

/** Counts by colour, for the stats screen. */
export function colourTally(days: StreakDay[]): ColourTally {
  const tally: ColourTally = { green: 0, amber: 0, red: 0, neutral: 0 };
  for (const d of days) {
    if (d.colour in tally) tally[d.colour] += 1;
  }
  return tally;
}
