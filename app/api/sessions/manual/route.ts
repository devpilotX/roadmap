/**
 * POST /api/sessions/manual | the fallback that always exists.
 *
 * A manual row still respects the block windows, so money time can never be
 * filed as study time after the fact.
 */

import { transaction } from '@/lib/db/pool';
import { recomputeDay } from '@/lib/db/progress';
import { MINUTE_COLUMN, SESSION_BLOCKS } from '@/lib/db/sessions';
import { ruleViolation } from '@/lib/errors';
import { BLOCKS, blockAllowedAt, isEditableDate, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { isoDate, optionalText, parseBody, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const manualBody = z.object({
  block: z.enum(SESSION_BLOCKS),
  session_date: isoDate,
  minutes: z.coerce.number().int().min(1).max(600),
  note: optionalText(255),
});

export const POST = authedRoute(async ({ request, user }) => {
  const body = await parseBody(request, manualBody);

  const editable = isEditableDate(body.session_date, todayInTz());
  if (!editable.ok) throw ruleViolation(editable.reason!);

  const block = BLOCKS.find((b) => b.code === body.block);
  const startMinutes = block ? block.start : 0;
  const allowed = blockAllowedAt(body.block, startMinutes);
  if (!allowed.ok) throw ruleViolation(allowed.message!);

  const startedAt = `${body.session_date} ${String(Math.floor(startMinutes / 60)).padStart(
    2,
    '0'
  )}:${String(startMinutes % 60).padStart(2, '0')}:00`;

  const result = await transaction(async (tx) => {
    const ins = await tx.run(
      `INSERT INTO study_sessions (user_id, block, session_date, started_at, ended_at, minutes, source, note)
       VALUES (?, ?, ?, ?, DATE_ADD(?, INTERVAL ? MINUTE), ?, 'manual', ?)`,
      [
        user.id,
        body.block,
        body.session_date,
        startedAt,
        startedAt,
        body.minutes,
        body.minutes,
        body.note ?? null,
      ]
    );
    const column = MINUTE_COLUMN[body.block];
    if (column) {
      await tx.run(
        'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
        [user.id, body.session_date]
      );
      await tx.run(
        `UPDATE day_logs SET ${column} = LEAST(1440, ${column} + ?) WHERE user_id = ? AND log_date = ?`,
        [body.minutes, user.id, body.session_date]
      );
    }
    return tx.one('SELECT * FROM study_sessions WHERE id = ?', [ins.insertId]);
  });

  await recomputeDay(user.id, body.session_date);
  return jsonOk(result, 201);
});
