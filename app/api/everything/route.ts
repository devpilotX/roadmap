/**
 * GET /api/everything
 *
 * This screen exists to prove nothing was lost. Every trackable item in the
 * roadmap appears in one list, grouped by the part of final.md it came from,
 * with one global completion number and the same number per group.
 */

import { query } from '@/lib/db/pool';
import {
  getCalendarDays,
  getEligibilityDsa,
  getEligibilityWeeks,
  getFastExits,
  getGates,
  getMoneyGates,
  getMoneyWeekTargets,
  getNzCosts,
  getNzMilestones,
  getNzProjection,
  getNzSalary,
  getOffers,
  getProjects,
  getReadmeSections,
  getResources,
  getRoleUnlocks,
  getRolesEarly,
  getSkillCombos,
  getSundays,
  getWeekDays,
  getWeekLinks,
  getWeeks,
} from '@/lib/db/reference';
import { dsaSolvedTotal, streakState } from '@/lib/db/progress';
import { rupeeEvents } from '@/lib/money';
import { todayInTz } from '@/lib/dates';
import { authedRoute, jsonOk } from '@/lib/server/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type State = 'done' | 'partial' | 'todo' | 'reference';

interface Item {
  id: string;
  label: string;
  text: string;
  state: State;
  href: string;
  date?: string | null;
  week_n?: number | null;
}

interface Group {
  key: string;
  title: string;
  source: string;
  items: Item[];
}

