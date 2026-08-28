/**
 * reference.mjs | Part 19 and the appendices, everything the plan had to pin
 * down before the first week could start.
 *
 * Twenty three reference tables in one long page: the corrections, the pinned
 * stack versions, what happens if you break a rule, the skip list, the do not
 * buy list, the costs, the dead links and their replacements, the trackers, the
 * clock facts, the courses you already own and the ruling on each of them, and
 * the falsifier. None of it is editable. The roadmap is read only in the
 * interface, by rule.
 *
 * rf-nav is a sticky section list built from whatever the API actually returned,
 * so a table that came back empty is still listed and still says so rather than
 * offering a link to nothing.
 *
 * rf-body also holds the verbatim reader for final.md. GET /api/doc/:slug
 * returns a doc_sections row and its body arrives in body_md, which is Markdown
 * source and not HTML: there is no server side rendering on that route and no
 * Markdown renderer on the client. So the body is written into a pre element
 * with textContent, exactly as it appears in the file. That is the honest
 * rendering of a verbatim reader, and insertAdjacentHTML would be wrong here
 * because there is no HTML to insert.
 *
 * rf-appendix-g is the exception on this page. The server already rendered
 * Appendix G into that panel from data/final.md, through the small renderer in
 * src/lib/markdown.mjs, so this module does not replace it. It appends the
 * provenance line and hardens the links inside it instead.
 */

import { api } from '../api.mjs';
import { toastError } from '../toast.mjs';
import { el, emptyState, hardenExternalLinks, int, minutesLabel, qs } from '../ui.mjs';
import { errorCard, mount, section, table } from '../render.mjs';

/**
 * One entry per reference table. `key` is the field name on the /api/reference
 * response, so the field names here are the API's and not a translation of them.
 */
