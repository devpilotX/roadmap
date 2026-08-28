/**
 * weekly-digest.mjs | the Saturday review, on paper.
 *
 * Part 18.6 of final.md makes Saturday a review, not a study day, and the six
 * review questions are in the database rather than in this file. This script
 * answers what can be answered from the data, prints the questions that only a
 * person can answer, and writes the whole thing as Markdown.
 *
 * It is deliberately blunt. A digest that flatters is worse than no digest: the
 * numbers below are the ones the gates are judged on.
 *
 * Usage
 *   node scripts/weekly-digest.mjs                     the current week, to stdout
 *   node scripts/weekly-digest.mjs --week=7            one specific week
 *   node scripts/weekly-digest.mjs --last              the week that just ended
 *   node scripts/weekly-digest.mjs --user=me@x.com     pick the user
 *   node scripts/weekly-digest.mjs --out=digest.md     also write a file
 *   node scripts/weekly-digest.mjs --all               every week so far, one file each
 *
 * Cron, Saturdays at 18:30 Asia/Kolkata, after the money hour:
 *   30 18 * * 6  cd /srv/roadmap-tracker && /usr/bin/node scripts/weekly-digest.mjs --out=backups/digest-latest.md >> /var/log/roadmap/digest.log 2>&1
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { config, ROOT } from '../src/config.mjs';
import { closePool, one, query } from '../src/db/pool.mjs';
import { longDate, shortDate, todayInTz } from '../src/lib/dates.mjs';
import { rupeeEvents, sumBetween, totalReceived } from '../src/lib/money.mjs';
import { warningsFor } from '../src/db/warnings.mjs';
import { banner, good, info, intOption, parseArgv, runScript, say, step, warn } from './lib/cli.mjs';

const { flags, values } = parseArgv(process.argv.slice(2), ['week', 'user', 'out']);

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/** A fixed width markdown table. Empty rows produce a stated absence, not a gap. */
function mdTable(rows, cols, emptyNote = '_Nothing recorded._') {
  if (!rows.length) return emptyNote;
  const header = `| ${cols.join(' | ')} |`;
  const rule = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${cols.map((c) => String(r[c] ?? '')).join(' | ')} |`);
  return [header, rule, ...body].join('\n');
}

function bar(done, total, width = 20) {
  if (!total) return '';
  const filled = Math.max(0, Math.min(width, Math.round((done / total) * width)));
  return `${'#'.repeat(filled)}${'.'.repeat(width - filled)}`;
}

/* ------------------------------------------------------------ the digest */

async function buildDigest(user, week, today) {
  const [days, logs, sessions, pushes, weekLinks, links, sunday, gate, moneyTarget, reviewQuestions, warnings] =
    await Promise.all([
      query(
        `SELECT c.cal_date, c.day_label, c.kind, c.dsa_target, c.learn_task, c.build_task, c.money_task
           FROM calendar_days c WHERE c.week_n = ? ORDER BY c.cal_date`,
        [week.n]
      ),
      query(
        `SELECT * FROM day_logs WHERE user_id = ? AND log_date BETWEEN ? AND ? ORDER BY log_date`,
        [user.id, week.start_date, week.end_date]
      ),
      query(
        `SELECT block, SUM(minutes) AS minutes, COUNT(*) AS sessions
           FROM study_sessions WHERE user_id = ? AND session_date BETWEEN ? AND ?
          GROUP BY block ORDER BY block`,
        [user.id, week.start_date, week.end_date]
      ),
      query(
        `SELECT p.push_date, r.full_name, SUM(p.commit_count) AS commits, MAX(p.suspicious) AS suspicious
           FROM github_pushes p JOIN github_repos r ON r.id = p.repo_id
          WHERE p.user_id = ? AND r.counts_to_target = 1 AND p.push_date BETWEEN ? AND ?
          GROUP BY p.push_date, r.full_name ORDER BY p.push_date`,
        [user.id, week.start_date, week.end_date]
      ),
      query('SELECT id, url, label, is_alive, last_status FROM week_links WHERE week_n = ? ORDER BY ord', [week.n]),
      query(
        `SELECT wl.id, wl.label, COALESCE(wlp.status, 'todo') AS status
           FROM week_links wl LEFT JOIN week_link_progress wlp ON wlp.week_link_id = wl.id AND wlp.user_id = ?
          WHERE wl.week_n = ? ORDER BY wl.ord`,
        [user.id, week.n]
      ),
      one('SELECT completed, hours, notes FROM sunday_logs WHERE user_id = ? AND week_n = ?', [user.id, week.n]),
      week.gate_no ? one('SELECT * FROM gates WHERE `no` = ?', [week.gate_no]) : Promise.resolve(null),
      one('SELECT * FROM money_week_targets WHERE week_n = ?', [week.n]),
      query('SELECT ord, question FROM review_questions ORDER BY ord'),
      warningsFor(user.id, today),
    ]);

  // warningsFor returns { warnings, context }. Only the list is wanted here.
  const activeWarnings = warnings?.warnings ?? [];
  const byDate = new Map(logs.map((l) => [l.log_date, l]));
  const studyDays = days.filter((d) => d.kind === 'study' || d.kind === 'launch');

  const dsaTarget = studyDays.reduce((a, d) => a + Number(d.dsa_target), 0);
  const dsaSolved = logs.reduce((a, l) => a + Number(l.dsa_solved), 0);
  const learnDone = logs.filter((l) => Number(l.learn_done) === 1).length;
  const buildDone = logs.filter((l) => Number(l.build_done) === 1).length;
  const closeDone = logs.filter((l) => Number(l.close_done) === 1).length;
  const moneyDone = logs.filter((l) => Number(l.money_done) === 1).length;
  const nightDone = logs.filter((l) => Number(l.night_anki_done) === 1 && Number(l.night_spoken_done) === 1).length;
  const colours = {
    green: logs.filter((l) => l.day_colour === 'green').length,
    amber: logs.filter((l) => l.day_colour === 'amber').length,
    red: logs.filter((l) => l.day_colour === 'red').length,
  };
  const videoOver = logs.filter((l) => Number(l.video_minutes) > config.roadmap.videoMinutesCap);
  const pushDays = new Set(pushes.map((p) => p.push_date));

  const events = await rupeeEvents(user.id);
  const moneyThisWeek = sumBetween(events, week.start_date, week.end_date);
  const moneyToDate = totalReceived(events, week.end_date);

  const cumulativeSolved = Number(
    (
      await one('SELECT COALESCE(SUM(dsa_solved), 0) AS c FROM day_logs WHERE user_id = ? AND log_date <= ?', [
        user.id, week.end_date,
      ])
    ).c
  );

  const apps = await one(
    'SELECT COUNT(*) AS total, SUM(applied_on BETWEEN ? AND ?) AS this_week FROM applications WHERE user_id = ? AND is_deleted = 0',
    [week.start_date, week.end_date, user.id]
  );

  const md = [];
  const push = (s = '') => md.push(s);

  push(`# Week ${week.n} review, ${week.dates_label}`);
  push('');
  push(`**${week.title}**`);
  push('');
  push(`${week.focus}`);
  push('');
  push(
    `Generated ${longDate(today)} for ${user.display_name} <${user.email}>. ` +
      `Phase ${week.phase_code}. Days ${week.start_date} to ${week.end_date}.`
  );
  push('');
  push('---');
  push('');

  /* ------------------------------------------------------------ headline */
  push('## Where the week actually landed');
  push('');
  push(
    mdTable(
      [
        { measure: 'DSA problems', done: dsaSolved, target: dsaTarget, at: `${pct(dsaSolved, dsaTarget)}%`, bar: bar(dsaSolved, dsaTarget) },
        { measure: 'Learn blocks', done: learnDone, target: studyDays.length, at: `${pct(learnDone, studyDays.length)}%`, bar: bar(learnDone, studyDays.length) },
        { measure: 'Build blocks', done: buildDone, target: studyDays.length, at: `${pct(buildDone, studyDays.length)}%`, bar: bar(buildDone, studyDays.length) },
        { measure: 'Close blocks', done: closeDone, target: studyDays.length, at: `${pct(closeDone, studyDays.length)}%`, bar: bar(closeDone, studyDays.length) },
        { measure: 'Money hours', done: moneyDone, target: studyDays.length, at: `${pct(moneyDone, studyDays.length)}%`, bar: bar(moneyDone, studyDays.length) },
        { measure: 'Night recall', done: nightDone, target: studyDays.length, at: `${pct(nightDone, studyDays.length)}%`, bar: bar(nightDone, studyDays.length) },
        { measure: 'Push days', done: pushDays.size, target: config.roadmap.weeklyPushTarget, at: `${pct(pushDays.size, config.roadmap.weeklyPushTarget)}%`, bar: bar(pushDays.size, config.roadmap.weeklyPushTarget) },
      ],
      ['measure', 'done', 'target', 'at', 'bar']
    )
  );
  push('');
  push(
    `Day colours: **${colours.green} green**, ${colours.amber} amber, ${colours.red} red, ` +
      `${studyDays.length - logs.length} day${studyDays.length - logs.length === 1 ? '' : 's'} never logged at all.`
  );
  push('');
  push(
    `DSA cumulative: **${cumulativeSolved}** against the plan's ${week.dsa_cumulative} by the end of week ${week.n}, ` +
      `on the way to ${config.roadmap.dsaTargetByEnd} by ${config.roadmap.lastDay}.`
  );
  if (cumulativeSolved < Number(week.dsa_cumulative)) {
    push('');
    push(
      `> Behind by ${Number(week.dsa_cumulative) - cumulativeSolved} problems. That is the number to say out loud, ` +
        'not to average away.'
    );
  }
  push('');

  /* ------------------------------------------------------------- day grid */
  push('## Day by day');
  push('');
  push(
    mdTable(
      days.map((d) => {
        const l = byDate.get(d.cal_date);
        return {
          date: shortDate(d.cal_date),
          day: d.day_label,
          kind: d.kind,
          dsa: l ? `${l.dsa_solved}/${d.dsa_target}` : `-/${d.dsa_target}`,
          learn: l ? (Number(l.learn_done) ? 'yes' : 'no') : '-',
          build: l ? (Number(l.build_done) ? 'yes' : 'no') : '-',
          money: l ? (Number(l.money_done) ? 'yes' : 'no') : '-',
          push: pushDays.has(d.cal_date) ? 'yes' : 'no',
          colour: l ? l.day_colour : 'not logged',
        };
      }),
      ['date', 'day', 'kind', 'dsa', 'learn', 'build', 'money', 'push', 'colour']
    )
  );
  push('');

  /* -------------------------------------------------------------- minutes */
  push('## Time on the clock');
  push('');
  push(
    mdTable(
      sessions.map((s) => ({
        block: s.block,
        sessions: s.sessions,
        minutes: s.minutes,
        hours: (Number(s.minutes) / 60).toFixed(1),
      })),
      ['block', 'sessions', 'minutes', 'hours'],
      '_No timer sessions this week. The blocks may still have been done and logged by hand._'
    )
  );
  if (videoOver.length) {
    push('');
    push(
      `> ${videoOver.length} day${videoOver.length === 1 ? '' : 's'} went over the ${config.roadmap.videoMinutesCap} minute ` +
        `video cap: ${videoOver.map((v) => `${shortDate(v.log_date)} (${v.video_minutes}m)`).join(', ')}. ` +
        'Watching is not learning.'
    );
  }
  push('');

  /* --------------------------------------------------------------- pushes */
  push('## GitHub');
  push('');
  push(
    `${pushDays.size} of the ${config.roadmap.weeklyPushTarget} push days this week` +
      (week.n === 1 ? `, and week 1 also wants ${config.roadmap.week1CommitTarget} commits on the utility repository` : '') +
      '.'
  );
  push('');
  push(
    mdTable(
      pushes.map((p) => ({
        date: shortDate(p.push_date),
        repository: p.full_name,
        commits: p.commits,
        flagged: Number(p.suspicious) ? 'yes, over 20 commits with no file changes' : '',
      })),
      ['date', 'repository', 'commits', 'flagged'],
      '_No pushes recorded on a repository that counts. Manual entry is on /pushes._'
    )
  );
  push('');

  /* ---------------------------------------------------------------- money */
  push('## The money hour');
  push('');
  if (moneyTarget) {
    push(`Target for week ${week.n}: **${moneyTarget.target_text}**. ${moneyTarget.focus}`);
    push('');
  }
  push(
    mdTable(
      [
        { measure: 'received this week', value: rupees(moneyThisWeek) },
        { measure: 'received to date', value: rupees(moneyToDate) },
        { measure: 'target by 24 Jan 2027', value: rupees(config.roadmap.moneyTargetRupees) },
        { measure: 'first touches logged', value: logs.reduce((a, l) => a + Number(l.money_touches), 0) },
        { measure: 'money hours done', value: `${moneyDone} of ${studyDays.length}` },
      ],
      ['measure', 'value']
    )
  );
  if (moneyTarget && moneyThisWeek < Number(moneyTarget.target_low) && Number(moneyTarget.target_low) > 0) {
    push('');
    push(
      `> Under the week's floor of ${rupees(moneyTarget.target_low)}. The money hour never borrows from study, ` +
        'so the fix is inside the hour, not outside it.'
    );
  }
  push('');

  /* ------------------------------------------------------------ this week */
  push('## The week\'s links');
  push('');
  push(
    mdTable(
      links.map((l, i) => {
        const health = weekLinks[i];
        return {
          link: l.label,
          done: l.status,
          health: health && Number(health.is_alive) === 0 ? `DEAD (${health.last_status ?? 'no answer'})` : 'ok',
        };
      }),
      ['link', 'done', 'health'],
      '_This week has no links, which would be unusual. Check the seed._'
    )
  );
  push('');

  /* ------------------------------------------------------------ the gate */
  if (gate) {
    push(`## Gate ${gate.no}, ${shortDate(gate.gate_date)}`);
    push('');
    push(`${gate.condition_text}`);
    push('');
    const result = await one('SELECT * FROM gate_results WHERE user_id = ? AND gate_no = ?', [user.id, gate.no]);
    push(
      result
        ? `Recorded: **${Number(result.passed) ? 'passed' : 'not passed'}**${result.passed_at ? ` on ${shortDate(result.passed_at.slice(0, 10))}` : ''}.`
        : '_Not recorded yet. A gate that is not answered is not passed._'
    );
    push('');
  }

  /* ----------------------------------------------------------- the sunday */
  push('## Sunday');
  push('');
  push(
    sunday
      ? `${Number(sunday.completed) ? 'Done' : 'Not done'}, ${Number(sunday.hours)} hours.${sunday.notes ? ` ${sunday.notes}` : ''}`
      : '_No Sunday log for this week yet._'
  );
  push('');

  /* --------------------------------------------------------- applications */
  if (Number(apps.total) || week.n >= 12) {
    push('## Applications');
    push('');
    push(
      `${Number(apps.this_week) || 0} sent this week, ${Number(apps.total)} in total, against the gate 4 target of ` +
        `${config.roadmap.gate4Applications} and the realistic range of ${config.roadmap.realisticApplications.join(' to ')}.`
    );
    push('');
  }

  /* ------------------------------------------------------------ warnings */
  push('## What the tracker is warning about');
  push('');
  push(
    mdTable(
      activeWarnings.map((w) => ({
        level: w.level ?? '',
        warning: String(w.title ?? w.code ?? '').replace(/\n/g, ' '),
        detail: String(w.message ?? '').replace(/\n/g, ' '),
      })),
      ['level', 'warning', 'detail'],
      '_No active warnings. That is either very good or a sign that nothing was logged._'
    )
  );
  push('');

  /* --------------------------------------------------- the six questions */
  push('## The review questions');
  push('');
  push('These are from Part 18.6 of final.md. No script can answer them. Write the answers down.');
  push('');
  for (const q of reviewQuestions) {
    push(`${q.ord}. ${q.question}`);
    push('');
    push('   ');
    push('');
  }

  push('---');
  push('');
  push(
    `_Generated by scripts/weekly-digest.mjs on ${new Date().toISOString()}. ` +
      'Every number above comes from the database, and the database only holds what was actually logged._'
  );
  push('');

  return {
    markdown: md.join('\n'),
    headline: {
      week: week.n,
      dsa: `${dsaSolved}/${dsaTarget}`,
      learn: `${learnDone}/${studyDays.length}`,
      build: `${buildDone}/${studyDays.length}`,
      pushes: `${pushDays.size}/${config.roadmap.weeklyPushTarget}`,
      money: rupees(moneyThisWeek),
      green: colours.green,
      red: colours.red,
      warnings: activeWarnings.length,
    },
  };
}

