/**
 * career.mjs (routes) | applications, mocks, writeups, the ladder, roles,
 * eligibility, after January 2027, New Zealand and reference.
 */

import { Router } from 'express';
import { z } from 'zod';
import { one, query, run } from '../../db/pool.mjs';
import {
  getAddedTopics,
  getBreakPlan,
  getBreaks,
  getClockFacts,
  getContinuation,
  getCorrections,
  getCosts,
  getCourseRulings,
  getCourseTopicMap,
  getDeadLinks,
  getDoNotBuy,
  getDocSections,
  getDsaThresholds,
  getEligibilityDefinitions,
  getEligibilityDsa,
  getEligibilityWeeks,
  getFalsifier,
  getFastExits,
  getFocusRules,
  getHonestyRules,
  getHonestyTests,
  getLaunchDays,
  getMachineInventory,
  getNightSegments,
  getNzCorrections,
  getNzCosts,
  getNzFacts,
  getNzMilestones,
  getNzProjection,
  getNzRequirements,
  getNzSalary,
  getNzUnverified,
  getOwnedCourses,
  getResources,
  getResumeStages,
  getRoleUnlocks,
  getRoles,
  getRolesEarly,
  getSkills,
  getSkillCombos,
  getSkipList,
  getStackVersions,
  getSubjects,
  getTrackers,
  getTrackingFiles,
  getVerificationLog,
  getVideoRules,
  getWeeks,
  getGates,
} from '../../db/reference.mjs';
import { completedWeeks, dsaSolvedTotal } from '../../db/progress.mjs';
import { computeEligibility } from '../../lib/eligibility.mjs';
import { ok, notFound } from '../../lib/errors.mjs';
import { daysBetween, todayInTz } from '../../lib/dates.mjs';
import { httpUrl, isoDate, optionalText, positiveId, validate } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

/* ----------------------------------------------------- GET /applications */

router.get('/applications', async (req, res, next) => {
  try {
    const today = todayInTz();
    const [rows, funnel, roles] = await Promise.all([
      query(
        `SELECT * FROM applications WHERE user_id = ? AND is_deleted = 0
          ORDER BY applied_on DESC, id DESC`,
        [req.user.id]
      ),
      query(
        'SELECT status, COUNT(*) AS n FROM applications WHERE user_id = ? AND is_deleted = 0 GROUP BY status',
        [req.user.id]
      ),
      getRoles(),
    ]);
    const byStatus = Object.fromEntries(funnel.map((r) => [r.status, Number(r.n)]));
    const total = rows.length;
    const referrals = rows.filter((r) => Number(r.referral) === 1).length;
    const interviews = rows.filter((r) => ['screen', 'tech', 'onsite', 'offer'].includes(r.status)).length;

    return ok(res, {
      today,
      applications: rows,
      roles: roles.map((r) => ({ code: r.code, name: r.short_name })),
      funnel: {
        by_status: byStatus,
        total,
        referrals,
        referral_rate: total ? Math.round((referrals / total) * 1000) / 10 : 0,
        interviews,
        interview_rate: total ? Math.round((interviews / total) * 1000) / 10 : 0,
        offers: byStatus.offer ?? 0,
      },
      gate4: {
        target: config.roadmap.gate4Applications,
        sent: total,
        remaining: Math.max(0, config.roadmap.gate4Applications - total),
        percent: Math.min(100, Math.round((total / config.roadmap.gate4Applications) * 100)),
      },
      realistic: {
        low: config.roadmap.realisticApplications[0],
        high: config.roadmap.realisticApplications[1],
        percent_of_low: Math.min(100, Math.round((total / config.roadmap.realisticApplications[0]) * 100)),
        note:
          'The Gate 4 condition is 100 applications. Treat 100 as the floor, not the target. A realistic total to one offer is 200 to 400. That figure is an inference from Indian time to hire and drop rate data, not a measured conversion rate for your profile, so track your own numbers and recalculate.',
      },
      red_banner:
        today >= config.roadmap.gate3Date && total === 0
          ? 'Gate 3 has passed and applications should have started. Part 13 is explicit: applications begin at Gate 3 on 13 December 2026, not at Gate 4.'
          : null,
      applications_open: today >= config.roadmap.gate3Date,
    });
  } catch (err) {
    return next(err);
  }
});

