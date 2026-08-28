/**
 * Builds the whole seed dataset from final.md.
 *
 * Every value in the returned object came out of the Markdown. The only two
 * exceptions are declared explicitly and documented in docs/ADDITIONS.md:
 *   1. data/striver-a2z-topics.json, because final.md names the sheet but does
 *      not list its 18 steps, and section 9.3 forbids inventing problem names.
 *   2. Derived columns that are pure functions of parsed values, for example
 *      resources.weeks_csv, which is computed by matching URLs.
 */

import { readFile } from 'node:fs/promises';
import { MdDoc, ParseError, plain } from './md.mjs';
import * as plan from './extract/plan.mjs';
import * as appendix from './extract/appendix.mjs';
import * as library from './extract/library.mjs';
import * as career from './extract/career.mjs';
import * as money from './extract/money.mjs';
import { ROLE_CODES_ALL } from './extract/util.mjs';

function slug(text) {
  return plain(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Every level 2 and level 3 section stored verbatim, so no prose is ever lost.
 * Excluded ranges are skipped whole, which is how Appendix G and every
 * subsection inside it stay out of the database entirely.
 */
function docSections(doc, { excludeRanges }) {
  const rows = [];
  let ord = 0;
  for (const h of doc.headings) {
    if (h.level < 2 || h.level > 3) continue;
    if (excludeRanges.some((r) => h.line >= r.startLine && h.line <= r.endLine)) continue;
    const sect = doc.sectionAt(h);
    const body = sect.lines.slice(1).join('\n').replace(/^\n+|\n+$/g, '');
    ord += 1;
    const parent = doc.headings
      .filter((p) => p.level === 2 && p.line <= h.line)
      .slice(-1)[0];
    rows.push({
      id: ord,
      ord,
      slug: slug(h.text),
      level: h.level,
      part_key: parent ? slug(parent.text) : slug(h.text),
      part_title: parent ? parent.text : h.text,
      heading: h.text,
      body_md: body,
      start_line: h.line,
      end_line: sect.endLine,
    });
  }
  return rows;
}

export async function buildDataset({ mdPath, topicsPath }) {
  const raw = await readFile(mdPath, 'utf8');
  const doc = new MdDoc(raw);

  /* ---------------------------------------------------------- front matter */
  const clockFacts = plan.clockFacts(doc);
  const dayBlocks = plan.dayBlocks(doc);
  const gates = plan.gates(doc);

  /* --------------------------------------------------------- parts 0 to 3 */
  const corrections = plan.corrections(doc);
  const subjects = plan.subjects(doc);
  const launchDays = plan.launchDays(doc);
  const phases = plan.phases(doc);
  const monthlyCheckpoints = plan.monthlyCheckpoints(doc);
  const sundays = plan.sundays(doc, phases);

  /* --------------- appendix C first, because weeks derive their dates from it */
  const calendar = appendix.calendarDays(doc);
  const calendarDays = calendar.rows;

  const weeks = plan.weeks(doc, { phases, gates, calendarDays });
  const pace = plan.dsaPace(doc);
  const weekDays = plan.weekDays(doc, weeks, pace.byWeek);
  const weekLinks = plan.weekLinks(doc, weeks);
  const weekProse = plan.weekProse(doc, weeks);

  plan.crossCheckWeekDaysAgainstCalendar(weekDays, calendarDays);
  plan.crossCheckAppendixD(doc, weekLinks);

  /* ---------------------------------------------------- Sundays vs calendar */
  const sundayByWeek = new Map(sundays.map((s) => [s.week_n, s]));
  for (const day of calendarDays.filter((d) => d.kind.startsWith('sunday_'))) {
    const s = sundayByWeek.get(day.week_n);
    if (!s) throw new ParseError(`Calendar Sunday ${day.cal_date} has no Part 3 row`, day.line);
    if (s.sunday_date !== day.cal_date) {
      throw new ParseError(
        `Week ${day.week_n} Sunday is ${day.cal_date} in Appendix C and ${s.sunday_date} in Part 3`,
        day.line
      );
    }
    const expectedKind = `sunday_${s.kind}`;
    if (expectedKind !== day.kind) {
      throw new ParseError(
        `Week ${day.week_n} Sunday is ${day.kind} in Appendix C and ${expectedKind} in Part 3`,
        day.line
      );
    }
  }

  /* -------------------------------------------------------- gates vs weeks */
  for (const g of gates) {
    const w = weeks.find((x) => x.n === g.week_n);
    if (!w) throw new ParseError(`Gate ${g.no} names week ${g.week_n}, which does not exist`, g.line);
    if (w.end_date !== g.gate_date) {
      throw new ParseError(
        `Gate ${g.no} is dated ${g.gate_date} but week ${g.week_n} ends ${w.end_date}`,
        g.line
      );
    }
  }

  /* --------------------------------------------------------- parts 5 and 6 */
  const projects = plan.projects(doc);
  const readmeSections = plan.readmeSections(doc);
  const stackVersions = plan.stackVersions(doc);
  const breaks = plan.breaks(doc);

  /* ----------------------------------------------------------------- part 7 */
  const { categories: resourceCategories, resources } = library.resourceLibrary(doc);

  // Derived: which weeks each library link is used in, matched by URL.
  const weeksByUrl = new Map();
  for (const l of weekLinks) {
    if (!weeksByUrl.has(l.url)) weeksByUrl.set(l.url, new Set());
    weeksByUrl.get(l.url).add(l.week_n);
  }
  for (const r of resources) {
    const hit = weeksByUrl.get(r.url);
    r.weeks_csv = hit ? [...hit].sort((a, b) => a - b).join(',') : '';
  }

  /* -------------------------------------------------------- parts 8 to 11 */
  const ownedCourses = library.ownedCourses(doc);
  const courseRulings = library.courseRulings(doc);
  const courseTopicMap = library.courseTopicMap(doc);
  const videoRules = library.videoRules(doc);
  const falsifier = library.falsifier(doc);
  const nightSegments = library.nightSegments(doc);
  const machineInventory = library.machineInventory(doc);
  const focusRules = library.focusRules(doc);
  const honestyTests = library.honestyTests(doc);

  /* ------------------------------------------------------- parts 12 to 16 */
  const roles = career.roles(doc);
  const skills = career.skills(doc);
  const dsaThresholds = career.dsaThresholds(doc);
  const roleUnlocks = career.roleUnlocks(doc);
  const resumeStages = career.resumeStages(doc);
  const skipList = career.skipList(doc);
  const doNotBuy = career.doNotBuy(doc);
  const addedTopics = career.addedTopics(doc);
  const costs = career.costs(doc);
  const continuation = career.continuation(doc);
  const nzRequirements = career.nzRequirements(doc);
  const nzFacts = career.nzFacts(doc);
  const nzCorrections = career.nzCorrections(doc);
  const nzMilestones = career.nzMilestones(doc);
  const nzCosts = career.nzCosts(doc);
  const nzSalary = career.nzSalary(doc);
  const nzProjection = career.nzProjection(doc);
  const nzUnverified = career.nzUnverified(doc);

  /* ------------------------------------------------------------- part 17 */
  const moneyRules = money.moneyRules(doc);
  const moneyLanes = money.moneyLanes(doc);
  const offers = money.offers(doc);
  const moneyHourShape = money.moneyHourShape(doc);
  const leadSources = money.leadSources(doc);
  const moneyScripts = money.moneyScripts(doc);
  const moneyRefuse = money.moneyRefuse(doc);
  const moneyMonthTargets = money.moneyMonthTargets(doc);
  const moneyBuyback = money.moneyBuyback(doc);
  const moneyGates = money.moneyGates(doc);
  const moneyFirstHour = money.moneyFirstHour(doc);
  const moneyWeekTargets = money.moneyWeekTargets(doc);

  /* ------------------------------------------------------------- part 18 */
  const trackers = money.trackers(doc);
  const doneConditions = money.doneConditions(doc);
  const githubRules = money.githubRules(doc);
  const warningRules = money.warningRules(doc);
  const reviewQuestions = money.reviewQuestions(doc);
  const honestyRules = money.honestyRules(doc);
  const exportRules = money.exportRules(doc);

  /* ------------------------------------------------------------- part 19 */
  const eligibilityDefinitions = career.eligibilityDefinitions(doc);
  const rolesEarly = career.rolesEarly(doc);
  const eligibilityWeeks = career.eligibilityWeeks(doc, weeks);
  const eligibilityDsa = career.eligibilityDsa(doc);
  const fastExits = career.fastExits(doc);
  const skillCombos = career.skillCombos(doc);
  const breakPlan = career.breakPlan(doc);

  /* --------------------------------------------------- appendices A, B, E */
  const deadLinks = appendix.deadLinks(doc);
  const trackingFiles = appendix.trackingFiles(doc);
  const seedContract = appendix.seedContract(doc);
  const verificationLog = appendix.verificationLogMarkdown(doc);

  /* -------------------------------------------- roles_early vs eligibility */
  // Part 19.2 records the week a role becomes properly eligible. Part 19.3 can
  // name the same role one week earlier with the qualifier "weakly". Both are
  // accepted, but an unqualified earlier mention is a contradiction.
  for (const early of rolesEarly) {
    const mentions = eligibilityWeeks.filter((e) => e.newly_eligible_codes.includes(early.code));
    if (mentions.length === 0) {
      throw new ParseError(`Role ${early.code} never appears in the Part 19.3 ladder`, early.line);
    }
    if (!mentions.some((m) => m.week_n === early.earliest_week)) {
      throw new ParseError(
        `Role ${early.code} is earliest at week ${early.earliest_week} in Part 19.2 but Part 19.3 names it only in weeks ${mentions.map((m) => m.week_n).join(', ')}`,
        early.line
      );
    }
    for (const m of mentions) {
      if (m.week_n < early.earliest_week && !/weakly/i.test(m.newly_eligible_text)) {
        throw new ParseError(
          `Role ${early.code} appears unqualified at week ${m.week_n} in Part 19.3 but Part 19.2 says week ${early.earliest_week}`,
          m.line
        );
      }
    }
  }

  /* ------------------------------------------------------------ dsa topics */
  const topicsRaw = JSON.parse(await readFile(topicsPath, 'utf8'));
  if (!Array.isArray(topicsRaw.topics) || topicsRaw.topics.length === 0) {
    throw new ParseError('striver-a2z-topics.json has no topics');
  }
  const dsaTopics = topicsRaw.topics.map((t, i) => {
    if (t.ord !== i + 1) throw new ParseError(`DSA topic ${t.name} is out of order`);
    return { id: i + 1, ord: t.ord, name: t.name };
  });

  /* ---------------------------------------------------------- doc sections */
  // Appendix G is excluded by line range, not by heading text, so that G.1 to
  // G.4 cannot slip in. final.md states that a parser which turns Appendix G
  // into rows is wrong.
  const sections = docSections(doc, {
    excludeRanges: [{ startLine: verificationLog.startLine, endLine: verificationLog.endLine }],
  });
  for (const s of sections) {
    if (s.start_line >= verificationLog.startLine && s.start_line <= verificationLog.endLine) {
      throw new ParseError(`Appendix G section "${s.heading}" leaked into doc_sections`, s.start_line);
    }
  }

  /* ------------------------------------------- dsa split from C14, parsed */
  const c14 = corrections.find((c) => c.code === 'C14');
  if (!c14) throw new ParseError('Correction C14 is missing, so the DSA split cannot be read');
  const splitMatch = /(\d+)\s+easy,\s*(\d+)\s+medium,\s*(\d+)\s+hard/i.exec(c14.actually_true);
  if (!splitMatch) {
    throw new ParseError('C14 does not state the easy, medium and hard split', c14.line);
  }
  const dsaSplit = {
    easy: Number(splitMatch[1]),
    medium: Number(splitMatch[2]),
    hard: Number(splitMatch[3]),
  };
  dsaSplit.total = dsaSplit.easy + dsaSplit.medium + dsaSplit.hard;
  if (dsaSplit.total !== 474) {
    throw new ParseError(`C14 splits to ${dsaSplit.total} problems, expected 474`, c14.line);
  }

  return {
    doc,
    meta: {
      mdPath,
      lineCount: doc.lines.length,
      headingCount: doc.headings.length,
      dsaSplit,
      calendarSums: calendar.sums,
      calendarCounts: calendar.counts,
      roleCodes: ROLE_CODES_ALL,
      verificationLog,
    },
    seedContract,
    tables: {
      clock_facts: clockFacts,
      day_blocks: dayBlocks,
      corrections,
      subjects,
      launch_days: launchDays,
      phases,
      weeks,
      week_days: weekDays,
      week_links: weekLinks,
      week_learn: weekProse.learn,
      week_build: weekProse.build,
      week_ships: weekProse.ships,
      week_traps: weekProse.traps,
      week_notes: weekProse.notes,
      dsa_month_checkpoints: monthlyCheckpoints,
      dsa_pace: pace.rows,
      sundays,
      calendar_days: calendarDays,
      gates,
      projects,
      readme_sections: readmeSections,
      stack_versions: stackVersions,
      breaks,
      resource_categories: resourceCategories,
      resources,
      owned_courses: ownedCourses,
      course_rulings: courseRulings,
      course_topic_map: courseTopicMap,
      video_rules: videoRules,
      falsifier,
      night_segments: nightSegments,
      machine_inventory: machineInventory,
      focus_rules: focusRules,
      honesty_tests: honestyTests,
      roles,
      skills,
      dsa_thresholds: dsaThresholds,
      role_unlocks: roleUnlocks,
      resume_stages: resumeStages,
      skip_list: skipList,
      do_not_buy: doNotBuy,
      added_topics: addedTopics,
      costs,
      continuation,
      nz_requirements: nzRequirements,
      nz_facts: nzFacts,
      nz_corrections: nzCorrections,
      nz_milestones: nzMilestones,
      nz_costs: nzCosts,
      nz_salary: nzSalary,
      nz_projection: nzProjection,
      nz_unverified: nzUnverified,
      money_rules: moneyRules,
      money_lanes: moneyLanes,
      offers,
      money_hour_shape: moneyHourShape,
      lead_sources: leadSources,
      money_scripts: moneyScripts,
      money_refuse: moneyRefuse,
      money_month_targets: moneyMonthTargets,
      money_buyback: moneyBuyback,
      money_gates: moneyGates,
      money_first_hour: moneyFirstHour,
      money_week_targets: moneyWeekTargets,
      trackers,
      done_conditions: doneConditions,
      github_rules: githubRules,
      warning_rules: warningRules,
      review_questions: reviewQuestions,
      honesty_rules: honestyRules,
      export_rules: exportRules,
      eligibility_definitions: eligibilityDefinitions,
      roles_early: rolesEarly,
      eligibility_weeks: eligibilityWeeks,
      eligibility_dsa: eligibilityDsa,
      fast_exits: fastExits,
      skill_combos: skillCombos,
      break_plan: breakPlan,
      dead_links: deadLinks,
      tracking_files: trackingFiles,
      dsa_topics: dsaTopics,
      doc_sections: sections,
    },
  };
}
