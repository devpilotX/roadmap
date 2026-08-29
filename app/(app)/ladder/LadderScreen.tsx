'use client';

/**
 * ladder | Part 12, the unlock ladder.
 *
 * The screen exists to answer one question honestly: what does this milestone
 * actually qualify me for. The answer is usually less than it feels like, which
 * is why the callout from the API sits above the ladder and not below it.
 *
 * A milestone is drawn as unlocked only when the server says so, and the server
 * decides from real evidence: a gate row marked passed, or a week finished in
 * full. Nothing here is unlocked by a date arriving.
 */

import { Icon } from '@/components/Icon';
import { useResource } from '@/components/ui/useResource';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  LoadingSections,
  Section,
  StatGrid,
  type StatSpec,
} from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { int, shortDate } from '@/lib/client/format';

const ICON = {
  check: 'M4 12l5 5L20 6',
  lock: 'M8 11V8a4 4 0 0 1 8 0v3M6 11h12v9H6z',
};

/* ------------------------------------------------------------------- types */

type Milestone = {
  id: number;
  ord: number;
  milestone: string;
  unlock_date: string;
  roles_text: string;
  verdict: string;
  is_gate: boolean;
  gate_no: number | null;
  week_n: number | null;
  unlocked: boolean;
  days_away: number;
  roles: string[];
};

type Threshold = {
  id: number;
  cumulative: number;
  reached_label: string;
  unlocks: string;
  reached: boolean;
  is_current: boolean;
};

type ResumeStage = {
  id: number;
  ord: number;
  stage: string;
  headline: string;
  available: boolean;
};

type RoleLegendRow = { code: string; name: string; entry_band: string };

interface Payload {
  today: string;
  solved: number;
  milestones: Milestone[];
  thresholds: Threshold[];
  resume_stages: ResumeStage[];
  roles: RoleLegendRow[];
  callout: string;
  applications_note: string;
}

/* ----------------------------------------------------------- the milestones */

function daysText(m: Milestone): string {
  if (m.unlocked) return 'unlocked';
  if (m.days_away === 0) return 'the date is today';
  if (m.days_away < 0) return `${int(Math.abs(m.days_away))} days past the date, still not unlocked`;
  return `${int(m.days_away)} days away`;
}

function MilestoneRow({ m }: { m: Milestone }) {
  const classes = ['milestone'];
  if (m.is_gate) classes.push('milestone--gate');
  if (m.unlocked) classes.push('milestone--unlocked');

  return (
    <div className={classes.join(' ')}>
      <span className="milestone__marker">
        <Icon path={m.unlocked ? ICON.check : ICON.lock} className="" />
      </span>
      <div className="stack-sm">
        <div className="row">
          <strong>{m.milestone}</strong>
          <Badge tone="outline">{shortDate(m.unlock_date)}</Badge>
          {m.is_gate ? <Badge tone="orange">{`Gate ${m.gate_no}`}</Badge> : null}
          {m.week_n ? <Badge tone="outline">{`Week ${m.week_n}`}</Badge> : null}
          <Badge tone={m.unlocked ? 'green' : m.days_away < 0 ? 'red' : 'outline'}>
            {daysText(m)}
          </Badge>
        </div>
        <p className="measure text-sm">{m.roles_text}</p>
        {m.roles.length ? (
          <div className="row">
            {m.roles.map((code) => (
              <Badge tone="outline" key={code}>
                {code}
              </Badge>
            ))}
          </div>
        ) : null}
        <p className="measure text-sm muted">{m.verdict}</p>
      </div>
    </div>
  );
}

