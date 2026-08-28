/**
 * dsa.mjs | the DSA tracker.
 *
 * Until a real 474 row export has been imported, dsa_problems is empty and the
 * screen shows topic level progress with a visible notice. Problem names are
 * never invented, per section 9.3.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, query, run, transaction } from '../../db/pool.mjs';
import { getDsaTopics, getDsaThresholds, getWeeks, getEligibilityDsa } from '../../db/reference.mjs';
import { dsaSolvedTotal, recomputeDay } from '../../db/progress.mjs';
import { ok, notFound, ruleViolation } from '../../lib/errors.mjs';
import { isEditableDate, todayInTz } from '../../lib/dates.mjs';
import { isoDate, optionalText, positiveId, validate } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

/* ------------------------------------------------------- GET /dsa/summary */

router.get('/dsa/summary', async (req, res, next) => {
  try {
    const [topics, thresholds, weeks, ladder, solved] = await Promise.all([
      getDsaTopics(),
      getDsaThresholds(),
      getWeeks(),
      getEligibilityDsa(),
      dsaSolvedTotal(req.user.id),
    ]);

    const [byDifficulty, byTopic, topicProgress, dailyRows, failed] = await Promise.all([
      query(
        `SELECT p.difficulty,
                COUNT(*) AS total,
                SUM(CASE WHEN g.status = 'solved' THEN 1 ELSE 0 END) AS solved
           FROM dsa_problems p LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
          GROUP BY p.difficulty`,
        [req.user.id]
      ),
      query(
        `SELECT t.id, t.ord, t.name, COUNT(p.id) AS total,
                SUM(CASE WHEN g.status = 'solved' THEN 1 ELSE 0 END) AS solved,
                SUM(CASE WHEN g.status = 'failed_twice' THEN 1 ELSE 0 END) AS failed_twice
           FROM dsa_topics t
           LEFT JOIN dsa_problems p ON p.topic_id = t.id
           LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
          GROUP BY t.id, t.ord, t.name ORDER BY t.ord`,
        [req.user.id]
      ),
      query('SELECT topic_id, solved, minutes, notes FROM dsa_topic_progress WHERE user_id = ?', [req.user.id]),
      query(
        `SELECT log_date, dsa_solved, dsa_minutes FROM day_logs
          WHERE user_id = ? AND dsa_solved > 0 ORDER BY log_date`,
        [req.user.id]
      ),
      query(
        `SELECT p.id, p.name, p.difficulty, p.url, t.name AS topic, g.times_failed, g.notes
           FROM dsa_progress g JOIN dsa_problems p ON p.id = g.problem_id JOIN dsa_topics t ON t.id = p.topic_id
          WHERE g.user_id = ? AND g.status = 'failed_twice' ORDER BY t.ord, p.ord`,
        [req.user.id]
      ),
    ]);

    const topicManual = new Map(topicProgress.map((t) => [Number(t.topic_id), t]));

    // The plan curve against the actual curve, by week.
    let running = 0;
    const actualByWeek = new Map();
    const cal = await query(
      `SELECT c.week_n, COALESCE(SUM(l.dsa_solved), 0) AS solved
         FROM calendar_days c LEFT JOIN day_logs l ON l.log_date = c.cal_date AND l.user_id = ?
        WHERE c.week_n IS NOT NULL GROUP BY c.week_n ORDER BY c.week_n`,
      [req.user.id]
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
      actual: w.end_date <= today ? actualByWeek.get(w.n) ?? 0 : null,
      is_past: w.end_date <= today,
    }));

    return ok(res, {
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
      thresholds: thresholds.map((t) => ({ ...t, reached: solved.total >= Number(t.cumulative) })),
      ladder: ladder.map((r) => ({ ...r, reached: solved.total >= Number(r.problems) })),
      curve,
      daily: dailyRows,
      failed_twice: failed,
      minutes_total: dailyRows.reduce((a, r) => a + Number(r.dsa_minutes), 0),
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------ GET /dsa/problems */

const problemQuery = z.object({
  topic: z.coerce.number().int().positive().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  status: z.enum(['todo', 'solved', 'revisit', 'failed_twice']).optional(),
  q: z.string().max(120).optional(),
});

router.get('/dsa/problems', validate({ query: problemQuery }), async (req, res, next) => {
  try {
    const f = req.validQuery;
    const where = ['1 = 1'];
    const params = [req.user.id];
    if (f.topic) {
      where.push('p.topic_id = ?');
      params.push(f.topic);
    }
    if (f.difficulty) {
      where.push('p.difficulty = ?');
      params.push(f.difficulty);
    }
    if (f.status) {
      where.push("COALESCE(g.status, 'todo') = ?");
      params.push(f.status);
    }
    if (f.q) {
      where.push('p.name LIKE ?');
      params.push(`%${f.q}%`);
    }
    const rows = await query(
      `SELECT p.id, p.topic_id, p.ord, p.name, p.difficulty, p.url, t.name AS topic, t.ord AS topic_ord,
              COALESCE(g.status, 'todo') AS status, g.first_solved_at, g.last_solved_on,
              g.times_solved, g.times_failed, g.minutes_spent, g.notes
         FROM dsa_problems p
         JOIN dsa_topics t ON t.id = p.topic_id
         LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
        WHERE ${where.join(' AND ')}
        ORDER BY t.ord, p.ord`,
      params
    );
    return ok(res, { problems: rows, count: rows.length });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------- PATCH /dsa/problems/:id/progress */

const problemBody = z.object({
  status: z.enum(['todo', 'solved', 'revisit', 'failed_twice']).optional(),
  minutes_spent: z.coerce.number().int().min(0).max(10000).optional(),
  notes: optionalText(4000).optional(),
  solved_on: isoDate.optional(),
});

router.patch(
  '/dsa/problems/:id/progress',
  validate({ params: z.object({ id: positiveId }), body: problemBody }),
  async (req, res, next) => {
    try {
      const problem = await one('SELECT id, name, topic_id FROM dsa_problems WHERE id = ?', [req.params.id]);
      if (!problem) throw notFound('No such problem.');

      const today = todayInTz();
      const solvedOn = req.body.solved_on ?? today;
      if (req.body.status === 'solved') {
        const editable = isEditableDate(solvedOn, today);
        if (!editable.ok) throw ruleViolation(editable.reason);
      }

      const result = await transaction(async (tx) => {
        const before = await tx.one(
          'SELECT status, times_solved, times_failed, last_solved_on FROM dsa_progress WHERE user_id = ? AND problem_id = ?',
          [req.user.id, problem.id]
        );
        await tx.run(
          'INSERT INTO dsa_progress (user_id, problem_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE problem_id = VALUES(problem_id)',
          [req.user.id, problem.id]
        );

        const sets = [];
        const params = [];
        if (req.body.status) {
          sets.push('status = ?');
          params.push(req.body.status);
          if (req.body.status === 'solved') {
            sets.push('first_solved_at = COALESCE(first_solved_at, NOW())');
            sets.push('last_solved_on = ?');
            params.push(solvedOn);
            if (before?.status !== 'solved') {
              sets.push('times_solved = times_solved + 1');
            }
          }
          if (req.body.status === 'failed_twice' && before?.status !== 'failed_twice') {
            sets.push('times_failed = times_failed + 1');
          }
        }
        if (req.body.minutes_spent !== undefined) {
          sets.push('minutes_spent = ?');
          params.push(req.body.minutes_spent);
        }
        if (req.body.notes !== undefined) {
          sets.push('notes = ?');
          params.push(req.body.notes);
        }
        if (sets.length) {
          params.push(req.user.id, problem.id);
          await tx.run(
            `UPDATE dsa_progress SET ${sets.join(', ')} WHERE user_id = ? AND problem_id = ?`,
            params
          );
        }

        // The per day count must agree with the per problem state.
        if (req.body.status === 'solved' && before?.status !== 'solved') {
          await tx.run(
            'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
            [req.user.id, solvedOn]
          );
          await tx.run(
            'UPDATE day_logs SET dsa_solved = dsa_solved + 1 WHERE user_id = ? AND log_date = ?',
            [req.user.id, solvedOn]
          );
        } else if (before?.status === 'solved' && req.body.status && req.body.status !== 'solved') {
          const when = before.last_solved_on ?? solvedOn;
          await tx.run(
            'UPDATE day_logs SET dsa_solved = GREATEST(0, dsa_solved - 1) WHERE user_id = ? AND log_date = ?',
            [req.user.id, when]
          );
        }

        return tx.one(
          `SELECT problem_id, status, first_solved_at, last_solved_on, times_solved, times_failed, minutes_spent, notes
             FROM dsa_progress WHERE user_id = ? AND problem_id = ?`,
          [req.user.id, problem.id]
        );
      });

      await recomputeDay(req.user.id, solvedOn);
      const solved = await dsaSolvedTotal(req.user.id);
      return ok(res, { progress: result, solved_total: solved.total });
    } catch (err) {
      return next(err);
    }
  }
);

/* ---------------------------------- PATCH /dsa/topics/:id/progress */

const topicBody = z.object({
  solved: z.coerce.number().int().min(0).max(500).optional(),
  minutes: z.coerce.number().int().min(0).max(100000).optional(),
  notes: optionalText(4000).optional(),
});

router.patch(
  '/dsa/topics/:id/progress',
  validate({ params: z.object({ id: positiveId }), body: topicBody }),
  async (req, res, next) => {
    try {
      const topics = await getDsaTopics();
      const topic = topics.find((t) => Number(t.id) === Number(req.params.id));
      if (!topic) throw notFound('No such topic.');
      await run(
        'INSERT INTO dsa_topic_progress (user_id, topic_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE topic_id = VALUES(topic_id)',
        [req.user.id, topic.id]
      );
      const sets = [];
      const params = [];
      for (const key of ['solved', 'minutes', 'notes']) {
        if (key in req.body) {
          sets.push(`${key} = ?`);
          params.push(req.body[key]);
        }
      }
      if (sets.length) {
        params.push(req.user.id, topic.id);
        await run(`UPDATE dsa_topic_progress SET ${sets.join(', ')} WHERE user_id = ? AND topic_id = ?`, params);
      }
      const row = await one(
        'SELECT topic_id, solved, minutes, notes FROM dsa_topic_progress WHERE user_id = ? AND topic_id = ?',
        [req.user.id, topic.id]
      );
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
