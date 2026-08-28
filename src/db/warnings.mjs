/**
 * warnings.mjs (db) | assembles the context the pure evaluator needs.
 *
 * Six queries, run in parallel. Any more than that would need a justification
 * comment under the budget in build prompt section 18.
 */

import { one, query, run } from './pool.mjs';
import { getCalendarDays, getGates, getWarningRules, getWeeks } from './reference.mjs';
import { dsaSolvedTotal, streakState } from './progress.mjs';
import { evaluateWarnings } from '../lib/warnings.mjs';
import { nowInTz, todayInTz } from '../lib/dates.mjs';

async function snoozedCodes(userId, today) {
  const rows = await query(
    'SELECT warning_code FROM warning_snoozes WHERE user_id = ? AND snoozed_until > NOW()',
    [userId]
  );
  return new Set(rows.map((r) => r.warning_code));
}

export async function buildWarningContext(userId, today = todayInTz()) {
  const now = nowInTz();
  const [rules, weeks, cal, gateRows] = await Promise.all([
    getWarningRules(),
    getWeeks(),
    getCalendarDays(),
    getGates(),
  ]);

  const week = weeks.find((w) => today >= w.start_date && today <= w.end_date) ?? null;
  const calendarDay = cal.find((d) => d.cal_date === today) ?? null;

  const [
    solved,
    todayLog,
    lastPushRow,
    gateResults,
    projectRows,
    touchRow,
    nextLeads,
    appRow,
    failed,
    snoozed,
    learnGaps,
  ] = await Promise.all([
    dsaSolvedTotal(userId),
    one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [userId, today]),
    one(
      `SELECT r.full_name AS repo, p.pushed_at,
              TIMESTAMPDIFF(MINUTE, p.pushed_at, NOW()) / 60 AS hours_since
         FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
        WHERE p.user_id = ? AND r.counts_to_target = 1
        ORDER BY p.pushed_at DESC LIMIT 1`,
      [userId]
    ),
    query('SELECT gate_no, passed, evidence_url FROM gate_results WHERE user_id = ?', [userId]),
    query(
      `SELECT p.id, p.week_from, p.week_to, pp.status, pp.live_url, pp.repo_url
         FROM projects p LEFT JOIN project_progress pp ON pp.project_id = p.id AND pp.user_id = ?
        ORDER BY p.id`,
      [userId]
    ),
    one('SELECT MAX(touched_on) AS last_touch FROM lead_touches WHERE user_id = ?', [userId]),
    query(
      `SELECT id, name, category, area, phone, next_touch_on, last_touch_on
         FROM leads
        WHERE user_id = ? AND is_deleted = 0 AND status NOT IN ('won', 'lost', 'dead')
        ORDER BY (next_touch_on IS NULL) DESC, next_touch_on ASC, last_touch_on IS NULL DESC, id ASC
        LIMIT 15`,
      [userId]
    ),
    one('SELECT COUNT(*) AS c FROM applications WHERE user_id = ? AND is_deleted = 0', [userId]),
    query(
      `SELECT p.problem_id, pr.name, pr.difficulty, p.times_failed
         FROM dsa_progress p JOIN dsa_problems pr ON pr.id = p.problem_id
        WHERE p.user_id = ? AND p.status = 'failed_twice'
        ORDER BY pr.id`,
      [userId]
    ),
    snoozedCodes(userId, today),
    query(
      `SELECT d.week_n, SUM(CASE WHEN COALESCE(p.learn_done, 0) = 1 THEN 0 ELSE 1 END) AS missing
         FROM week_days d
         LEFT JOIN week_day_progress p ON p.week_day_id = d.id AND p.user_id = ?
         JOIN weeks w ON w.n = d.week_n
        WHERE w.end_date < ?
        GROUP BY d.week_n
       HAVING missing > 0
        ORDER BY d.week_n`,
      [userId, today]
    ),
  ]);

  const passedByGate = new Map(gateResults.map((g) => [Number(g.gate_no), g]));

  // A gate counts as started when the project that carries it has been touched.
  const gates = gateRows.map((g) => {
    const result = passedByGate.get(Number(g.no));
    const carrier = projectRows.find((p) => g.week_n >= p.week_from && g.week_n <= p.week_to);
    const started = Boolean(
      (carrier && carrier.status && carrier.status !== 'not_started') ||
        (carrier && (carrier.live_url || carrier.repo_url)) ||
        (result && result.evidence_url)
    );
    return {
      no: Number(g.no),
      gate_date: g.gate_date,
      condition_text: g.condition_text,
      passed: Number(result?.passed ?? 0) === 1,
      started,
    };
  });

  const streak = await streakState(userId, today);
  const weekDays = week
    ? streak.days.filter((d) => d.week_n === week.n)
    : [];

  const lastTouch = touchRow?.last_touch ?? null;
  const daysSinceLastTouch = lastTouch
    ? Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${lastTouch}T00:00:00Z`)) / 86400000)
    : -1;

  return {
    today,
    nowMinutes: now.minutes,
    rules,
    week,
    calendarDay,
    // The day this person started, and whether today is still before it. The
    // time based warnings stay quiet until the roadmap has actually begun.
    startedOn: streak.started_on,
    notStarted: streak.not_started_yet,
    dsaSolvedTotal: solved.total,
    dsaSource: solved.source,
    todayLog: todayLog ?? {},
    lastPush: lastPushRow
      ? { repo: lastPushRow.repo, pushed_at: lastPushRow.pushed_at, hours_since: Number(lastPushRow.hours_since) }
      : null,
    gates,
    daysSinceLastTouch,
    nextLeads,
    applicationCount: Number(appRow?.c ?? 0),
    failedTwice: failed,
    weekDays,
    unfinishedLearnWeeks: learnGaps.map((r) => ({ week_n: Number(r.week_n), missing: Number(r.missing) })),
    snoozed,
    streak,
  };
}

export async function warningsFor(userId, today = todayInTz()) {
  const ctx = await buildWarningContext(userId, today);
  return { warnings: evaluateWarnings(ctx), context: ctx };
}

/** Snoozes an orange warning for 24 hours, once per day. */
export async function snoozeWarning(userId, code) {
  const rule = (await getWarningRules()).find((r) => r.code === code);
  if (!rule) return { ok: false, reason: 'No such warning.' };
  if (rule.level !== 'orange' || Number(rule.is_permanent) === 1) {
    return { ok: false, reason: 'Red means red. This warning cannot be dismissed or snoozed.' };
  }
  const today = todayInTz();
  const existing = await one(
    'SELECT id FROM warning_snoozes WHERE user_id = ? AND warning_code = ? AND snooze_date = ?',
    [userId, code, today]
  );
  if (existing) {
    return { ok: false, reason: 'That warning has already been snoozed once today. Once is the limit.' };
  }
  await run(
    'INSERT INTO warning_snoozes (user_id, warning_code, snooze_date, snoozed_until) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
    [userId, code, today]
  );
  return { ok: true, reason: null };
}
