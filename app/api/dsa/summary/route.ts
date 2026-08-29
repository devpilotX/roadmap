/**
 * GET /api/dsa/summary
 *
 * Until a real 474 row export has been imported, dsa_problems is empty and the
 * screen shows topic level progress with a visible notice. Problem names are
 * never invented, per section 9.3.
 */

import { query } from '@/lib/db/pool';
import { getDsaThresholds, getEligibilityDsa, getWeeks } from '@/lib/db/reference';
import { dsaSolvedTotal } from '@/lib/db/progress';
import { todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const [thresholds, weeks, ladder, solved] = await Promise.all([
    getDsaThresholds(),
    getWeeks(),
    getEligibilityDsa(),
    dsaSolvedTotal(user.id),
  ]);

  const [byDifficulty, byTopic, topicProgress, dailyRows, failed] = await Promise.all([
    query(
      `SELECT p.difficulty,
              COUNT(*) AS total,
              SUM(CASE WHEN g.status = 'solved' THEN 1 ELSE 0 END) AS solved
         FROM dsa_problems p LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
        GROUP BY p.difficulty`,
      [user.id]
    ),
    query(
      `SELECT t.id, t.ord, t.name, COUNT(p.id) AS total,
              SUM(CASE WHEN g.status = 'solved' THEN 1 ELSE 0 END) AS solved,
              SUM(CASE WHEN g.status = 'failed_twice' THEN 1 ELSE 0 END) AS failed_twice
         FROM dsa_topics t
         LEFT JOIN dsa_problems p ON p.topic_id = t.id
         LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
        GROUP BY t.id, t.ord, t.name ORDER BY t.ord`,
      [user.id]
    ),
    query('SELECT topic_id, solved, minutes, notes FROM dsa_topic_progress WHERE user_id = ?', [
      user.id,
    ]),
    query(
      `SELECT log_date, dsa_solved, dsa_minutes FROM day_logs
        WHERE user_id = ? AND dsa_solved > 0 ORDER BY log_date`,
      [user.id]
    ),
    query(
      `SELECT p.id, p.name, p.difficulty, p.url, t.name AS topic, g.times_failed, g.notes
         FROM dsa_progress g JOIN dsa_problems p ON p.id = g.problem_id JOIN dsa_topics t ON t.id = p.topic_id
        WHERE g.user_id = ? AND g.status = 'failed_twice' ORDER BY t.ord, p.ord`,
      [user.id]
    ),
  ]);

  const topicManual = new Map(topicProgress.map((t) => [Number(t.topic_id), t]));

  // The plan curve against the actual curve, by week.
  let running = 0;
  const actualByWeek = new Map<number, number>();
  const cal = await query(
    `SELECT c.week_n, COALESCE(SUM(l.dsa_solved), 0) AS solved
       FROM calendar_days c LEFT JOIN day_logs l ON l.log_date = c.cal_date AND l.user_id = ?
      WHERE c.week_n IS NOT NULL GROUP BY c.week_n ORDER BY c.week_n`,
    [user.id]
  );
  for (const r of cal) {
    running += Number(r.solved);
    actualByWeek.set(Number(r.week_n), running);
  }
  const today = todayInTz();
  const curve = weeks.map((w) => ({
    week_n: w.n,
    end_date: w.end_date,
    plan: w.dsa_cumulative,
    actual: w.end_date <= today ? actualByWeek.get(Number(w.n)) ?? 0 : null,
    is_past: w.end_date <= today,
  }));

  return jsonOk({
    total_in_sheet: config.roadmap.dsaSheetTotal,
    target_by_gate4: config.roadmap.dsaTargetByEnd,
    solved: solved.total,
    source: solved.source,
    problems_imported: solved.problemCount > 0,
    problem_count: solved.problemCount,
    import_pending: solved.problemCount === 0,
    import_notice:
      solved.problemCount === 0
        ? 'Problem level import is pending. final.md does not contain the 474 problem names, and this app never invents one. Run scripts/import-dsa.mjs with a CSV export from the Striver A2Z tracker or Codolio. Until then, progress is tracked per topic and per day.'
        : null,
    by_difficulty: Object.fromEntries(
      byDifficulty.map((r) => [r.difficulty, { total: Number(r.total), solved: Number(r.solved) }])
    ),
    expected_split: { Easy: 152, Medium: 186, Hard: 136 },
    topics: byTopic.map((t) => ({
      id: Number(t.id),
      ord: Number(t.ord),
      name: t.name,
      total: Number(t.total),
      solved: Number(t.solved),
      failed_twice: Number(t.failed_twice),
      manual_solved: Number(topicManual.get(Number(t.id))?.solved ?? 0),
      manual_minutes: Number(topicManual.get(Number(t.id))?.minutes ?? 0),
      notes: topicManual.get(Number(t.id))?.notes ?? '',
    })),
    thresholds: thresholds.map((t): Record<string, any> => ({
      ...t,
      reached: solved.total >= Number(t.cumulative),
    })),
    ladder: ladder.map((r): Record<string, any> => ({
      ...r,
      reached: solved.total >= Number(r.problems),
    })),
    curve,
    daily: dailyRows,
    failed_twice: failed,
    minutes_total: dailyRows.reduce((a, r) => a + Number(r.dsa_minutes), 0),
  });
});