const SECTIONS = [
  {
    key: 'corrections',
    title: 'Corrections',
    lede: 'Things that were wrong in an earlier draft of the plan, what is actually true, and where that came from.',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'was_wrong', label: 'Was wrong' },
      { key: 'actually_true', label: 'Actually true' },
      { key: 'source', label: 'Source' },
      { key: 'fix', label: 'Fix' },
    ],
  },
  {
    key: 'stack_versions',
    title: 'Pinned stack versions',
    lede: 'The version you learn is the version you pin. A tutorial written against a different major version is a different tutorial.',
    columns: [
      { key: 'tech', label: 'Technology' },
      { key: 'version', label: 'Version' },
      { key: 'status', label: 'Status' },
      { key: 'why', label: 'Why this one' },
    ],
  },
  {
    key: 'breaks',
    title: 'What breaks if you break it',
    lede: 'Each rule in the plan holds something else up. This is what falls over.',
    columns: [
      { key: 'if_you_do', label: 'If you do this' },
      { key: 'what_happens', label: 'What happens' },
    ],
  },
  {
    key: 'skip_list',
    title: 'The skip list',
    lede: 'Deliberately not in the 21 weeks, with the reason. Skipping something on purpose is not the same as missing it.',
    columns: [
      { key: 'item', label: 'Skipped' },
      { key: 'reason', label: 'Reason' },
    ],
  },
  {
    key: 'do_not_buy',
    title: 'Do not buy',
    lede: 'Money that would not have bought progress.',
    columns: [{ key: 'item', label: 'Do not buy' }],
  },
  {
    key: 'added_topics',
    title: 'Added topics',
    lede: 'Put into the plan after the first draft, with the reason it earned a place.',
    columns: [
      { key: 'item', label: 'Added' },
      { key: 'reason', label: 'Reason' },
    ],
  },
  {
    key: 'costs',
    title: 'What the 21 weeks cost',
    lede: 'Every rupee the plan asks for, and what it buys.',
    columns: [
      { key: 'item', label: 'Item' },
      { key: 'cost', label: 'Cost' },
      { key: 'note', label: 'Note' },
    ],
  },
  {
    key: 'dead_links',
    title: 'Dead links and their replacements',
    lede: 'Links that were in an earlier draft and no longer resolve. The replacement is the one to use.',
    columns: [
      { key: 'was', label: 'Was' },
      {
        key: 'now_url',
        label: 'Now',
        render: (r) =>
          r.now_url
            ? el('a', {
                href: r.now_url,
                text: r.now_url,
                target: '_blank',
                rel: 'noopener noreferrer',
                'data-ext': '1',
              })
            : 'No replacement',
      },
      { key: 'what_happened', label: 'What happened' },
    ],
  },
  {
    key: 'trackers',
    title: 'The trackers',
    lede: 'What gets written down, when it gets written, and which one wins when two disagree.',
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Tracker' },
      { key: 'written_when', label: 'Written when' },
      { key: 'source_of_truth', label: 'Source of truth' },
    ],
  },
  {
    key: 'tracking_files',
    title: 'The tracking files',
    lede: 'The files the plan expects on disk, and what belongs in each.',
    columns: [
      { key: 'file_name', label: 'File' },
      { key: 'what_goes_in_it', label: 'What goes in it' },
    ],
  },
  {
    key: 'clock_facts',
    title: 'Clock facts',
    lede: 'The numbers the whole schedule is built from.',
    columns: [
      { key: 'item', label: 'Fact' },
      { key: 'value', label: 'Value' },
    ],
  },
  {
    key: 'subjects',
    title: 'College subjects',
    lede: 'The degree still has to be passed. This is where it sits in the week.',
    columns: [
      { key: 'subject', label: 'Subject' },
      { key: 'when_text', label: 'When' },
      { key: 'hours_text', label: 'Hours' },
    ],
  },
  {
    key: 'launch_days',
    title: 'The launch days',
    lede: 'The first days, spelled out hour by hour, because the start is where most plans stop.',
    columns: [
      { key: 'cal_date', label: 'Date' },
      { key: 'day_name', label: 'Day' },
      { key: 'work', label: 'Work' },
    ],
  },
  {
    key: 'night_segments',
    title: 'The night segments',
    lede: 'The last block of the day, broken into named pieces so it cannot quietly become scrolling.',
    columns: [
      { key: 'segment', label: 'Segment' },
      { key: 'minutes', label: 'Length', num: true, render: (r) => minutesLabel(r.minutes) },
      { key: 'detail', label: 'What happens' },
    ],
  },
  {
    key: 'machine_inventory',
    title: 'The machine',
    lede: 'What is installed, so a broken environment is a known list and not a mystery.',
    columns: [{ key: 'item', label: 'Item' }],
  },
  {
    key: 'focus_rules',
    title: 'Focus rules',
    lede: 'The rules that protect the three hour learn block.',
    columns: [{ key: 'rule', label: 'Rule' }],
  },
  {
    key: 'honesty_tests',
    title: 'The honesty tests',
    lede: 'Questions to ask yourself on a Saturday. They only work if you answer them badly when the answer is bad.',
    columns: [{ key: 'question', label: 'Question' }],
  },
  {
    key: 'honesty_rules',
    title: 'The honesty rules',
    lede: 'What this tracker refuses to let you pretend.',
    columns: [{ key: 'rule', label: 'Rule' }],
  },
  {
    key: 'owned_courses',
    title: 'Courses you already own',
    lede: 'Already paid for. The question is only whether watching them is the best use of the hour.',
    columns: [
      { key: 'course', label: 'Course' },
      { key: 'videos', label: 'Videos' },
      { key: 'progress', label: 'Progress' },
      { key: 'access_expires', label: 'Access expires' },
    ],
  },
  {
    key: 'course_rulings',
    title: 'The ruling on each course',
    lede: 'Watch it, skim it, or leave it. A course you own is still a cost in hours.',
    columns: [
      { key: 'course', label: 'Course' },
      { key: 'ruling', label: 'Ruling' },
    ],
  },
  {
    key: 'course_topic_map',
    title: 'Course topics, mapped',
    lede: 'Topic by topic, whether the course you own covers it well enough to use.',
    columns: [
      { key: 'track', label: 'Track' },
      { key: 'topic', label: 'Topic' },
      { key: 'ruling', label: 'Ruling' },
    ],
  },
  {
    key: 'video_rules',
    title: 'Video rules',
    lede: 'How to watch a tutorial without it becoming television.',
    columns: [{ key: 'rule', label: 'Rule' }],
  },
  {
    key: 'falsifier',
    title: 'The falsifier',
    lede: 'The conditions under which this plan should be abandoned. A plan that cannot be wrong is not a plan.',
    columns: [{ key: 'text', label: 'Condition' }],
  },
];

/* ---------------------------------------------------------------- rf-nav */

function navBar(present) {
  const bar = el('div', { class: 'refnav' }, [
    el('span', { class: 'card__label', text: 'Jump to' }),
    ...present.map((s) =>
      el('a', {
        class: 'chip',
        href: `#rf-sec-${s.key}`,
        text: s.title,
      })
    ),
    el('a', { class: 'chip', href: '#rf-doc', text: 'Read final.md verbatim' }),
    el('a', { class: 'chip', href: '#rf-appendix-g', text: 'Verification log' }),
  ]);
  return bar;
}

/* --------------------------------------------------------------- rf-body */

function tableSection(spec, rows) {
  const id = `rf-sec-${spec.key}`;
  const body = rows.length
    ? table({
        columns: spec.columns,
        rows,
        caption: `${int(rows.length)} ${rows.length === 1 ? 'row' : 'rows'}.`,
      })
    : emptyState(
        'Nothing seeded here',
        `The ${spec.title.toLowerCase()} table came back empty. It is seeded from final.md, so run npm run setup if that is unexpected.`
      );

  const node = section(spec.title, body, { lede: spec.lede, id });
  // refsection only adds scroll-margin, so the sticky nav does not cover the
  // heading it just jumped to.
  node.classList.add('refsection');
  return node;
}

