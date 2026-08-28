/**
 * reference.mjs | reads of the seeded roadmap.
 *
 * Reference data never changes while the process runs, so it is read once and
 * cached in memory. That is what keeps the Today screen inside its 150 ms budget
 * without an N+1 query anywhere.
 *
 * Nothing here writes. The roadmap is read only in the interface, by rule.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from '../config.mjs';
import { query } from './pool.mjs';

const cache = new Map();

async function cached(key, loader) {
  if (!cache.has(key)) cache.set(key, await loader());
  return cache.get(key);
}

/** Drops the cache. Used by the tests and after a re-seed. */
export function resetReferenceCache() {
  cache.clear();
}

/* ------------------------------------------------------------- the plan */

export const getPhases = () =>
  cached('phases', () => query('SELECT code, ord, name, week_from, week_to, blurb FROM phases ORDER BY ord'));

export const getWeeks = () =>
  cached('weeks', () =>
    query(
      `SELECT w.n, w.start_date, w.end_date, w.dates_label, w.title, w.phase_code, w.focus,
              w.dsa_target, w.dsa_cumulative, w.gate_no, p.name AS phase_name
         FROM weeks w JOIN phases p ON p.code = w.phase_code
        ORDER BY w.n`
    )
  );

export const getWeekDays = () =>
  cached('week_days', () =>
    query(
      'SELECT id, week_n, day_name, day_order, learn_task, build_task, dsa_day_target, cal_date FROM week_days ORDER BY week_n, day_order'
    )
  );

export const getCalendarDays = () =>
  cached('calendar_days', () =>
    query(
      'SELECT cal_date, week_n, day_label, kind, dsa_target, learn_task, build_task, money_task FROM calendar_days ORDER BY cal_date'
    )
  );

export const getSundays = () =>
  cached('sundays', () =>
    query('SELECT week_n, sunday_date, kind, hours, type_text, topic FROM sundays ORDER BY week_n')
  );

export const getGates = () =>
  cached('gates', () => query('SELECT no, week_n, gate_date, condition_text FROM gates ORDER BY no'));

export const getMoneyGates = () =>
  cached('money_gates', () =>
    query('SELECT code, ord, gate_date, condition_text, if_it_fails FROM money_gates ORDER BY ord')
  );

export const getWeekLinks = () =>
  cached('week_links', () =>
    query(
      `SELECT l.id, l.week_n, l.ord, l.url, l.label, l.resource_id, l.is_alive, l.last_checked,
              r.why AS resource_why, r.cost AS resource_cost, r.category_no
         FROM week_links l LEFT JOIN resources r ON r.id = l.resource_id
        ORDER BY l.week_n, l.ord`
    )
  );

export const getWeekLists = () =>
  cached('week_lists', async () => {
    const [learn, build, ships, traps, notes] = await Promise.all([
      query('SELECT id, week_n, ord, text FROM week_learn ORDER BY week_n, ord'),
      query('SELECT id, week_n, ord, text FROM week_build ORDER BY week_n, ord'),
      query('SELECT id, week_n, ord, text FROM week_ships ORDER BY week_n, ord'),
      query('SELECT week_n, text FROM week_traps ORDER BY week_n'),
      query('SELECT week_n, text FROM week_notes ORDER BY week_n'),
    ]);
    return { learn, build, ships, traps, notes };
  });

export const getProjects = () =>
  cached('projects', () =>
    query('SELECT id, code, name, repo, week_from, week_to, description FROM projects ORDER BY id')
  );

export const getReadmeSections = () =>
  cached('readme_sections', () => query('SELECT id, ord, title FROM readme_sections ORDER BY ord'));

export const getDayBlocks = () =>
  cached('day_blocks', () =>
    query('SELECT code, ord, block_name, window_text, hours, what_happens FROM day_blocks ORDER BY ord')
  );

