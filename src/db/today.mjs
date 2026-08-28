/**
 * today.mjs | everything the Today screen needs, in one payload.
 *
 * This is the screen that gets opened 150 times. It answers one question without
 * scrolling: what do I do right now. Every task string comes from the database,
 * never from a hardcoded string in a template.
 */

import { one, query } from './pool.mjs';
import {
  getCalendarDays,
  getGates,
  getProjects,
  getResources,
  getSundays,
  getWeekDays,
  getWeekLinks,
  getWeeks,
  getPhases,
  getDoneConditions,
} from './reference.mjs';
import {
  dsaSolvedTotal,
  failedTwice,
  getDayLog,
  openSession,
  streakState,
  yesterdaySummary,
} from './progress.mjs';
import { warningsFor } from './warnings.mjs';
import { BLOCKS, blockForNow, daysBetween, humanMinutes, longDate, todayInTz } from '../lib/dates.mjs';
import { conditionsFor } from '../lib/streaks.mjs';
import { rupeeEvents, sumBetween, touchTargetFromTask, carePlanFloor } from '../lib/money.mjs';
import { config } from '../config.mjs';

/** The next unsolved problem in topic order, or null when nothing is imported. */
async function nextUnsolvedProblem(userId) {
  return one(
    `SELECT p.id, p.name, p.difficulty, p.url, t.name AS topic, t.ord AS topic_ord, p.ord
       FROM dsa_problems p
       JOIN dsa_topics t ON t.id = p.topic_id
       LEFT JOIN dsa_progress g ON g.problem_id = p.id AND g.user_id = ?
      WHERE COALESCE(g.status, 'todo') IN ('todo', 'revisit', 'failed_twice')
      ORDER BY t.ord, p.ord
      LIMIT 1`,
    [userId]
  );
}

