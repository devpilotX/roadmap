/**
 * meta.mjs (routes) | /everything, /stats and the exports.
 *
 * /everything exists to prove nothing was lost. Every trackable item in the
 * roadmap appears in one list, grouped by the part of final.md it came from,
 * with one global completion number and the same number per group.
 */

import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../../db/pool.mjs';
import { EXPORTABLE, toCsv } from '../../lib/exportTables.mjs';
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
} from '../../db/reference.mjs';
import { completedWeeks, dsaSolvedTotal, streakState } from '../../db/progress.mjs';
import { rupeeEvents, sumByMonth, touchStats, dealStats, carePlanFloor } from '../../lib/money.mjs';
import { colourTally } from '../../lib/streaks.mjs';
import { ok, notFound } from '../../lib/errors.mjs';
import { monthLabel, todayInTz } from '../../lib/dates.mjs';
import { validate } from '../../middleware/validate.mjs';
import { config } from '../../config.mjs';

const router = Router();

/* -------------------------------------------------------- GET /everything */

router.get('/everything', async (req, res, next) => {
  try {
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
      query('SELECT week_day_id, learn_done, build_done FROM week_day_progress WHERE user_id = ?', [req.user.id]),
      query('SELECT resource_id, status FROM resource_progress WHERE user_id = ?', [req.user.id]),
      query('SELECT week_link_id, status FROM week_link_progress WHERE user_id = ?', [req.user.id]),
      query('SELECT project_id, status, readme_done_json FROM project_progress WHERE user_id = ?', [req.user.id]),
      query('SELECT gate_no, passed FROM gate_results WHERE user_id = ?', [req.user.id]),
      query('SELECT money_gate_code, passed FROM money_gate_results WHERE user_id = ?', [req.user.id]),
      query('SELECT week_n, completed FROM sunday_logs WHERE user_id = ?', [req.user.id]),
      query("SELECT offer_code, status FROM deals WHERE user_id = ? AND is_deleted = 0", [req.user.id]),
      dsaSolvedTotal(req.user.id),
      query('SELECT p.id, p.name, p.difficulty, t.name AS topic FROM dsa_problems p JOIN dsa_topics t ON t.id = p.topic_id ORDER BY t.ord, p.ord'),
      query("SELECT problem_id, status FROM dsa_progress WHERE user_id = ?", [req.user.id]),
      query('SELECT nz_milestone_id, status FROM nz_progress WHERE user_id = ?', [req.user.id]),
      streakState(req.user.id, today),
      rupeeEvents(req.user.id),
    ]);

    const dp = new Map(dayProgress.map((r) => [Number(r.week_day_id), r]));
    const rp = new Map(resourceProgress.map((r) => [Number(r.resource_id), r.status]));
    const lp = new Map(linkProgress.map((r) => [Number(r.week_link_id), r.status]));
    const pp = new Map(projectProgress.map((r) => [Number(r.project_id), r]));
    const gr = new Map(gateResults.map((r) => [Number(r.gate_no), Number(r.passed) === 1]));
    const mgr = new Map(moneyGateResults.map((r) => [r.money_gate_code, Number(r.passed) === 1]));
    const sl = new Map(sundayLogs.map((r) => [Number(r.week_n), Number(r.completed) === 1]));
    const dealsByOffer = new Set(deals.map((d) => d.offer_code));
    const probStatus = new Map(problemProgress.map((r) => [Number(r.problem_id), r.status]));
    const nzp = new Map(nzProgress.map((r) => [Number(r.nz_milestone_id), r.status]));
    const receivedByMonth = sumByMonth(events);
    const cumulativeByWeekEnd = new Map();
    let running = 0;
    for (const w of weeks) {
      running += events.filter((e) => e.on >= w.start_date && e.on <= w.end_date).reduce((a, e) => a + e.amount, 0);
      cumulativeByWeekEnd.set(w.n, running);
    }

    /** state is 'done', 'partial', 'todo' or 'reference'. */
    const groups = [];
    const add = (key, title, source, items) => groups.push({ key, title, source, items });

    add('week_days', 'The 126 week days', 'Part 4, six rows per week', weekDays.map((d) => {
      const p = dp.get(Number(d.id));
      const learn = Number(p?.learn_done ?? 0) === 1;
      const build = Number(p?.build_done ?? 0) === 1;
      return {
        id: `wd-${d.id}`,
        label: `W${String(d.week_n).padStart(2, '0')} ${d.day_name}`,
        text: `${d.learn_task} | ${d.build_task}`,
        date: d.cal_date,
        week_n: d.week_n,
        state: learn && build ? 'done' : learn || build ? 'partial' : 'todo',
        href: `/weeks/${d.week_n}`,
      };
    }));

    add('calendar_days', 'The 150 calendar days', 'Appendix C', cal.map((d) => {
      const c = streak.byDate.get(d.cal_date);
      return {
        id: `cd-${d.cal_date}`,
        label: `${d.cal_date} ${d.day_label}`,
        text: `${d.learn_task} | ${d.build_task} | ${d.money_task}`,
        date: d.cal_date,
        week_n: d.week_n,
        state: c ? (c.colour === 'green' ? 'done' : c.colour === 'neutral' ? 'reference' : c.logged ? 'partial' : 'todo') : 'todo',
        href: `/calendar?date=${d.cal_date}`,
      };
    }));

    if (problems.length) {
      add('dsa_problems', `The ${problems.length} DSA problems`, 'Striver A2Z, imported by CSV', problems.map((p) => ({
        id: `pr-${p.id}`,
        label: p.name,
        text: `${p.topic}, ${p.difficulty}`,
        state: probStatus.get(Number(p.id)) === 'solved' ? 'done' : probStatus.get(Number(p.id)) ? 'partial' : 'todo',
        href: '/dsa',
      })));
    } else {
      add('dsa_problems', 'The 474 DSA problems', 'Striver A2Z, import pending', [
        {
          id: 'pr-pending',
          label: 'Problem level import is pending',
          text:
            'final.md does not contain the 474 problem names and this app never invents one. Run scripts/import-dsa.mjs with a CSV export from the Striver A2Z tracker or Codolio.',
          state: 'reference',
          href: '/dsa',
        },
      ]);
    }

    add('resources', `The ${resources.length} library links`, 'Part 7, all 20 categories', resources.map((r) => ({
      id: `rs-${r.id}`,
      label: r.label,
      text: `${r.category_name}. ${r.why}`,
      state: rp.get(Number(r.id)) === 'done' ? 'done' : rp.get(Number(r.id)) === 'reading' ? 'partial' : 'todo',
      href: '/library',
    })));

    add('week_links', 'The 120 week links', 'Part 4, links for each week', weekLinks.map((l) => ({
      id: `wl-${l.id}`,
      label: l.label,
      text: `Week ${l.week_n}`,
      week_n: l.week_n,
      state: lp.get(Number(l.id)) === 'done' ? 'done' : lp.get(Number(l.id)) === 'reading' ? 'partial' : 'todo',
      href: `/weeks/${l.week_n}`,
    })));

    const readmeItems = [];
    for (const p of projects) {
      const row = pp.get(Number(p.id));
      let done = [];
      if (row?.readme_done_json) {
        try {
          done = typeof row.readme_done_json === 'string' ? JSON.parse(row.readme_done_json) : row.readme_done_json;
        } catch {
          done = [];
        }
      }
      readmeItems.push({
        id: `pj-${p.id}`,
        label: `${p.code} ${p.name}`,
        text: p.description,
        state: row?.status === 'live' || row?.status === 'shipped' ? 'done' : row?.status === 'in_progress' ? 'partial' : 'todo',
        href: '/projects',
      });
      for (const s of readmeSections) {
        readmeItems.push({
          id: `pj-${p.id}-rs-${s.ord}`,
          label: `${p.code} README ${s.ord}`,
          text: s.title,
          state: done.includes(Number(s.ord)) ? 'done' : 'todo',
          href: '/projects',
        });
      }
    }
    add('projects', 'The 4 projects and their 9 README sections each', 'Part 5', readmeItems);

    add('gates', 'The 4 gates', 'The four gates', gates.map((g) => ({
      id: `gt-${g.no}`,
      label: `Gate ${g.no}, ${g.gate_date}`,
      text: g.condition_text,
      date: g.gate_date,
      week_n: g.week_n,
      state: gr.get(Number(g.no)) ? 'done' : 'todo',
      href: '/gates',
    })));

    add('money_gates', 'The 4 money gates', 'Part 17.12', moneyGates.map((g) => ({
      id: `mg-${g.code}`,
      label: `${g.code}, ${g.gate_date}`,
      text: g.condition_text,
      date: g.gate_date,
      state: mgr.get(g.code) ? 'done' : 'todo',
      href: '/gates',
    })));

    add('sundays', 'The 21 Sundays', 'Part 3, The Sundays', sundays.map((s) => ({
      id: `su-${s.week_n}`,
      label: `Week ${s.week_n} Sunday, ${s.sunday_date}`,
      text: `${s.type_text}. ${s.topic}`,
      date: s.sunday_date,
      week_n: s.week_n,
      state: s.kind === 'rest' ? 'reference' : sl.get(Number(s.week_n)) ? 'done' : 'todo',
      href: '/sundays',
    })));

    add('offers', 'The 8 offers', 'Part 17.4', offers.map((o) => ({
      id: `of-${o.code}`,
      label: `${o.code} ${o.name}`,
      text: `${o.scope} Delivery ${o.delivery}. ${o.price_band_text}`,
      state: dealsByOffer.has(o.code) ? 'done' : 'todo',
      href: '/money',
    })));

    add('money_weeks', 'The 21 money weeks', 'Part 17.14', moneyWeeks.map((m) => ({
      id: `mw-${m.week_n}`,
      label: `Week ${m.week_n} money`,
      text: `${m.focus}. Target ${m.target_text}`,
      week_n: m.week_n,
      state: (cumulativeByWeekEnd.get(m.week_n) ?? 0) >= Number(m.target_low) && Number(m.target_low) > 0 ? 'done' : 'todo',
      href: '/money',
    })));

    add('ladder', 'The Part 13 ladder rows', 'Part 13, The real ladder', ladder.map((l) => ({
      id: `ld-${l.id}`,
      label: l.milestone,
      text: `${l.unlock_date}. ${l.roles_text}. ${l.verdict}`,
      date: l.unlock_date,
      state: 'reference',
      href: '/ladder',
    })));

    add('nz_milestones', 'The New Zealand timeline', 'Part 16 timeline', nzMilestones.map((m) => ({
      id: `nz-${m.id}`,
      label: `${m.milestone_date}, ${m.age_label}`,
      text: m.milestone,
      state: nzp.get(Number(m.id)) === 'done' ? 'done' : nzp.get(Number(m.id)) === 'in_progress' ? 'partial' : 'todo',
      href: '/newzealand',
    })));

    add('nz_costs', 'The 8 New Zealand cost rows', 'Part 16, What the move actually costs', nzCosts.map((c) => ({
      id: `nzc-${c.id}`,
      label: c.item,
      text: `${c.cost_rupees}. ${c.basis}`,
      state: 'reference',
      href: '/newzealand',
    })));

    add('nz_salary', 'The 3 New Zealand salary rows', 'Part 16, What the salary is actually worth', nzSalary.map((s) => ({
      id: `nzs-${s.id}`,
      label: s.gross_nzd,
      text: `${s.gross_rupees}, tax ${s.effective_tax_pct}, net ${s.net_nzd} which is ${s.net_rupees}`,
      state: 'reference',
      href: '/newzealand',
    })));

    add('nz_projection', 'The 5 New Zealand projection rows', 'Part 16, Where the crores actually come from', nzProjection.map((p) => ({
      id: `nzp-${p.id}`,
      label: `${p.years_after_landing} years after landing, age ${p.real_age}`,
      text: p.accumulated_rupees,
      state: 'reference',
      href: '/newzealand',
    })));

    add('roles_early', 'The 9 early roles', 'Part 19.2', rolesEarly.map((r) => ({
      id: `re-${r.code}`,
      label: `${r.code} ${r.role}`,
      text: `${r.earliest_text}. ${r.entry_band}. ${r.verdict}`,
      state: 'reference',
      href: '/eligibility',
    })));

    add('eligibility_weeks', 'The 22 eligibility ladder rows', 'Part 19.3', eligWeeks.map((e) => ({
      id: `ew-${e.week_key}`,
      label: `${e.week_key}, ${e.reached_date}, ${e.dsa_total} problems`,
      text: `${e.newly_holds}. Newly eligible: ${e.newly_eligible_text}. ${e.apply_verdict}`,
      date: e.reached_date,
      state: 'reference',
      href: '/eligibility',
    })));

    add('eligibility_dsa', 'The 13 DSA only ladder rows', 'Part 19.4', eligDsa.map((e) => ({
      id: `ed-${e.problems}`,
      label: `${e.problems} problems, ${e.reached_about}`,
      text: `Gets you past: ${e.gets_you_past}. Does not open: ${e.does_not_open}`,
      state: solved.total >= Number(e.problems) ? 'done' : 'todo',
      href: '/eligibility',
    })));

    add('fast_exits', 'The 4 fast exits', 'Part 19.5', fastExits.map((e) => ({
      id: `fe-${e.exit_no}`,
      label: `${e.exit_label}, ${e.exit_date}`,
      text: `${e.roles_available}. ${e.band}. ${e.verdict}`,
      date: e.exit_date,
      state: 'reference',
      href: '/eligibility',
    })));

    add('skill_combos', 'The 8 skill combination rows', 'Part 19.6', combos.map((c) => ({
      id: `sc-${c.sort_order}`,
      label: c.stack_held,
      text: `DSA ${c.dsa_needed_text}. Unlocks ${c.roles_unlocked_text}. ${c.band}. ${c.interview_you_face}`,
      state: 'reference',
      href: '/eligibility',
    })));

    /* ---- the numbers ---- */
    const summarise = (items) => {
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
    const allItems = withCounts.flatMap((g) => g.items.map((i) => ({ ...i, group: g.key, group_title: g.title })));
    const global = summarise(allItems);

    return ok(res, {
      today,
      global,
      groups: withCounts.map((g) => ({ key: g.key, title: g.title, source: g.source, counts: g.counts })),
      items: allItems,
      item_count: allItems.length,
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------- GET /stats */

router.get('/stats', async (req, res, next) => {
  try {
    const today = todayInTz();
    const [weeks, cal] = await Promise.all([getWeeks(), getCalendarDays()]);
    const [
      blockMinutes,
      dsaByWeek,
      streak,
      phaseRows,
      appFunnel,
      events,
      touches,
      deals,
      care,
      videoRows,
      solved,
    ] = await Promise.all([
      query(
        `SELECT c.week_n, s.block, SUM(s.minutes) AS minutes
           FROM study_sessions s JOIN calendar_days c ON c.cal_date = s.session_date
          WHERE s.user_id = ? AND c.week_n IS NOT NULL
          GROUP BY c.week_n, s.block ORDER BY c.week_n`,
        [req.user.id]
      ),
      query(
        `SELECT c.week_n, COALESCE(SUM(l.dsa_solved), 0) AS solved,
                COALESCE(SUM(l.dsa_minutes), 0) AS minutes
           FROM calendar_days c LEFT JOIN day_logs l ON l.log_date = c.cal_date AND l.user_id = ?
          WHERE c.week_n IS NOT NULL GROUP BY c.week_n ORDER BY c.week_n`,
        [req.user.id]
      ),
      streakState(req.user.id, today),
      query(
        `SELECT w.phase_code,
                COUNT(DISTINCT d.id) AS day_rows,
                SUM(CASE WHEN p.learn_done = 1 THEN 1 ELSE 0 END) AS learn_done,
                SUM(CASE WHEN p.build_done = 1 THEN 1 ELSE 0 END) AS build_done
           FROM week_days d
           JOIN weeks w ON w.n = d.week_n
           LEFT JOIN week_day_progress p ON p.week_day_id = d.id AND p.user_id = ?
          GROUP BY w.phase_code ORDER BY w.phase_code`,
        [req.user.id]
      ),
      query(
        'SELECT status, COUNT(*) AS n FROM applications WHERE user_id = ? AND is_deleted = 0 GROUP BY status',
        [req.user.id]
      ),
      rupeeEvents(req.user.id),
      touchStats(req.user.id),
      dealStats(req.user.id),
      carePlanFloor(req.user.id),
      query(
        'SELECT log_date, video_minutes FROM day_logs WHERE user_id = ? AND video_minutes > 0 ORDER BY log_date',
        [req.user.id]
      ),
      dsaSolvedTotal(req.user.id),
    ]);

    const hoursByWeek = new Map();
    for (const r of blockMinutes) {
      const w = Number(r.week_n);
      if (!hoursByWeek.has(w)) hoursByWeek.set(w, {});
      hoursByWeek.get(w)[r.block] = Number(r.minutes);
    }

    let cumulative = 0;
    const dsaCurve = weeks.map((w) => {
      const row = dsaByWeek.find((r) => Number(r.week_n) === w.n);
      cumulative += Number(row?.solved ?? 0);
      return {
        week_n: w.n,
        end_date: w.end_date,
        plan: w.dsa_cumulative,
        actual: w.end_date <= today ? cumulative : null,
        minutes: Number(row?.minutes ?? 0),
      };
    });

    const byMonth = sumByMonth(events);

    return ok(res, {
      today,
      hours_by_block_by_week: weeks.map((w) => ({
        week_n: w.n,
        dates_label: w.dates_label,
        blocks: hoursByWeek.get(w.n) ?? {},
        total_minutes: Object.values(hoursByWeek.get(w.n) ?? {}).reduce((a, b) => a + b, 0),
      })),
      dsa_curve: dsaCurve,
      dsa_solved: solved.total,
      dsa_target: config.roadmap.dsaTargetByEnd,
      colours: colourTally(streak.days),
      streak: { current: streak.current, longest: streak.longest },
      day_history: streak.days.map((d) => ({ date: d.cal_date, colour: d.colour, met: d.met, total: d.total })),
      phases: phaseRows.map((p) => ({
        phase_code: p.phase_code,
        day_rows: Number(p.day_rows),
        learn_done: Number(p.learn_done),
        build_done: Number(p.build_done),
        percent: Math.round(((Number(p.learn_done) + Number(p.build_done)) / (Number(p.day_rows) * 2)) * 100),
      })),
      applications: (() => {
        const byStatus = Object.fromEntries(appFunnel.map((r) => [r.status, Number(r.n)]));
        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
        return {
          by_status: byStatus,
          total,
          target: config.roadmap.gate4Applications,
          conversion: {
            to_screen: total ? Math.round(((byStatus.screen ?? 0) / total) * 1000) / 10 : 0,
            to_offer: total ? Math.round(((byStatus.offer ?? 0) / total) * 1000) / 10 : 0,
          },
        };
      })(),
      money: {
        by_month: [...byMonth.entries()].map(([k, v]) => ({ month: k, label: monthLabel(k), amount: v })),
        total: events.reduce((a, e) => a + e.amount, 0),
        target: config.roadmap.moneyTargetRupees,
        touches,
        deals,
        care_plans: care,
      },
      video: {
        days_over_cap: videoRows.filter((r) => Number(r.video_minutes) > config.roadmap.videoMinutesCap).length,
        cap: config.roadmap.videoMinutesCap,
        rows: videoRows,
        total_minutes: videoRows.reduce((a, r) => a + Number(r.video_minutes), 0),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------- GET /ops */

/**
 * The operational record: when the scripts last ran and what they found.
 *
 * `link_check_runs`, `backup_log` and `dsa_imports` are written by
 * scripts/check-links.mjs, scripts/backup.sh, scripts/backup.mjs,
 * scripts/export-all.mjs and scripts/import-dsa.mjs. Nothing read them, which
 * meant /profile could only claim a backup existed rather than show one. This is
 * the read side, so "when was the last backup" has an answer that comes from the
 * row the script actually wrote.
 */
router.get('/ops', async (req, res, next) => {
  try {
    const [links, backups, imports, deadResources, deadWeekLinks] = await Promise.all([
      query('SELECT id, started_at, finished_at, checked_count, dead_count, notes FROM link_check_runs ORDER BY id DESC LIMIT 10'),
      query('SELECT id, ran_at, kind, file_name, bytes, ok, message FROM backup_log ORDER BY id DESC LIMIT 15'),
      query(
        `SELECT id, source_name, rows_read, rows_written, easy_count, medium_count, hard_count,
                dry_run, report, created_at
           FROM dsa_imports ORDER BY id DESC LIMIT 10`
      ),
      query('SELECT category_no, ord, label, url, last_status, last_checked FROM resources WHERE is_alive = 0 ORDER BY category_no, ord'),
      query('SELECT week_n, ord, label, url, last_status, last_checked FROM week_links WHERE is_alive = 0 ORDER BY week_n, ord'),
    ]);

    const lastOf = (rows, kind) => rows.find((r) => r.kind === kind) ?? null;

    return ok(res, {
      link_check: {
        runs: links,
        last: links[0] ?? null,
        dead_resources: deadResources,
        dead_week_links: deadWeekLinks,
        dead_total: deadResources.length + deadWeekLinks.length,
        note: 'A dead link is flagged, never deleted. Cross reference Appendix A for the replacement.',
      },
      backups: {
        rows: backups,
        last_dump: lastOf(backups, 'dump'),
        last_export: lastOf(backups, 'export'),
        note: 'A dump is mysqldump. An export is the CSV and JSON copy you can read without this application.',
      },
      dsa_imports: {
        rows: imports,
        last: imports[0] ?? null,
        note:
          'final.md does not contain the 474 problem names. They only ever arrive through ' +
          'scripts/import-dsa.mjs from a real tracker export.',
      },
      commands: [
        { label: 'Check every link', command: 'npm run check-links' },
        { label: 'Back up the database', command: 'npm run backup' },
        { label: 'Export everything to disk', command: 'npm run export-all' },
        { label: 'Import a DSA export', command: 'npm run import-dsa -- export.csv' },
        { label: 'Sync GitHub pushes', command: 'npm run sync-github' },
        { label: 'Write the Saturday digest', command: 'npm run digest' },
      ],
    });
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------- CSV and JSON export */

/**
 * The table list and the CSV writer live in src/lib/exportTables.mjs, so
 * scripts/export-all.mjs and these two routes can never drift apart.
 */

// all.json is declared before the :name route, otherwise ":name" would swallow it.
router.get('/export/all.json', async (req, res, next) => {
  try {
    const out = { exported_at: new Date().toISOString(), user_id: req.user.id, tables: {} };
    for (const [name, spec] of Object.entries(EXPORTABLE)) {
      out.tables[name] = spec.user
        ? await query(`SELECT * FROM \`${name}\` WHERE user_id = ?`, [req.user.id])
        : await query(`SELECT * FROM \`${name}\``);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="roadmap-export.json"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(JSON.stringify(out, null, 2));
  } catch (err) {
    return next(err);
  }
});

router.get(
  '/export/:name',
  validate({ params: z.object({ name: z.string().max(80) }) }),
  async (req, res, next) => {
    try {
      const name = req.params.name.replace(/\.csv$/i, '');
      const spec = EXPORTABLE[name];
      if (!spec) {
        throw notFound(
          `${name} is not exportable. Try one of: ${Object.keys(EXPORTABLE).sort().join(', ')}`
        );
      }
      const rows = spec.user
        ? await query(`SELECT * FROM \`${name}\` WHERE user_id = ?`, [req.user.id])
        : await query(`SELECT * FROM \`${name}\``);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
      res.setHeader('Cache-Control', 'no-store');
      return res.send(toCsv(rows));
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