const appBody = z.object({
  company: z.string().trim().min(1).max(200),
  role_title: z.string().trim().min(1).max(200),
  role_code: optionalText(8),
  source: optionalText(120),
  applied_on: isoDate,
  status: z.enum(['applied', 'screen', 'tech', 'onsite', 'offer', 'rejected', 'ghosted']).optional(),
  last_update: z.union([isoDate, z.null()]).optional(),
  referral: z.boolean().optional(),
  salary_offered: optionalText(120),
  jd_url: z.union([httpUrl, z.literal(''), z.null()]).optional(),
  notes: optionalText(4000),
});

router.post('/applications', validate({ body: appBody }), async (req, res, next) => {
  try {
    const b = req.body;
    const result = await run(
      `INSERT INTO applications (user_id, company, role_title, role_code, source, applied_on, status,
                                 last_update, referral, salary_offered, jd_url, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        b.company,
        b.role_title,
        b.role_code ?? null,
        b.source ?? null,
        b.applied_on,
        b.status ?? 'applied',
        b.last_update ?? null,
        b.referral ? 1 : 0,
        b.salary_offered ?? null,
        b.jd_url === '' ? null : b.jd_url ?? null,
        b.notes ?? null,
      ]
    );
    return ok(res, await one('SELECT * FROM applications WHERE id = ?', [result.insertId]), 201);
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/applications/:id',
  validate({ params: z.object({ id: positiveId }), body: appBody.partial() }),
  async (req, res, next) => {
    try {
      const row = await one('SELECT * FROM applications WHERE id = ? AND user_id = ? AND is_deleted = 0', [
        req.params.id,
        req.user.id,
      ]);
      if (!row) throw notFound('No such application.');
      const sets = [];
      const params = [];
      for (const key of Object.keys(appBody.shape)) {
        if (key in req.body) {
          sets.push(`${key} = ?`);
          params.push(key === 'referral' ? (req.body[key] ? 1 : 0) : req.body[key] === '' ? null : req.body[key]);
        }
      }
      if (!('last_update' in req.body) && 'status' in req.body) {
        sets.push('last_update = ?');
        params.push(todayInTz());
      }
      if (sets.length) {
        params.push(req.user.id, row.id);
        await run(`UPDATE applications SET ${sets.join(', ')} WHERE user_id = ? AND id = ?`, params);
        await run(
          `INSERT INTO audit_log (user_id, table_name, row_pk, action, before_json, after_json)
           VALUES (?, 'applications', ?, 'update', CAST(? AS JSON), CAST(? AS JSON))`,
          [req.user.id, String(row.id), JSON.stringify(row), JSON.stringify(req.body)]
        );
      }
      return ok(res, await one('SELECT * FROM applications WHERE id = ?', [row.id]));
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/applications/:id',
  validate({ params: z.object({ id: positiveId }) }),
  async (req, res, next) => {
    try {
      const row = await one('SELECT id FROM applications WHERE id = ? AND user_id = ?', [
        req.params.id,
        req.user.id,
      ]);
      if (!row) throw notFound('No such application.');
      await run('UPDATE applications SET is_deleted = 1 WHERE id = ? AND user_id = ?', [row.id, req.user.id]);
      await run(
        `INSERT INTO audit_log (user_id, table_name, row_pk, action) VALUES (?, 'applications', ?, 'soft_delete')`,
        [req.user.id, String(row.id)]
      );
      return ok(res, { id: Number(row.id), soft_deleted: true });
    } catch (err) {
      return next(err);
    }
  }
);

/* ------------------------------------------------------------- GET /mocks */

router.get('/mocks', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM mock_interviews WHERE user_id = ? AND is_deleted = 0 ORDER BY held_on DESC, id DESC',
      [req.user.id]
    );
    const byKind = {};
    for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    return ok(res, {
      mocks: rows,
      total: rows.length,
      by_kind: byKind,
      week20_target: 10,
      case_study_target: 4,
      from_february_target: 2,
      note:
        'Ten mocks in Week 20, four of them case studies rather than coding mocks. Two a week from February.',
    });
  } catch (err) {
    return next(err);
  }
});

const mockBody = z.object({
  held_on: isoDate,
  platform: z.string().trim().min(1).max(120),
  topic: z.string().trim().min(1).max(200),
  kind: z.enum(['coding', 'system_design', 'case_study', 'rag_design', 'behavioural']).optional(),
  score: z.union([z.coerce.number().int().min(0).max(10), z.null()]).optional(),
  what_broke: optionalText(4000),
});

router.post('/mocks', validate({ body: mockBody }), async (req, res, next) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO mock_interviews (user_id, held_on, platform, topic, kind, score, what_broke) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, b.held_on, b.platform, b.topic, b.kind ?? 'coding', b.score ?? null, b.what_broke ?? null]
    );
    return ok(res, await one('SELECT * FROM mock_interviews WHERE id = ?', [result.insertId]), 201);
  } catch (err) {
    return next(err);
  }
});

/* ---------------------------------------------------------- GET /writeups */

router.get('/writeups', async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT * FROM writeups WHERE user_id = ? AND is_deleted = 0 ORDER BY published_on DESC, id DESC',
      [req.user.id]
    );
    return ok(res, {
      writeups: rows,
      total: rows.length,
      target: 3,
      note:
        'Write three things publicly: one on the ITC Reclaim reconciliation logic, one on the Ragas numbers and what they revealed, one on the MCP server. These are what recruiters actually read.',
    });
  } catch (err) {
    return next(err);
  }
});

const writeupBody = z.object({
  title: z.string().trim().min(1).max(255),
  url: httpUrl,
  published_on: isoDate,
  topic: optionalText(200),
});

router.post('/writeups', validate({ body: writeupBody }), async (req, res, next) => {
  try {
    const b = req.body;
    const result = await run(
      'INSERT INTO writeups (user_id, title, url, published_on, topic) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, b.title, b.url, b.published_on, b.topic ?? null]
    );
    return ok(res, await one('SELECT * FROM writeups WHERE id = ?', [result.insertId]), 201);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------ GET /ladder */

router.get('/ladder', async (req, res, next) => {
  try {
    const today = todayInTz();
    const [unlocks, thresholds, stages, roles, solvedRow, weekState] = await Promise.all([
      getRoleUnlocks(),
      getDsaThresholds(),
      getResumeStages(),
      getRoles(),
      dsaSolvedTotal(req.user.id),
      completedWeeks(req.user.id),
    ]);
    const gateResults = await query('SELECT gate_no, passed FROM gate_results WHERE user_id = ?', [req.user.id]);
    const passed = new Set(gateResults.filter((g) => Number(g.passed) === 1).map((g) => Number(g.gate_no)));
    const solved = solvedRow.total;
    const done = new Set(weekState.complete);

    return ok(res, {
      today,
      solved,
      milestones: unlocks.map((m) => {
        const gateMatch = /GATE\s+(\d)/i.exec(m.milestone);
        const weekMatch = /Week\s+(\d+)/i.exec(m.milestone);
        const unlocked = gateMatch
          ? passed.has(Number(gateMatch[1]))
          : weekMatch
            ? done.has(Number(weekMatch[1]))
            : m.unlock_date <= today && solved >= 6;
        return {
          ...m,
          is_gate: Boolean(gateMatch),
          gate_no: gateMatch ? Number(gateMatch[1]) : null,
          week_n: weekMatch ? Number(weekMatch[1]) : null,
          unlocked,
          days_away: daysBetween(today, m.unlock_date),
          roles: m.roles_csv ? m.roles_csv.split(',') : [],
        };
      }),
      thresholds: thresholds.map((t) => ({
        ...t,
        cumulative: Number(t.cumulative),
        reached: solved >= Number(t.cumulative),
        is_current:
          solved >= Number(t.cumulative) &&
          !thresholds.some((o) => Number(o.cumulative) > Number(t.cumulative) && solved >= Number(o.cumulative)),
      })),
      resume_stages: stages.map((s) => ({
        ...s,
        available: (() => {
          const m = /Gate\s+(\d)/i.exec(s.stage);
          return m ? passed.has(Number(m[1])) : false;
        })(),
      })),
      roles: roles.map((r) => ({ code: r.code, name: r.short_name, entry_band: r.entry_band })),
      callout: 'DSA alone unlocks no role. The count gets you past a screen. The projects get you the offer.',
      applications_note:
        'Applications begin at Gate 3 on 13 December 2026, not at Gate 4. Waiting for Gate 4 costs six weeks of pipeline and lands your first replies inside the Indian hiring slowdown, which runs roughly 21 to 27 December.',
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------- GET /roles */

/**
 * GET /roles
 *
 * Part 12, the seven roles, plus everything a person actually needs in front of
 * them when they are deciding what to apply for:
 *
 *   - the seven roles ranked, with what each one tests and which project carries it
 *   - the nine earlier roles from Part 19.2
 *   - the Part 12 skill matrix, ticked from finished weeks
 *   - where to apply: the five boards and salary sources from Part 7 category 19,
 *     and the seven apply rules from the Week 21 LEARN block
 *   - interview preparation: the six links from Part 7 category 16
 *   - what goes on the resume at each gate, from Part 13
 *   - the unlock ladder, so a role that is not open yet says when it opens
 *   - the person's own mocks and applications, counted per role
 *
 * Every string here comes out of the database, which means out of final.md.
 * Nothing on this screen is advice this application invented.
 */
router.get('/roles', async (req, res, next) => {
  try {
    const today = todayInTz();
    const [
      roles,
      skills,
      weekState,
      earlyRoles,
      unlocks,
      resumeStages,
      thresholds,
      resources,
      applyRules,
      solvedRow,
      gateResults,
      mocks,
      appRows,
      resourceProgress,
    ] = await Promise.all([
      getRoles(),
      getSkills(),
      completedWeeks(req.user.id),
      getRolesEarly(),
      getRoleUnlocks(),
      getResumeStages(),
      getDsaThresholds(),
      getResources(),
      query('SELECT ord, text FROM week_learn WHERE week_n = 21 ORDER BY ord'),
      dsaSolvedTotal(req.user.id),
      query('SELECT gate_no, passed FROM gate_results WHERE user_id = ?', [req.user.id]),
      query(
        `SELECT id, held_on, platform, topic, kind, score, what_broke
           FROM mock_interviews WHERE user_id = ? AND is_deleted = 0 ORDER BY held_on DESC, id DESC`,
        [req.user.id]
      ),
      query(
        `SELECT role_code, status, COUNT(*) AS n
           FROM applications WHERE user_id = ? AND is_deleted = 0
          GROUP BY role_code, status`,
        [req.user.id]
      ),
      query('SELECT resource_id, status, notes FROM resource_progress WHERE user_id = ?', [req.user.id]),
    ]);

    const done = new Set(weekState.complete);
    const solved = solvedRow.total;
    const passedGates = new Set(
      gateResults.filter((g) => Number(g.passed) === 1).map((g) => Number(g.gate_no))
    );
    const progressById = new Map(resourceProgress.map((p) => [Number(p.resource_id), p]));

    /** A resource row with this user's progress attached. */
    const withProgress = (r) => ({
      ...r,
      weeks: r.weeks_csv ? r.weeks_csv.split(',').map(Number) : [],
      status: progressById.get(Number(r.id))?.status ?? 'todo',
      notes: progressById.get(Number(r.id))?.notes ?? '',
      is_alive: Number(r.is_alive) === 1,
    });

    // Category 19 is "Salary and job search": the boards and the two salary
    // sources. Category 16 is "Interview preparation".
    const jobSearch = resources.filter((r) => Number(r.category_no) === 19).map(withProgress);
    const interviewPrep = resources.filter((r) => Number(r.category_no) === 16).map(withProgress);

    /** Which milestone opened each role, and whether it has been reached. */
    const unlockRows = unlocks.map((u) => {
      const codes = u.roles_csv ? u.roles_csv.split(',').filter(Boolean) : [];
      return {
        ...u,
        codes,
        is_past: u.unlock_date <= today,
        days_away: daysBetween(today, u.unlock_date),
      };
    });
    const openedBy = new Map();
    for (const u of unlockRows) {
      for (const code of u.codes) if (!openedBy.has(code)) openedBy.set(code, u);
    }

    const appsByRole = new Map();
    for (const a of appRows) {
      const key = a.role_code ?? '(none)';
      const cur = appsByRole.get(key) ?? { total: 0, by_status: {} };
      cur.total += Number(a.n);
      cur.by_status[a.status] = Number(a.n);
      appsByRole.set(key, cur);
    }

    const skillRows = skills.map((s) => ({
      ...s,
      roles: s.roles_csv ? s.roles_csv.split(',') : [],
      week_n: s.week_n,
      have: s.week_n ? done.has(Number(s.week_n)) : false,
    }));

    /** Skills that name this role, so a card can show what it still needs. */
    const skillsFor = (code) => skillRows.filter((s) => s.roles.includes(code));

    return ok(res, {
      today,
      solved,
      roles: roles.map((r) => {
        const mine = skillsFor(r.code);
        const unlock = openedBy.get(r.code) ?? null;
        return {
          ...r,
          skills_total: mine.length,
          skills_have: mine.filter((s) => s.have).length,
          skills_missing: mine.filter((s) => !s.have).map((s) => s.name),
          unlocked_by: unlock
            ? { milestone: unlock.milestone, unlock_date: unlock.unlock_date, is_past: unlock.is_past, days_away: unlock.days_away }
            : null,
          applications: appsByRole.get(r.code) ?? { total: 0, by_status: {} },
        };
      }),
      roles_early: earlyRoles.map((r) => ({
        ...r,
        is_open: r.earliest_date <= today,
        days_away: daysBetween(today, r.earliest_date),
        applications: appsByRole.get(r.code) ?? { total: 0, by_status: {} },
      })),
      skills: skillRows,
      skills_have: skillRows.filter((s) => s.have).length,
      skills_total: skillRows.length,
      completed_weeks: [...done].sort((a, b) => a - b),

      /* ---- where to apply ---- */
      where_to_apply: {
        boards: jobSearch,
        rules: applyRules,
        rules_source: 'Part 4, Week 21 LEARN block',
        note:
          'Apply to the role name, not to companies you have heard of. The boards below are the five final.md names, ' +
          'and the two salary sources are there so the first number you hear is not the first number you have thought about.',
      },

      /* ---- interview preparation ---- */
      interview_prep: {
        resources: interviewPrep,
        category: 'Part 7, category 16, Interview preparation',
        what_they_test: roles.map((r) => ({
          code: r.code,
          short_name: r.short_name,
          what_they_test: r.what_they_test,
          which_project: r.which_project,
        })),
        mocks,
        mocks_by_kind: mocks.reduce((acc, m) => {
          acc[m.kind] = (acc[m.kind] ?? 0) + 1;
          return acc;
        }, {}),
      },

      /* ---- the resume, per gate ---- */
      resume_stages: resumeStages.map((s) => {
        const gateNo = Number(String(s.stage).replace(/\D/g, '')) || null;
        return { ...s, gate_no: gateNo, passed: gateNo ? passedGates.has(gateNo) : false };
      }),

      /* ---- the ladder and the DSA thresholds ---- */
      unlocks: unlockRows,
      dsa_thresholds: thresholds.map((t) => ({
        ...t,
        reached: solved >= Number(t.cumulative),
      })),
      dsa_note: 'No number in this table unlocks a single role on its own.',
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------- GET /eligibility */

router.get('/eligibility', async (req, res, next) => {
  try {
    const today = todayInTz();
    const [
      eligibilityWeeks,
      rolesEarly,
      roles,
      eligibilityDsa,
      skillCombos,
      fastExits,
      definitions,
      breakPlan,
      weeks,
      solvedRow,
      weekState,
    ] = await Promise.all([
      getEligibilityWeeks(),
      getRolesEarly(),
      getRoles(),
      getEligibilityDsa(),
      getSkillCombos(),
      getFastExits(),
      getEligibilityDefinitions(),
      getBreakPlan(),
      getWeeks(),
      dsaSolvedTotal(req.user.id),
      completedWeeks(req.user.id),
    ]);

    const currentWeek = weeks.find((w) => today >= w.start_date && today <= w.end_date) ?? null;
    const result = computeEligibility({
      today,
      solved: solvedRow.total,
      completedWeeks: weekState.complete,
      eligibilityWeeks,
      rolesEarly,
      roles,
      eligibilityDsa,
      skillCombos,
      fastExits,
      currentWeek,
    });

    return ok(res, {
      ...result,
      definitions,
      break_plan: breakPlan,
      current_week: currentWeek,
      week_progress: weekState.perWeek,
      dsa_source: solvedRow.source,
      problems_imported: solvedRow.problemCount > 0,
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------- GET /after */

router.get('/after', async (req, res, next) => {
  try {
    const [rows, progress] = await Promise.all([
      getContinuation(),
      query('SELECT continuation_id, done, completed_on, notes FROM continuation_progress WHERE user_id = ?', [
        req.user.id,
      ]),
    ]);
    const byId = new Map(progress.map((p) => [Number(p.continuation_id), p]));
    const withProgress = rows.map((r) => ({
      ...r,
      done: Number(byId.get(Number(r.id))?.done ?? 0) === 1,
      completed_on: byId.get(Number(r.id))?.completed_on ?? null,
      notes: byId.get(Number(r.id))?.notes ?? '',
    }));
    const grouped = {};
    for (const r of withProgress) {
      grouped[r.kind] = grouped[r.kind] ?? [];
      grouped[r.kind].push(r);
    }
    const checkable = withProgress.filter((r) => ['bridge', 'quarter', 'year_detail'].includes(r.kind));
    return ok(res, {
      rows: withProgress,
      grouped,
      done_count: checkable.filter((r) => r.done).length,
      total_count: checkable.length,
    });
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/after/:id/progress',
  validate({
    params: z.object({ id: positiveId }),
    body: z.object({ done: z.boolean().optional(), notes: optionalText(2000).optional() }),
  }),
  async (req, res, next) => {
    try {
      const row = await one('SELECT id FROM continuation WHERE id = ?', [req.params.id]);
      if (!row) throw notFound('No such row.');
      await run(
        'INSERT INTO continuation_progress (user_id, continuation_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE continuation_id = VALUES(continuation_id)',
        [req.user.id, row.id]
      );
      const sets = [];
      const params = [];
      if ('done' in req.body) {
        sets.push('done = ?', 'completed_on = ?');
        params.push(req.body.done ? 1 : 0, req.body.done ? todayInTz() : null);
      }
      if ('notes' in req.body) {
        sets.push('notes = ?');
        params.push(req.body.notes);
      }
      if (sets.length) {
        params.push(req.user.id, row.id);
        await run(
          `UPDATE continuation_progress SET ${sets.join(', ')} WHERE user_id = ? AND continuation_id = ?`,
          params
        );
      }
      return ok(res, await one(
        'SELECT continuation_id, done, completed_on, notes FROM continuation_progress WHERE user_id = ? AND continuation_id = ?',
        [req.user.id, row.id]
      ));
    } catch (err) {
      return next(err);
    }
  }
);

/* ---------------------------------------------------------------- GET /nz */

router.get('/nz', async (req, res, next) => {
  try {
    const [reqs, facts, corrections, milestones, costs, salary, projection, unverified, progress] =
      await Promise.all([
        getNzRequirements(),
        getNzFacts(),
        getNzCorrections(),
        getNzMilestones(),
        getNzCosts(),
        getNzSalary(),
        getNzProjection(),
        getNzUnverified(),
        query('SELECT nz_milestone_id, status, completed_on, notes FROM nz_progress WHERE user_id = ?', [
          req.user.id,
        ]),
      ]);
    const byId = new Map(progress.map((p) => [Number(p.nz_milestone_id), p]));
    const total = costs.find((c) => Number(c.is_total) === 1) ?? null;
    return ok(res, {
      requirements: reqs,
      facts: {
        wage: facts.filter((f) => f.group_key === 'wage'),
        salary: facts.filter((f) => f.group_key === 'salary'),
      },
      corrections,
      milestones: milestones.map((m) => ({
        ...m,
        status: byId.get(Number(m.id))?.status ?? 'not_started',
        completed_on: byId.get(Number(m.id))?.completed_on ?? null,
        notes: byId.get(Number(m.id))?.notes ?? '',
      })),
      costs,
      cost_total: total,
      // The Active Investor Plus comparison sits beside the total so the gap is
      // visible without scrolling. Both figures come from Part 16 verbatim.
      investor_comparison: {
        label: 'Active Investor Plus Visa, the actual source of the crore figure',
        growth: 'NZD 5 million over 3 years, Growth category',
        balanced: 'NZD 10 million over 5 years, Balanced category',
        rupees_growth: 'Rs 28.35 crore',
        rupees_balanced: 'Rs 56.70 crore',
        multiple: '320 times more expensive than your route',
        note: 'That visa is for people who buy their way in. You are the one being paid to walk in.',
      },
      salary,
      projection,
      projection_label: 'Projection, not promise',
      unverified,
    });
  } catch (err) {
    return next(err);
  }
});

router.patch(
  '/nz/:id/progress',
  validate({
    params: z.object({ id: positiveId }),
    body: z.object({
      status: z.enum(['not_started', 'in_progress', 'done']).optional(),
      notes: optionalText(2000).optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      const row = await one('SELECT id FROM nz_milestones WHERE id = ?', [req.params.id]);
      if (!row) throw notFound('No such milestone.');
      await run(
        'INSERT INTO nz_progress (user_id, nz_milestone_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE nz_milestone_id = VALUES(nz_milestone_id)',
        [req.user.id, row.id]
      );
      const sets = [];
      const params = [];
      if ('status' in req.body) {
        sets.push('status = ?', 'completed_on = ?');
        params.push(req.body.status, req.body.status === 'done' ? todayInTz() : null);
      }
      if ('notes' in req.body) {
        sets.push('notes = ?');
        params.push(req.body.notes);
      }
      if (sets.length) {
        params.push(req.user.id, row.id);
        await run(`UPDATE nz_progress SET ${sets.join(', ')} WHERE user_id = ? AND nz_milestone_id = ?`, params);
      }
      return ok(res, await one(
        'SELECT nz_milestone_id, status, completed_on, notes FROM nz_progress WHERE user_id = ? AND nz_milestone_id = ?',
        [req.user.id, row.id]
      ));
    } catch (err) {
      return next(err);
    }
  }
);

/* --------------------------------------------------------- GET /reference */

router.get('/reference', async (req, res, next) => {
  try {
    const [
      corrections,
      stack,
      breaks,
      skip,
      doNotBuy,
      added,
      costs,
      dead,
      trackers,
      trackingFiles,
      clock,
      subjects,
      launch,
      night,
      machine,
      focus,
      honestyTests,
      honestyRules,
      courses,
      rulings,
      topicMap,
      videoRules,
      falsifier,
      log,
    ] = await Promise.all([
      getCorrections(),
      getStackVersions(),
      getBreaks(),
      getSkipList(),
      getDoNotBuy(),
      getAddedTopics(),
      getCosts(),
      getDeadLinks(),
      getTrackers(),
      getTrackingFiles(),
      getClockFacts(),
      getSubjects(),
      getLaunchDays(),
      getNightSegments(),
      getMachineInventory(),
      getFocusRules(),
      getHonestyTests(),
      getHonestyRules(),
      getOwnedCourses(),
      getCourseRulings(),
      getCourseTopicMap(),
      getVideoRules(),
      getFalsifier(),
      getVerificationLog(),
    ]);
    return ok(res, {
      corrections,
      stack_versions: stack,
      breaks,
      skip_list: skip,
      do_not_buy: doNotBuy,
      added_topics: added,
      costs,
      dead_links: dead,
      trackers,
      tracking_files: trackingFiles,
      clock_facts: clock,
      subjects,
      launch_days: launch,
      night_segments: night,
      machine_inventory: machine,
      focus_rules: focus,
      honesty_tests: honestyTests,
      honesty_rules: honestyRules,
      owned_courses: courses,
      course_rulings: rulings,
      course_topic_map: topicMap,
      video_rules: videoRules,
      falsifier,
      verification_log: log,
    });
  } catch (err) {
    return next(err);
  }
});

/** Any level 2 or 3 section of final.md, verbatim. */
router.get(
  '/doc/:slug',
  validate({ params: z.object({ slug: z.string().max(160) }) }),
  async (req, res, next) => {
    try {
      const sections = await getDocSections();
      const hit = sections.find((s) => s.slug === req.params.slug);
      if (!hit) throw notFound('No such section of final.md.');
      return ok(res, hit);
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