/**
 * The verbatim reader. There is no endpoint that lists the slugs, so the slug is
 * typed or arrives in the query string, and a wrong one gets the server's own
 * message back rather than an invented one.
 */
function docReader() {
  const input = el('input', {
    class: 'input',
    type: 'text',
    placeholder: 'the-clock',
    'aria-label': 'Slug of a section of final.md',
    maxlength: 160,
  });
  const read = el('button', { type: 'button', class: 'btn btn--primary', text: 'Read it' });
  const meta = el('p', { class: 'text-sm muted' });
  const body = el('div', { class: 'md md--wide' });

  function idle() {
    meta.textContent = '';
    body.replaceChildren(
      emptyState(
        'Nothing selected',
        'Every level 2 and level 3 heading of final.md is readable here by its slug, which is the heading in lower case with punctuation turned into hyphens: the-clock, the-four-gates, part-0-the-25-corrections. A slug is also accepted as ?doc= on this page. There is no endpoint that lists them, so a wrong slug is answered by the server rather than guessed at here.'
      )
    );
  }

  async function load(slug) {
    const wanted = String(slug ?? '').trim();
    if (!wanted) {
      idle();
      return;
    }
    read.disabled = true;
    meta.textContent = 'Reading.';
    try {
      const d = await api.get(`/api/doc/${encodeURIComponent(wanted)}`);
      meta.textContent = [
        d.part_title ? `${d.part_title}` : null,
        d.heading ? `heading: ${d.heading}` : null,
        `level ${d.level}`,
        `lines ${d.start_line} to ${d.end_line} of final.md`,
      ]
        .filter(Boolean)
        .join(' · ');
      // Markdown source, shown as source. Nothing here is parsed or reflowed.
      const pre = el('pre');
      pre.textContent = d.body_md ?? '';
      body.replaceChildren(
        el('h3', { text: d.heading ?? wanted }),
        pre
      );
      input.value = d.slug;
    } catch (err) {
      meta.textContent = '';
      body.replaceChildren(errorCard(err.message));
      toastError(err.message);
    } finally {
      read.disabled = false;
    }
  }

  read.addEventListener('click', () => load(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      load(input.value);
    }
  });

  const fromQuery = new URLSearchParams(window.location.search).get('doc');
  if (fromQuery) {
    input.value = fromQuery;
    load(fromQuery);
  } else {
    idle();
  }

  const node = section(
    'Read a section of final.md, verbatim',
    [
      el('div', { class: 'row' }, [input, read]),
      meta,
      body,
      el('p', {
        class: 'text-xs muted measure',
        text: 'The body is Markdown source and is shown as source, unrendered, because that is what the API returns. Nothing on this page edits final.md.',
      }),
    ],
    { id: 'rf-doc', lede: 'Any level 2 or level 3 section, straight from the file, by its slug.' }
  );
  node.classList.add('refsection');
  return node;
}

/* --------------------------------------------------------- rf-appendix-g */

/**
 * Appendix G is rendered server side into this panel from data/final.md, so it
 * is never cleared here. Only the provenance line is added. The markdown
 * renderer already writes target and rel on the links it produces; the pass
 * below is for anything carrying data-ext, and costs nothing when there is none.
 */
function annotateAppendixG(log) {
  const host = qs('#rf-appendix-g');
  if (!host) return;
  hardenExternalLinks(host);

  const lines = String(log?.markdown ?? '').split('\n').length;
  host.appendChild(
    el('p', {
      class: 'text-xs muted measure',
      text: log?.found
        ? `Read from data/final.md when this page was requested: ${int(lines)} lines. It is not in the database, it is not seeded, and nothing in this application writes to it.`
        : 'Appendix G was not found in data/final.md, so there is nothing to show. That is a missing file, not an empty log.',
    })
  );
}

/* ------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/reference');

    // A section is listed in the nav whether or not it has rows, so the page and
    // the nav can never disagree about what exists.
    const present = SECTIONS.filter((s) => Array.isArray(d[s.key]));

    mount('#rf-nav', [
      navBar(present),
      el('p', {
        class: 'text-xs muted',
        text: `${int(present.length)} reference tables, plus the verbatim reader and Appendix G. Everything on this page is read only.`,
      }),
    ]);

    mount('#rf-body', [
      ...present.map((s) => tableSection(s, d[s.key] ?? [])),
      docReader(),
    ]);

    annotateAppendixG(d.verification_log);
  } catch (err) {
    mount('#rf-nav', errorCard(err.message));
    mount('#rf-body', [
      emptyState(
        'The reference tables did not load',
        'Nothing here is editable, so nothing was lost. Reload the page once the error above is dealt with.'
      ),
    ]);
    // Appendix G came from the server with the page, so it is left exactly as it is.
  }
}

await main();
