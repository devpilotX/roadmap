/**
 * GET /api/roles
 *
 * Part 12, the seven roles, plus everything a person actually needs in front of
 * them when they are deciding what to apply for:
 *
 *   - the seven roles ranked, with what each one tests and which project carries it
 *   - the nine earlier roles from Part 19.2
 *   - the Part 12 skill matrix, ticked from finished weeks
 *   - where to apply: the boards and salary sources from Part 7 category 19, and
 *     the apply rules from the Week 21 LEARN block
 *   - interview preparation: the links from Part 7 category 16
 *   - what goes on the resume at each gate, from Part 13
 *   - the unlock ladder, so a role that is not open yet says when it opens
 *   - the person's own mocks and applications, counted per role
 *
 * Every string here comes out of the database, which means out of final.md.
 * Nothing on this screen is advice this application invented.
 */

import { query } from '@/lib/db/pool';
import {
  getDsaThresholds,
  getResources,
  getResumeStages,
  getRoleUnlocks,
  getRoles,
  getRolesEarly,
  getSkills,
} from '@/lib/db/reference';
import { completedWeeks, dsaSolvedTotal } from '@/lib/db/progress';
import { daysBetween, todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
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
    completedWeeks(user.id),
    getRolesEarly(),
    getRoleUnlocks(),
    getResumeStages(),
    getDsaThresholds(),
    getResources(),
    query('SELECT ord, text FROM week_learn WHERE week_n = 21 ORDER BY ord'),
    dsaSolvedTotal(user.id),
    query('SELECT gate_no, passed FROM gate_results WHERE user_id = ?', [user.id]),
    query(
      `SELECT id, held_on, platform, topic, kind, score, what_broke
         FROM mock_interviews WHERE user_id = ? AND is_deleted = 0 ORDER BY held_on DESC, id DESC`,
      [user.id]
    ),
    query(
      `SELECT role_code, status, COUNT(*) AS n
         FROM applications WHERE user_id = ? AND is_deleted = 0
        GROUP BY role_code, status`,
      [user.id]
    ),
    query('SELECT resource_id, status, notes FROM resource_progress WHERE user_id = ?', [user.id]),
  ]);

  const done = new Set(weekState.complete);
  const solved = solvedRow.total;
  const passedGates = new Set(
    gateResults.filter((g) => Number(g.passed) === 1).map((g) => Number(g.gate_no))
  );
  const progressById = new Map(resourceProgress.map((p) => [Number(p.resource_id), p]));

  /** A resource row with this user's progress attached. */
  const withProgress = (r: Record<string, any>): Record<string, any> => ({
    ...r,
    weeks: r.weeks_csv ? String(r.weeks_csv).split(',').map(Number) : [],
    status: progressById.get(Number(r.id))?.status ?? 'todo',
    notes: progressById.get(Number(r.id))?.notes ?? '',
    is_alive: Number(r.is_alive) === 1,
  });

  // Category 19 is "Salary and job search": the boards and the two salary
  // sources. Category 16 is "Interview preparation".
  const jobSearch = resources.filter((r) => Number(r.category_no) === 19).map(withProgress);
  const interviewPrep = resources.filter((r) => Number(r.category_no) === 16).map(withProgress);

  /** Which milestone opened each role, and whether it has been reached. */
  const unlockRows = unlocks.map((u): Record<string, any> => {
    const codes = u.roles_csv ? String(u.roles_csv).split(',').filter(Boolean) : [];
    return {
      ...u,
      codes,
      is_past: u.unlock_date <= today,
      days_away: daysBetween(today, u.unlock_date as string),
    };
  });
  const openedBy = new Map<string, Record<string, any>>();
  for (const u of unlockRows) {
    for (const code of u.codes as string[]) if (!openedBy.has(code)) openedBy.set(code, u);
  }

  const appsByRole = new Map<string, { total: number; by_status: Record<string, number> }>();
  for (const a of appRows) {
    const key = (a.role_code as string) ?? '(none)';
    const cur = appsByRole.get(key) ?? { total: 0, by_status: {} };
    cur.total += Number(a.n);
    cur.by_status[String(a.status)] = Number(a.n);
    appsByRole.set(key, cur);
  }

  const skillRows = skills.map((s): Record<string, any> => ({
    ...s,
    roles: s.roles_csv ? String(s.roles_csv).split(',') : [],
    week_n: s.week_n,
    have: s.week_n ? done.has(Number(s.week_n)) : false,
  }));

  /** Skills that name this role, so a card can show what it still needs. */
  const skillsFor = (code: string) => skillRows.filter((s) => (s.roles as string[]).includes(code));

  return jsonOk({
    today,
    solved,
    roles: roles.map((r): Record<string, any> => {
      const mine = skillsFor(r.code as string);
      const unlock = openedBy.get(r.code as string) ?? null;
      return {
        ...r,
        skills_total: mine.length,
        skills_have: mine.filter((s) => s.have).length,
        skills_missing: mine.filter((s) => !s.have).map((s) => s.name),
        unlocked_by: unlock
          ? {
              milestone: unlock.milestone,
              unlock_date: unlock.unlock_date,
              is_past: unlock.is_past,
              days_away: unlock.days_away,
            }
          : null,
        applications: appsByRole.get(r.code as string) ?? { total: 0, by_status: {} },
      };
    }),
    roles_early: earlyRoles.map((r): Record<string, any> => ({
      ...r,
      is_open: r.earliest_date <= today,
      days_away: daysBetween(today, r.earliest_date as string),
      applications: appsByRole.get(r.code as string) ?? { total: 0, by_status: {} },
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
      mocks_by_kind: mocks.reduce((acc: Record<string, number>, m) => {
        acc[String(m.kind)] = (acc[String(m.kind)] ?? 0) + 1;
        return acc;
      }, {}),
    },

    /* ---- the resume, per gate ---- */
    resume_stages: resumeStages.map((s): Record<string, any> => {
      const gateNo = Number(String(s.stage).replace(/\D/g, '')) || null;
      return { ...s, gate_no: gateNo, passed: gateNo ? passedGates.has(gateNo) : false };
    }),

    /* ---- the ladder and the DSA thresholds ---- */
    unlocks: unlockRows,
    dsa_thresholds: thresholds.map((t): Record<string, any> => ({
      ...t,
      reached: solved >= Number(t.cumulative),
    })),
    dsa_note: 'No number in this table unlocks a single role on its own.',
  });
});
