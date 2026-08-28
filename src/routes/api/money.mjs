/**
 * money.mjs (routes) | the money hour.
 *
 * The one job of this screen is to make it impossible to end a day without
 * knowing whether the touches happened. Every write here is one tap.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, query, run, transaction } from '../../db/pool.mjs';
import {
  getMoneyGates,
  getMoneyHourShape,
  getMoneyLanes,
  getMoneyMonthTargets,
  getMoneyRefuse,
  getMoneyRules,
  getMoneyScripts,
  getMoneyWeekTargets,
  getMoneyBuyback,
  getMoneyFirstHour,
  getLeadSources,
  getOffers,
  getWeeks,
} from '../../db/reference.mjs';
import { recomputeDay } from '../../db/progress.mjs';
import {
  carePlanFloor,
  dealStats,
  offerLocked,
  rupeeEvents,
  sumBetween,
  sumByMonth,
  totalReceived,
  touchStats,
  touchTargetFromTask,
} from '../../lib/money.mjs';
import { ok, notFound, ruleViolation, badRequest } from '../../lib/errors.mjs';
import { isEditableDate, monthKey, monthLabel, mondayOf, addDays, todayInTz } from '../../lib/dates.mjs';
import { isoDate, optionalText, positiveId, rupees, validate, optionalHttpUrl } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

/* --------------------------------------------------- GET /money/summary */

router.get('/money/summary', async (req, res, next) => {
  try {
    const today = todayInTz();
    const [
      weeks,
      weekTargets,
      monthTargets,
      offers,
      scripts,
      gates,
      rules,
      lanes,
      shape,
      refuse,
      buyback,
      firstHour,
      sources,
    ] = await Promise.all([
      getWeeks(),
      getMoneyWeekTargets(),
      getMoneyMonthTargets(),
      getOffers(),
      getMoneyScripts(),
      getMoneyGates(),
      getMoneyRules(),
      getMoneyLanes(),
      getMoneyHourShape(),
      getMoneyRefuse(),
      getMoneyBuyback(),
      getMoneyFirstHour(),
      getLeadSources(),
    ]);

    const week = weeks.find((w) => today >= w.start_date && today <= w.end_date) ?? null;
    const [events, care, touches, deals, gateResults, leadTally, calDay, versions] = await Promise.all([
      rupeeEvents(req.user.id),
      carePlanFloor(req.user.id),
      touchStats(req.user.id),
      dealStats(req.user.id),
      query(
        'SELECT money_gate_code, passed, passed_at, amount_received, notes FROM money_gate_results WHERE user_id = ?',
        [req.user.id]
      ),
      query(
        'SELECT status, COUNT(*) AS n FROM leads WHERE user_id = ? AND is_deleted = 0 GROUP BY status',
        [req.user.id]
      ),
      one('SELECT money_task FROM calendar_days WHERE cal_date = ?', [today]),
      query(
        'SELECT script_code, MAX(version) AS version FROM money_script_versions WHERE user_id = ? GROUP BY script_code',
        [req.user.id]
      ),
    ]);

    const monthNow = monthKey(today);
    const byMonth = sumByMonth(events);
    const total = totalReceived(events, today);
    const gateResultByCode = new Map(gateResults.map((g) => [g.money_gate_code, g]));
    const versionByCode = new Map(versions.map((v) => [v.script_code, Number(v.version)]));

    const monthTarget =
      monthTargets.find((m) => !m.is_total && monthLabel(monthNow) === m.month_label) ?? null;

    return ok(res, {
      today,
      week: week ? { n: week.n, title: week.title, dates_label: week.dates_label } : null,
      strip: {
        received_this_month: byMonth.get(monthNow) ?? 0,
        month_label: monthLabel(monthNow),
        month_target: monthTarget ? { low: monthTarget.target_low, high: monthTarget.target_high } : null,
        received_total: total,
        target_total: config.roadmap.moneyTargetRupees,
        care_plan_count: care.count,
        care_plan_monthly: care.monthly,
        care_plan_target: 5,
        days_since_last_touch: touches.last_touch
          ? Math.round((new Date(`${today}T00:00:00Z`) - new Date(`${touches.last_touch}T00:00:00Z`)) / 86400000)
          : null,
        days_since_last_rupee: events.length
          ? Math.round(
              (new Date(`${today}T00:00:00Z`) - new Date(`${events[events.length - 1].on}T00:00:00Z`)) / 86400000
            )
          : null,
      },
      week_plan: weekTargets.map((t) => ({
        ...t,
        actual: (() => {
          const w = weeks.find((x) => x.n === t.week_n);
          return w ? sumBetween(events, config.roadmap.firstDay, w.end_date) : 0;
        })(),
        is_current: week?.n === t.week_n,
      })),
      month_plan: monthTargets.map((m) => ({
        ...m,
        actual: m.is_total ? total : byMonth.get(monthKeyFromLabel(m.month_label)) ?? 0,
      })),
      offers: offers.map((o) => ({ ...o, ...offerLocked(o, week?.n ?? 0) })),
      scripts: scripts.map((s) => ({ ...s, latest_version: versionByCode.get(s.code) ?? 1 })),
      money_gates: gates.map((g) => {
        const r = gateResultByCode.get(g.code);
        return {
          ...g,
          passed: Number(r?.passed ?? 0) === 1,
          passed_at: r?.passed_at ?? null,
          amount_received: r?.amount_received ?? null,
          is_past: g.gate_date < today,
          show_if_it_fails: g.gate_date < today && Number(r?.passed ?? 0) !== 1,
        };
      }),
      rules,
      lanes,
      hour_shape: shape,
      refuse,
      buyback,
      first_hour: firstHour,
      lead_sources: sources,
      touches,
      deals,
      pipeline: Object.fromEntries(leadTally.map((r) => [r.status, Number(r.n)])),
      touch_target_today: touchTargetFromTask(calDay?.money_task),
      money_task_today: calDay?.money_task ?? null,
      received_by_month: [...byMonth.entries()].map(([k, v]) => ({ month: k, label: monthLabel(k), amount: v })),
      events,
    });
  } catch (err) {
    return next(err);
  }
});