export const getDoneConditions = () =>
  cached('done_conditions', () => query('SELECT code, ord, threshold FROM done_conditions ORDER BY ord'));

export const getDsaPace = () =>
  cached('dsa_pace', () =>
    query('SELECT ord, week_from, week_to, weekly_target, mon, tue, wed, thu, fri, sat FROM dsa_pace ORDER BY ord')
  );

export const getDsaThresholds = () =>
  cached('dsa_thresholds', () =>
    query('SELECT id, cumulative, reached_label, unlocks FROM dsa_thresholds ORDER BY cumulative')
  );

export const getDsaMonthCheckpoints = () =>
  cached('dsa_month_checkpoints', () =>
    query('SELECT ord, month_label, cumulative, note FROM dsa_month_checkpoints ORDER BY ord')
  );

export const getDsaTopics = () =>
  cached('dsa_topics', () => query('SELECT id, ord, name FROM dsa_topics ORDER BY ord'));

/* --------------------------------------------------------- the library */

export const getResourceCategories = () =>
  cached('resource_categories', () => query('SELECT no, name FROM resource_categories ORDER BY no'));

export const getResources = () =>
  cached('resources', () =>
    query(
      `SELECT r.id, r.category_no, r.ord, r.url, r.label, r.why, r.cost, r.weeks_csv,
              r.is_alive, r.last_status, r.last_checked, c.name AS category_name
         FROM resources r JOIN resource_categories c ON c.no = r.category_no
        ORDER BY r.category_no, r.ord`
    )
  );

/* ------------------------------------------------------- roles, ladder */

export const getRoles = () =>
  cached('roles', () =>
    query(
      `SELECT code, name, short_name, entry_band, band_low_lakh, band_high_lakh, ceiling,
              verdict, what_they_test, which_project, rank_order
         FROM roles ORDER BY rank_order`
    )
  );

export const getRolesEarly = () =>
  cached('roles_early', () =>
    query(
      `SELECT id, code, role, earliest_text, earliest_week, earliest_date, entry_band,
              band_low_lakh, band_high_lakh, verdict
         FROM roles_early ORDER BY earliest_week, id`
    )
  );

export const getSkills = () =>
  cached('skills', () =>
    query('SELECT id, ord, name, roles_text, roles_csv, where_built, week_n FROM skills ORDER BY ord')
  );

export const getRoleUnlocks = () =>
  cached('role_unlocks', () =>
    query('SELECT id, ord, milestone, unlock_date, roles_text, roles_csv, verdict FROM role_unlocks ORDER BY ord')
  );

export const getResumeStages = () =>
  cached('resume_stages', () => query('SELECT id, ord, stage, headline FROM resume_stages ORDER BY ord'));

export const getEligibilityWeeks = () =>
  cached('eligibility_weeks', () =>
    query(
      `SELECT id, week_key, week_n, reached_date, dsa_total, newly_holds, newly_eligible_text,
              newly_eligible_codes, band, apply_verdict, is_advised
         FROM eligibility_weeks ORDER BY week_n`
    )
  );

export const getEligibilityDsa = () =>
  cached('eligibility_dsa', () =>
    query('SELECT id, ord, problems, reached_about, gets_you_past, does_not_open FROM eligibility_dsa ORDER BY problems')
  );

export const getFastExits = () =>
  cached('fast_exits', () =>
    query(
      `SELECT id, exit_no, exit_label, exit_date, exit_week, roles_available, band,
              what_you_give_up, verdict, cost_note, before_gate3
         FROM fast_exits ORDER BY exit_no`
    )
  );

export const getSkillCombos = () =>
  cached('skill_combos', () =>
    query(
      `SELECT id, sort_order, stack_held, dsa_needed_text, dsa_needed, roles_unlocked_text,
              roles_unlocked_codes, band, interview_you_face
         FROM skill_combos ORDER BY sort_order`
    )
  );

