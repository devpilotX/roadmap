/**
 * GET  /api/applications | the funnel, and Gate 4's target of 100.
 * POST /api/applications | one new application.
 *
 * Treat 100 as the floor, not the target. Applications begin at Gate 3 on
 * 13 December 2026, not at Gate 4.
 */

import { one, query, run } from '@/lib/db/pool';
import { getRoles } from '@/lib/db/reference';
import { todayInTz } from '@/lib/dates';
import { config } from '@/lib/config';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { applicationBody } from '@/lib/server/schemas';
import { parseBody } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = authedRoute(async ({ user }) => {
  const today = todayInTz();
  const [rows, funnel, roles] = await Promise.all([
    query(
      `SELECT * FROM applications WHERE user_id = ? AND is_deleted = 0
        ORDER BY applied_on DESC, id DESC`,
      [user.id]
    ),
    query(
      'SELECT status, COUNT(*) AS n FROM applications WHERE user_id = ? AND is_deleted = 0 GROUP BY status',
      [user.id]
    ),
    getRoles(),
  ]);

  const byStatus = Object.fromEntries(funnel.map((r) => [r.status, Number(r.n)])) as Record<
    string,
    number
  >;
  const total = rows.length;
  const referrals = rows.filter((r) => Number(r.referral) === 1).length;
  const interviews = rows.filter((r) =>
    ['screen', 'tech', 'onsite', 'offer'].includes(String(r.status))
  ).length;

  return jsonOk({
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
      percent_of_low: Math.min(
        100,
        Math.round((total / config.roadmap.realisticApplications[0]) * 100)
      ),
      note:
        'The Gate 4 condition is 100 applications. Treat 100 as the floor, not the target. A realistic total to one offer is 200 to 400. That figure is an inference from Indian time to hire and drop rate data, not a measured conversion rate for your profile, so track your own numbers and recalculate.',
    },
    red_banner:
      today >= config.roadmap.gate3Date && total === 0
        ? 'Gate 3 has passed and applications should have started. Part 13 is explicit: applications begin at Gate 3 on 13 December 2026, not at Gate 4.'
        : null,
    applications_open: today >= config.roadmap.gate3Date,
  });
});

export const POST = authedRoute(async ({ request, user }) => {
  const b = await parseBody(request, applicationBody);

  const result = await run(
    `INSERT INTO applications (user_id, company, role_title, role_code, source, applied_on, status,
                               last_update, referral, salary_offered, jd_url, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user.id,
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
  return jsonOk(await one('SELECT * FROM applications WHERE id = ?', [result.insertId]), 201);
});
