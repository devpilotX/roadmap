/**
 * GET /api/nz | Part 16, New Zealand.
 *
 * The Active Investor Plus comparison sits beside the cost total so the gap is
 * visible without scrolling. Both figures come from Part 16 verbatim.
 */

import { query } from '@/lib/db/pool';
import {
  getNzCorrections,
  getNzCosts,
  getNzFacts,
  getNzMilestones,
  getNzProjection,
  getNzRequirements,
  getNzSalary,
  getNzUnverified,
} from '@/lib/db/reference';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
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
        user.id,
      ]),
    ]);

  const byId = new Map(progress.map((p) => [Number(p.nz_milestone_id), p]));
  const total = costs.find((c) => Number(c.is_total) === 1) ?? null;

  return jsonOk({
    requirements: reqs,
    facts: {
      wage: facts.filter((f) => f.group_key === 'wage'),
      salary: facts.filter((f) => f.group_key === 'salary'),
    },
    corrections,
    milestones: milestones.map((m): Record<string, any> => ({
      ...m,
      status: byId.get(Number(m.id))?.status ?? 'not_started',
      completed_on: byId.get(Number(m.id))?.completed_on ?? null,
      notes: byId.get(Number(m.id))?.notes ?? '',
    })),
    costs,
    cost_total: total,
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
});