export const getEligibilityDefinitions = () =>
  cached('eligibility_definitions', () => query('SELECT id, ord, text FROM eligibility_definitions ORDER BY ord'));

export const getBreakPlan = () =>
  cached('break_plan', () => query('SELECT id, ord, text FROM break_plan ORDER BY ord'));

/* ----------------------------------------------------------- the money */

export const getOffers = () =>
  cached('offers', () =>
    query(
      `SELECT code, ord, name, scope, delivery, price_band_text, price_low, price_high,
              is_recurring, unlocked_from_week
         FROM offers ORDER BY ord`
    )
  );

export const getMoneyScripts = () =>
  cached('money_scripts', () =>
    query('SELECT id, code, ord, channel, title, body, version, is_original FROM money_scripts ORDER BY ord')
  );

export const getMoneyWeekTargets = () =>
  cached('money_week_targets', () =>
    query('SELECT week_n, focus, target_text, target_low, target_high FROM money_week_targets ORDER BY week_n')
  );

export const getMoneyMonthTargets = () =>
  cached('money_month_targets', () =>
    query(
      'SELECT id, ord, month_label, target_text, target_low, target_high, what_produces_it, is_total FROM money_month_targets ORDER BY ord'
    )
  );

export const getMoneyRules = () =>
  cached('money_rules', () => query('SELECT id, group_key, ord, rule FROM money_rules ORDER BY group_key, ord'));

export const getMoneyLanes = () =>
  cached('money_lanes', () =>
    query('SELECT id, ord, lane, what_it_is, time_to_first_rupee, ceiling, use_it_for FROM money_lanes ORDER BY ord')
  );

export const getMoneyHourShape = () =>
  cached('money_hour_shape', () =>
    query('SELECT id, ord, day_name, first_forty, last_twenty FROM money_hour_shape ORDER BY ord')
  );

export const getMoneyRefuse = () =>
  cached('money_refuse', () => query('SELECT id, ord, item FROM money_refuse ORDER BY ord'));

export const getMoneyBuyback = () =>
  cached('money_buyback', () => query('SELECT id, ord, item FROM money_buyback ORDER BY ord'));

export const getMoneyFirstHour = () =>
  cached('money_first_hour', () => query('SELECT id, ord, step FROM money_first_hour ORDER BY ord'));

export const getLeadSources = () =>
  cached('lead_sources', () => query('SELECT id, ord, source FROM lead_sources ORDER BY ord'));

/* ------------------------------------------------------- the contract */

export const getTrackers = () =>
  cached('trackers', () =>
    query('SELECT code, ord, name, written_when, source_of_truth FROM trackers ORDER BY ord')
  );

export const getWarningRules = () =>
  cached('warning_rules', () =>
    query('SELECT code, ord, trigger_text, level, level_text, is_permanent, message FROM warning_rules ORDER BY ord')
  );

export const getGithubRules = () =>
  cached('github_rules', () => query('SELECT id, ord, rule, value FROM github_rules ORDER BY ord'));

export const getReviewQuestions = () =>
  cached('review_questions', () => query('SELECT id, ord, question FROM review_questions ORDER BY ord'));

export const getHonestyRules = () =>
  cached('honesty_rules', () => query('SELECT id, ord, rule FROM honesty_rules ORDER BY ord'));

export const getExportRules = () =>
  cached('export_rules', () => query('SELECT id, ord, rule FROM export_rules ORDER BY ord'));

/* ------------------------------------------------------------ reference */

export const getCorrections = () =>
  cached('corrections', () =>
    query('SELECT code, ord, was_wrong, actually_true, source, fix FROM corrections ORDER BY ord')
  );

export const getStackVersions = () =>
  cached('stack_versions', () => query('SELECT id, tech, version, status, why FROM stack_versions ORDER BY id'));

export const getBreaks = () =>
  cached('breaks', () => query('SELECT id, if_you_do, what_happens FROM breaks ORDER BY id'));