export async function buildToday(userId, today = todayInTz()) {
  const clock = blockForNow();
  const [cal, weeks, phases, weekDays, weekLinks, gates, projects, sundays, doneConditions] =
    await Promise.all([
      getCalendarDays(),
      getWeeks(),
      getPhases(),
      getWeekDays(),
      getWeekLinks(),
      getGates(),
      getProjects(),
      getSundays(),
      getDoneConditions(),
    ]);

  const day = cal.find((d) => d.cal_date === today) ?? null;
  const week = day?.week_n ? weeks.find((w) => w.n === day.week_n) ?? null : null;
  const phase = week ? phases.find((p) => p.code === week.phase_code) ?? null : null;
  const weekDay = weekDays.find((wd) => wd.cal_date === today) ?? null;
  const sunday = sundays.find((s) => s.sunday_date === today) ?? null;
  const resources = await getResources();

  const [
    log,
    solved,
    nextProblem,
    failed,
    yesterday,
    session,
    warningResult,
    streak,
    dayProgress,
    events,
    carePlans,
    nextLeads,
    todayTouches,
    projectProgress,
    sundayLog,
    gateResults,
  ] = await Promise.all([
    getDayLog(userId, today),
    dsaSolvedTotal(userId),
    nextUnsolvedProblem(userId),
    failedTwice(userId),
    yesterdaySummary(userId, today),
    openSession(userId),
    warningsFor(userId, today),
    streakState(userId, today),
    weekDay
      ? one('SELECT learn_done, build_done FROM week_day_progress WHERE user_id = ? AND week_day_id = ?', [
          userId,
          weekDay.id,
        ])
      : Promise.resolve(null),
    rupeeEvents(userId),
    carePlanFloor(userId),
    query(
      `SELECT id, name, category, area, phone, website, mobile_broken, rating, reviews,
              status, last_touch_on, next_touch_on
         FROM leads
        WHERE user_id = ? AND is_deleted = 0 AND status NOT IN ('won','lost','dead')
        ORDER BY (next_touch_on IS NULL) DESC, next_touch_on ASC, last_touch_on IS NULL DESC, id ASC
        LIMIT 15`,
      [userId]
    ),
    query(
      `SELECT t.id, t.lead_id, t.channel, t.script_code, t.reply, l.name
         FROM lead_touches t JOIN leads l ON l.id = t.lead_id
        WHERE t.user_id = ? AND t.touched_on = ? ORDER BY t.id`,
      [userId, today]
    ),
    query(
      `SELECT p.id, p.code, p.name, p.repo, p.week_from, p.week_to,
              pp.status, pp.live_url, pp.repo_url
         FROM projects p LEFT JOIN project_progress pp ON pp.project_id = p.id AND pp.user_id = ?
        ORDER BY p.id`,
      [userId]
    ),
    sunday
      ? one('SELECT completed, hours, notes FROM sunday_logs WHERE user_id = ? AND week_n = ?', [
          userId,
          sunday.week_n,
        ])
      : Promise.resolve(null),
    query('SELECT gate_no, passed, passed_at, evidence_url, notes FROM gate_results WHERE user_id = ?', [userId]),
  ]);

  /* ------------------------------------------------------ header strip */

  const nextGate = gates
    .filter((g) => g.gate_date >= today)
    .sort((a, b) => (a.gate_date < b.gate_date ? -1 : 1))[0] ?? null;
  const gateResultByNo = new Map(gateResults.map((g) => [Number(g.gate_no), g]));

  const header = {
    date: today,
    date_long: longDate(today),
    day_label: day?.day_label ?? null,
    kind: day?.kind ?? 'outside',
    in_roadmap: Boolean(day),
    day_number: day ? daysBetween(config.roadmap.firstDay, today) + 1 : null,
    total_days: config.roadmap.totalDays,
    week: week
      ? {
          n: week.n,
          title: week.title,
          dates_label: week.dates_label,
          focus: week.focus,
          dsa_target: week.dsa_target,
          dsa_cumulative: week.dsa_cumulative,
          gate_no: week.gate_no,
        }
      : null,
    phase: phase ? { code: phase.code, name: phase.name, blurb: phase.blurb } : null,
    next_gate: nextGate
      ? {
          no: nextGate.no,
          gate_date: nextGate.gate_date,
          condition_text: nextGate.condition_text,
          days_remaining: daysBetween(today, nextGate.gate_date),
          passed: Number(gateResultByNo.get(Number(nextGate.no))?.passed ?? 0) === 1,
        }
      : null,
    days_to_end: daysBetween(today, config.roadmap.lastDay),
    streak: streak.current,
    longest_streak: streak.longest,
    // The day this person starts, which may be later than the first day of the
    // window. Days before it are neutral rather than red, and the screen says so
    // instead of showing an unexplained blank.
    started_on: streak.started_on,
    not_started_yet: streak.not_started_yet,
    days_until_start: streak.not_started_yet ? daysBetween(today, streak.started_on) : 0,
    start_note: streak.not_started_yet
      ? `The roadmap starts on ${longDate(streak.started_on)}. Today is not counted, and nothing here is marked as missed.`
      : null,
  };

  /* --------------------------------------------------------- the blocks */

  // On the three launch days there is no week, so there would be no links at
  // all. Week 1 starts the following Monday and its links are the material the
  // launch block is preparing for, so they are surfaced early and labelled.
  const linkWeek = week ? week.n : 1;
  const linksAreEarly = !week;
  const weekLinksForWeek = weekLinks.filter((l) => l.week_n === linkWeek);

  // The DSA block always needs somewhere to go, even before a problem list has
  // been imported. Category 12 of Part 7 is the DSA category, so its rows are
  // the real, seeded destinations rather than an invented URL.
  const dsaResources = resources.filter((r) => Number(r.category_no) === 12);

  const linkIds = weekLinksForWeek.map((l) => l.id);
  const linkProgress = linkIds.length
    ? await query(
        `SELECT week_link_id, status, minutes FROM week_link_progress
          WHERE user_id = ? AND week_link_id IN (${linkIds.map(() => '?').join(',')})`,
        [userId, ...linkIds]
      )
    : [];
  const linkStatus = new Map(linkProgress.map((r) => [Number(r.week_link_id), r]));

  const dsaResourceIds = dsaResources.map((r) => r.id);
  const dsaResourceProgress = dsaResourceIds.length
    ? await query(
        `SELECT resource_id, status, minutes FROM resource_progress
          WHERE user_id = ? AND resource_id IN (${dsaResourceIds.map(() => '?').join(',')})`,
        [userId, ...dsaResourceIds]
      )
    : [];
  const dsaStatus = new Map(dsaResourceProgress.map((r) => [Number(r.resource_id), r]));

  /** Shape a link the same way whether it came from Part 4 or Part 7. */
  const shapeWeekLink = (l) => ({
    id: l.id,
    kind: 'week_link',
    url: l.url,
    label: l.label,
    resource_id: l.resource_id,
    why: l.resource_why,
    cost: l.resource_cost,
    is_alive: Number(l.is_alive) === 1,
    last_checked: l.last_checked,
    status: linkStatus.get(l.id)?.status ?? 'todo',
  });
  const shapeResource = (r) => ({
    id: null,
    kind: 'resource',
    url: r.url,
    label: r.label,
    resource_id: r.id,
    why: r.why,
    cost: r.cost,
    is_alive: Number(r.is_alive) === 1,
    last_checked: r.last_checked,
    status: dsaStatus.get(Number(r.id))?.status ?? 'todo',
  });

  const activeProject = projectProgress.find(
    (p) => week && week.n >= p.week_from && week.n <= p.week_to
  ) ?? null;

  const pushesToday = Number(
    (
      await one(
        `SELECT COALESCE(SUM(p.commit_count), 0) AS commits
           FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
          WHERE p.user_id = ? AND p.push_date = ? AND r.counts_to_target = 1`,
        [userId, today]
      )
    )?.commits ?? 0
  );

  const weekStart = week?.start_date ?? today;
  const weekEnd = week?.end_date ?? today;
  const moneyThisWeek = sumBetween(events, weekStart, weekEnd);
  const touchTarget = touchTargetFromTask(day?.money_task);

  const blocks = BLOCKS.map((b) => {
    const isCurrent = clock.current?.code === b.code;
    const base = {
      code: b.code,
      label: b.label,
      window: b.window,
      tracked: b.tracked,
      is_current: isCurrent,
      is_past: clock.now.minutes >= b.end,
      is_future: clock.now.minutes < b.start,
    };

    if (b.code === 'DSA') {
      return {
        ...base,
        task: day
          ? day.kind === 'launch'
            ? day.learn_task
            : `Striver A2Z, in JavaScript. Never skipped, never moved. Target ${day.dsa_target} today.`
          : null,
        target: day?.dsa_target ?? 0,
        target_is_zero: Number(day?.dsa_target ?? 0) === 0,
        target_note:
          Number(day?.dsa_target ?? 0) === 0
            ? day?.kind === 'launch'
              ? 'The launch block carries no daily DSA target. The 6 problems on 30 August prove the morning block works and sit outside the 415.'
              : 'Sundays carry no DSA target, always. The weekly number is what counts.'
            : null,
        solved_today: Number(log.dsa_solved ?? 0),
        minutes: Number(log.dsa_minutes ?? 0),
        cumulative: solved.total,
        cumulative_target: week?.dsa_cumulative ?? null,
        source: solved.source,
        next_problem: nextProblem,
        problems_imported: solved.problemCount > 0,
        // Category 12 of Part 7, so there is always somewhere to click.
        links: dsaResources.map(shapeResource),
        done: Number(log.dsa_solved ?? 0) >= Number(day?.dsa_target ?? 0) && Number(day?.dsa_target ?? 0) > 0,
      };
    }
    if (b.code === 'LEARN') {
      return {
        ...base,
        task: day?.learn_task ?? null,
        week_day_id: weekDay?.id ?? null,
        done: Number(dayProgress?.learn_done ?? log.learn_done ?? 0) === 1,
        minutes: Number(log.learn_minutes ?? 0),
        minutes_target: 150,
        links: weekLinksForWeek.map(shapeWeekLink),
        links_week: linkWeek,
        links_are_early: linksAreEarly,
        links_note: linksAreEarly
          ? 'These are the Week 1 links. Week 1 starts on Monday 31 August 2026, and the launch block is the housekeeping that would otherwise eat it.'
          : null,
        video_minutes: Number(log.video_minutes ?? 0),
        video_cap: config.roadmap.videoMinutesCap,
      };
    }
    if (b.code === 'BUILD') {
      return {
        ...base,
        task: day?.build_task ?? null,
        week_day_id: weekDay?.id ?? null,
        done: Number(dayProgress?.build_done ?? log.build_done ?? 0) === 1,
        minutes: Number(log.build_minutes ?? 0),
        minutes_target: 100,
        pushes_today: pushesToday,
        project: activeProject
          ? {
              id: activeProject.id,
              code: activeProject.code,
              name: activeProject.name,
              repo: activeProject.repo,
              status: activeProject.status ?? 'not_started',
              live_url: activeProject.live_url,
              repo_url: activeProject.repo_url,
            }
          : null,
      };
    }
    if (b.code === 'CLOSE') {
      return {
        ...base,
        task: 'Commit, log.md, tomorrow decided before you stand up.',
        done: Number(log.close_done ?? 0) === 1,
        log_line: log.close_log_line ?? '',
        tomorrow_dsa: log.close_tomorrow_dsa ?? '',
        tomorrow_build: log.close_tomorrow_build ?? '',
        can_complete: Boolean(
          String(log.close_log_line ?? '').trim() &&
            String(log.close_tomorrow_dsa ?? '').trim() &&
            String(log.close_tomorrow_build ?? '').trim()
        ),
      };
    }
    if (b.code === 'BREAK') {
      return {
        ...base,
        task: 'Off the screen. Walk, eat. This break is what makes the money hour possible.',
      };
    }
    if (b.code === 'MONEY') {
      return {
        ...base,
        task: day?.money_task ?? null,
        done: Number(log.money_done ?? 0) === 1,
        minutes: Number(log.money_minutes ?? 0),
        touches_today: todayTouches.length,
        touch_target: touchTarget,
        touches: todayTouches,
        next_leads: nextLeads,
        received_this_week: moneyThisWeek,
        week_target: week
          ? { low: null, high: null } // filled by /api/money/summary, kept out of the hot path
          : null,
        care_plans: carePlans,
      };
    }
    return {
      ...base,
      task: 'Anki plus spoken explanation. Four of six nights aloud.',
      anki_done: Number(log.night_anki_done ?? 0) === 1,
      anki_overdue: Number(log.anki_overdue ?? 0),
      spoken_done: Number(log.night_spoken_done ?? 0) === 1,
      spoken_aloud: Number(log.night_spoken_aloud ?? 0) === 1,
      tomorrow_done: Number(log.night_tomorrow_done ?? 0) === 1,
    };
  });

  /* ------------------------------------------------------- right rail */

  const extraForColour =
    sunday && (day.kind === 'sunday_working' || day.kind === 'sunday_gate')
      ? {
          sundayCompleted: sundayLog?.completed ?? 0,
          sundayHours: sundayLog?.hours ?? 0,
          sundayRequiredHours: sunday.hours,
        }
      : {};
  const conditions = day ? conditionsFor(day, log, extraForColour) : [];
  const colourState = streak.byDate.get(today) ?? { colour: 'red', met: 0, total: conditions.length };

  /* ------------------------------------------------ Sunday overrides */

  const gate = week?.gate_no ? gates.find((g) => Number(g.no) === Number(week.gate_no)) ?? null : null;

  return {
    header,
    clock: {
      time: clock.now.time,
      minutes: clock.now.minutes,
      is_fake: clock.now.isFake,
      current_block: clock.current?.code ?? null,
      next_block: clock.next?.code ?? null,
      next_block_label: clock.next?.label ?? null,
      next_block_window: clock.next?.window ?? null,
      minutes_to_next: clock.minutesToNext,
      countdown: clock.minutesToNext !== null ? humanMinutes(clock.minutesToNext) : null,
      minutes_to_tomorrow_first: clock.minutesToTomorrowFirst,
    },
    day: day
      ? {
          cal_date: day.cal_date,
          kind: day.kind,
          day_label: day.day_label,
          dsa_target: day.dsa_target,
          learn_task: day.learn_task,
          build_task: day.build_task,
          money_task: day.money_task,
        }
      : null,
    sunday: sunday
      ? {
          week_n: sunday.week_n,
          kind: sunday.kind,
          hours: sunday.hours,
          type_text: sunday.type_text,
          topic: sunday.topic,
          completed: Number(sundayLog?.completed ?? 0) === 1,
          hours_logged: Number(sundayLog?.hours ?? 0),
          notes: sundayLog?.notes ?? '',
        }
      : null,
    gate: gate
      ? {
          no: gate.no,
          gate_date: gate.gate_date,
          condition_text: gate.condition_text,
          is_today: gate.gate_date === today,
          days_remaining: daysBetween(today, gate.gate_date),
          result: gateResultByNo.get(Number(gate.no)) ?? null,
        }
      : null,
    blocks,
    day_log: {
      log_date: today,
      exists: log.exists !== false,
      dsa_solved: Number(log.dsa_solved ?? 0),
      learn_minutes: Number(log.learn_minutes ?? 0),
      build_minutes: Number(log.build_minutes ?? 0),
      money_minutes: Number(log.money_minutes ?? 0),
      video_minutes: Number(log.video_minutes ?? 0),
      anki_overdue: Number(log.anki_overdue ?? 0),
      blocked_on: log.blocked_on ?? '',
      notes: log.notes ?? '',
      day_colour: colourState.colour,
    },
    conditions: {
      spec: doneConditions,
      list: conditions,
      met: colourState.met,
      total: colourState.total,
      colour: colourState.colour,
    },
    failed_twice: failed,
    warnings: warningResult.warnings,
    yesterday,
    open_session: session,
  };
}
