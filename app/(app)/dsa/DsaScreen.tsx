'use client';

/**
 * DsaScreen | the DSA tracker.
 *
 * Until a real 474 row export is imported the screen shows topic level progress
 * and says so plainly, because problem names are never invented.
 */

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { useDebounced, useResource } from '@/components/ui/useResource';
import {
  Badge,
  Callout,
  ErrorCard,
  LoadingCard,
  Meter,
  Section,
  StatGrid,
  LoadingSections,
} from '@/components/ui/Basics';
import { ChipFilter, NumberInput, SearchBox } from '@/components/ui/Controls';
import { LineChart } from '@/components/ui/Charts';
import { Table, type Column } from '@/components/ui/Table';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { useTimer } from '@/components/TimerProvider';
import { int } from '@/lib/client/format';

const A2Z_SHEET = 'https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z';
const PLAY = 'M8 5l11 7-11 7z';

/* ------------------------------------------------------------------ types */

interface Topic {
  id: number;
  ord: number;
  name: string;
  total: number;
  solved: number;
  failed_twice: number;
  manual_solved: number;
  manual_minutes: number;
  notes: string;
}

interface Problem {
  id: number;
  name: string;
  difficulty: string;
  url: string | null;
  topic: string;
  status: string;
  times_failed?: number;
  notes?: string | null;
}

interface LadderRow {
  problems: number;
  reached_about: string;
  gets_you_past: string;
  does_not_open: string;
  reached: boolean;
  [key: string]: unknown;
}

interface Summary {
  total_in_sheet: number;
  target_by_gate4: number;
  solved: number;
  source: string;
  problems_imported: boolean;
  problem_count: number;
  import_pending: boolean;
  import_notice: string | null;
  by_difficulty: Record<string, { total: number; solved: number }>;
  expected_split: { Easy: number; Medium: number; Hard: number };
  topics: Topic[];
  thresholds: Record<string, unknown>[];
  ladder: LadderRow[];
  curve: {
    week_n: number;
    end_date: string;
    plan: number;
    actual: number | null;
    is_past: boolean;
  }[];
  daily: { log_date: string; dsa_solved: number; dsa_minutes: number }[];
  failed_twice: Problem[];
  minutes_total: number;
}

interface ProblemsPayload {
  problems: Problem[];
  count: number;
}

/* -------------------------------------------------------------- one topic */

