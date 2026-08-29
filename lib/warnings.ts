/**
 * warnings.ts | W1 to W10 from Part 18.5.
 *
 * These are not suggestions. They are the reason the tracker exists.
 * Red cannot be dismissed. Orange can be snoozed for 24 hours, once.
 *
 * evaluateWarnings is pure: it takes a context object and returns warnings, so
 * every rule can be tested against a fixture without a database.
 */

import { daysBetween } from './dates';

export const WARNING_CODES = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'] as const;

export type WarningCode = (typeof WARNING_CODES)[number];
export type WarningLevel = 'red' | 'orange';

const TITLES: Record<string, string> = {
  W1: 'DSA is behind',
  W2: 'No GitHub push',
  W3: 'A gate is close and not started',
  W4: 'Video over the 30 minute cap',
  W5: 'Anki is overdue',
  W6: 'No money touch',
  W7: 'Applications have not started',
  W8: 'A problem beat you twice',
  W9: 'Two red days this week',
  W10: 'A week ended with LEARN unfinished',
};

export interface WarningRuleRow {
  code?: string;
  level?: string | null;
  is_permanent?: number | null;
  trigger_text?: string | null;
  message?: string | null;
  [key: string]: any;
}

export interface Warning {
  code: string;
  level: WarningLevel;
  title: string;
  message: string;
  trigger_text: string | null;
  spec_message: string | null;
  is_permanent: boolean;
  can_snooze: boolean;
  [key: string]: any;
}

function rule(rules: WarningRuleRow[], code: string): WarningRuleRow {
  return (
    rules.find((r) => r.code === code) ?? {
      code,
      level:
        code === 'W4' || code === 'W5' || code === 'W6' || code === 'W10' ? 'orange' : 'red',
      is_permanent: 0,
      trigger_text: '',
      message: '',
    }
  );
}

export interface WarningGate {
  no: number;
  gate_date: string;
  condition_text: string;
  passed: boolean;
  started: boolean;
}

export interface WarningContext {
  today: string;
  /** Minutes from midnight, Asia/Kolkata. */
  nowMinutes: number;
  rules: WarningRuleRow[];
  week: { n: number; end_date: string; dsa_cumulative: number | string } | null;
  calendarDay: { kind: string } | null;
  /** The day this person started, and whether today is still before it. */
  startedOn?: string;
  notStarted?: boolean;
  dsaSolvedTotal: number;
  dsaSource?: string;
  todayLog: Record<string, any>;
  lastPush: { repo: string; pushed_at: string; hours_since: number } | null;
  gates: WarningGate[];
  /** -1 when there has never been one. */
  daysSinceLastTouch: number;
  nextLeads: { name: string; [key: string]: any }[];
  applicationCount: number;
  failedTwice: { name: string; [key: string]: any }[];
  weekDays: { cal_date: string; colour: string; before_start?: boolean }[];
  unfinishedLearnWeeks: { week_n: number; missing: number }[];
  snoozed?: Set<string>;
  [key: string]: any;
}

