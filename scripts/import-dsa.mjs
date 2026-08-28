/**
 * import-dsa.mjs | the only way problem names ever enter this database.
 *
 * `final.md` names the Striver A2Z sheet and its split of 474 problems into
 * 152 easy, 186 medium and 136 hard in Part 3, C14. It does not list the 474
 * names. This application therefore ships the 18 step names in
 * `data/striver-a2z-topics.json` and nothing else, and problem names arrive
 * here from a real tracker export.
 *
 *   No problem name is ever invented. Not one. If it is not in your CSV, it does
 *   not go in the database.
 *
 * The importer is idempotent and matches on (topic, problem name), never on row
 * order, so re-importing a longer export later adds the new rows and leaves
 * `dsa_progress` intact. Nothing is ever deleted.
 *
 * Usage
 *   node scripts/import-dsa.mjs export.csv                  dry run, the default
 *   node scripts/import-dsa.mjs export.csv --write          actually write
 *   node scripts/import-dsa.mjs export.csv --source=codolio force a mapping
 *   node scripts/import-dsa.mjs export.csv --headers        just show the mapping
 *   node scripts/import-dsa.mjs export.csv --write --user=me@example.com
 *                                                          also import solved status
 *   node scripts/import-dsa.mjs export.csv --write --allow-partial
 *                                                          accept fewer than 474 rows
 *   node scripts/import-dsa.mjs --map "topic=Step,name=Question,difficulty=Level"
 *                                                          override the column mapping
 *
 * ---------------------------------------------------------------------------
 * COLUMN MAPPING
 * ---------------------------------------------------------------------------
 * Five fields are understood. Only `name` is required. Header matching is
 * case insensitive and ignores spaces, underscores and punctuation.
 *
 *   field       meaning                     accepted headers
 *   ----------  --------------------------  ------------------------------------
 *   topic       which of the 18 steps       step, step no, step title, topic,
 *                                           topic name, section, category,
 *                                           sub step, tags
 *   name        the problem name            problem, problem name, question,
 *                                           question name, title, name, task
 *   difficulty  Easy, Medium or Hard        difficulty, level, diff
 *   url         where to solve it           link, url, problem link, problem url,
 *                                           href
 *   status      solved or not               status, solved, done, completed,
 *                                           progress, state
 *
 * Striver A2Z tracker export, the usual shape:
 *   Step No,Step Title,Sub Step,Problem,Difficulty,Link,Status
 * Codolio export, the usual shape:
 *   Name,Platform,Difficulty,Url,Status,Tags,SolvedAt
 *
 * `status` is read loosely. solved, done, yes, y, true, 1, completed, ac and
 * accepted all mean solved. Anything else means not solved yet.
 *
 * A `topic` that does not match one of the 18 steps is reported and its rows are
 * skipped, because a nineteenth step would be an invention. Fix the CSV or use
 * --map, then run again.
 */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { closePool, one, query, run as dbRun, transaction } from '../src/db/pool.mjs';
import { todayInTz } from '../src/lib/dates.mjs';
import {
  banner, bad, csvToObjects, good, info, parseArgv, runScript, say, sqlNow, step, table, warn,
} from './lib/cli.mjs';

/* ------------------------------------------------- the contract from final.md */

const CONTRACT = { total: 474, Easy: 152, Medium: 186, Hard: 136 };

const FIELD_ALIASES = {
  topic: [
    'step', 'stepno', 'stepnumber', 'steptitle', 'stepname', 'topic', 'topicname',
    'section', 'category', 'substep', 'substepname', 'tags', 'tag', 'chapter',
  ],
  name: [
    'problem', 'problemname', 'problemtitle', 'question', 'questionname',
    'questiontitle', 'title', 'name', 'task', 'problems',
  ],
  difficulty: ['difficulty', 'level', 'diff', 'difficultylevel'],
  url: ['link', 'url', 'problemlink', 'problemurl', 'href', 'practicelink', 'leetcodelink'],
  status: ['status', 'solved', 'done', 'completed', 'progress', 'state', 'issolved'],
};

