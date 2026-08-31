/**
 * POST /api/leads/:id/touch
 *
 * One tap logs a touch, moves the lead's status, and schedules the follow up.
 * Follow up 1 is 48 hours later per Part 17.7, so two days is the default.
 *
 * Idempotent by lead and day: a repeated POST for a lead already touched today
 * changes nothing and returns the touch already recorded, with 200 rather than
 * 201 and already_logged set. The reason is in the transaction below.
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
    // One touch per lead per day, and a second request for the same day returns
    // the row already there rather than adding to it.
    //
    // This is not tidiness, it is the difference between a correct day colour
    // and a wrong one. money_touches is never sent by the client: recomputeDay
    // in lib/db/progress.ts derives it as COUNT(*) of lead_touches for the date.
    // lib/client/offline.ts replays a POST that failed on the network, with the
    // same body, so on a patchy connection one tap used to leave two rows, the
    // day's touch count read one higher than the work actually done, and a day
    // that had not met the money condition could show green.
    //
    // FOR UPDATE makes the check and the write a single step. There is no unique
    // key on (user_id, lead_id, touched_on) yet, so what serialises two
    // simultaneous taps here is the gap lock InnoDB takes on idx_touch_lead for
    // a locking read that matches nothing. That closes the race; the unique key
    // is the durable fix and is stated for the migration rather than written
    // here, because this file does not own the schema.
    const existing = await tx.one(
      `SELECT * FROM lead_touches
        WHERE user_id = ? AND lead_id = ? AND touched_on = ?
        ORDER BY id
        LIMIT 1
        FOR UPDATE`,
      [user.id, lead.id, on]
    );
    if (existing) return { touch: existing, inserted: false };

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
    const touch = await tx.one('SELECT * FROM lead_touches WHERE id = ?', [ins.insertId]);
    return { touch, inserted: true };
  });

  // Recomputed either way. On a replay nothing changed, so this returns the
  // colour the day already had, which is the state the caller asked for.
  const colour = await recomputeDay(user.id, on);
  return jsonOk(
    { touch: result.touch, colour, already_logged: !result.inserted },
    result.inserted ? 201 : 200
  );
});