export const GET = authedRoute(async ({ user }) => {
  const today = todayInTz();

  const [
    weekDays,
    cal,
    resources,
    weekLinks,
    projects,
    readmeSections,
    gates,
    moneyGates,
    sundays,
    offers,
    moneyWeeks,
    ladder,
    nzMilestones,
    nzCosts,
    nzSalary,
    nzProjection,
    rolesEarly,
    eligWeeks,
    eligDsa,
    fastExits,
    combos,
    weeks,
  ] = await Promise.all([
    getWeekDays(),
    getCalendarDays(),
    getResources(),
    getWeekLinks(),
    getProjects(),
    getReadmeSections(),
    getGates(),
    getMoneyGates(),
    getSundays(),
    getOffers(),
    getMoneyWeekTargets(),
    getRoleUnlocks(),
    getNzMilestones(),
    getNzCosts(),
    getNzSalary(),
    getNzProjection(),
    getRolesEarly(),
    getEligibilityWeeks(),
    getEligibilityDsa(),
    getFastExits(),
    getSkillCombos(),
    getWeeks(),
  ]);

  const [
    dayProgress,
    resourceProgress,
    linkProgress,
    projectProgress,
    gateResults,
    moneyGateResults,
    sundayLogs,
    deals,
    solved,
    problems,
    problemProgress,
    nzProgress,
    streak,
    events,
  ] = await Promise.all([
    query('SELECT week_day_id, learn_done, build_done FROM week_day_progress WHERE user_id = ?', [
      user.id,
    ]),
    query('SELECT resource_id, status FROM resource_progress WHERE user_id = ?', [user.id]),
    query('SELECT week_link_id, status FROM week_link_progress WHERE user_id = ?', [user.id]),
    query('SELECT project_id, status, readme_done_json FROM project_progress WHERE user_id = ?', [
      user.id,
    ]),
    query('SELECT gate_no, passed FROM gate_results WHERE user_id = ?', [user.id]),
    query('SELECT money_gate_code, passed FROM money_gate_results WHERE user_id = ?', [user.id]),
    query('SELECT week_n, completed FROM sunday_logs WHERE user_id = ?', [user.id]),
    query('SELECT offer_code, status FROM deals WHERE user_id = ? AND is_deleted = 0', [user.id]),
    dsaSolvedTotal(user.id),
    query(
      'SELECT p.id, p.name, p.difficulty, t.name AS topic FROM dsa_problems p JOIN dsa_topics t ON t.id = p.topic_id ORDER BY t.ord, p.ord'
    ),
    query('SELECT problem_id, status FROM dsa_progress WHERE user_id = ?', [user.id]),
    query('SELECT nz_milestone_id, status FROM nz_progress WHERE user_id = ?', [user.id]),
    streakState(user.id, today),
    rupeeEvents(user.id),
  ]);

  const dp = new Map(dayProgress.map((r) => [Number(r.week_day_id), r]));
  const rp = new Map(resourceProgress.map((r) => [Number(r.resource_id), r.status as string]));
  const lp = new Map(linkProgress.map((r) => [Number(r.week_link_id), r.status as string]));
  const pp = new Map(projectProgress.map((r) => [Number(r.project_id), r]));
  const gr = new Map(gateResults.map((r) => [Number(r.gate_no), Number(r.passed) === 1]));
  const mgr = new Map(
    moneyGateResults.map((r) => [r.money_gate_code as string, Number(r.passed) === 1])
  );
  const sl = new Map(sundayLogs.map((r) => [Number(r.week_n), Number(r.completed) === 1]));
  const dealsByOffer = new Set(deals.map((d) => d.offer_code as string));
  const probStatus = new Map(problemProgress.map((r) => [Number(r.problem_id), r.status as string]));
  const nzp = new Map(nzProgress.map((r) => [Number(r.nz_milestone_id), r.status as string]));

  const cumulativeByWeekEnd = new Map<number, number>();
  let running = 0;
  for (const w of weeks) {
    running += events
      .filter((e) => e.on >= w.start_date && e.on <= w.end_date)
      .reduce((a, e) => a + e.amount, 0);
    cumulativeByWeekEnd.set(Number(w.n), running);
  }

  const groups: Group[] = [];
  const add = (key: string, title: string, source: string, items: Item[]) =>
    groups.push({ key, title, source, items });

  add(
    'week_days',
    'The 126 week days',
    'Part 4, six rows per week',
    weekDays.map((d) => {
      const p = dp.get(Number(d.id));
      const learn = Number(p?.learn_done ?? 0) === 1;
      const build = Number(p?.build_done ?? 0) === 1;
      return {
        id: `wd-${d.id}`,
        label: `W${String(d.week_n).padStart(2, '0')} ${d.day_name}`,
        text: `${d.learn_task} | ${d.build_task}`,
        date: d.cal_date as string,
        week_n: Number(d.week_n),
        state: learn && build ? 'done' : learn || build ? 'partial' : 'todo',
        href: `/weeks/${d.week_n}`,
      };
    })
  );

  add(
    'calendar_days',
    'The 150 calendar days',
    'Appendix C',
    cal.map((d) => {
      const c = streak.byDate.get(d.cal_date as string);
      return {
        id: `cd-${d.cal_date}`,
        label: `${d.cal_date} ${d.day_label}`,
        text: `${d.learn_task} | ${d.build_task} | ${d.money_task}`,
        date: d.cal_date as string,
        week_n: (d.week_n as number | null) ?? null,
        state: c
          ? c.colour === 'green'
            ? 'done'
            : c.colour === 'neutral'
              ? 'reference'
              : c.logged
                ? 'partial'
                : 'todo'
          : 'todo',
        href: `/calendar?date=${d.cal_date}`,
      };
    })
  );

  if (problems.length) {
    add(
      'dsa_problems',
      `The ${problems.length} DSA problems`,
      'Striver A2Z, imported by CSV',
      problems.map((p) => ({
        id: `pr-${p.id}`,
        label: String(p.name),
        text: `${p.topic}, ${p.difficulty}`,
        state:
          probStatus.get(Number(p.id)) === 'solved'
            ? 'done'
            : probStatus.get(Number(p.id))
              ? 'partial'
              : 'todo',
        href: '/dsa',
      }))
    );
  } else {
    add('dsa_problems', 'The 474 DSA problems', 'Striver A2Z, import pending', [
      {
        id: 'pr-pending',
        label: 'Problem level import is pending',
        text: 'final.md does not contain the 474 problem names and this app never invents one. Run scripts/import-dsa.mjs with a CSV export from the Striver A2Z tracker or Codolio.',
        state: 'reference',
        href: '/dsa',
      },
    ]);
  }

  add(
    'resources',
    `The ${resources.length} library links`,
    'Part 7, all 20 categories',
    resources.map((r) => ({
      id: `rs-${r.id}`,
      label: String(r.label),
      text: `${r.category_name}. ${r.why}`,
      state:
        rp.get(Number(r.id)) === 'done'
          ? 'done'
          : rp.get(Number(r.id)) === 'reading'
            ? 'partial'
            : 'todo',
      href: '/library',
    }))
  );

  add(
    'week_links',
    'The 120 week links',
    'Part 4, links for each week',
    weekLinks.map((l) => ({
      id: `wl-${l.id}`,
      label: String(l.label),
      text: `Week ${l.week_n}`,
      week_n: Number(l.week_n),
      state:
        lp.get(Number(l.id)) === 'done'
          ? 'done'
          : lp.get(Number(l.id)) === 'reading'
            ? 'partial'
            : 'todo',
      href: `/weeks/${l.week_n}`,
    }))
  );

  const readmeItems: Item[] = [];
  for (const p of projects) {
    const row = pp.get(Number(p.id));
    let done: number[] = [];
    if (row?.readme_done_json) {
      try {
        done =
          typeof row.readme_done_json === 'string'
            ? JSON.parse(row.readme_done_json)
            : row.readme_done_json;
      } catch {
        done = [];
      }
    }
    readmeItems.push({
      id: `pj-${p.id}`,
      label: `${p.code} ${p.name}`,
      text: String(p.description),
      state:
        row?.status === 'live' || row?.status === 'shipped'
          ? 'done'
          : row?.status === 'in_progress'
            ? 'partial'
            : 'todo',
      href: '/projects',
    });
    for (const s of readmeSections) {
      readmeItems.push({
        id: `pj-${p.id}-rs-${s.ord}`,
        label: `${p.code} README ${s.ord}`,
        text: String(s.title),
        state: done.includes(Number(s.ord)) ? 'done' : 'todo',
        href: '/projects',
      });
    }
  }
  add('projects', 'The 4 projects and their 9 README sections each', 'Part 5', readmeItems);

  add(
    'gates',
    'The 4 gates',
    'The four gates',
    gates.map((g) => ({
      id: `gt-${g.no}`,
      label: `Gate ${g.no}, ${g.gate_date}`,
      text: String(g.condition_text),
      date: g.gate_date as string,
      week_n: Number(g.week_n),
      state: gr.get(Number(g.no)) ? 'done' : 'todo',
      href: '/gates',
    }))
  );

  add(
    'money_gates',
    'The 4 money gates',
    'Part 17.12',
    moneyGates.map((g) => ({
      id: `mg-${g.code}`,
      label: `${g.code}, ${g.gate_date}`,
      text: String(g.condition_text),
      date: g.gate_date as string,
      state: mgr.get(g.code as string) ? 'done' : 'todo',
      href: '/gates',
    }))
  );

  add(
    'sundays',
    'The 21 Sundays',
    'Part 3, The Sundays',
    sundays.map((s) => ({
      id: `su-${s.week_n}`,
      label: `Week ${s.week_n} Sunday, ${s.sunday_date}`,
      text: `${s.type_text}. ${s.topic}`,
      date: s.sunday_date as string,
      week_n: Number(s.week_n),
      state: s.kind === 'rest' ? 'reference' : sl.get(Number(s.week_n)) ? 'done' : 'todo',
      href: '/sundays',
    }))
  );

  add(
    'offers',
    'The 8 offers',
    'Part 17.4',
    offers.map((o) => ({
      id: `of-${o.code}`,
      label: `${o.code} ${o.name}`,
      text: `${o.scope} Delivery ${o.delivery}. ${o.price_band_text}`,
      state: dealsByOffer.has(o.code as string) ? 'done' : 'todo',
      href: '/money',
    }))
  );

  add(
    'money_weeks',
    'The 21 money weeks',
    'Part 17.14',
    moneyWeeks.map((m) => ({
      id: `mw-${m.week_n}`,
      label: `Week ${m.week_n} money`,
      text: `${m.focus}. Target ${m.target_text}`,
      week_n: Number(m.week_n),
      state:
        (cumulativeByWeekEnd.get(Number(m.week_n)) ?? 0) >= Number(m.target_low) &&
        Number(m.target_low) > 0
          ? 'done'
          : 'todo',
      href: '/money',
    }))
  );

  add(
    'ladder',
    'The Part 13 ladder rows',
    'Part 13, The real ladder',
    ladder.map((l) => ({
      id: `ld-${l.id}`,
      label: String(l.milestone),
      text: `${l.unlock_date}. ${l.roles_text}. ${l.verdict}`,
      date: l.unlock_date as string,
      state: 'reference',
      href: '/ladder',
    }))
  );

  add(
    'nz_milestones',
    'The New Zealand timeline',
    'Part 16 timeline',
    nzMilestones.map((m) => ({
      id: `nz-${m.id}`,
      label: `${m.milestone_date}, ${m.age_label}`,
      text: String(m.milestone),
      state:
        nzp.get(Number(m.id)) === 'done'
          ? 'done'
          : nzp.get(Number(m.id)) === 'in_progress'
            ? 'partial'
            : 'todo',
      href: '/newzealand',
    }))
  );

  add(
    'nz_costs',
    'The 8 New Zealand cost rows',
    'Part 16, What the move actually costs',
    nzCosts.map((c) => ({
      id: `nzc-${c.id}`,
      label: String(c.item),
      text: `${c.cost_rupees}. ${c.basis}`,
      state: 'reference',
      href: '/newzealand',
    }))
  );

  add(
    'nz_salary',
    'The 3 New Zealand salary rows',
    'Part 16, What the salary is actually worth',
    nzSalary.map((s) => ({
      id: `nzs-${s.id}`,
      label: String(s.gross_nzd),
      text: `${s.gross_rupees}, tax ${s.effective_tax_pct}, net ${s.net_nzd} which is ${s.net_rupees}`,
      state: 'reference',
      href: '/newzealand',
    }))
  );

  add(
    'nz_projection',
    'The 5 New Zealand projection rows',
    'Part 16, Where the crores actually come from',
    nzProjection.map((p) => ({
      id: `nzp-${p.id}`,
      label: `${p.years_after_landing} years after landing, age ${p.real_age}`,
      text: String(p.accumulated_rupees),
      state: 'reference',
      href: '/newzealand',
    }))
  );

  add(
    'roles_early',
    'The 9 early roles',
    'Part 19.2',
    rolesEarly.map((r) => ({
      id: `re-${r.code}`,
      label: `${r.code} ${r.role}`,
      text: `${r.earliest_text}. ${r.entry_band}. ${r.verdict}`,
      state: 'reference',
      href: '/eligibility',
    }))
  );

  add(
    'eligibility_weeks',
    'The 22 eligibility ladder rows',
    'Part 19.3',
    eligWeeks.map((e) => ({
      id: `ew-${e.week_key}`,
      label: `${e.week_key}, ${e.reached_date}, ${e.dsa_total} problems`,
      text: `${e.newly_holds}. Newly eligible: ${e.newly_eligible_text}. ${e.apply_verdict}`,
      date: e.reached_date as string,
      state: 'reference',
      href: '/eligibility',
    }))
  );

  add(
    'eligibility_dsa',
    'The 13 DSA only ladder rows',
    'Part 19.4',
    eligDsa.map((e) => ({
      id: `ed-${e.problems}`,
      label: `${e.problems} problems, ${e.reached_about}`,
      text: `Gets you past: ${e.gets_you_past}. Does not open: ${e.does_not_open}`,
      state: solved.total >= Number(e.problems) ? 'done' : 'todo',
      href: '/eligibility',
    }))
  );

  add(
    'fast_exits',
    'The 4 fast exits',
    'Part 19.5',
    fastExits.map((e) => ({
      id: `fe-${e.exit_no}`,
      label: `${e.exit_label}, ${e.exit_date}`,
      text: `${e.roles_available}. ${e.band}. ${e.verdict}`,
      date: e.exit_date as string,
      state: 'reference',
      href: '/eligibility',
    }))
  );

  add(
    'skill_combos',
    'The 8 skill combination rows',
    'Part 19.6',
    combos.map((c) => ({
      id: `sc-${c.sort_order}`,
      label: String(c.stack_held),
      text: `DSA ${c.dsa_needed_text}. Unlocks ${c.roles_unlocked_text}. ${c.band}. ${c.interview_you_face}`,
      state: 'reference',
      href: '/eligibility',
    }))
  );

  /* ---- the numbers ---- */
  const summarise = (items: Item[]) => {
    const trackable = items.filter((i) => i.state !== 'reference');
    const done = trackable.filter((i) => i.state === 'done').length;
    const partial = trackable.filter((i) => i.state === 'partial').length;
    return {
      total: items.length,
      trackable: trackable.length,
      done,
      partial,
      todo: trackable.length - done - partial,
      percent: trackable.length ? Math.round((done / trackable.length) * 100) : 0,
    };
  };

  const withCounts = groups.map((g) => ({ ...g, counts: summarise(g.items) }));
  const allItems = withCounts.flatMap((g) =>
    g.items.map((i) => ({ ...i, group: g.key, group_title: g.title }))
  );
  const global = summarise(allItems);

  return jsonOk({
    today,
    global,
    groups: withCounts.map((g) => ({
      key: g.key,
      title: g.title,
      source: g.source,
      counts: g.counts,
    })),
    items: allItems,
    item_count: allItems.length,
  });
});