/* --------------------------------------------------------------------- main */

async function main() {
  const today = todayInTz();

  const user = values.has('user')
    ? await one('SELECT id, email, display_name FROM users WHERE email = ?', [values.get('user')])
    : await one('SELECT id, email, display_name FROM users WHERE is_active = 1 ORDER BY id LIMIT 1');
  if (!user) throw new Error(values.has('user') ? `No user with the email ${values.get('user')}.` : 'There are no users yet. Sign up first.');

  const weeks = await query('SELECT * FROM weeks ORDER BY n');
  if (!weeks.length) throw new Error('The weeks table is empty. Run npm run setup.');

  const current =
    weeks.find((w) => today >= w.start_date && today <= w.end_date) ??
    (today < weeks[0].start_date ? weeks[0] : weeks[weeks.length - 1]);

  let targets;
  if (flags.has('all')) {
    targets = weeks.filter((w) => w.start_date <= today);
    if (!targets.length) targets = [weeks[0]];
  } else if (values.has('week')) {
    const n = intOption(values, 'week', 1, { min: 1, max: config.roadmap.totalWeeks });
    const w = weeks.find((x) => Number(x.n) === n);
    if (!w) throw new Error(`There is no week ${n}. The roadmap has ${weeks.length}.`);
    targets = [w];
  } else if (flags.has('last')) {
    const idx = weeks.findIndex((w) => Number(w.n) === Number(current.n));
    targets = [weeks[Math.max(0, idx - 1)]];
  } else {
    targets = [current];
  }

  banner(
    'weekly-digest.mjs | the Saturday review, on paper',
    `${user.email}  ·  ${targets.length === 1 ? `week ${targets[0].n}` : `${targets.length} weeks`}  ·  today ${today}`
  );

  const outArg = values.get('out') ?? null;
  const written = [];

  for (const week of targets) {
    const { markdown, headline } = await buildDigest(user, week, today);

    if (!outArg && targets.length === 1) {
      say('');
      say(markdown);
    } else {
      step(`Week ${week.n}, ${week.dates_label}`);
      info(
        `dsa ${headline.dsa}  learn ${headline.learn}  build ${headline.build}  pushes ${headline.pushes}  ` +
          `money ${headline.money}  green ${headline.green}  red ${headline.red}  warnings ${headline.warnings}`
      );
    }

    if (outArg) {
      const base = isAbsolute(outArg) ? outArg : resolve(join(ROOT, outArg));
      const path = targets.length === 1 ? base : base.replace(/(\.md)?$/i, `-week-${String(week.n).padStart(2, '0')}.md`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, markdown, 'utf8');
      written.push(path);
    }
  }

  if (written.length) {
    say('');
    for (const p of written) good(`written ${p}`);
  }
  if (targets.length === 1 && Number(targets[0].n) !== Number(current.n)) {
    say('');
    warn(`That is week ${targets[0].n}. Today, ${today}, sits in week ${current.n}.`);
  }
  return 0;
}

await runScript('weekly-digest.mjs', main, { closePool });
