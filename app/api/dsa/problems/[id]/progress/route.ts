/**
 * PATCH /api/dsa/problems/:id/progress
 *
 * The per day count and the per problem state have to agree, so marking a problem
 * solved increments that day's count and unmarking it decrements the day it was
 * originally solved on.
 */

import { one, transaction, type SqlParam } from '@/lib/db/pool';
import { dsaSolvedTotal, recomputeDay } from '@/lib/db/progress';
import { notFound, ruleViolation } from '@/lib/errors';
import { isEditableDate, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import {
  isoDate,
  optionalText,
  parseBody,
  parseParams,
  positiveId,
  z,
} from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ id: positiveId });

const problemBody = z.object({
  status: z.enum(['todo', 'solved', 'revisit', 'failed_twice']).optional(),
  minutes_spent: z.coerce.number().int().min(0).max(10000).optional(),
  notes: optionalText(4000).optional(),
  solved_on: isoDate.optional(),
});

export const PATCH = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, problemBody);

  const problem = await one('SELECT id, name, topic_id FROM dsa_problems WHERE id = ?', [id]);
  if (!problem) throw notFound('No such problem.');

  const today = todayInTz();
  const solvedOn = body.solved_on ?? today;
  if (body.status === 'solved') {
    const editable = isEditableDate(solvedOn, today);
    if (!editable.ok) throw ruleViolation(editable.reason!);
  }

  const result = await transaction(async (tx) => {
    const before = await tx.one(
      'SELECT status, times_solved, times_failed, last_solved_on FROM dsa_progress WHERE user_id = ? AND problem_id = ?',
      [user.id, problem.id]
    );
    await tx.run(
      'INSERT INTO dsa_progress (user_id, problem_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE problem_id = VALUES(problem_id)',
      [user.id, problem.id]
    );

    const sets: string[] = [];
    const setParams: SqlParam[] = [];
    if (body.status) {
      sets.push('status = ?');
      setParams.push(body.status);
      if (body.status === 'solved') {
        sets.push('first_solved_at = COALESCE(first_solved_at, NOW())');
        sets.push('last_solved_on = ?');
        setParams.push(solvedOn);
        if (before?.status !== 'solved') sets.push('times_solved = times_solved + 1');
      }
      if (body.status === 'failed_twice' && before?.status !== 'failed_twice') {
        sets.push('times_failed = times_failed + 1');
      }
    }
    if (body.minutes_spent !== undefined) {
      sets.push('minutes_spent = ?');
      setParams.push(body.minutes_spent);
    }
    if (body.notes !== undefined) {
      sets.push('notes = ?');
      setParams.push(body.notes);
    }
    if (sets.length) {
      setParams.push(user.id, problem.id);
      await tx.run(
        `UPDATE dsa_progress SET ${sets.join(', ')} WHERE user_id = ? AND problem_id = ?`,
        setParams
      );
    }

    // The per day count must agree with the per problem state.
    if (body.status === 'solved' && before?.status !== 'solved') {
      await tx.run(
        'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
        [user.id, solvedOn]
      );
      await tx.run(
        'UPDATE day_logs SET dsa_solved = dsa_solved + 1 WHERE user_id = ? AND log_date = ?',
        [user.id, solvedOn]
      );
    } else if (before?.status === 'solved' && body.status && body.status !== 'solved') {
      const when = (before.last_solved_on as string) ?? solvedOn;
      await tx.run(
        'UPDATE day_logs SET dsa_solved = GREATEST(0, dsa_solved - 1) WHERE user_id = ? AND log_date = ?',
        [user.id, when]
      );
    }

    return tx.one(
      `SELECT problem_id, status, first_solved_at, last_solved_on, times_solved, times_failed, minutes_spent, notes
         FROM dsa_progress WHERE user_id = ? AND problem_id = ?`,
      [user.id, problem.id]
    );
  });

  await recomputeDay(user.id, solvedOn);
  const solved = await dsaSolvedTotal(user.id);
  return jsonOk({ progress: result, solved_total: solved.total });
});
