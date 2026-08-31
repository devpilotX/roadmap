'use client';

/**
 * The 21 week grid, in six phase colour groups.
 */

import Link from 'next/link';
import { useResource } from '@/components/ui/useResource';
import { Badge, Callout, ErrorCard, Meter, StatGrid , LoadingSections} from '@/components/ui/Basics';
import { int, phaseClass } from '@/lib/client/format';

interface WeekProgress {
  percent: number;
  learn_done: number;
  build_done: number;
  complete: boolean;
}

interface WeekRow {
  n: number;
  title: string;
  dates_label: string;
  phase_code: string;
  focus: string;
  dsa_target: number;
  dsa_cumulative: number;
  gate_no: number | null;
  progress: WeekProgress;
  link_count: number;
  is_current: boolean;
  is_past: boolean;
}

interface Phase {
  code: string;
  name: string;
  week_from: number;
  week_to: number;
  blurb: string;
}

interface Payload {
  today: string;
  phases: Phase[];
  gates: { no: number; gate_date: string }[];
  weeks: WeekRow[];
}

function WeekCard({ w }: { w: WeekRow }) {
  return (
    <Link
      href={`/weeks/${w.n}`}
      className={`weekcard ${phaseClass(w.phase_code)}${w.is_current ? ' weekcard--current' : ''}`}
    >
      <span className="weekcard__top">
        <span className="weekcard__n">W{String(w.n).padStart(2, '0')}</span>
        {w.gate_no ? <Badge tone="orange">Gate {w.gate_no}</Badge> : null}
      </span>
      <span className="weekcard__dates">{w.dates_label}</span>
      <span className="weekcard__title">{w.title}</span>
      <Meter
        percent={w.progress.percent}
        tone={w.progress.complete ? 'green' : undefined}
        label={`${w.progress.percent} per cent of week ${w.n} done`}
      />
      <span className="weekcard__foot">
        <span>{w.progress.percent}% done</span>
        <span>DSA {int(w.dsa_cumulative)}</span>
      </span>
    </Link>
  );
}

export function WeeksScreen() {
  const { data, error, loading } = useResource<Payload>('/api/weeks');

  // Only a first load that failed has nothing to show. useResource keeps the last
  // good payload when a refetch fails, and this used to throw all 21 cards away on
  // the strength of that error anyway: a moment offline replaced a finished grid
  // with a red box. An error with data behind it is reported above the grid instead,
  // because stale weeks are worth more than no weeks and the person still has to be
  // told the number they are looking at is not fresh.
  if (error && !data) return <ErrorCard message={error} />;
  if (loading || !data) {
    return (
      <LoadingSections
        sections={[
          { label: 'Week summary', text: 'Loading week summary.' },
          {
            label: 'The weeks, grouped by phase',
            text: 'Loading the weeks, grouped by phase.',
            className: 'stack-lg',
          },
        ]}
      />
    );
  }

  const complete = data.weeks.filter((w) => w.progress.complete).length;
  const current = data.weeks.find((w) => w.is_current);
  const totalTicks = data.weeks.reduce(
    (a, w) => a + w.progress.learn_done + w.progress.build_done,
    0
  );

  return (
    <>
      {error ? (
        <section className="stack" aria-label="Refresh failure">
          <Callout tone="orange" title="That did not refresh">
            <p>{error}</p>
            <p>Everything below is the last good answer the server gave.</p>
          </Callout>
        </section>
      ) : null}

      <section className="stack" aria-label="Week summary">
        <StatGrid
          stats={[
            {
              value: `${complete} of 21`,
              label: 'weeks finished in full',
              tone: complete ? 'green' : undefined,
            },
            {
              value: current ? `W${String(current.n).padStart(2, '0')}` : 'None',
              label: current ? current.title : 'outside the window',
              sub: current ? current.dates_label : '',
            },
            {
              value: `${totalTicks} of 252`,
              label: 'day ticks, six learn and six build a week',
            },
            {
              value: data.gates.length,
              label: 'gates',
              sub: data.gates.map((g) => `Gate ${g.no} on ${g.gate_date}`).join(', '),
            },
          ]}
        />
      </section>

      <section className="stack-lg" aria-label="The weeks, grouped by phase">
        {data.phases.map((p) => {
          const weeks = data.weeks.filter((w) => w.phase_code === p.code);
          return (
            <div className="phasegroup" key={p.code}>
              <div className={`phasegroup__head ${phaseClass(p.code)}`}>
                <span className="phasegroup__code">{p.code}</span>
                <div>
                  <h2 className="card__title">
                    {p.name}, weeks {p.week_from} to {p.week_to}
                  </h2>
                  <p className="text-sm muted">{p.blurb}</p>
                </div>
              </div>
              <div className="grid grid--3">
                {weeks.map((w) => (
                  <WeekCard key={w.n} w={w} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}

export default WeeksScreen;