export function evaluateWarnings(ctx: WarningContext): Warning[] {
  const out: Warning[] = [];
  const rules = ctx.rules ?? [];
  const log = ctx.todayLog ?? {};
  const isStudyWeek = Boolean(ctx.week) && ctx.calendarDay?.kind !== 'sunday_rest';

  /**
   * Before the day this person started, the tracker has nothing to warn about.
   * The 150 day window is fixed by final.md, but the start date is theirs, and
   * shouting about a DSA deficit or a missing push on a day they had not begun
   * is the fastest way to teach someone to ignore a red banner.
   *
   * Only the time based rules are suppressed. W4, W5, W7 and W8 are not: if a
   * problem has already beaten you twice, that is true whenever it happened.
   */
  const notStarted = Boolean(ctx.notStarted);

  const push = (code: string, message: string, extra: Record<string, any> = {}): void => {
    const r = rule(rules, code);
    const level = (r.level ?? 'red') as WarningLevel;
    const permanent = Number(r.is_permanent ?? 0) === 1;
    const snoozable = level === 'orange' && !permanent;
    if (snoozable && ctx.snoozed?.has(code)) return;
    out.push({
      code,
      level,
      title: TITLES[code],
      message,
      trigger_text: r.trigger_text ?? null,
      spec_message: r.message ?? null,
      is_permanent: permanent,
      can_snooze: snoozable,
      ...extra,
    });
  };

  /* --- W1: DSA cumulative more than 10 behind the week's target --- */
  if (ctx.week && !notStarted) {
    const target = Number(ctx.week.dsa_cumulative);
    const deficit = target - Number(ctx.dsaSolvedTotal ?? 0);
    if (deficit > 10) {
      const daysLeft = Math.max(1, daysBetween(ctx.today, ctx.week.end_date));
      const perDay = Math.ceil(deficit / daysLeft);
      push(
        'W1',
        `You are ${deficit} problems behind the week ${ctx.week.n} target of ${target}. ` +
          `That is ${perDay} a day for the ${daysLeft} ${
            daysLeft === 1 ? 'day' : 'days'
          } left in this week, on top of today's pace.`,
        { deficit, per_day_to_recover: perDay, days_left: daysLeft }
      );
    }
  }

  /* --- W2: no push in 48 hours on a study week --- */
  if (isStudyWeek && !notStarted) {
    const hours = ctx.lastPush ? Number(ctx.lastPush.hours_since) : Infinity;
    if (hours >= 48) {
      const where = ctx.lastPush
        ? `The last push was to ${ctx.lastPush.repo} at ${ctx.lastPush.pushed_at}, ${Math.floor(
            hours
          )} hours ago.`
        : 'There is no push on record at all.';
      const cancelled =
        hours >= 72 ? ' The streak is cancelled at 72 hours, regardless of every other box.' : '';
      push('W2', `${where}${cancelled}`, {
        hours_since: Number.isFinite(hours) ? Math.floor(hours) : null,
        streak_cancelled: hours >= 72,
        repo: ctx.lastPush?.repo ?? null,
      });
    }
  }

  /* --- W3: a gate is 14 days away and its condition is not started --- */
  for (const g of ctx.gates ?? []) {
    const days = daysBetween(ctx.today, g.gate_date);
    if (days >= 0 && days <= 14 && !g.started && !g.passed) {
      push(
        'W3',
        `Gate ${g.no} is ${
          days === 0 ? 'today' : `${days} ${days === 1 ? 'day' : 'days'} away`
        } and nothing is marked started. The condition is: ${g.condition_text}`,
        { gate_no: g.no, days_remaining: days, condition_text: g.condition_text }
      );
    }
  }

  /* --- W4: video minutes over 30 in a day --- */
  const video = Number(log.video_minutes ?? 0);
  if (video > 30) {
    push(
      'W4',
      `${video} minutes of video today, ${
        video - 30
      } over the cap. This came out of LEARN, it was not added on top.`,
      { video_minutes: video, over_by: video - 30 }
    );
  }

  /* --- W5: Anki overdue above zero at 22:00 --- */
  const overdue = Number(log.anki_overdue ?? 0);
  if (overdue > 0 && Number(ctx.nowMinutes ?? 0) >= 22 * 60) {
    push('W5', `${overdue} Anki cards overdue after 22:00. Zero overdue is the only acceptable state.`, {
      overdue,
    });
  }

  /* --- W6: no money touch logged for 3 days --- */
  const since = Number(ctx.daysSinceLastTouch ?? -1);
  if (!notStarted && (since === -1 || since >= 3)) {
    const names = (ctx.nextLeads ?? []).slice(0, 15).map((l) => l.name);
    const head =
      since === -1
        ? 'No money touch has ever been logged.'
        : `${since} days since the last money touch.`;
    const tail = names.length
      ? ` The next ${names.length} on the list: ${names.join(', ')}.`
      : ' There are no leads on the list yet. Part 17.13 says fill 30 rows in the first ten minutes.';
    push('W6', `${head}${tail}`, { days_since: since === -1 ? null : since, next_leads: names });
  }

  /* --- W7: on or after 13 December 2026 with zero applications --- */
  if (ctx.today >= '2026-12-13' && Number(ctx.applicationCount ?? 0) === 0) {
    push(
      'W7',
      'Gate 3 has passed and applications should have started. Part 13 is explicit: applications begin at Gate 3 on 13 December 2026, not at Gate 4. ' +
        'Waiting costs six weeks of pipeline and lands your first replies inside the Indian hiring slowdown.',
      { application_count: 0 }
    );
  }

  /* --- W8: a problem has been failed twice --- */
  const ft = ctx.failedTwice ?? [];
  if (ft.length) {
    push(
      'W8',
      `${ft.length} ${ft.length === 1 ? 'problem has' : 'problems have'} beaten you twice: ${ft
        .slice(0, 6)
        .map((p) => p.name)
        .join(', ')}${ft.length > 6 ? ', and more' : ''}. ` +
        'Each one stays on Today until it is solved cold.',
      { count: ft.length, problems: ft.slice(0, 12) }
    );
  }

  /* --- W9: two red days inside one week --- */
  const reds = (ctx.weekDays ?? []).filter(
    (d) => d.colour === 'red' && d.cal_date <= ctx.today && !d.before_start
  );
  if (reds.length >= 2) {
    const weekday = new Date(`${ctx.today}T00:00:00Z`).getUTCDay();
    const cut =
      weekday <= 3 && weekday >= 1
        ? ' Today is on or before Wednesday, so the CUT POINT applies now: trim scope.'
        : ' The Wednesday CUT POINT has passed. Trim scope anyway and protect the gate.';
    push(
      'W9',
      `${reds.length} red days in week ${ctx.week?.n ?? '?'}: ${reds
        .map((d) => d.cal_date)
        .join(', ')}.${cut}`,
      { red_days: reds.map((d) => d.cal_date) }
    );
  }

  /* --- W10: a week ended with the LEARN row unfinished --- */
  for (const w of ctx.unfinishedLearnWeeks ?? []) {
    push(
      'W10',
      `Week ${w.week_n} ended with ${w.missing} LEARN ${
        w.missing === 1 ? 'row' : 'rows'
      } unfinished. ` + 'Carry it into the Saturday review, never into the next week LEARN block.',
      { week_n: w.week_n, missing: w.missing }
    );
  }

  // Red first, then orange, each group in code order.
  const order = (w: Warning): number =>
    (w.level === 'red' ? 0 : 1) * 100 + (WARNING_CODES as readonly string[]).indexOf(w.code);
  return out.sort((a, b) => order(a) - order(b));
}

/** Fires when a warning should trigger a browser notification. */
export function notifiableGateCountdowns(
  gates: { no: number; gate_date: string; condition_text: string; passed: boolean }[],
  today: string
): { gate_no: number; days: number; title: string; body: string }[] {
  const out: { gate_no: number; days: number; title: string; body: string }[] = [];
  for (const g of gates) {
    const days = daysBetween(today, g.gate_date);
    if ([14, 7, 1].includes(days) && !g.passed) {
      out.push({
        gate_no: g.no,
        days,
        title: `Gate ${g.no} in ${days} ${days === 1 ? 'day' : 'days'}`,
        body: g.condition_text,
      });
    }
  }
  return out;
}