const SOLVED_WORDS = new Set([
  'solved', 'done', 'yes', 'y', 'true', '1', 'completed', 'complete', 'ac',
  'accepted', 'finished', 'x', 'checked',
]);

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/* ----------------------------------------------------------------- arguments */

const { flags, values, positional } = parseArgv(process.argv.slice(2), ['source', 'user', 'map']);
const write = flags.has('write');
const file = positional[0] ?? null;

/* ------------------------------------------------------------------ mapping */

/** Builds field -> header from the CSV's own headers, plus any --map override. */
function buildMapping(headers) {
  const chosen = {};
  const reasons = [];
  const normalised = headers.map((h) => ({ raw: h, key: norm(h) }));

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    // Exact alias first, then a contains match, so "Problem Statement" still lands.
    let hit = normalised.find((h) => aliases.includes(h.key));
    if (!hit) hit = normalised.find((h) => aliases.some((a) => h.key === `${a}s`));
    if (!hit) hit = normalised.find((h) => aliases.some((a) => a.length > 4 && h.key.includes(a)));
    if (hit) {
      chosen[field] = hit.raw;
      reasons.push({ field, header: hit.raw, how: 'matched by alias' });
    }
  }

  // A --map override always wins, and is stated in the report.
  if (values.has('map')) {
    for (const pair of values.get('map').split(',')) {
      const [field, header] = pair.split('=').map((s) => s.trim());
      if (!field || !header) continue;
      if (!(field in FIELD_ALIASES)) {
        throw new Error(`--map names an unknown field "${field}". Known fields: ${Object.keys(FIELD_ALIASES).join(', ')}`);
      }
      const real = headers.find((h) => norm(h) === norm(header));
      if (!real) {
        throw new Error(`--map points ${field} at "${header}", which is not a column in this CSV. Columns: ${headers.join(', ')}`);
      }
      chosen[field] = real;
      reasons.push({ field, header: real, how: '--map override' });
    }
  }
  return { chosen, reasons };
}

function readDifficulty(raw) {
  const k = norm(raw);
  if (!k) return null;
  if (k.startsWith('e')) return 'Easy';
  if (k.startsWith('m') || k === 'med') return 'Medium';
  if (k.startsWith('h')) return 'Hard';
  if (k === '1') return 'Easy';
  if (k === '2') return 'Medium';
  if (k === '3') return 'Hard';
  return null;
}

/** Matches a CSV topic string to one of the 18 steps. Returns the topic row or null. */
function matchTopic(raw, topics) {
  const k = norm(raw);
  if (!k) return null;

  // A bare or leading step number, "7" or "Step 7" or "7. Recursion".
  const numeric = String(raw).match(/^\s*(?:step\s*)?(\d{1,2})\b/i);
  if (numeric) {
    const n = Number(numeric[1]);
    const byOrd = topics.find((t) => Number(t.ord) === n);
    if (byOrd) return byOrd;
  }
  let hit = topics.find((t) => norm(t.name) === k);
  if (hit) return hit;
  hit = topics.find((t) => k.includes(norm(t.name)) || norm(t.name).includes(k));
  if (hit) return hit;
  // Codolio exports tags rather than steps, so a few common words are mapped to
  // the step that owns them. Nothing here invents a step, it only routes to one.
  const HINTS = [
    [['array', 'arrays'], 3], [['binarysearch'], 4], [['string', 'strings'], 5],
    [['linkedlist'], 6], [['recursion', 'backtracking'], 7], [['bit', 'bitmanipulation'], 8],
    [['stack', 'queue', 'monotonic'], 9], [['slidingwindow', 'twopointer'], 10],
    [['heap', 'priorityqueue'], 11], [['greedy'], 12],
    [['binarytree', 'tree', 'trees'], 13], [['bst', 'binarysearchtree'], 14],
    [['graph', 'graphs', 'dijkstra', 'topologicalsort'], 15],
    [['dp', 'dynamicprogramming'], 16], [['trie', 'tries'], 17],
    [['sort', 'sorting'], 2], [['basics', 'math', 'hashing'], 1],
  ];
  for (const [words, ord] of HINTS) {
    if (words.includes(k)) return topics.find((t) => Number(t.ord) === ord) ?? null;
  }
  return null;
}