function monthKeyFromLabel(label) {
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const m = /^([A-Za-z]+)\s+(\d{4})$/.exec(String(label).trim());
  if (!m) return '';
  const idx = MONTHS.indexOf(m[1]);
  if (idx === -1) return '';
  return `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
}

/* ------------------------------------------------------------- GET /leads */

const leadQuery = z.object({
  status: z.enum(['new', 'touched', 'replied', 'quoted', 'won', 'lost', 'dead']).optional(),
  due: z.enum(['today', 'overdue', 'never']).optional(),
  q: z.string().max(120).optional(),
});

router.get('/leads', validate({ query: leadQuery }), async (req, res, next) => {
  try {
    const today = todayInTz();
    const where = ['user_id = ?', 'is_deleted = 0'];
    const params = [req.user.id];
    const f = req.validQuery;
    if (f.status) {
      where.push('status = ?');
      params.push(f.status);
    }
    if (f.due === 'today') {
      where.push('next_touch_on = ?');
      params.push(today);
    } else if (f.due === 'overdue') {
      where.push('next_touch_on < ?');
      params.push(today);
    } else if (f.due === 'never') {
      where.push('last_touch_on IS NULL');
    }
    if (f.q) {
      where.push('(name LIKE ? OR category LIKE ? OR area LIKE ?)');
      params.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
    }
    const leads = await query(
      `SELECT id, name, category, area, phone, website, mobile_broken, rating, reviews,
              status, last_touch_on, next_touch_on, notes,
              (SELECT COUNT(*) FROM lead_touches t WHERE t.lead_id = leads.id) AS touch_count
         FROM leads WHERE ${where.join(' AND ')}
        ORDER BY (next_touch_on IS NULL) DESC, next_touch_on ASC, last_touch_on IS NULL DESC, id ASC`,
      params
    );

    const next15 = await query(
      `SELECT id, name, category, area, phone, website, mobile_broken, rating, reviews, status,
              last_touch_on, next_touch_on
         FROM leads
        WHERE user_id = ? AND is_deleted = 0 AND status NOT IN ('won','lost','dead')
        ORDER BY (next_touch_on IS NULL) DESC, next_touch_on ASC, last_touch_on IS NULL DESC, id ASC
        LIMIT 15`,
      [req.user.id]
    );

    return ok(res, { leads, next_15: next15, count: leads.length, today });
  } catch (err) {
    return next(err);
  }
});

const leadBody = z.object({
  name: z.string().trim().min(1).max(200),
  category: optionalText(120),
  area: optionalText(120),
  phone: optionalText(32),
  website: optionalHttpUrl,
  mobile_broken: z.boolean().optional(),
  rating: z.union([z.coerce.number().min(0).max(5), z.null()]).optional(),
  reviews: z.union([z.coerce.number().int().min(0).max(100000), z.null()]).optional(),
  status: z.enum(['new', 'touched', 'replied', 'quoted', 'won', 'lost', 'dead']).optional(),
  next_touch_on: z.union([isoDate, z.null()]).optional(),
  notes: optionalText(4000),
});

router.post('/leads', validate({ body: leadBody }), async (req, res, next) => {
  try {
    const b = req.body;
    const result = await run(
      `INSERT INTO leads (user_id, name, category, area, phone, website, mobile_broken, rating, reviews, status, next_touch_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        b.name,
        b.category ?? null,
        b.area ?? null,
        b.phone ?? null,
        b.website ?? null,
        b.mobile_broken ? 1 : 0,
        b.rating ?? null,
        b.reviews ?? null,
        b.status ?? 'new',
        b.next_touch_on ?? null,
        b.notes ?? null,
      ]
    );
    const row = await one('SELECT * FROM leads WHERE id = ? AND user_id = ?', [result.insertId, req.user.id]);
    return ok(res, row, 201);
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/leads/:id',
  validate({ params: z.object({ id: positiveId }), body: leadBody.partial() }),
  async (req, res, next) => {
    try {
      const lead = await one('SELECT * FROM leads WHERE id = ? AND user_id = ? AND is_deleted = 0', [
        req.params.id,
        req.user.id,
      ]);
      if (!lead) throw notFound('No such lead.');
      const sets = [];
      const params = [];
      for (const key of Object.keys(leadBody.shape)) {
        if (key in req.body) {
          sets.push(`${key} = ?`);
          params.push(key === 'mobile_broken' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }
      if (sets.length) {
        params.push(req.user.id, lead.id);
        await run(`UPDATE leads SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, params);
        await run(
          `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
           VALUES (?, 'leads', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
          [req.user.id, String(lead.id), JSON.stringify(lead), JSON.stringify(req.body)]
        );
      }
      return ok(res, await one('SELECT * FROM leads WHERE id = ?', [lead.id]));
    } catch (err) {
      return next(err);
    }
  }
);

/** Soft delete only. Nothing is ever hard deleted. */
router.delete('/leads/:id', validate({ params: z.object({ id: positiveId }) }), async (req, res, next) => {
  try {
    const lead = await one('SELECT id FROM leads WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!lead) throw notFound('No such lead.');
    await run('UPDATE leads SET is_deleted = 1 WHERE id = ? AND user_id = ?', [lead.id, req.user.id]);
    await run(
      `INSERT INTO audit_log (user_id, table_name, row_pk, action) VALUES (?, 'leads', ?, 'soft_delete')`,
      [req.user.id, String(lead.id)]
    );
    return ok(res, { id: Number(lead.id), soft_deleted: true });
  } catch (err) {
    return next(err);
  }
});

/* -------------------------------------------------- POST /leads/:id/touch */

const touchBody = z.object({
  channel: z.enum(['whatsapp', 'email', 'call', 'walkin', 'instagram']),
  script_code: z.union([z.string().regex(/^S[1-8]$/), z.null()]).optional(),
  reply: z.boolean().optional(),
  notes: optionalText(2000),
  touched_on: isoDate.optional(),
  next_touch_in_days: z.coerce.number().int().min(0).max(60).optional(),
});

router.post(
  '/leads/:id/touch',
  validate({ params: z.object({ id: positiveId }), body: touchBody }),
  async (req, res, next) => {
    try {
      const today = todayInTz();
      const on = req.body.touched_on ?? today;
      const editable = isEditableDate(on, today);
      if (!editable.ok) throw ruleViolation(editable.reason);

      const lead = await one('SELECT * FROM leads WHERE id = ? AND user_id = ? AND is_deleted = 0', [
        req.params.id,
        req.user.id,
      ]);
      if (!lead) throw notFound('No such lead.');

      const result = await transaction(async (tx) => {
        const ins = await tx.run(
          `INSERT INTO lead_touches (user_id, lead_id, touched_on, channel, script_code, reply, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            lead.id,
            on,
            req.body.channel,
            req.body.script_code ?? null,
            req.body.reply ? 1 : 0,
            req.body.notes ?? null,
          ]
        );
        // Follow up 1 is 48 hours later, per Part 17.7. Two days is the default.
        const nextIn = req.body.next_touch_in_days ?? 2;
        const nextOn = nextIn > 0 ? addDays(on, nextIn) : null;
        const newStatus = req.body.reply ? 'replied' : lead.status === 'new' ? 'touched' : lead.status;
        await tx.run(
          'UPDATE leads SET last_touch_on = ?, next_touch_on = ?, status = ? WHERE id = ? AND user_id = ?',
          [on, nextOn, newStatus, lead.id, req.user.id]
        );
        await tx.run(
          'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
          [req.user.id, on]
        );
        return tx.one('SELECT * FROM lead_touches WHERE id = ?', [ins.insertId]);
      });

      const colour = await recomputeDay(req.user.id, on);
      return ok(res, { touch: result, colour }, 201);
    } catch (err) {
      return next(err);
    }
  }
);

/* -------------------------------------------------- POST /leads/import */

const importBody = z.object({
  csv: z.string().min(1).max(2_000_000),
  dry_run: z.boolean().optional(),
});

/** Matches leads.csv from Appendix B of final.md. */
const LEAD_COLUMNS = [
  'name', 'category', 'area', 'phone', 'website', 'mobile broken', 'rating', 'reviews',
  'status', 'last touch date', 'next touch date', 'notes',
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

router.post('/leads/import', validate({ body: importBody }), async (req, res, next) => {
  try {
    const rows = parseCsv(req.body.csv);
    if (rows.length < 2) throw badRequest('That CSV has a header but no rows.');
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/_/g, ' '));
    const idx = (name) => header.findIndex((h) => h === name || h.startsWith(name));
    const nameCol = idx('name');
    if (nameCol === -1) {
      throw badRequest(
        `That CSV has no name column. The expected columns, from Appendix B, are: ${LEAD_COLUMNS.join(', ')}.`
      );
    }

    const report = { read: rows.length - 1, written: 0, skipped: 0, problems: [] };
    const seen = new Set();
    const toWrite = [];
    for (let i = 1; i < rows.length; i += 1) {
      const r = rows[i];
      const name = String(r[nameCol] ?? '').trim();
      if (!name) {
        report.skipped += 1;
        report.problems.push(`Row ${i + 1}: no name.`);
        continue;
      }
      const key = name.toLowerCase();
      if (seen.has(key)) {
        report.skipped += 1;
        report.problems.push(`Row ${i + 1}: "${name}" appears twice in the file.`);
        continue;
      }
      seen.add(key);
      const get = (col) => {
        const at = idx(col);
        return at === -1 ? null : String(r[at] ?? '').trim() || null;
      };
      const yes = (v) => /^(y|yes|true|1)$/i.test(String(v ?? '').trim());
      const statusRaw = String(get('status') ?? 'new').toLowerCase();
      const status = ['new', 'touched', 'replied', 'quoted', 'won', 'lost', 'dead'].includes(statusRaw)
        ? statusRaw
        : 'new';
      toWrite.push([
        req.user.id,
        name,
        get('category'),
        get('area'),
        get('phone'),
        (() => {
          const w = get('website');
          if (!w) return null;
          return /^https?:\/\//i.test(w) ? w.slice(0, 500) : `https://${w}`.slice(0, 500);
        })(),
        yes(get('mobile broken')) ? 1 : 0,
        (() => {
          const n = Number(get('rating'));
          return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
        })(),
        (() => {
          const n = Number(String(get('reviews') ?? '').replace(/\D/g, ''));
          return Number.isFinite(n) && n > 0 ? n : null;
        })(),
        status,
        /^\d{4}-\d{2}-\d{2}$/.test(get('last touch date') ?? '') ? get('last touch date') : null,
        /^\d{4}-\d{2}-\d{2}$/.test(get('next touch date') ?? '') ? get('next touch date') : null,
        get('notes'),
      ]);
    }

    if (req.body.dry_run) {
      return ok(res, { ...report, dry_run: true, would_write: toWrite.length, sample: toWrite.slice(0, 5).map((r) => r[1]) });
    }

    for (const values of toWrite) {
      const existing = await one('SELECT id FROM leads WHERE user_id = ? AND name = ? AND is_deleted = 0', [
        values[0],
        values[1],
      ]);
      if (existing) {
        report.skipped += 1;
        report.problems.push(`"${values[1]}" is already on the list.`);
        continue;
      }
      await run(
        `INSERT INTO leads (user_id, name, category, area, phone, website, mobile_broken, rating, reviews, status, last_touch_on, next_touch_on, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values
      );
      report.written += 1;
    }
    return ok(res, { ...report, dry_run: false }, 201);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------- GET /deals */

router.get('/deals', async (req, res, next) => {
  try {
    const today = todayInTz();
    const deals = await query(
      `SELECT d.*, l.name AS lead_name, o.name AS offer_name, o.price_low, o.price_high
         FROM deals d
         LEFT JOIN leads l ON l.id = d.lead_id
         JOIN offers o ON o.code = d.offer_code
        WHERE d.user_id = ? AND d.is_deleted = 0
        ORDER BY d.created_at DESC`,
      [req.user.id]
    );
    return ok(res, {
      today,
      deals: deals.map((d) => ({
        ...d,
        overdue:
          Boolean(d.delivery_due) &&
          d.delivery_due < today &&
          !['delivered', 'paid', 'dead', 'refunded'].includes(d.status),
        days_to_delivery: d.delivery_due
          ? Math.round((new Date(`${d.delivery_due}T00:00:00Z`) - new Date(`${today}T00:00:00Z`)) / 86400000)
          : null,
      })),
      stats: await dealStats(req.user.id),
    });
  } catch (err) {
    return next(err);
  }
});

const dealBody = z.object({
  lead_id: z.union([positiveId, z.null()]).optional(),
  client_name: z.string().trim().min(1).max(200),
  offer_code: z.string().regex(/^O[1-8]$/),
  price: rupees,
  advance_amount: z.union([rupees, z.null()]).optional(),
  advance_on: z.union([isoDate, z.null()]).optional(),
  delivery_due: z.union([isoDate, z.null()]).optional(),
  delivered_on: z.union([isoDate, z.null()]).optional(),
  balance_amount: z.union([rupees, z.null()]).optional(),
  balance_on: z.union([isoDate, z.null()]).optional(),
  status: z
    .enum(['quoted', 'advance_paid', 'in_delivery', 'delivered', 'paid', 'refunded', 'dead'])
    .optional(),
  referral_asked: z.boolean().optional(),
  notes: optionalText(4000),
});

async function assertDealRules(userId, body, existing = {}) {
  const merged = { ...existing, ...body };
  const offers = await getOffers();
  const offer = offers.find((o) => o.code === merged.offer_code);
  if (!offer) throw notFound('No such offer code.');

  const today = todayInTz();
  const weeks = await getWeeks();
  const week = weeks.find((w) => today >= w.start_date && today <= w.end_date);
  const lock = offerLocked(offer, week?.n ?? 0);
  if (lock.locked) throw ruleViolation(lock.reason);

  if (Number(merged.price) < Number(offer.price_low)) {
    throw ruleViolation(
      `${offer.code} has a floor of Rs ${Number(offer.price_low).toLocaleString('en-IN')}. Quote at the top of the band, settle in the middle, never go under the floor.`
    );
  }
  const status = merged.status ?? 'quoted';
  if (['in_delivery', 'delivered', 'paid'].includes(status)) {
    if (!merged.advance_on || !Number(merged.advance_amount)) {
      throw ruleViolation(
        'Fifty per cent advance before you start. No advance, no work. A deal cannot move to delivery without an advance date and an advance amount.'
      );
    }
  }
  if (status === 'paid' && !merged.balance_on) {
    throw ruleViolation('A deal cannot be marked paid without a balance date.');
  }
  return offer;
}

router.post('/deals', validate({ body: dealBody }), async (req, res, next) => {
  try {
    await assertDealRules(req.user.id, req.body);
    const b = req.body;
    const result = await run(
      `INSERT INTO deals (user_id, lead_id, client_name, offer_code, price, advance_amount, advance_on,
                          delivery_due, delivered_on, balance_amount, balance_on, status, referral_asked, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        b.lead_id ?? null,
        b.client_name,
        b.offer_code,
        b.price,
        b.advance_amount ?? null,
        b.advance_on ?? null,
        b.delivery_due ?? null,
        b.delivered_on ?? null,
        b.balance_amount ?? null,
        b.balance_on ?? null,
        b.status ?? 'quoted',
        b.referral_asked ? 1 : 0,
        b.notes ?? null,
      ]
    );
    return ok(res, await one('SELECT * FROM deals WHERE id = ?', [result.insertId]), 201);
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/deals/:id',
  validate({ params: z.object({ id: positiveId }), body: dealBody.partial() }),
  async (req, res, next) => {
    try {
      const deal = await one('SELECT * FROM deals WHERE id = ? AND user_id = ? AND is_deleted = 0', [
        req.params.id,
        req.user.id,
      ]);
      if (!deal) throw notFound('No such deal.');
      await assertDealRules(req.user.id, req.body, deal);

      const sets = [];
      const params = [];
      for (const key of Object.keys(dealBody.shape)) {
        if (key in req.body) {
          sets.push(`${key} = ?`);
          params.push(key === 'referral_asked' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }
      if (sets.length) {
        params.push(req.user.id, deal.id);
        await run(`UPDATE deals SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, params);
        await run(
          `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
           VALUES (?, 'deals', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
          [req.user.id, String(deal.id), JSON.stringify(deal), JSON.stringify(req.body)]
        );
      }
      return ok(res, await one('SELECT * FROM deals WHERE id = ?', [deal.id]));
    } catch (err) {
      return next(err);
    }
  }
);

/* -------------------------------------------------------- GET /care-plans */

router.get('/care-plans', async (req, res, next) => {
  try {
    const plans = await query(
      'SELECT * FROM care_plans WHERE user_id = ? AND is_deleted = 0 ORDER BY active DESC, started_on',
      [req.user.id]
    );
    return ok(res, { care_plans: plans, floor: await carePlanFloor(req.user.id), target: 5 });
  } catch (err) {
    return next(err);
  }
});

const carePlanBody = z.object({
  client_name: z.string().trim().min(1).max(200),
  monthly_amount: rupees,
  started_on: isoDate,
  active: z.boolean().optional(),
  last_invoice_on: z.union([isoDate, z.null()]).optional(),
  notes: optionalText(4000),
});

router.post('/care-plans', validate({ body: carePlanBody }), async (req, res, next) => {
  try {
    const b = req.body;
    if (b.monthly_amount < 1200) {
      throw ruleViolation('O8 has a floor of Rs 1,200 a month. Never go under the floor.');
    }
    const result = await run(
      `INSERT INTO care_plans (user_id, client_name, monthly_amount, started_on, active, last_invoice_on, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        b.client_name,
        b.monthly_amount,
        b.started_on,
        b.active === false ? 0 : 1,
        b.last_invoice_on ?? null,
        b.notes ?? null,
      ]
    );
    return ok(res, await one('SELECT * FROM care_plans WHERE id = ?', [result.insertId]), 201);
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/care-plans/:id',
  validate({ params: z.object({ id: positiveId }), body: carePlanBody.partial() }),
  async (req, res, next) => {
    try {
      const plan = await one('SELECT * FROM care_plans WHERE id = ? AND user_id = ? AND is_deleted = 0', [
        req.params.id,
        req.user.id,
      ]);
      if (!plan) throw notFound('No such care plan.');
      const sets = [];
      const params = [];
      for (const key of Object.keys(carePlanBody.shape)) {
        if (key in req.body) {
          sets.push(`${key} = ?`);
          params.push(key === 'active' ? (req.body[key] ? 1 : 0) : req.body[key]);
        }
      }
      if (sets.length) {
        params.push(req.user.id, plan.id);
        await run(`UPDATE care_plans SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, params);
      }
      return ok(res, await one('SELECT * FROM care_plans WHERE id = ?', [plan.id]));
    } catch (err) {
      return next(err);
    }
  }
);

/* ----------------------------------------------------- GET /money/scripts */

router.get('/money/scripts', async (req, res, next) => {
  try {
    const [scripts, versions, profile] = await Promise.all([
      getMoneyScripts(),
      query('SELECT id, script_code, version, title, body, created_at FROM money_script_versions WHERE user_id = ? ORDER BY script_code, version', [
        req.user.id,
      ]),
      one('SELECT upi_id, phone, site_1, site_2 FROM profiles WHERE user_id = ?', [req.user.id]),
    ]);
    return ok(res, {
      scripts,
      versions,
      substitutions: {
        '{{business}}': 'the business name',
        '{{price}}': 'the quoted price',
        '[upi id]': profile?.upi_id ?? 'set your UPI id on /profile',
        '[url]': 'the live URL you are delivering',
      },
      note:
        'Editing a script creates a new version. The original from Part 17.7 is never overwritten.',
    });
  } catch (err) {
    return next(err);
  }
});

const scriptVersionBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
});

router.post(
  '/money/scripts/:code/version',
  validate({ params: z.object({ code: z.string().regex(/^S[1-8]$/) }), body: scriptVersionBody }),
  async (req, res, next) => {
    try {
      const scripts = await getMoneyScripts();
      const script = scripts.find((s) => s.code === req.params.code);
      if (!script) throw notFound('No such script.');
      const latest = await one(
        'SELECT COALESCE(MAX(version), 1) AS v FROM money_script_versions WHERE user_id = ? AND script_code = ?',
        [req.user.id, script.code]
      );
      const version = Number(latest?.v ?? 1) + 1;
      await run(
        'INSERT INTO money_script_versions (user_id, script_code, version, title, body) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, script.code, version, req.body.title, req.body.body]
      );
      return ok(res, { code: script.code, version, original_preserved: true }, 201);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