function RoleLegend({ roles }: { roles: RoleLegendRow[] }) {
  return (
    <details className="acc">
      <summary className="acc__summary">{`What the role codes mean, ${roles.length} of them`}</summary>
      <div className="acc__body">
        <div className="grid grid--2">
          {roles.map((r) => (
            <div className="rolechip" key={r.code}>
              <span className="rolechip__code">{r.code}</span>
              <span className="rolechip__name">{r.name}</span>
              <span className="rolechip__band">{r.entry_band}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

/* --------------------------------------------------------------------- main */

const SECTIONS: [string, string][] = [
  ['The part you will not like', 'Loading the part you will not like.'],
  ['The real ladder', 'Loading the real ladder.'],
  ['The DSA threshold table', 'Loading the dsa threshold table.'],
  ['What goes on the resume', 'Loading what goes on the resume.'],
];

export function LadderScreen() {
  const { data, error, loading } = useResource<Payload>('/api/ladder');

  if (error) return <ErrorCard message={error} />;
  if (loading || !data)
    return (
      <LoadingSections
        sections={SECTIONS.map(([label, text]) => ({
          label,
          text,
          // The callout sits tighter than the tables below it, as it did in the view.
          className: label === 'The part you will not like' ? 'stack-sm' : 'stack',
        }))}
      />
    );

  const milestones = data.milestones ?? [];
  const thresholds = data.thresholds ?? [];
  const stages = data.resume_stages ?? [];
  const roles = data.roles ?? [];

  const unlocked = milestones.filter((m) => m.unlocked).length;
  const overdue = milestones.filter((m) => !m.unlocked && m.days_away < 0).length;
  const next = milestones.find((m) => !m.unlocked) ?? null;
  const current = thresholds.find((t) => t.is_current) ?? null;
  // Several resume stages can be available at once, so only the furthest one is
  // marked as the current row. Marking all of them says nothing.
  const furthestStage = stages.filter((s) => s.available).at(-1) ?? null;

  const stats: StatSpec[] = [
    {
      value: `${unlocked} of ${milestones.length}`,
      label: 'milestones actually unlocked',
      tone: unlocked ? 'green' : 'red',
      hero: true,
    },
    {
      value: next ? shortDate(next.unlock_date) : 'None left',
      label: next ? next.milestone : 'every milestone on the ladder is behind you',
      sub: next ? daysText(next) : '',
    },
    { value: int(data.solved), label: 'problems solved, which is what the thresholds below read' },
    {
      value: overdue,
      label: 'milestones whose date has passed and are still locked',
      tone: overdue ? 'red' : undefined,
    },
  ];

  const thresholdColumns: Column<Threshold>[] = [
    { key: 'cumulative', label: 'Solved', num: true, render: (r) => int(r.cumulative) },
    { key: 'reached_label', label: 'Reached about' },
    { key: 'unlocks', label: 'What the count unlocks' },
    {
      key: 'reached',
      label: 'Reached',
      render: (r) => (
        <Badge tone={r.reached ? 'green' : 'outline'}>{r.reached ? 'Yes' : 'Not yet'}</Badge>
      ),
    },
  ];

  const stageColumns: Column<ResumeStage>[] = [
    { key: 'stage', label: 'Stage' },
    { key: 'headline', label: 'The headline you can honestly write' },
    {
      key: 'available',
      label: 'Available',
      render: (r) => (
        <Badge tone={r.available ? 'green' : 'outline'}>{r.available ? 'Yes' : 'Not yet'}</Badge>
      ),
    },
  ];

  return (
    <>
      <section className="stack-sm" aria-label="The part you will not like">
        <Callout tone="red" title="The part you will not like">
          <p className="measure">{data.callout}</p>
        </Callout>
        <Callout tone="orange" title="Applications start at Gate 3, not Gate 4">
          <p className="measure">{data.applications_note}</p>
        </Callout>
      </section>

      <section className="stack" aria-label="The real ladder">
        <Section
          title="The real ladder"
          lede="A milestone is unlocked by evidence, not by a date. Gates need a gate row marked passed, weeks need all twelve ticks."
        >
          <StatGrid stats={stats} />
          {milestones.length ? (
            <div className="card card--flush">
              {milestones.map((m) => (
                <MilestoneRow key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No milestones"
              body="The ladder comes from Part 12 of final.md. Run npm run setup."
            />
          )}
          {roles.length ? <RoleLegend roles={roles} /> : null}
        </Section>
      </section>

      <section className="stack" aria-label="The DSA threshold table">
        <Section title="The DSA threshold table">
          {thresholds.length ? (
            <Table
              columns={thresholdColumns}
              rows={thresholds}
              rowKey={(r) => r.id}
              rowCurrent={(r) => Boolean(r.is_current)}
              caption={
                current
                  ? `You are at ${int(data.solved)} solved, which sits on the ${int(current.cumulative)} row.`
                  : `You are at ${int(data.solved)} solved, below the first row of this table.`
              }
            />
          ) : (
            <EmptyState
              title="No thresholds"
              body="The DSA thresholds come from Part 12 of final.md. Run npm run setup."
            />
          )}
          <p className="text-sm muted measure">
            The count gets you past a screen. It is a filter, not a qualification, and no row in this
            table is a job offer.
          </p>
        </Section>
      </section>

      <section className="stack" aria-label="What goes on the resume">
        <Section title="What goes on the resume, and when">
          {stages.length ? (
            <Table
              columns={stageColumns}
              rows={stages}
              rowKey={(r) => r.id}
              rowCurrent={(r) => r === furthestStage}
            />
          ) : (
            <EmptyState
              title="No resume stages"
              body="They come from Part 12 of final.md. Run npm run setup."
            />
          )}
          <p className="text-sm muted measure">
            A stage becomes available when its gate is marked passed with evidence. Writing the later
            headline early is the one lie on a resume that gets checked.
          </p>
        </Section>
      </section>
    </>
  );
}

export default LadderScreen;