/* --------------------------------------------------------------------- main */

async function main() {
  banner(
    'import-dsa.mjs | Striver A2Z or Codolio CSV into dsa_problems',
    write ? 'WRITING to the database' : 'dry run, nothing is written. Add --write when the report looks right.'
  );

  const topics = await query('SELECT id, ord, name FROM dsa_topics ORDER BY ord');
  if (topics.length !== 18) {
    warn(`dsa_topics holds ${topics.length} rows, not the 18 steps of the sheet. Run npm run setup first.`);
  }

  if (!file) {
    step('No CSV given, so here is what this script expects.');
    table(
      Object.entries(FIELD_ALIASES).map(([field, aliases]) => ({
        field,
        required: field === 'name' ? 'yes' : 'no',
        'accepted headers': aliases.join(', '),
      })),
      ['field', 'required', 'accepted headers']
    );
    step('The 18 steps a topic column must match');
    table(topics.map((t) => ({ step: t.ord, name: t.name })), ['step', 'name']);
    step('Where to get a CSV');
    info('Striver A2Z tracker: takeuforward.org sheet, export or copy the tracker table.');
    info('Codolio: profile, then Export, which produces a CSV of solved problems.');
    info('Then: node scripts/import-dsa.mjs path/to/export.csv');
    return 1;
  }

  const text = await readFile(file, 'utf8');
  const { headers, records } = csvToObjects(text);
  if (!headers.length) throw new Error(`${file} has no header row.`);

  step(`Read ${basename(file)}`);
  info(`${headers.length} columns, ${records.length} data rows`);

  const { chosen, reasons } = buildMapping(headers);
  step('Column mapping');
  table(
    Object.keys(FIELD_ALIASES).map((f) => ({
      field: f,
      column: chosen[f] ?? '(not found)',
      how: reasons.find((r) => r.field === f)?.how ?? (f === 'name' ? 'REQUIRED' : 'skipped'),
    })),
    ['field', 'column', 'how']
  );
  const unmapped = headers.filter((h) => !Object.values(chosen).includes(h));
  if (unmapped.length) info(`ignored columns: ${unmapped.join(', ')}`);

  if (!chosen.name) {
    bad(
      'No problem name column was found, so there is nothing safe to import. ' +
        `Point one at it: --map "name=${headers[0]}"`
    );
    return 1;
  }
  if (flags.has('headers')) {
    say('');
    good('Mapping printed. Nothing else was done because --headers was given.');
    return 0;
  }

  /* ------------------------------------------------------------- read rows */

  const parsed = [];
  const skipped = [];
  const unknownTopics = new Map();
  const seen = new Set();

  for (const [i, rec] of records.entries()) {
    const line = i + 2; // header is line 1
    const name = String(rec[chosen.name] ?? '').trim();
    if (!name) {
      skipped.push({ line, why: 'no problem name in that row' });
      continue;
    }
    const rawTopic = chosen.topic ? rec[chosen.topic] : '';
    const topic = matchTopic(rawTopic, topics);
    if (!topic) {
      const key = String(rawTopic || '(blank)');
      unknownTopics.set(key, (unknownTopics.get(key) ?? 0) + 1);
      skipped.push({ line, why: `topic "${key}" is not one of the 18 steps`, name });
      continue;
    }
    const difficulty = readDifficulty(chosen.difficulty ? rec[chosen.difficulty] : '');
    if (!difficulty) {
      skipped.push({ line, why: 'difficulty is missing or unreadable', name });
      continue;
    }
    const url = chosen.url ? String(rec[chosen.url] ?? '').trim().slice(0, 500) : null;
    const solved = chosen.status ? SOLVED_WORDS.has(norm(rec[chosen.status])) : false;

    const key = `${topic.id}::${norm(name)}`;
    if (seen.has(key)) {
      skipped.push({ line, why: 'the same problem appears twice in this CSV', name });
      continue;
    }
    seen.add(key);
    parsed.push({
      topic_id: topic.id,
      topic_ord: topic.ord,
      topic_name: topic.name,
      name: name.slice(0, 255),
      difficulty,
      url: url && /^https?:\/\//i.test(url) ? url : null,
      solved,
      line,
    });
  }

  const counts = {
    Easy: parsed.filter((p) => p.difficulty === 'Easy').length,
    Medium: parsed.filter((p) => p.difficulty === 'Medium').length,
    Hard: parsed.filter((p) => p.difficulty === 'Hard').length,
  };

  step('What the CSV actually holds');
  table(
    [
      { measure: 'rows read', csv: records.length, 'final.md expects': '' },
      { measure: 'usable problems', csv: parsed.length, 'final.md expects': CONTRACT.total },
      { measure: 'easy', csv: counts.Easy, 'final.md expects': CONTRACT.Easy },
      { measure: 'medium', csv: counts.Medium, 'final.md expects': CONTRACT.Medium },
      { measure: 'hard', csv: counts.Hard, 'final.md expects': CONTRACT.Hard },
      { measure: 'marked solved', csv: parsed.filter((p) => p.solved).length, 'final.md expects': '' },
      { measure: 'skipped rows', csv: skipped.length, 'final.md expects': 0 },
    ],
    ['measure', 'csv', 'final.md expects']
  );

  step('Per step');
  table(
    topics.map((t) => {
      const mine = parsed.filter((p) => p.topic_id === t.id);
      return {
        step: t.ord,
        name: t.name,
        problems: mine.length,
        easy: mine.filter((p) => p.difficulty === 'Easy').length,
        medium: mine.filter((p) => p.difficulty === 'Medium').length,
        hard: mine.filter((p) => p.difficulty === 'Hard').length,
      };
    }),
    ['step', 'name', 'problems', 'easy', 'medium', 'hard']
  );

  if (unknownTopics.size) {
    step('Topics that did not match one of the 18 steps');
    table(
      [...unknownTopics.entries()].map(([topic, rows]) => ({ topic, rows })),
      ['topic', 'rows']
    );
    info('These rows were skipped. A nineteenth step would be an invention, so nothing was guessed.');
    info(`Fix the CSV, or map the column yourself: --map "topic=${chosen.topic ?? headers[0]}"`);
  }

  if (skipped.length) {
    step(`${skipped.length} skipped row${skipped.length === 1 ? '' : 's'}, first 20`);
    table(skipped.slice(0, 20).map((s) => ({ line: s.line, problem: s.name ?? '', why: s.why })), ['line', 'problem', 'why']);
  }

  /* ------------------------------------------------------- the count gate */

  const mismatches = [];
  if (parsed.length !== CONTRACT.total) mismatches.push(`total ${parsed.length} against ${CONTRACT.total}`);
  for (const d of ['Easy', 'Medium', 'Hard']) {
    if (counts[d] !== CONTRACT[d]) mismatches.push(`${d.toLowerCase()} ${counts[d]} against ${CONTRACT[d]}`);
  }

  if (mismatches.length) {
    step('The counts do not match final.md');
    for (const m of mismatches) warn(m);
    info('That is not automatically wrong: a partial export, or a sheet that has grown, will differ.');
    if (!flags.has('allow-partial')) {
      info('Nothing was written. Re-run with --allow-partial once you are satisfied the export is what you meant.');
    }
  } else {
    step('Counts match Appendix E exactly: 474 problems, 152 easy, 186 medium, 136 hard.');
  }

  const blocked = mismatches.length > 0 && !flags.has('allow-partial');

  /* ------------------------------------------------------------ the write */

  let written = 0;
  let updated = 0;
  let progressWritten = 0;
  let user = null;

  if (values.has('user')) {
    user = await one('SELECT id, email FROM users WHERE email = ?', [values.get('user')]);
    if (!user) throw new Error(`No user with the email ${values.get('user')}. Sign up first, or drop --user.`);
  }

  if (write && !blocked && parsed.length) {
    step('Writing');
    await transaction(async (tx) => {
      const existing = await tx.query('SELECT id, topic_id, ord, name FROM dsa_problems');
      const byKey = new Map(existing.map((e) => [`${e.topic_id}::${norm(e.name)}`, e]));
      const nextOrd = new Map();
      for (const e of existing) {
        nextOrd.set(Number(e.topic_id), Math.max(nextOrd.get(Number(e.topic_id)) ?? 0, Number(e.ord)));
      }

      for (const p of parsed) {
        const key = `${p.topic_id}::${norm(p.name)}`;
        const hit = byKey.get(key);
        if (hit) {
          // Matched by name, so the ord is left alone and dsa_progress survives.
          await tx.run('UPDATE dsa_problems SET name = ?, difficulty = ?, url = ? WHERE id = ?', [
            p.name, p.difficulty, p.url, hit.id,
          ]);
          p.problem_id = hit.id;
          updated += 1;
        } else {
          const ord = (nextOrd.get(Number(p.topic_id)) ?? 0) + 1;
          nextOrd.set(Number(p.topic_id), ord);
          const res = await tx.run(
            'INSERT INTO dsa_problems (topic_id, ord, name, difficulty, url) VALUES (?, ?, ?, ?, ?)',
            [p.topic_id, ord, p.name, p.difficulty, p.url]
          );
          p.problem_id = res.insertId;
          written += 1;
        }
      }

      if (user) {
        const today = todayInTz();
        for (const p of parsed.filter((x) => x.solved && x.problem_id)) {
          const res = await tx.run(
            `INSERT INTO dsa_progress (user_id, problem_id, status, first_solved_at, last_solved_on, times_solved)
             VALUES (?, ?, 'solved', NOW(), ?, 1)
             ON DUPLICATE KEY UPDATE
               status = 'solved',
               first_solved_at = COALESCE(first_solved_at, NOW()),
               last_solved_on = COALESCE(last_solved_on, VALUES(last_solved_on)),
               times_solved = GREATEST(times_solved, 1)`,
            [user.id, p.problem_id, today]
          );
          if (res.affectedRows) progressWritten += 1;
        }
      }
    });
    good(`${written} problems inserted, ${updated} updated, 0 deleted`);
    if (user) good(`${progressWritten} rows of solved status written for ${user.email}`);
  }

  /* ------------------------------------------------------------ the record */

  const report = [
    `file=${basename(file)}`,
    `mapping=${Object.entries(chosen).map(([k, v]) => `${k}:${v}`).join(' ')}`,
    `rows_read=${records.length} usable=${parsed.length} skipped=${skipped.length}`,
    `easy=${counts.Easy} medium=${counts.Medium} hard=${counts.Hard}`,
    mismatches.length ? `contract_mismatch=${mismatches.join('; ')}` : 'contract=match',
    blocked ? 'result=blocked, needs --allow-partial' : write ? `result=written inserted=${written} updated=${updated}` : 'result=dry run',
  ].join('\n');

  await dbRun(    `INSERT INTO dsa_imports
       (user_id, source_name, rows_read, rows_written, easy_count, medium_count, hard_count, dry_run, report, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      user?.id ?? null,
      (values.get('source') ?? basename(file)).slice(0, 255),
      records.length,
      write && !blocked ? written + updated : 0,
      counts.Easy,
      counts.Medium,
      counts.Hard,
      write && !blocked ? 0 : 1,
      report,
      sqlNow(),
    ]
  );

  step('Recorded in dsa_imports');
  if (!write) {
    info('This was a dry run. Nothing entered dsa_problems.');
    info(`When the report above is right: node scripts/import-dsa.mjs ${file} --write`);
  } else if (blocked) {
    info('Blocked on the count contract. Add --allow-partial to accept it, or fix the export.');
  } else {
    const total = Number((await one('SELECT COUNT(*) AS c FROM dsa_problems')).c);
    info(`dsa_problems now holds ${total} rows. /dsa switches from topic level to problem level automatically.`);
  }

  return blocked && write ? 1 : 0;
}

await runScript('import-dsa.mjs', main, { closePool });