function TopicBlock({
  t,
  problemsImported,
  onSaved,
}: {
  t: Topic;
  problemsImported: boolean;
  onSaved: () => void;
}) {
  const { toast, toastError } = useToast();
  const [solved, setSolved] = useState(t.manual_solved);
  useEffect(() => setSolved(t.manual_solved), [t.manual_solved]);

  const commit = useDebounced(async (value: number) => {
    try {
      await api.patch(`/api/dsa/topics/${t.id}/progress`, { solved: value });
      toast('Saved.', 'ok');
      onSaved();
    } catch (err) {
      toastError((err as ApiError).message);
    }
  }, 350);

  const percent = t.total ? Math.round((t.solved / t.total) * 100) : 0;

  return (
    <details className="dsatopic">
      <summary className="dsatopic__head">
        <span className="dsatopic__ord">{String(t.ord).padStart(2, '0')}</span>
        <span>
          <strong>{t.name}</strong>
          <span className="text-xs muted">
            {t.total
              ? ` ${t.solved} of ${t.total} solved`
              : ` ${t.manual_solved} logged, no problem list imported`}
          </span>
        </span>
        <span className="dsatopic__meter">
          <Meter percent={percent} tone={t.total && t.solved === t.total ? 'green' : undefined} />
        </span>
        {t.failed_twice ? (
          <Badge tone="red">{`${t.failed_twice} failed twice`}</Badge>
        ) : (
          <span />
        )}
      </summary>
      <div className="dsatopic__body stack-sm">
        {!problemsImported ? (
          <div className="row">
            <span className="text-sm">Problems solved in this step</span>
            <NumberInput
              value={solved}
              min={0}
              max={500}
              label={`Problems solved in ${t.name}`}
              className="input input--sm input--num"
              onChange={(next) => {
                setSolved(next);
                void commit(next);
              }}
            />
          </div>
        ) : (
          <p className="text-sm muted">Open the problem list below and tick them individually.</p>
        )}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------ one problem */

const STATUS_OPTIONS: [string, string][] = [
  ['todo', 'Not started'],
  ['solved', 'Solved'],
  ['revisit', 'Revisit'],
  ['failed_twice', 'Failed twice'],
];

function ProblemRow({ p, onSaved }: { p: Problem; onSaved: () => Promise<void> }) {
  const { toast, toastError } = useToast();
  const { openAndStart } = useTimer();
  const [status, setStatus] = useState(p.status);
  useEffect(() => setStatus(p.status), [p.status]);

  return (
    <div className="linkrow">
      <div className="linkrow__main">
        <div className="linkrow__title">
          <span>{p.name}</span>
          <span className={`difficulty difficulty--${p.difficulty}`}>{p.difficulty}</span>
          {status === 'failed_twice' ? <Badge tone="red">Failed twice</Badge> : null}
        </div>
        <p className="linkrow__why">{p.topic}</p>
      </div>
      <div className="linkrow__actions">
        <select
          className="select select--sm"
          aria-label={`Status for ${p.name}`}
          value={status}
          onChange={async (e) => {
            const next = e.target.value;
            setStatus(next);
            try {
              await api.patch(`/api/dsa/problems/${p.id}/progress`, { status: next });
              toast('Saved.', 'ok');
              await onSaved();
            } catch (err) {
              setStatus(p.status);
              toastError((err as ApiError).message);
            }
          }}
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--sm btn--start"
          onClick={() =>
            void openAndStart({ url: p.url || A2Z_SHEET, block: 'DSA', label: p.name })
          }
        >
          <Icon path={PLAY} />
          Open and start
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- screen */

export function DsaScreen() {
  const summary = useResource<Summary>('/api/dsa/summary');

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const pushQ = useDebounced((value: string) => setDebouncedQ(value), 250);

  const imported = summary.data?.problems_imported ?? false;

  const path = useMemo(() => {
    if (!imported) return null;
    const params = new URLSearchParams();
    if (topic) params.set('topic', topic);
    if (difficulty) params.set('difficulty', difficulty);
    if (status) params.set('status', status);
    if (debouncedQ) params.set('q', debouncedQ);
    return `/api/dsa/problems?${params.toString()}`;
  }, [imported, topic, difficulty, status, debouncedQ]);

  const problems = useResource<ProblemsPayload>(path);

  const reload = async () => {
    await summary.refresh();
    await problems.refresh();
  };

  if (summary.error && !summary.data) return <ErrorCard message={summary.error} />;
  if (summary.loading || !summary.data) {
    return (
      <LoadingSections
        sections={[
          { label: 'DSA summary', text: 'Loading dsa summary.' },
          { label: 'Cumulative against plan', text: 'Loading cumulative against plan.' },
          { label: 'Failed twice', text: 'Loading failed twice.' },
          { label: 'Filters', text: 'Loading filters.', className: 'stack-sm' },
          { label: 'Problems and topics', text: 'Loading problems and topics.' },
        ]}
      />
    );
  }

  const s = summary.data;

  const ladderColumns: Column<LadderRow>[] = [
    { key: 'problems', label: 'Problems', num: true },
    { key: 'reached_about', label: 'Reached about' },
    { key: 'gets_you_past', label: 'What the number alone gets you past' },
    { key: 'does_not_open', label: 'What it still does not open' },
  ];

  /* The 18 A2Z steps are seed data, so an empty list is not "you have not started
   * yet", it is "the seed did not land". Saying which saves a hunt through the
   * network tab for a request that succeeded and returned nothing. */
  const topicList = s.topics.length ? (
    <div>
      {s.topics.map((t) => (
        <TopicBlock
          key={t.id}
          t={t}
          problemsImported={s.problems_imported}
          onSaved={() => void summary.refresh()}
        />
      ))}
    </div>
  ) : (
    <p className="muted">
      No steps are loaded. The 18 A2Z steps come from the seed, not from anything you do here, so an
      empty list means the seed has not run against this account.
    </p>
  );

  return (
    <>
      <section className="stack" aria-label="DSA summary">
        <StatGrid
          columns={4}
          stats={[
            {
              value: `${int(s.solved)} of ${int(s.total_in_sheet)}`,
              label: 'problems solved',
              sub: `${int(s.target_by_gate4)} is the target by 24 January 2027`,
              hero: true,
              tone: s.solved >= s.target_by_gate4 ? 'green' : undefined,
            },
            {
              value: s.by_difficulty.Easy?.solved ?? 0,
              label: `Easy, of ${s.expected_split.Easy}`,
            },
            {
              value: s.by_difficulty.Medium?.solved ?? 0,
              label: `Medium, of ${s.expected_split.Medium}`,
            },
            {
              value: s.by_difficulty.Hard?.solved ?? 0,
              label: `Hard, of ${s.expected_split.Hard}`,
            },
          ]}
        />

        {s.import_notice ? (
          <Callout tone="orange" title="Problem level import is pending">
            <p>{s.import_notice}</p>
          </Callout>
        ) : null}

        <Callout
          tone="blue"
          title="Completing DSA on its own unlocks no job role at all"
        >
          <p>
            DSA is a filter, not a qualification. The count gets you past a screen. The projects get
            you the offer. A candidate with 474 problems and no shipped system loses to a candidate
            with 200 problems and a live application, every time.
          </p>
        </Callout>
      </section>

      <section className="stack" aria-label="Cumulative against plan">
        <Section
          title="Cumulative against the plan"
          lede="The dashed line is the Part 3 cumulative column. The solid line is what actually happened."
        >
          <LineChart
            points={s.curve.map((c) => ({
              label: `W${c.week_n}`,
              plan: c.plan,
              actual: c.actual,
            }))}
            summary={`Plan ends at ${int(s.target_by_gate4)}. Actual is ${int(s.solved)}.`}
          />
        </Section>

        <Section title="The DSA only ladder" lede="No number in this table unlocks a single role.">
          <Table<LadderRow>
            columns={ladderColumns}
            rows={s.ladder}
            rowKey={(r) => r.problems}
            rowCurrent={(r) =>
              Boolean(r.reached) && !s.ladder.some((o) => o.problems > r.problems && o.reached)
            }
          />
        </Section>
      </section>

      <section className="stack" aria-label="Failed twice">
        {s.failed_twice.length ? (
          <Section
            title={`Failed twice, ${s.failed_twice.length}`}
            lede="Each one stays here, and on Today, until it is solved cold. Every entry needs the mechanism, not the answer."
          >
            <div>
              {s.failed_twice.map((p) => (
                <ProblemRow key={p.id} p={p} onSaved={reload} />
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Failed twice">
            <p className="muted">
              Nothing has beaten you twice yet. When something does, it lands here and on Today.
            </p>
          </Section>
        )}
      </section>

      <section className="stack-sm" aria-label="Filters">
        <div className="card">
          <div className="filters">
            <SearchBox
              placeholder="Search a problem name"
              value={q}
              onChange={(value) => {
                setQ(value);
                pushQ(value);
              }}
            />

            <select
              className="select select--sm"
              aria-label="Filter by topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            >
              <option value="">Every topic</option>
              {s.topics.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name}
                </option>
              ))}
            </select>

            <ChipFilter<string>
              options={[
                { value: '', label: 'Any difficulty' },
                { value: 'Easy', label: 'Easy', count: s.expected_split.Easy },
                { value: 'Medium', label: 'Medium', count: s.expected_split.Medium },
                { value: 'Hard', label: 'Hard', count: s.expected_split.Hard },
              ]}
              current={difficulty}
              onChange={setDifficulty}
            />

            <ChipFilter<string>
              options={[
                { value: '', label: 'Any status' },
                { value: 'todo', label: 'Not started' },
                { value: 'solved', label: 'Solved' },
                { value: 'revisit', label: 'Revisit' },
                { value: 'failed_twice', label: 'Failed twice' },
              ]}
              current={status}
              onChange={setStatus}
            />
          </div>
        </div>
      </section>

      <section className="stack" aria-label="Problems and topics">
        {!s.problems_imported ? (
          <Section
            title="The 18 A2Z steps"
            lede="Progress is tracked per step until a real problem list is imported."
          >
            {topicList}
          </Section>
        ) : problems.error ? (
          <ErrorCard message={problems.error} />
        ) : problems.loading || !problems.data ? (
          <LoadingCard text="Loading problems and topics." />
        ) : (
          <>
            <Section title={`Problems, ${problems.data.count} shown`}>
              {problems.data.problems.length ? (
                <div>
                  {problems.data.problems.map((p) => (
                    <ProblemRow key={p.id} p={p} onSaved={reload} />
                  ))}
                </div>
              ) : (
                /* Four filters can be on at once, so an empty list is nearly always
                   the filters and not the import. It says so rather than looking
                   like a screen that failed to draw. */
                <p className="muted">
                  No problem matches these filters. Clear the search, or widen the topic, difficulty
                  and status above.
                </p>
              )}
            </Section>
            <Section title="The 18 A2Z steps">{topicList}</Section>
          </>
        )}
      </section>
    </>
  );
}

export default DsaScreen;
