/**
 * GET /api/eligibility | Part 19, computed live and never stored.
 *
 * Eligible is not a reason to apply. Eligible plus advised is.
 */

import {
  getBreakPlan,
  getEligibilityDefinitions,
  getEligibilityDsa,
  getEligibilityWeeks,
  getFastExits,
  getRoles,
  getRolesEarly,
  getSkillCombos,
  getWeeks,
} from '@/lib/db/reference';
import { completedWeeks, dsaSolvedTotal } from '@/lib/db/progress';
import { computeEligibility } from '@/lib/eligibility';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
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
    dsaSolvedTotal(user.id),
    completedWeeks(user.id),
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
    currentWeek: currentWeek ? { n: currentWeek.n } : null,
  });

  return jsonOk({
    ...result,
    definitions,
    break_plan: breakPlan,
    current_week: currentWeek,
    week_progress: weekState.perWeek,
    dsa_source: solvedRow.source,
    problems_imported: solvedRow.problemCount > 0,
  });
});