export const getSkipList = () =>
  cached('skip_list', () => query('SELECT id, ord, item, reason FROM skip_list ORDER BY ord'));

export const getDoNotBuy = () =>
  cached('do_not_buy', () => query('SELECT id, ord, item FROM do_not_buy ORDER BY ord'));

export const getAddedTopics = () =>
  cached('added_topics', () => query('SELECT id, ord, item, reason FROM added_topics ORDER BY ord'));

export const getCosts = () =>
  cached('costs', () => query('SELECT id, ord, item, cost, note FROM costs ORDER BY ord'));

export const getDeadLinks = () =>
  cached('dead_links', () => query('SELECT id, was, now_url, what_happened FROM dead_links ORDER BY id'));

export const getTrackingFiles = () =>
  cached('tracking_files', () => query('SELECT id, file_name, what_goes_in_it FROM tracking_files ORDER BY id'));

export const getClockFacts = () =>
  cached('clock_facts', () => query('SELECT ord, item, value FROM clock_facts ORDER BY ord'));

export const getSubjects = () =>
  cached('subjects', () => query('SELECT ord, subject, when_text, hours_text FROM subjects ORDER BY ord'));

export const getLaunchDays = () =>
  cached('launch_days', () => query('SELECT cal_date, ord, day_name, work FROM launch_days ORDER BY ord'));

export const getNightSegments = () =>
  cached('night_segments', () => query('SELECT id, ord, segment, minutes, detail FROM night_segments ORDER BY ord'));

export const getMachineInventory = () =>
  cached('machine_inventory', () => query('SELECT id, ord, item FROM machine_inventory ORDER BY ord'));

export const getFocusRules = () =>
  cached('focus_rules', () => query('SELECT id, ord, rule FROM focus_rules ORDER BY ord'));

export const getHonestyTests = () =>
  cached('honesty_tests', () => query('SELECT id, ord, question FROM honesty_tests ORDER BY ord'));

export const getOwnedCourses = () =>
  cached('owned_courses', () =>
    query('SELECT id, course, videos, progress, access_expires FROM owned_courses ORDER BY id')
  );

export const getCourseRulings = () =>
  cached('course_rulings', () => query('SELECT id, course, ruling FROM course_rulings ORDER BY id'));

export const getCourseTopicMap = () =>
  cached('course_topic_map', () =>
    query('SELECT id, track, ord, topic, ruling FROM course_topic_map ORDER BY track, ord')
  );

export const getVideoRules = () =>
  cached('video_rules', () => query('SELECT id, ord, rule FROM video_rules ORDER BY ord'));

export const getFalsifier = () =>
  cached('falsifier', () => query('SELECT id, ord, text FROM falsifier ORDER BY ord'));

/* ------------------------------------------------- continuation and NZ */

export const getContinuation = () =>
  cached('continuation', () =>
    query('SELECT id, ord, kind, label, period, age_label, goal, detail, hours_text FROM continuation ORDER BY ord')
  );

export const getNzRequirements = () =>
  cached('nz_requirements', () => query('SELECT id, ord, requirement, detail FROM nz_requirements ORDER BY ord'));

export const getNzFacts = () =>
  cached('nz_facts', () => query('SELECT id, ord, group_key, label, value, caveat FROM nz_facts ORDER BY ord'));

export const getNzCorrections = () =>
  cached('nz_corrections', () => query('SELECT id, ord, title, body FROM nz_corrections ORDER BY ord'));

export const getNzMilestones = () =>
  cached('nz_milestones', () =>
    query(
      'SELECT id, ord, milestone_date, age_on_id, age_actual, age_label, milestone FROM nz_milestones ORDER BY ord'
    )
  );

export const getNzCosts = () =>
  cached('nz_costs', () =>
    query('SELECT id, sort_order, item, cost_rupees, basis, is_total FROM nz_costs ORDER BY sort_order')
  );

