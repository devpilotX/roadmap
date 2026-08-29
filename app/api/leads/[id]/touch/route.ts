/**
 * POST /api/leads/:id/touch
 *
 * One tap logs a touch, moves the lead's status, and schedules the follow up.
 * Follow up 1 is 48 hours later per Part 17.7, so two days is the default.
 */

import { one, transaction } from '@/lib/db/pool';
import { recomputeDay } from '@/lib/db/progress';
import { notFound, ruleViolation } from '@/lib/errors';
import { addDays, isEditableDate, todayInTz } from '@/lib/dates';
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

const touchBody = z.object({
  channel: z.enum(['whatsapp', 'email', 'call', 'walkin', 'instagram']),
  script_code: z.union([z.string().regex(/^S[1-8]$/), z.null()]).optional(),
  reply: z.boolean().optional(),
  notes: optionalText(2000),
  touched_on: isoDate.optional(),
  next_touch_in_days: z.coerce.number().int().min(0).max(60).optional(),
});

export const POST = authedRoute<{ id: string }>(async ({ request, params, user }) => {
  const { id } = parseParams(params, paramsSchema);
  const body = await parseBody(request, touchBody);

  const today = todayInTz();
  const on = body.touched_on ?? today;
  const editable = isEditableDate(on, today);
  if (!editable.ok) throw ruleViolation(editable.reason!);

  const lead = await one('SELECT * FROM leads WHERE id = ? AND user_id = ? AND is_deleted = 0', [
    id,
    user.id,
  ]);
  if (!lead) throw notFound('No such lead.');

  const result = await transaction(async (tx) => {
    const ins = await tx.run(
      `INSERT INTO lead_touches (user_id, lead_id, touched_on, channel, script_code, reply, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        lead.id,
        on,
        body.channel,
        body.script_code ?? null,
        body.reply ? 1 : 0,
        body.notes ?? null,
      ]
    );
    // Follow up 1 is 48 hours later, per Part 17.7. Two days is the default.
    const nextIn = body.next_touch_in_days ?? 2;
    const nextOn = nextIn > 0 ? addDays(on, nextIn) : null;
    const newStatus = body.reply ? 'replied' : lead.status === 'new' ? 'touched' : lead.status;
    await tx.run(
      'UPDATE leads SET last_touch_on = ?, next_touch_on = ?, status = ? WHERE id = ? AND user_id = ?',
      [on, nextOn, newStatus, lead.id, user.id]
    );
    await tx.run(
      'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
      [user.id, on]
    );
    return tx.one('SELECT * FROM lead_touches WHERE id = ?', [ins.insertId]);
  });

  const colour = await recomputeDay(user.id, on);
  return jsonOk({ touch: result, colour }, 201);
});
