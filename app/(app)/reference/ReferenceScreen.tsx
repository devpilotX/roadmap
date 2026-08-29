'use client';

/**
 * Part 19 and the appendices, everything the plan had to pin down before the
 * first week could start.
 *
 * Twenty three reference tables in one long page: the corrections, the pinned
 * stack versions, what happens if you break a rule, the skip list, the do not
 * buy list, the costs, the dead links and their replacements, the trackers, the
 * clock facts, the courses you already own and the ruling on each of them, and
 * the falsifier. None of it is editable. The roadmap is read only in the
 * interface, by rule.
 *
 * The jump bar is a sticky section list built from whatever the API actually
 * returned, so a table that came back empty is still listed and still says so
 * rather than offering a link to nothing.
 *
 * The verbatim reader is here too. GET /api/doc/:slug returns a doc_sections row
 * and its body arrives in body_md, which is Markdown source and not HTML: there
 * is no renderer on that route. So the body is written into a pre element exactly
 * as it appears in the file. That is the honest rendering of a verbatim reader.
 *
 * Appendix G is the exception on this page. The server rendered it from
 * data/final.md before this component ran, so it arrives as props and is never
 * replaced here. Only the provenance line is added.
 */

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import {
  EmptyState,
  ErrorCard,
  ExternalLink,
  LoadingCard,
  Section,
} from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { useResource } from '@/components/ui/useResource';
import { api, ApiError } from '@/lib/client/api';
import { int, minutesLabel } from '@/lib/client/format';

type RefRow = Record<string, any>;

interface SectionSpec {
  key: string;
  title: string;
  lede: string;
  columns: Column<RefRow>[];
}

/**
 * One entry per reference table. `key` is the field name on the /api/reference
 * response, so the field names here are the API's and not a translation of them.
 */
const SECTIONS: SectionSpec[] = [
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
          r.now_url ? <ExternalLink href={String(r.now_url)}>{String(r.now_url)}</ExternalLink> : 'No replacement',
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

interface Payload extends Record<string, any> {
  verification_log?: { markdown: string; found: boolean };
}

interface DocSection {
  slug: string;
  heading: string | null;
  part_title: string | null;
  level: number;
  start_line: number;
  end_line: number;
  body_md: string | null;
}

const IDLE_BODY =
  'Every level 2 and level 3 heading of final.md is readable here by its slug, which is the heading in lower case with punctuation turned into hyphens: the-clock, the-four-gates, part-0-the-25-corrections. A slug is also accepted as ?doc= on this page. There is no endpoint that lists them, so a wrong slug is answered by the server rather than guessed at here.';

/**
 * The verbatim reader. There is no endpoint that lists the slugs, so the slug is
 * typed or arrives in the query string, and a wrong one gets the server's own
 * message back rather than an invented one.
 */
function DocReader() {
  const params = useSearchParams();
  const fromQuery = params.get('doc') ?? '';
  const { toastError } = useToast();

  const [slug, setSlug] = useState(fromQuery);
  const [meta, setMeta] = useState('');
  const [doc, setDoc] = useState<DocSection | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wanted, setWanted] = useState('');

  const load = useCallback(
    async (value: string) => {
      const want = String(value ?? '').trim();
      if (!want) {
        setMeta('');
        setDoc(null);
        setFailed(null);
        setWanted('');
        return;
      }
      setWanted(want);
      setBusy(true);
      setMeta('Reading.');
      try {
        const d = await api.get<DocSection>(`/api/doc/${encodeURIComponent(want)}`);
        setMeta(
          [
            d.part_title ? `${d.part_title}` : null,
            d.heading ? `heading: ${d.heading}` : null,
            `level ${d.level}`,
            `lines ${d.start_line} to ${d.end_line} of final.md`,
          ]
            .filter(Boolean)
            .join(' · ')
        );
        setDoc(d);
        setFailed(null);
        setSlug(d.slug);
      } catch (err) {
        setMeta('');
        setDoc(null);
        setFailed((err as ApiError).message);
        toastError((err as ApiError).message);
      } finally {
        setBusy(false);
      }
    },
    [toastError]
  );

  useEffect(() => {
    if (fromQuery) void load(fromQuery);
  }, [fromQuery, load]);

  return (
    <Section
      id="rf-doc"
      className="card stack refsection"
      title="Read a section of final.md, verbatim"
      lede="Any level 2 or level 3 section, straight from the file, by its slug."
    >
      <div className="row">
        <input
          className="input"
          type="text"
          placeholder="the-clock"
          aria-label="Slug of a section of final.md"
          maxLength={160}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void load(slug);
            }
          }}
        />
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={() => void load(slug)}
        >
          Read it
        </button>
      </div>
      <p className="text-sm muted">{meta}</p>
      <div className="md md--wide">
        {failed ? (
          <ErrorCard message={failed} />
        ) : doc ? (
          <>
            <h3>{doc.heading ?? wanted}</h3>
            {/* Markdown source, shown as source. Nothing here is parsed or reflowed. */}
            <pre>{doc.body_md ?? ''}</pre>
          </>
        ) : (
          <EmptyState title="Nothing selected" body={IDLE_BODY} />
        )}
      </div>
      <p className="text-xs muted measure">
        The body is Markdown source and is shown as source, unrendered, because that is what the API
        returns. Nothing on this page edits final.md.
      </p>
    </Section>
  );
}