export const getNzSalary = () =>
  cached('nz_salary', () =>
    query('SELECT id, ord, gross_nzd, gross_rupees, effective_tax_pct, net_nzd, net_rupees FROM nz_salary ORDER BY ord')
  );

export const getNzProjection = () =>
  cached('nz_projection', () =>
    query('SELECT id, ord, years_after_landing, real_age, accumulated_rupees FROM nz_projection ORDER BY ord')
  );

export const getNzUnverified = () =>
  cached('nz_unverified', () => query('SELECT id, ord, text FROM nz_unverified ORDER BY ord'));

/* --------------------------------------------------------- doc sections */

export const getDocSections = () =>
  cached('doc_sections', () =>
    query(
      'SELECT id, ord, slug, level, part_key, part_title, heading, body_md, start_line, end_line FROM doc_sections ORDER BY ord'
    )
  );

export async function getDocSection(slug) {
  const all = await getDocSections();
  return all.find((s) => s.slug === slug) ?? null;
}

/* ---------------------------- Appendix G, read only, never seeded ---- */

let verificationLog = null;

/**
 * Appendix G is read straight from data/final.md at request time. final.md states
 * that a parser which turns it into rows is wrong, so it is never in the database.
 */
export async function getVerificationLog() {
  if (verificationLog) return verificationLog;
  const text = await readFile(join(ROOT, 'data', 'final.md'), 'utf8');
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^##\s+Appendix G\b/.test(l));
  if (start === -1) {
    verificationLog = { markdown: '', found: false };
    return verificationLog;
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) {
      end = i;
      break;
    }
  }
  verificationLog = { markdown: lines.slice(start, end).join('\n').trimEnd(), found: true };
  return verificationLog;
}

/* ------------------------------------------------------------- health */

/** A cheap sanity check at boot. A wrong count means the numbers cannot be trusted. */
export async function readSeedHealth() {
  const expected = {
    phases: 6,
    weeks: 21,
    week_days: 126,
    calendar_days: 150,
    week_links: 120,
    gates: 4,
    money_gates: 4,
    sundays: 21,
    projects: 4,
    resource_categories: 20,
    roles: 7,
    roles_early: 9,
    eligibility_weeks: 22,
    warning_rules: 10,
    offers: 8,
    money_week_targets: 21,
  };
  const problems = [];
  const rows = await query(
    `SELECT 'phases' AS t, COUNT(*) AS c FROM phases
     UNION ALL SELECT 'weeks', COUNT(*) FROM weeks
     UNION ALL SELECT 'week_days', COUNT(*) FROM week_days
     UNION ALL SELECT 'calendar_days', COUNT(*) FROM calendar_days
     UNION ALL SELECT 'week_links', COUNT(*) FROM week_links
     UNION ALL SELECT 'gates', COUNT(*) FROM gates
     UNION ALL SELECT 'money_gates', COUNT(*) FROM money_gates
     UNION ALL SELECT 'sundays', COUNT(*) FROM sundays
     UNION ALL SELECT 'projects', COUNT(*) FROM projects
     UNION ALL SELECT 'resource_categories', COUNT(*) FROM resource_categories
     UNION ALL SELECT 'roles', COUNT(*) FROM roles
     UNION ALL SELECT 'roles_early', COUNT(*) FROM roles_early
     UNION ALL SELECT 'eligibility_weeks', COUNT(*) FROM eligibility_weeks
     UNION ALL SELECT 'warning_rules', COUNT(*) FROM warning_rules
     UNION ALL SELECT 'offers', COUNT(*) FROM offers
     UNION ALL SELECT 'money_week_targets', COUNT(*) FROM money_week_targets`
  );
  for (const r of rows) {
    const want = expected[r.t];
    if (Number(r.c) !== want) problems.push(`${r.t} has ${r.c} rows, expected ${want}`);
  }
  return { ok: problems.length === 0, problems };
}
