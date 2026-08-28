/**
 * plan.mjs | weeks, the library, projects, gates and Sundays.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, query, run, transaction } from '../../db/pool.mjs';
import {
  getGates,
  getMoneyGates,
  getProjects,
  getReadmeSections,
  getResourceCategories,
  getResources,
  getSundays,
  getWeekDays,
  getWeekLinks,
  getWeekLists,
  getWeeks,
  getPhases,
} from '../../db/reference.mjs';
import { completedWeeks, recomputeDay } from '../../db/progress.mjs';
import { ok, notFound, ruleViolation } from '../../lib/errors.mjs';
import { daysBetween, nowDateTime, todayInTz, isEditableDate } from '../../lib/dates.mjs';
import {
  httpUrl,
  isoDate,
  optionalText,
  positiveId,
  validate,
  weekNumber,
  z as zz,
} from '../../middleware/validate.mjs';

const router = Router();

/* ------------------------------------------------------------- GET /weeks */

router.get('/weeks', async (req, res, next) => {
  try {
    const [weeks, phases, gates, sundays, progress, links] = await Promise.all([
      getWeeks(),
      getPhases(),
      getGates(),
      getSundays(),
      completedWeeks(req.user.id),
      getWeekLinks(),
    ]);
    const byWeek = new Map(progress.perWeek.map((p) => [p.week_n, p]));
    const linkCount = new Map();
    for (const l of links) linkCount.set(l.week_n, (linkCount.get(l.week_n) ?? 0) + 1);
    const today = todayInTz();

    return ok(res, {
      today,
      phases,
      gates,
      weeks: weeks.map((w) => ({
        ...w,
        progress: byWeek.get(w.n) ?? { percent: 0, learn_done: 0, build_done: 0, complete: false },
        link_count: linkCount.get(w.n) ?? 0,
        sunday: sundays.find((s) => s.week_n === w.n) ?? null,
        is_current: today >= w.start_date && today <= w.end_date,
        is_past: w.end_date < today,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

/* ---------------------------------------------------------- GET /weeks/:n */

router.get('/weeks/:n', validate({ params: z.object({ n: weekNumber }) }), async (req, res, next) => {
  try {
    const n = req.params.n;
    const [weeks, phases, weekDays, links, lists, sundays, gates] = await Promise.all([
      getWeeks(),
      getPhases(),
      getWeekDays(),
      getWeekLinks(),
      getWeekLists(),
      getSundays(),
      getGates(),
    ]);
    const week = weeks.find((w) => w.n === n);
    if (!week) throw notFound(`There is no week ${n}. The roadmap has 21.`);

    const days = weekDays.filter((d) => d.week_n === n);
    const dayIds = days.map((d) => d.id);
    const weekLinks = links.filter((l) => l.week_n === n);
    const linkIds = weekLinks.map((l) => l.id);

    const [dayProgress, linkProgress, logs] = await Promise.all([
      dayIds.length
        ? query(
            `SELECT week_day_id, learn_done, build_done, completed_at FROM week_day_progress
              WHERE user_id = ? AND week_day_id IN (${dayIds.map(() => '?').join(',')})`,
            [req.user.id, ...dayIds]
          )
        : Promise.resolve([]),
      linkIds.length
        ? query(
            `SELECT week_link_id, status, minutes, notes FROM week_link_progress
              WHERE user_id = ? AND week_link_id IN (${linkIds.map(() => '?').join(',')})`,
            [req.user.id, ...linkIds]
          )
        : Promise.resolve([]),
      query(
        'SELECT log_date, dsa_solved, day_colour, pushes FROM day_logs WHERE user_id = ? AND log_date BETWEEN ? AND ?',
        [req.user.id, week.start_date, week.end_date]
      ),
    ]);

    const dp = new Map(dayProgress.map((r) => [Number(r.week_day_id), r]));
    const lp = new Map(linkProgress.map((r) => [Number(r.week_link_id), r]));
    const logByDate = new Map(logs.map((l) => [l.log_date, l]));

    return ok(res, {
      week,
      phase: phases.find((p) => p.code === week.phase_code) ?? null,
      gate: week.gate_no ? gates.find((g) => Number(g.no) === Number(week.gate_no)) ?? null : null,
      sunday: sundays.find((s) => s.week_n === n) ?? null,
      learn: lists.learn.filter((r) => r.week_n === n),
      build: lists.build.filter((r) => r.week_n === n),
      ships: lists.ships.filter((r) => r.week_n === n),
      trap: lists.traps.find((r) => r.week_n === n)?.text ?? null,
      note: lists.notes.find((r) => r.week_n === n)?.text ?? null,
      days: days.map((d) => ({
        ...d,
        learn_done: Number(dp.get(Number(d.id))?.learn_done ?? 0) === 1,
        build_done: Number(dp.get(Number(d.id))?.build_done ?? 0) === 1,
        completed_at: dp.get(Number(d.id))?.completed_at ?? null,
        dsa_solved: Number(logByDate.get(d.cal_date)?.dsa_solved ?? 0),
        day_colour: logByDate.get(d.cal_date)?.day_colour ?? null,
        pushes: Number(logByDate.get(d.cal_date)?.pushes ?? 0),
        editable: isEditableDate(d.cal_date, todayInTz()).ok,
      })),
      links: weekLinks.map((l) => ({
        id: l.id,
        url: l.url,
        label: l.label,
        resource_id: l.resource_id,
        why: l.resource_why,
        cost: l.resource_cost,
        is_alive: Number(l.is_alive) === 1,
        last_checked: l.last_checked,
        status: lp.get(l.id)?.status ?? 'todo',
        minutes: Number(lp.get(l.id)?.minutes ?? 0),
        notes: lp.get(l.id)?.notes ?? '',
      })),
      neighbours: { prev: n > 1 ? n - 1 : null, next: n < 21 ? n + 1 : null },
    });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------------- GET /resources */

const resourceQuery = z.object({
  category: z.coerce.number().int().min(1).max(20).optional(),
  week: weekNumber.optional(),
  cost: z.string().max(40).optional(),
  status: z.enum(['todo', 'reading', 'done']).optional(),
  q: z.string().max(120).optional(),
});

router.get('/resources', validate({ query: resourceQuery }), async (req, res, next) => {
  try {
    const [categories, resources, progress] = await Promise.all([
      getResourceCategories(),
      getResources(),
      query('SELECT resource_id, status, minutes, rating, notes, completed_at FROM resource_progress WHERE user_id = ?', [
        req.user.id,
      ]),
    ]);
    const byId = new Map(progress.map((p) => [Number(p.resource_id), p]));
    const f = req.validQuery;

    let rows = resources.map((r) => ({
      ...r,
      is_alive: Number(r.is_alive) === 1,
      weeks: r.weeks_csv ? r.weeks_csv.split(',').map(Number) : [],
      status: byId.get(Number(r.id))?.status ?? 'todo',
      minutes: Number(byId.get(Number(r.id))?.minutes ?? 0),
      rating: byId.get(Number(r.id))?.rating ?? null,
      notes: byId.get(Number(r.id))?.notes ?? '',
    }));

    if (f.category) rows = rows.filter((r) => Number(r.category_no) === f.category);
    if (f.week) rows = rows.filter((r) => r.weeks.includes(f.week));
    if (f.cost) rows = rows.filter((r) => r.cost.toLowerCase().includes(f.cost.toLowerCase()));
    if (f.status) rows = rows.filter((r) => r.status === f.status);
    if (f.q) {
      const q = f.q.toLowerCase();
      rows = rows.filter(
        (r) => r.label.toLowerCase().includes(q) || r.why.toLowerCase().includes(q) || r.category_name.toLowerCase().includes(q)
      );
    }

    const tally = { todo: 0, reading: 0, done: 0 };
    for (const r of rows) tally[r.status] += 1;

    return ok(res, {
      categories,
      resources: rows,
      total: resources.length,
      shown: rows.length,
      tally,
      dead: resources.filter((r) => Number(r.is_alive) === 0).length,
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------ PATCH /resources/:id/progress */

const progressBody = z.object({
  status: z.enum(['todo', 'reading', 'done']).optional(),
  minutes: z.coerce.number().int().min(0).max(100000).optional(),
  rating: z.union([z.coerce.number().int().min(1).max(5), z.null()]).optional(),
  notes: optionalText(4000).optional(),
});

router.patch(
  '/resources/:id/progress',
  validate({ params: z.object({ id: positiveId }), body: progressBody }),
  async (req, res, next) => {
    try {
      const resources = await getResources();
      const resource = resources.find((r) => Number(r.id) === Number(req.params.id));
      if (!resource) throw notFound('No such resource.');

      const row = await writeLinkProgress(req.user.id, { resourceId: resource.id, patch: req.body });
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

/* ---------------------------------- PATCH /week-links/:id/progress */

router.patch(
  '/week-links/:id/progress',
  validate({ params: z.object({ id: positiveId }), body: progressBody }),
  async (req, res, next) => {
    try {
      const links = await getWeekLinks();
      const link = links.find((l) => Number(l.id) === Number(req.params.id));
      if (!link) throw notFound('No such week link.');
      const row = await writeLinkProgress(req.user.id, {
        weekLinkId: link.id,
        resourceId: link.resource_id,
        patch: req.body,
      });
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * Writes link progress. When a week link maps to a library row, both rows are
 * written in one transaction, so /weeks and /library can never disagree.
 */
async function writeLinkProgress(userId, { resourceId = null, weekLinkId = null, patch }) {
  return transaction(async (tx) => {
    const now = nowDateTime();
    const status = patch.status;
    const setStarted = status === 'reading' || status === 'done';
    const setDone = status === 'done';

    if (resourceId) {
      await tx.run(
        'INSERT INTO resource_progress (user_id, resource_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE resource_id = VALUES(resource_id)',
        [userId, resourceId]
      );
      const sets = [];
      const params = [];
      if (status) {
        sets.push('status = ?');
        params.push(status);
      }
      if (patch.minutes !== undefined) {
        sets.push('minutes = ?');
        params.push(patch.minutes);
      }
      if (patch.rating !== undefined) {
        sets.push('rating = ?');
        params.push(patch.rating);
      }
      if (patch.notes !== undefined) {
        sets.push('notes = ?');
        params.push(patch.notes);
      }
      if (setStarted) {
        sets.push('started_at = COALESCE(started_at, ?)');
        params.push(now);
      }
      if (status) {
        sets.push('completed_at = ?');
        params.push(setDone ? now : null);
      }
      if (sets.length) {
        params.push(userId, resourceId);
        await tx.run(
          `UPDATE resource_progress SET ${sets.join(', ')} WHERE user_id = ? AND resource_id = ?`,
          params
        );
      }
    }

    if (weekLinkId) {
      await tx.run(
        'INSERT INTO week_link_progress (user_id, week_link_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE week_link_id = VALUES(week_link_id)',
        [userId, weekLinkId]
      );
      const sets = [];
      const params = [];
      if (status) {
        sets.push('status = ?');
        params.push(status);
      }
      if (patch.minutes !== undefined) {
        sets.push('minutes = ?');
        params.push(patch.minutes);
      }
      if (patch.notes !== undefined) {
        sets.push('notes = ?');
        params.push(patch.notes);
      }
      if (setStarted) {
        sets.push('started_at = COALESCE(started_at, ?)');
        params.push(now);
      }
      if (status) {
        sets.push('completed_at = ?');
        params.push(setDone ? now : null);
      }
      if (sets.length) {
        params.push(userId, weekLinkId);
        await tx.run(
          `UPDATE week_link_progress SET ${sets.join(', ')} WHERE user_id = ? AND week_link_id = ?`,
          params
        );
      }
    }

    return {
      resource_id: resourceId,
      week_link_id: weekLinkId,
      status: status ?? null,
      synced_both: Boolean(resourceId && weekLinkId),
    };
  });
}

/* ------------------------------------------------- POST /resources/open */

const openBody = z.object({
  resource_id: z.union([positiveId, z.null()]).optional(),
  week_link_id: z.union([positiveId, z.null()]).optional(),
});

router.post('/resources/open', validate({ body: openBody }), async (req, res, next) => {
  try {
    let resourceId = req.body.resource_id ?? null;
    const weekLinkId = req.body.week_link_id ?? null;
    if (!resourceId && weekLinkId) {
      const links = await getWeekLinks();
      resourceId = links.find((l) => Number(l.id) === Number(weekLinkId))?.resource_id ?? null;
    }
    if (!resourceId && !weekLinkId) throw notFound('Nothing to open.');

    // Only a todo becomes reading. A done link stays done.
    const current = resourceId
      ? await one('SELECT status FROM resource_progress WHERE user_id = ? AND resource_id = ?', [
          req.user.id,
          resourceId,
        ])
      : await one('SELECT status FROM week_link_progress WHERE user_id = ? AND week_link_id = ?', [
          req.user.id,
          weekLinkId,
        ]);
    const status = !current || current.status === 'todo' ? 'reading' : current.status;

    await writeLinkProgress(req.user.id, { resourceId, weekLinkId, patch: { status } });
    return ok(res, { resource_id: resourceId, week_link_id: weekLinkId, status });
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------------- GET /projects */

router.get('/projects', async (req, res, next) => {
  try {
    const [projects, sections, weeks] = await Promise.all([getProjects(), getReadmeSections(), getWeeks()]);
    const progress = await query(
      'SELECT project_id, status, live_url, repo_url, readme_done_json, notes FROM project_progress WHERE user_id = ?',
      [req.user.id]
    );
    const byId = new Map(progress.map((p) => [Number(p.project_id), p]));
    const today = todayInTz();
    const currentWeek = weeks.find((w) => today >= w.start_date && today <= w.end_date)?.n ?? null;

    const pushRows = await query(
      `SELECT r.project_id, COUNT(*) AS pushes, COALESCE(SUM(p.commit_count),0) AS commits
         FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
        WHERE p.user_id = ? AND r.project_id IS NOT NULL
          AND p.push_date >= DATE_SUB(?, INTERVAL WEEKDAY(?) DAY)
        GROUP BY r.project_id`,
      [req.user.id, today, today]
    );
    const pushByProject = new Map(pushRows.map((r) => [Number(r.project_id), r]));

    return ok(res, {
      readme_sections: sections,
      current_week: currentWeek,
      projects: projects.map((p) => {
        const row = byId.get(Number(p.id));
        let done = [];
        if (row?.readme_done_json) {
          try {
            done = typeof row.readme_done_json === 'string' ? JSON.parse(row.readme_done_json) : row.readme_done_json;
          } catch {
            done = [];
          }
        }
        return {
          ...p,
          status: row?.status ?? 'not_started',
          live_url: row?.live_url ?? null,
          repo_url: row?.repo_url ?? null,
          notes: row?.notes ?? '',
          readme_done: Array.isArray(done) ? done : [],
          readme_percent: Math.round(((Array.isArray(done) ? done.length : 0) / sections.length) * 100),
          is_active: currentWeek !== null && currentWeek >= p.week_from && currentWeek <= p.week_to,
          pushes_this_week: Number(pushByProject.get(Number(p.id))?.pushes ?? 0),
          commits_this_week: Number(pushByProject.get(Number(p.id))?.commits ?? 0),
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
});

const projectBody = z.object({
  status: z.enum(['not_started', 'in_progress', 'shipped', 'live']).optional(),
  live_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  repo_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  readme_done: z.array(z.coerce.number().int().min(1).max(50)).max(50).optional(),
  notes: optionalText(4000).optional(),
});

router.patch(
  '/projects/:id/progress',
  validate({ params: z.object({ id: positiveId }), body: projectBody }),
  async (req, res, next) => {
    try {
      const projects = await getProjects();
      const project = projects.find((p) => Number(p.id) === Number(req.params.id));
      if (!project) throw notFound('No such project.');

      await run(
        'INSERT INTO project_progress (user_id, project_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE project_id = VALUES(project_id)',
        [req.user.id, project.id]
      );
      const sets = [];
      const params = [];
      for (const [key, column] of [
        ['status', 'status'],
        ['live_url', 'live_url'],
        ['repo_url', 'repo_url'],
        ['notes', 'notes'],
      ]) {
        if (key in req.body) {
          sets.push(`${column} = ?`);
          params.push(req.body[key] === '' ? null : req.body[key]);
        }
      }
      if (req.body.readme_done) {
        const unique = [...new Set(req.body.readme_done)].sort((a, b) => a - b);
        sets.push('readme_done_json = CAST(? AS JSON)');
        params.push(JSON.stringify(unique));
      }
      if (sets.length) {
        params.push(req.user.id, project.id);
        await run(`UPDATE project_progress SET ${sets.join(', ')} WHERE user_id = ? AND project_id = ?`, params);
      }
      const row = await one(
        'SELECT project_id, status, live_url, repo_url, readme_done_json, notes FROM project_progress WHERE user_id = ? AND project_id = ?',
        [req.user.id, project.id]
      );
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

/* ------------------------------------------------------------ GET /gates */

router.get('/gates', async (req, res, next) => {
  try {
    const [gates, moneyGates, weeks] = await Promise.all([getGates(), getMoneyGates(), getWeeks()]);
    const [results, moneyResults] = await Promise.all([
      query('SELECT gate_no, passed, passed_at, evidence_url, notes FROM gate_results WHERE user_id = ?', [
        req.user.id,
      ]),
      query(
        'SELECT money_gate_code, passed, passed_at, amount_received, notes FROM money_gate_results WHERE user_id = ?',
        [req.user.id]
      ),
    ]);
    const byNo = new Map(results.map((r) => [Number(r.gate_no), r]));
    const byCode = new Map(moneyResults.map((r) => [r.money_gate_code, r]));
    const today = todayInTz();

    return ok(res, {
      today,
      gates: gates.map((g) => {
        const r = byNo.get(Number(g.no));
        return {
          ...g,
          week_title: weeks.find((w) => w.n === g.week_n)?.title ?? null,
          days_remaining: daysBetween(today, g.gate_date),
          is_past: g.gate_date < today,
          passed: Number(r?.passed ?? 0) === 1,
          passed_at: r?.passed_at ?? null,
          evidence_url: r?.evidence_url ?? null,
          notes: r?.notes ?? '',
        };
      }),
      money_gates: moneyGates.map((g) => {
        const r = byCode.get(g.code);
        return {
          ...g,
          days_remaining: daysBetween(today, g.gate_date),
          is_past: g.gate_date < today,
          passed: Number(r?.passed ?? 0) === 1,
          passed_at: r?.passed_at ?? null,
          amount_received: r?.amount_received ?? null,
          notes: r?.notes ?? '',
          show_if_it_fails: g.gate_date < today && Number(r?.passed ?? 0) !== 1,
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
});

const gateBody = z.object({
  passed: z.boolean(),
  evidence_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  notes: optionalText(4000).optional(),
});

router.patch(
  '/gates/:no/result',
  validate({ params: z.object({ no: z.coerce.number().int().min(1).max(4) }), body: gateBody }),
  async (req, res, next) => {
    try {
      const gates = await getGates();
      const gate = gates.find((g) => Number(g.no) === Number(req.params.no));
      if (!gate) throw notFound('No such gate.');

      const evidence = req.body.evidence_url === '' ? null : req.body.evidence_url ?? null;
      if (req.body.passed && !evidence) {
        throw ruleViolation(
          'A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.'
        );
      }

      await run(
        `INSERT INTO gate_results (user_id, gate_no, passed, passed_at, evidence_url, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE passed = VALUES(passed), passed_at = VALUES(passed_at),
           evidence_url = VALUES(evidence_url), notes = VALUES(notes)`,
        [
          req.user.id,
          gate.no,
          req.body.passed ? 1 : 0,
          req.body.passed ? nowDateTime() : null,
          evidence,
          req.body.notes ?? null,
        ]
      );
      const row = await one(
        'SELECT gate_no, passed, passed_at, evidence_url, notes FROM gate_results WHERE user_id = ? AND gate_no = ?',
        [req.user.id, gate.no]
      );
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

const moneyGateBody = z.object({
  passed: z.boolean(),
  amount_received: z.union([z.coerce.number().int().min(0).max(100000000), z.null()]).optional(),
  notes: optionalText(4000).optional(),
});

router.patch(
  '/money-gates/:code/result',
  validate({ params: z.object({ code: z.string().regex(/^M[1-4]$/) }), body: moneyGateBody }),
  async (req, res, next) => {
    try {
      const gates = await getMoneyGates();
      const gate = gates.find((g) => g.code === req.params.code);
      if (!gate) throw notFound('No such money gate.');
      await run(
        `INSERT INTO money_gate_results (user_id, money_gate_code, passed, passed_at, amount_received, notes)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE passed = VALUES(passed), passed_at = VALUES(passed_at),
           amount_received = VALUES(amount_received), notes = VALUES(notes)`,
        [
          req.user.id,
          gate.code,
          req.body.passed ? 1 : 0,
          req.body.passed ? nowDateTime() : null,
          req.body.amount_received ?? null,
          req.body.notes ?? null,
        ]
      );
      const row = await one(
        'SELECT money_gate_code, passed, passed_at, amount_received, notes FROM money_gate_results WHERE user_id = ? AND money_gate_code = ?',
        [req.user.id, gate.code]
      );
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

/* ---------------------------------------------------------- GET /sundays */

router.get('/sundays', async (req, res, next) => {
  try {
    const [sundays, weeks] = await Promise.all([getSundays(), getWeeks()]);
    const logs = await query('SELECT week_n, completed, hours, notes FROM sunday_logs WHERE user_id = ?', [
      req.user.id,
    ]);
    const byWeek = new Map(logs.map((l) => [Number(l.week_n), l]));
    const today = todayInTz();
    return ok(res, {
      today,
      sundays: sundays.map((s) => {
        const l = byWeek.get(Number(s.week_n));
        return {
          ...s,
          week_title: weeks.find((w) => w.n === s.week_n)?.title ?? null,
          completed: Number(l?.completed ?? 0) === 1,
          hours_logged: Number(l?.hours ?? 0),
          notes: l?.notes ?? '',
          is_today: s.sunday_date === today,
          is_past: s.sunday_date < today,
        };
      }),
      totals: {
        working: sundays.filter((s) => s.kind === 'working').length,
        gate: sundays.filter((s) => s.kind === 'gate').length,
        rest: sundays.filter((s) => s.kind === 'rest').length,
      },
    });
  } catch (err) {
    return next(err);
  }
});

const sundayBody = z.object({
  completed: z.boolean().optional(),
  hours: z.coerce.number().min(0).max(24).optional(),
  notes: optionalText(4000).optional(),
});

router.patch(
  '/sundays/:week/log',
  validate({ params: z.object({ week: weekNumber }), body: sundayBody }),
  async (req, res, next) => {
    try {
      const sundays = await getSundays();
      const sunday = sundays.find((s) => Number(s.week_n) === Number(req.params.week));
      if (!sunday) throw notFound('No such Sunday.');
      if (sunday.kind === 'rest' && (req.body.completed || req.body.hours)) {
        throw ruleViolation(
          'This is a rest Sunday. No code. No screens before noon. This is load bearing. Only the note field is writable.'
        );
      }
      await run(
        'INSERT INTO sunday_logs (user_id, week_n) VALUES (?, ?) ON DUPLICATE KEY UPDATE week_n = VALUES(week_n)',
        [req.user.id, sunday.week_n]
      );
      const sets = [];
      const params = [];
      if ('completed' in req.body) {
        sets.push('completed = ?');
        params.push(req.body.completed ? 1 : 0);
      }
      if ('hours' in req.body) {
        sets.push('hours = ?');
        params.push(req.body.hours);
      }
      if ('notes' in req.body) {
        sets.push('notes = ?');
        params.push(req.body.notes);
      }
      if (sets.length) {
        params.push(req.user.id, sunday.week_n);
        await run(`UPDATE sunday_logs SET ${sets.join(', ')} WHERE user_id = ? AND week_n = ?`, params);
      }
      await recomputeDay(req.user.id, sunday.sunday_date);
      const row = await one(
        'SELECT week_n, completed, hours, notes FROM sunday_logs WHERE user_id = ? AND week_n = ?',
        [req.user.id, sunday.week_n]
      );
      return ok(res, row);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