export function ReferenceScreen({
  verificationLogHtml,
  verificationLogFound,
}: {
  verificationLogHtml: string;
  verificationLogFound: boolean;
}) {
  const { data, error, loading } = useResource<Payload>('/api/reference');

  const log = data?.verification_log;
  const lines = String(log?.markdown ?? '').split('\n').length;

  // Appendix G came from the server with the page, so it is never cleared here.
  const appendixG = (
    <section className="stack" id="rf-appendix-g" aria-label="Verification log">
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Verification log</h2>
          <span className="badge badge--outline">Read only, Appendix G</span>
        </div>
        <p className="text-sm muted">
          Appendix G of final.md is a record, not seed data. It is never parsed into rows and never
          stored in the database. It is rendered here straight from the file.
        </p>
        {verificationLogFound ? (
          <div className="md md--wide" dangerouslySetInnerHTML={{ __html: verificationLogHtml }} />
        ) : (
          <p className="muted">Appendix G was not found in data/final.md.</p>
        )}
        {data ? (
          <p className="text-xs muted measure">
            {log?.found
              ? `Read from data/final.md when this page was requested: ${int(
                  lines
                )} lines. It is not in the database, it is not seeded, and nothing in this application writes to it.`
              : 'Appendix G was not found in data/final.md, so there is nothing to show. That is a missing file, not an empty log.'}
          </p>
        ) : null}
      </div>
    </section>
  );

  if (error) {
    return (
      <>
        <section className="stack-sm" aria-label="Jump to">
          <ErrorCard message={error} />
        </section>
        <section className="stack-lg" aria-label="Reference tables">
          <EmptyState
            title="The reference tables did not load"
            body="Nothing here is editable, so nothing was lost. Reload the page once the error above is dealt with."
          />
        </section>
        {appendixG}
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <section className="stack-sm" aria-label="Jump to">
          <LoadingCard text="Loading jump to." />
        </section>
        <section className="stack-lg" aria-label="Reference tables">
          <LoadingCard text="Loading reference tables." />
        </section>
        {appendixG}
      </>
    );
  }

  // A section is listed in the nav whether or not it has rows, so the page and
  // the nav can never disagree about what exists.
  const present = SECTIONS.filter((s) => Array.isArray(data[s.key]));

  return (
    <>
      <section className="stack-sm" aria-label="Jump to">
        <div className="refnav">
          <span className="card__label">Jump to</span>
          {present.map((s) => (
            <a className="chip" href={`#rf-sec-${s.key}`} key={s.key}>
              {s.title}
            </a>
          ))}
          <a className="chip" href="#rf-doc">
            Read final.md verbatim
          </a>
          <a className="chip" href="#rf-appendix-g">
            Verification log
          </a>
        </div>
        <p className="text-xs muted">
          {`${int(
            present.length
          )} reference tables, plus the verbatim reader and Appendix G. Everything on this page is read only.`}
        </p>
      </section>

      <section className="stack-lg" aria-label="Reference tables">
        {present.map((spec) => {
          const rows: RefRow[] = data[spec.key] ?? [];
          return (
            <Section
              key={spec.key}
              id={`rf-sec-${spec.key}`}
              className="card stack refsection"
              title={spec.title}
              lede={spec.lede}
            >
              {rows.length ? (
                <Table<RefRow>
                  columns={spec.columns}
                  rows={rows}
                  caption={`${int(rows.length)} ${rows.length === 1 ? 'row' : 'rows'}.`}
                />
              ) : (
                <EmptyState
                  title="Nothing seeded here"
                  body={`The ${spec.title.toLowerCase()} table came back empty. It is seeded from final.md, so run npm run setup if that is unexpected.`}
                />
              )}
            </Section>
          );
        })}
        <DocReader />
      </section>

      {appendixG}
    </>
  );
}

export default ReferenceScreen;
