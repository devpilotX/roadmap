/**
 * daily.mjs | Today, the calendar, day logs, week day ticks and study sessions.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, query, run, transaction } from '../../db/pool.mjs';
import { buildToday } from '../../db/today.mjs';
import {
  getCalendarDays,
  getSundays,
  getWeekDays,
  getWeekLinks,
  getWeeks,
} from '../../db/reference.mjs';
import {
  getDayLogs,
  openSession,
  pushesByDate,
  recomputeDay,
  streakState,
  writeDayLog,
} from '../../db/progress.mjs';
import { snoozeWarning, warningsFor } from '../../db/warnings.mjs';
import { ok, badRequest, notFound, ruleViolation } from '../../lib/errors.mjs';
import {
  BLOCKS,
  blockAllowedAt,
  isEditableDate,
  nowDateTime,
  nowInTz,
  todayInTz,
} from '../../lib/dates.mjs';
import { buildIcs } from '../../lib/ics.mjs';
import { isoDate, minutes, positiveId, smallCount, validate, optionalText, boolish } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

/* ------------------------------------------------------------ GET /today */

router.get('/today', async (req, res, next) => {
  try {
    return ok(res, await buildToday(req.user.id));
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------------- GET /warnings */

router.get('/warnings', async (req, res, next) => {
  try {
    const { warnings } = await warningsFor(req.user.id);
    return ok(res, { warnings, count: warnings.length });
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/warnings/:code/snooze',
  validate({ params: z.object({ code: z.string().regex(/^W([1-9]|10)$/) }) }),
  async (req, res, next) => {
    try {
      const result = await snoozeWarning(req.user.id, req.params.code);
      if (!result.ok) throw ruleViolation(result.reason);
      return ok(res, { snoozed: true, code: req.params.code });
    } catch (err) {
      return next(err);
    }
  }
);

/* --------------------------------------------------------- GET /calendar */

const rangeQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
});

router.get('/calendar', validate({ query: rangeQuery }), async (req, res, next) => {
  try {
    const from = req.validQuery.from ?? config.roadmap.firstDay;
    const to = req.validQuery.to ?? config.roadmap.lastDay;
    if (from > to) throw badRequest('from must not be after to.');

    const [cal, weeks, sundays, logs, pushes, streak] = await Promise.all([
      getCalendarDays(),
      getWeeks(),
      getSundays(),
      getDayLogs(req.user.id, from, to),
      pushesByDate(req.user.id, from, to),
      streakState(req.user.id, todayInTz()),
    ]);

    const logByDate = new Map(logs.map((l) => [l.log_date, l]));
    const sundayByDate = new Map(sundays.map((s) => [s.sunday_date, s]));

    const days = cal
      .filter((d) => d.cal_date >= from && d.cal_date <= to)
      .map((d) => {
        const log = logByDate.get(d.cal_date) ?? null;
        const push = pushes.get(d.cal_date) ?? null;
        const colour = streak.byDate.get(d.cal_date)?.colour ?? null;
        return {
          cal_date: d.cal_date,
          week_n: d.week_n,
          day_label: d.day_label,
          kind: d.kind,
          dsa_target: d.dsa_target,
          dsa_solved: log ? Number(log.dsa_solved) : 0,
          day_colour: colour,
          logged: Boolean(log),
          pushes: push ? push.pushes : 0,
          commits: push ? push.commits : 0,
          sunday_kind: sundayByDate.get(d.cal_date)?.kind ?? null,
        };
      });

    return ok(res, {
      from,
      to,
      today: todayInTz(),
      first_day: config.roadmap.firstDay,
      last_day: config.roadmap.lastDay,
      weeks: weeks.map((w) => ({
        n: w.n,
        start_date: w.start_date,
        end_date: w.end_date,
        title: w.title,
        dates_label: w.dates_label,
        phase_code: w.phase_code,
        gate_no: w.gate_no,
      })),
      days,
      streak: streak.current,
    });
  } catch (err) {
    return next(err);
  }
});

/* ---------------------------------------------------- GET /calendar/:date */

router.get(
  '/calendar/:date',
  validate({ params: z.object({ date: isoDate }) }),
  async (req, res, next) => {
    try {
      const date = req.params.date;
      const [cal, weeks, weekDays, weekLinks, sundays] = await Promise.all([
        getCalendarDays(),
        getWeeks(),
        getWeekDays(),
        getWeekLinks(),
        getSundays(),
      ]);
      const day = cal.find((d) => d.cal_date === date);
      if (!day) throw notFound(`${date} is not one of the 150 roadmap days.`);

      const week = day.week_n ? weeks.find((w) => w.n === day.week_n) ?? null : null;
      const weekDay = weekDays.find((wd) => wd.cal_date === date) ?? null;
      const links = week ? weekLinks.filter((l) => l.week_n === week.n) : [];
      const linkIds = links.map((l) => l.id);

      const [log, linkProgress, pushRows, sessions, dayProgress] = await Promise.all([
        one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [req.user.id, date]),
        linkIds.length
          ? query(
              `SELECT week_link_id, status, minutes FROM week_link_progress
                WHERE user_id = ? AND week_link_id IN (${linkIds.map(() => '?').join(',')})`,
              [req.user.id, ...linkIds]
            )
          : Promise.resolve([]),
        query(
          `SELECT r.full_name AS repo, r.counts_to_target, p.commit_count, p.pushed_at, p.message_head, p.source
             FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
            WHERE p.user_id = ? AND p.push_date = ? ORDER BY p.pushed_at`,
          [req.user.id, date]
        ),
        query(
          `SELECT id, block, started_at, ended_at, minutes, source, auto_closed, resource_id, week_link_id
             FROM study_sessions WHERE user_id = ? AND session_date = ? ORDER BY started_at`,
          [req.user.id, date]
        ),
        weekDay
          ? one('SELECT learn_done, build_done FROM week_day_progress WHERE user_id = ? AND week_day_id = ?', [
              req.user.id,
              weekDay.id,
            ])
          : Promise.resolve(null),
      ]);

      const statusByLink = new Map(linkProgress.map((r) => [Number(r.week_link_id), r]));
      const editable = isEditableDate(date, todayInTz());

      return ok(res, {
        day,
        week: week
          ? { n: week.n, title: week.title, dates_label: week.dates_label, focus: week.focus, phase_code: week.phase_code, gate_no: week.gate_no }
          : null,
        week_day: weekDay ? { ...weekDay, ...(dayProgress ?? { learn_done: 0, build_done: 0 }) } : null,
        sunday: sundays.find((s) => s.sunday_date === date) ?? null,
        links: links.map((l) => ({
          id: l.id,
          url: l.url,
          label: l.label,
          resource_id: l.resource_id,
          why: l.resource_why,
          cost: l.resource_cost,
          is_alive: Number(l.is_alive) === 1,
          last_checked: l.last_checked,
          status: statusByLink.get(l.id)?.status ?? 'todo',
          minutes: Number(statusByLink.get(l.id)?.minutes ?? 0),
        })),
        log: log ?? null,
        pushes: pushRows,
        sessions,
        editable: editable.ok,
        editable_reason: editable.reason,
      });
    } catch (err) {
      return next(err);
    }
  }
);

/* ------------------------------------------------------- GET /day-logs */

router.get('/day-logs', validate({ query: rangeQuery }), async (req, res, next) => {
  try {
    const from = req.validQuery.from ?? config.roadmap.firstDay;
    const to = req.validQuery.to ?? config.roadmap.lastDay;
    const logs = await getDayLogs(req.user.id, from, to);
    return ok(res, { from, to, logs });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------- PUT /day-logs/:date */

const dayLogBody = z
  .object({
    dsa_solved: smallCount,
    dsa_minutes: minutes,
    learn_done: boolish,
    learn_minutes: minutes,
    build_done: boolish,
    build_minutes: minutes,
    close_done: boolish,
    close_log_line: optionalText(2000),
    close_tomorrow_dsa: optionalText(255),
    close_tomorrow_build: optionalText(255),
    money_done: boolish,
    money_minutes: minutes,
    night_anki_done: boolish,
    night_spoken_done: boolish,
    night_spoken_aloud: boolish,
    night_tomorrow_done: boolish,
    anki_overdue: smallCount,
    video_minutes: minutes,
    blocked_on: optionalText(2000),
    notes: optionalText(4000),
    dsa_increment: z.coerce.number().int().min(-20).max(20),
  })
  .partial();

router.put(
  '/day-logs/:date',
  validate({ params: z.object({ date: isoDate }), body: dayLogBody }),
  async (req, res, next) => {
    try {
      const date = req.params.date;
      const cal = await getCalendarDays();
      const day = cal.find((d) => d.cal_date === date);
      if (!day) throw notFound(`${date} is not one of the 150 roadmap days.`);
      if (day.kind === 'sunday_rest') {
        const touched = Object.keys(req.body).filter((k) => k !== 'notes');
        if (touched.length) {
          throw ruleViolation(
            'This is a rest Sunday. No code. No screens before noon. This is load bearing. Nothing is tickable except the note field.'
          );
        }
      }

      const patch = { ...req.body };
      if ('dsa_increment' in patch) {
        const current = await one('SELECT dsa_solved FROM day_logs WHERE user_id = ? AND log_date = ?', [
          req.user.id,
          date,
        ]);
        patch.dsa_solved = Math.max(0, Number(current?.dsa_solved ?? 0) + Number(patch.dsa_increment));
        delete patch.dsa_increment;
      }

      // CLOSE cannot be marked done with an empty field.
      if (patch.close_done === true) {
        const current = await one('SELECT * FROM day_logs WHERE user_id = ? AND log_date = ?', [
          req.user.id,
          date,
        ]);
        const line = patch.close_log_line ?? current?.close_log_line;
        const dsa = patch.close_tomorrow_dsa ?? current?.close_tomorrow_dsa;
        const build = patch.close_tomorrow_build ?? current?.close_tomorrow_build;
        if (!String(line ?? '').trim() || !String(dsa ?? '').trim() || !String(build ?? '').trim()) {
          throw ruleViolation(
            'Close needs all three: one log line, tomorrow first DSA problem, and tomorrow first build task. Tomorrow is decided before you stand up.'
          );
        }
      }

      const result = await writeDayLog(req.user.id, date, patch);
      return ok(res, { log: result.log, colour: result.colour });
    } catch (err) {
      return next(err);
    }
  }
);

/* ------------------------------------- PATCH /week-days/:id/progress */

const weekDayBody = z.object({
  learn_done: boolish.optional(),
  build_done: boolish.optional(),
});

router.patch(
  '/week-days/:id/progress',
  validate({ params: z.object({ id: positiveId }), body: weekDayBody }),
  async (req, res, next) => {
    try {
      const weekDays = await getWeekDays();
      const wd = weekDays.find((w) => Number(w.id) === Number(req.params.id));
      if (!wd) throw notFound('No such week day.');

      const today = todayInTz();
      const editable = isEditableDate(wd.cal_date, today);
      if (!editable.ok) throw ruleViolation(`${wd.cal_date}: ${editable.reason}`);

      const result = await transaction(async (tx) => {
        await tx.run(
          `INSERT INTO week_day_progress (user_id, week_day_id, learn_done, build_done, completed_at)
           VALUES (?, ?, 0, 0, NULL)
           ON DUPLICATE KEY UPDATE week_day_id = VALUES(week_day_id)`,
          [req.user.id, wd.id]
        );
        const sets = [];
        const params = [];
        if ('learn_done' in req.body) {
          sets.push('learn_done = ?');
          params.push(req.body.learn_done ? 1 : 0);
        }
        if ('build_done' in req.body) {
          sets.push('build_done = ?');
          params.push(req.body.build_done ? 1 : 0);
        }
        if (sets.length) {
          sets.push('completed_at = CASE WHEN learn_done = 1 AND build_done = 1 THEN COALESCE(completed_at, NOW()) ELSE NULL END');
          params.push(req.user.id, wd.id);
          await tx.run(
            `UPDATE week_day_progress SET ${sets.join(', ')} WHERE user_id = ? AND week_day_id = ?`,
            params
          );
        }
        // The same tick shows on Today, so the day log mirrors it.
        const mirror = [];
        const mirrorParams = [];
        if ('learn_done' in req.body) {
          mirror.push('learn_done = ?');
          mirrorParams.push(req.body.learn_done ? 1 : 0);
        }
        if ('build_done' in req.body) {
          mirror.push('build_done = ?');
          mirrorParams.push(req.body.build_done ? 1 : 0);
        }
        await tx.run(
          'INSERT INTO day_logs (user_id, log_date, week_n) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE week_n = VALUES(week_n)',
          [req.user.id, wd.cal_date, wd.week_n]
        );
        if (mirror.length) {
          mirrorParams.push(req.user.id, wd.cal_date);
          await tx.run(
            `UPDATE day_logs SET ${mirror.join(', ')} WHERE user_id = ? AND log_date = ?`,
            mirrorParams
          );
        }
        const row = await tx.one(
          'SELECT learn_done, build_done, completed_at FROM week_day_progress WHERE user_id = ? AND week_day_id = ?',
          [req.user.id, wd.id]
        );
        return row;
      });

      const colour = await recomputeDay(req.user.id, wd.cal_date);
      return ok(res, { week_day_id: Number(wd.id), cal_date: wd.cal_date, progress: result, colour });
    } catch (err) {
      return next(err);
    }
  }
);

/* --------------------------------------------------------- sessions */

const startBody = z.object({
  block: z.enum(['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT']),
  resource_id: z.union([positiveId, z.null()]).optional(),
  week_link_id: z.union([positiveId, z.null()]).optional(),
});

router.post('/sessions/start', validate({ body: startBody }), async (req, res, next) => {
  try {
    const now = nowInTz();
    const allowed = blockAllowedAt(req.body.block, now.minutes);
    if (!allowed.ok) throw ruleViolation(allowed.message);

    const existing = await openSession(req.user.id);
    if (existing) {
      throw ruleViolation(
        `A ${existing.block} session is already running since ${existing.started_at}. Stop it before starting another.`
      );
    }

    const result = await run(
      `INSERT INTO study_sessions (user_id, block, session_date, resource_id, week_link_id, started_at, source)
       VALUES (?, ?, ?, ?, ?, ?, 'timer')`,
      [
        req.user.id,
        req.body.block,
        now.date,
        req.body.resource_id ?? null,
        req.body.week_link_id ?? null,
        nowDateTime(),
      ]
    );
    const row = await one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
      result.insertId,
      req.user.id,
    ]);
    return ok(res, row, 201);
  } catch (err) {
    return next(err);
  }
});

router.get('/sessions/open', async (req, res, next) => {
  try {
    return ok(res, await openSession(req.user.id));
  } catch (err) {
    return next(err);
  }
});

const MINUTE_COLUMN = {
  DSA: 'dsa_minutes',
  LEARN: 'learn_minutes',
  BUILD: 'build_minutes',
  MONEY: 'money_minutes',
};

router.post(
  '/sessions/:id/stop',
  validate({ params: z.object({ id: positiveId }) }),
  async (req, res, next) => {
    try {
      const session = await one('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [
        req.params.id,
        req.user.id,
      ]);
      if (!session) throw notFound('No such session.');
      if (session.ended_at) return ok(res, session);

      const endedAt = nowDateTime();
      const result = await transaction(async (tx) => {
        await tx.run(
          'UPDATE study_sessions SET ended_at = ?, minutes = GREATEST(0, TIMESTAMPDIFF(MINUTE, started_at, ?)) WHERE id = ? AND user_id = ?',
          [endedAt, endedAt, session.id, req.user.id]
        );
        const row = await tx.one('SELECT * FROM study_sessions WHERE id = ?', [session.id]);
        const column = MINUTE_COLUMN[row.block];
        if (column && Number(row.minutes) > 0) {
          await tx.run(
            'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
            [req.user.id, row.session_date]
          );
          await tx.run(
            `UPDATE day_logs SET ${column} = LEAST(1440, ${column} + ?) WHERE user_id = ? AND log_date = ?`,
            [Number(row.minutes), req.user.id, row.session_date]
          );
        }
        return row;
      });
      await recomputeDay(req.user.id, result.session_date);
      return ok(res, result);
    } catch (err) {
      return next(err);
    }
  }
);

/** Manual session entry, the fallback that always exists. */
const manualBody = z.object({
  block: z.enum(['DSA', 'LEARN', 'BUILD', 'CLOSE', 'MONEY', 'NIGHT']),
  session_date: isoDate,
  minutes: z.coerce.number().int().min(1).max(600),
  note: optionalText(255),
});

router.post('/sessions/manual', validate({ body: manualBody }), async (req, res, next) => {
  try {
    const editable = isEditableDate(req.body.session_date, todayInTz());
    if (!editable.ok) throw ruleViolation(editable.reason);

    // A manual row still respects the block windows, so money time can never be
    // filed as study time after the fact.
    const block = BLOCKS.find((b) => b.code === req.body.block);
    const startMinutes = block ? block.start : 0;
    const allowed = blockAllowedAt(req.body.block, startMinutes);
    if (!allowed.ok) throw ruleViolation(allowed.message);

    const startedAt = `${req.body.session_date} ${String(Math.floor(startMinutes / 60)).padStart(2, '0')}:${String(startMinutes % 60).padStart(2, '0')}:00`;
    const result = await transaction(async (tx) => {
      const ins = await tx.run(
        `INSERT INTO study_sessions (user_id, block, session_date, started_at, ended_at, minutes, source, note)
         VALUES (?, ?, ?, ?, DATE_ADD(?, INTERVAL ? MINUTE), ?, 'manual', ?)`,
        [
          req.user.id,
          req.body.block,
          req.body.session_date,
          startedAt,
          startedAt,
          req.body.minutes,
          req.body.minutes,
          req.body.note ?? null,
        ]
      );
      const column = MINUTE_COLUMN[req.body.block];
      if (column) {
        await tx.run(
          'INSERT INTO day_logs (user_id, log_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_date = VALUES(log_date)',
          [req.user.id, req.body.session_date]
        );
        await tx.run(
          `UPDATE day_logs SET ${column} = LEAST(1440, ${column} + ?) WHERE user_id = ? AND log_date = ?`,
          [req.body.minutes, req.user.id, req.body.session_date]
        );
      }
      return tx.one('SELECT * FROM study_sessions WHERE id = ?', [ins.insertId]);
    });
    await recomputeDay(req.user.id, req.body.session_date);
    return ok(res, result, 201);
  } catch (err) {
    return next(err);
  }
});

router.get('/sessions', validate({ query: z.object({ date: isoDate.optional() }) }), async (req, res, next) => {
  try {
    const date = req.validQuery.date ?? todayInTz();
    const rows = await query(
      `SELECT id, block, session_date, started_at, ended_at, minutes, source, auto_closed, note, resource_id, week_link_id
         FROM study_sessions WHERE user_id = ? AND session_date = ? ORDER BY started_at`,
      [req.user.id, date]
    );
    return ok(res, { date, sessions: rows });
  } catch (err) {
    return next(err);
  }
});

/* -------------------------------------------------- GET /calendar.ics */

router.get('/calendar.ics', async (req, res, next) => {
  try {
    const cal = await getCalendarDays();
    const ics = buildIcs({
      days: cal,
      origin: config.publicOrigin,
      timezone: config.timezone,
      userLabel: req.user.display_name,
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="roadmap-2026-2027.ics"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(ics);
  } catch (err) {
    return next(err);
  }
});

export default router;
