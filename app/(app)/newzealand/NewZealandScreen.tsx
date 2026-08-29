'use client';

/**
 * newzealand | Part 16, the New Zealand route.
 *
 * This is the long tail of the plan: what Tier 1 on the Green List actually
 * asks for, what New Zealand actually pays, what the move actually costs, and
 * the seven dated milestones between Gate 4 and a Permanent Resident Visa.
 *
 * Three things this screen is careful about.
 *
 * Every figure here is stored as text, not as a number, because final.md states
 * them with their units and their caveats attached. Nothing is reformatted or
 * rounded on the way to the screen, so what you read is what the source says.
 *
 * The wage and salary figures carry a caveat column and it is always shown. A
 * self reported median from a site that skews senior is not the same kind of
 * fact as a statutory wage threshold, and the two are not run together.
 *
 * The nz_unverified rows are not facts. They are the things that could not be
 * confirmed. They are labelled unverified, kept in their own panel at the
 * bottom, and never mixed into the tables above.
 */

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useResource } from '@/components/ui/useResource';
import { useToast } from '@/components/ToastProvider';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  LoadingCard,
  Section,
  StatGrid,
  type StatSpec,
} from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { api, type ApiError } from '@/lib/client/api';

const STATUS: { value: NzStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
];

const STATUS_TONE: Record<string, 'outline' | 'blue' | 'green'> = {
  not_started: 'outline',
  in_progress: 'blue',
  done: 'green',
};

const TICK = 'M4 12l5 5L20 6';

/* ------------------------------------------------------------------- types */

type NzStatus = 'not_started' | 'in_progress' | 'done';

type Requirement = { id: number; ord: number; requirement: string; detail: string };

type Fact = { id: number; ord: number; group_key: string; label: string; value: string; caveat: string };

type Correction = { id: number; ord: number; title: string; body: string };

type Milestone = {
  id: number;
  ord: number;
  milestone_date: string;
  age_on_id: string;
  age_actual: string;
  age_label: string;
  milestone: string;
  status: NzStatus;
  completed_on: string | null;
  notes: string;
};

type CostRow = {
  id: number;
  sort_order: number;
  item: string;
  cost_rupees: string;
  basis: string;
  is_total: number;
};

type SalaryRow = {
  id: number;
  ord: number;
  gross_nzd: string;
  gross_rupees: string;
  effective_tax_pct: string;
  net_nzd: string;
  net_rupees: string;
};

type ProjectionRow = {
  id: number;
  ord: number;
  years_after_landing: number;
  real_age: string;
  accumulated_rupees: string;
};

type UnverifiedRow = { id: number; ord: number; text: string };

type Investor = {
  label: string;
  growth: string;
  balanced: string;
  rupees_growth: string;
  rupees_balanced: string;
  multiple: string;
  note: string;
};

interface Payload {
  requirements: Requirement[];
  facts: { wage: Fact[]; salary: Fact[] };
  corrections: Correction[];
  milestones: Milestone[];
  costs: CostRow[];
  cost_total: CostRow | null;
  investor_comparison: Investor | null;
  salary: SalaryRow[];
  projection: ProjectionRow[];
  projection_label: string;
  unverified: UnverifiedRow[];
}

/* ------------------------------------------------------------------ nz-tier */

const REQUIREMENT_COLUMNS: Column<Requirement>[] = [
  { key: 'requirement', label: 'Requirement' },
  { key: 'detail', label: 'What it means' },
];

function TierPanel({
  requirements,
  milestones,
}: {
  requirements: Requirement[];
  milestones: Milestone[];
}) {
  const done = milestones.filter((m) => m.status === 'done').length;
  const started = milestones.filter((m) => m.status === 'in_progress').length;

  const stats: StatSpec[] = [
    {
      value: `${requirements.length}`,
      label: 'conditions on a Straight to Residence application',
      hero: true,
    },
    {
      value: `${done} of ${milestones.length}`,
      label: 'milestones marked done',
      tone: done ? 'green' : undefined,
    },
    { value: started, label: 'milestones in progress', tone: started ? 'blue' : undefined },
    { value: 'Tier 1', label: 'Software Engineer 261313 on the Green List' },
  ];

  return (
    <>
      <StatGrid stats={stats} />
      <Section
        title="What Tier 1 requires"
        lede="This is an employer led route. Every one of these is a condition on the application, not a preference."
      >
        {requirements.length ? (
          <Table
            columns={REQUIREMENT_COLUMNS}
            rows={requirements}
            rowKey={(r) => r.id}
            caption="The eight conditions, from Part 16."
          />
        ) : (
          <EmptyState
            title="No requirements loaded"
            body="The eight Tier 1 conditions come from Part 16 of final.md. Run npm run setup."
          />
        )}
      </Section>
    </>
  );
}

/* ----------------------------------------------------------------- nz-wages */

const FACT_COLUMNS: Column<Fact>[] = [
  { key: 'label', label: 'Source' },
  { key: 'value', label: 'Figure' },
  { key: 'caveat', label: 'Caveat' },
];

function FactsTable({ rows, caption }: { rows: Fact[]; caption: string }) {
  return <Table columns={FACT_COLUMNS} rows={rows} rowKey={(r) => r.id} caption={caption} />;
}

function WagesPanel({ facts }: { facts: Payload['facts'] }) {
  const wage = facts?.wage ?? [];
  const salary = facts?.salary ?? [];

  return (
    <>
      <Section
        title="Wage thresholds"
        lede="These are the numbers the visa is measured against. The employer satisfies them, not your savings."
      >
        {wage.length ? (
          <FactsTable
            rows={wage}
            caption="The statutory thresholds Immigration New Zealand publishes."
          />
        ) : (
          <EmptyState
            title="No wage thresholds loaded"
            body="They come from Part 16 of final.md. Run npm run setup."
          />
        )}
      </Section>
      <Section
        title="What New Zealand actually pays"
        lede="Self reported data skews senior and skews large employers. The caveat column is part of the figure, not a footnote to it."
      >
        {salary.length ? (
          <FactsTable rows={salary} caption="Market figures, each with the reason it might be wrong." />
        ) : (
          <EmptyState
            title="No salary figures loaded"
            body="They come from Part 16 of final.md. Run npm run setup."
          />
        )}
      </Section>
    </>
  );
}

/* ----------------------------------------------------------- nz-corrections */

function CorrectionsPanel({ corrections }: { corrections: Correction[] }) {
  if (!corrections.length) {
    return (
      <Section title="Three corrections">
        <EmptyState
          title="No corrections loaded"
          body="They come from Part 16 of final.md. Run npm run setup."
        />
      </Section>
    );
  }

  return (
    <Section
      title="Three corrections"
      lede="Three beliefs about this route that are wrong, and what is true instead. Read these before the numbers."
    >
      {corrections.map((c) => (
        <Callout tone="orange" title={c.title} key={c.id}>
          <p className="measure">{c.body}</p>
        </Callout>
      ))}
    </Section>
  );
}

/* -------------------------------------------------------------- nz-timeline */

function MilestoneRow({
  m,
  onSaved,
}: {
  m: Milestone;
  onSaved: (id: number, patch: { status?: NzStatus; notes?: string }) => void;
}) {
  const { toastOk, toastError } = useToast();
  const [status, setStatus] = useState<NzStatus>(m.status);
  const [notes, setNotes] = useState(m.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function write(
    patch: { status?: NzStatus; notes?: string },
    revert?: () => void
  ): Promise<boolean> {
    setBusy(true);
    try {
      await api.patch(`/api/nz/${m.id}/progress`, patch);
      toastOk('Saved.');
      return true;
    } catch (err) {
      if (revert) revert();
      toastError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onStatusChange(want: NzStatus) {
    const before = status;
    setStatus(want);
    const ok = await write({ status: want, notes }, () => setStatus(before));
    if (!ok) return;
    onSaved(m.id, { status: want, notes });
  }

  async function onSaveNote() {
    const ok = await write({ notes });
    if (ok) onSaved(m.id, { notes });
  }

  return (
    <div className={`milestone ${status === 'done' ? 'milestone--unlocked' : ''}`}>
      <span className="milestone__marker">
        {/* A tick only appears once the row is done, so the column reads as progress. */}
        {status === 'done' ? (
          <Icon path={TICK} className="" />
        ) : (
          <span className="text-xs muted">{String(m.ord)}</span>
        )}
      </span>
      <div className="stack-sm">
        <div className="between">
          <div className="row">
            <Badge tone="outline">{m.milestone_date}</Badge>
            <span className="text-xs muted">{m.age_label}</span>
          </div>
          <Badge tone={STATUS_TONE[status] ?? 'outline'}>
            {STATUS.find((s) => s.value === status)?.label ?? status}
          </Badge>
        </div>
        <p className="measure">{m.milestone}</p>
        <p className="text-xs muted">
          {`Age ${m.age_on_id} on your government ID, ${m.age_actual} by your actual date of birth.`}
        </p>
        <details className="acc">
          <summary className="acc__summary">Mark this milestone and add a note</summary>
          <div className="acc__body stack-sm">
            <div className="field">
              <label className="field__label" htmlFor={`nz-status-${m.id}`}>
                Status
              </label>
              <select
                id={`nz-status-${m.id}`}
                className="select select--sm"
                aria-label={`Status of ${m.milestone}`}
                value={status}
                disabled={busy}
                onChange={(e) => void onStatusChange(e.target.value as NzStatus)}
              >
                {STATUS.map((s) => (
                  <option value={s.value} key={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor={`nz-notes-${m.id}`}>
                Notes
              </label>
              <textarea
                id={`nz-notes-${m.id}`}
                className="textarea"
                rows={2}
                placeholder="What has actually moved on this."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <div className="row">
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy}
                onClick={() => void onSaveNote()}
              >
                Save the note
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

function TimelinePanel({
  milestones,
  onSaved,
}: {
  milestones: Milestone[];
  onSaved: (id: number, patch: { status?: NzStatus; notes?: string }) => void;
}) {
  return (
    <Section
      title="The timeline"
      lede="Seven dated milestones between Gate 4 and a Permanent Resident Visa. Every date is years out, so each row carries both the age on your ID and your actual age."
    >
      {milestones.length ? (
        <div className="card card--flush">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} m={m} onSaved={onSaved} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No milestones loaded"
          body="The seven milestones come from Part 16 of final.md. Run npm run setup."
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ nz-cost */

const COST_COLUMNS: Column<CostRow>[] = [
  { key: 'item', label: 'Item' },
  { key: 'cost_rupees', label: 'Cost' },
  { key: 'basis', label: 'Basis' },
];

function CostPanel({
  costs,
  total,
  investor,
}: {
  costs: CostRow[];
  total: CostRow | null;
  investor: Investor | null;
}) {
  const lines = costs.filter((c) => Number(c.is_total) !== 1);

  return (
    <Section
      title="What the move costs"
      lede="The crore figure people repeat about New Zealand comes from a different visa entirely. Both sit here side by side so the gap is visible without scrolling."
    >
      <p className="costheading">One person, direct costs only. Not lakhs of migration savings.</p>
      {lines.length ? (
        <Table
          columns={COST_COLUMNS}
          rows={lines}
          rowKey={(c) => c.id}
          caption="Each line carries the basis it was worked out from."
        />
      ) : (
        <EmptyState
          title="No costs loaded"
          body="They come from Part 16 of final.md. Run npm run setup."
        />
      )}
      <div className="nzsplit">
        <div className="card stack-sm">
          <p className="card__label">{total ? total.item : 'Total'}</p>
          <p className="nztotal">{total ? total.cost_rupees : 'Not loaded'}</p>
          {total ? <p className="text-sm muted measure">{total.basis}</p> : null}
        </div>
        {investor ? (
          <div className="card nzinvestor stack-sm">
            <p className="card__label">{investor.label}</p>
            <p className="nzinvestor__figure">{investor.growth}</p>
            <p className="text-sm">{investor.rupees_growth}</p>
            <p className="nzinvestor__figure">{investor.balanced}</p>
            <p className="text-sm">{investor.rupees_balanced}</p>
            <p className="nzgap">{investor.multiple}</p>
            <p className="measure text-sm">{investor.note}</p>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- nz-salary */

const SALARY_COLUMNS: Column<SalaryRow>[] = [
  { key: 'gross_nzd', label: 'Gross, NZD' },
  { key: 'gross_rupees', label: 'Gross, rupees' },
  { key: 'effective_tax_pct', label: 'Effective tax' },
  { key: 'net_nzd', label: 'Net, NZD' },
  { key: 'net_rupees', label: 'Net, rupees' },
];

function SalaryPanel({ salary }: { salary: SalaryRow[] }) {
  return (
    <Section
      title="What the salary is worth"
      lede="The rupee column is a conversion, not purchasing power. New Zealand rent and food are not Indian rent and food, and the take home in the last column is what you actually live on."
    >
      {salary.length ? (
        <Table
          columns={SALARY_COLUMNS}
          rows={salary}
          rowKey={(r) => r.id}
          caption="Gross to net at several salary levels."
        />
      ) : (
        <EmptyState
          title="No salary conversions loaded"
          body="They come from Part 16 of final.md. Run npm run setup."
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ nz-projection */

const PROJECTION_COLUMNS: Column<ProjectionRow>[] = [
  { key: 'years_after_landing', label: 'Years after landing', num: true },
  { key: 'real_age', label: 'Your actual age' },
  { key: 'accumulated_rupees', label: 'Accumulated' },
];

function ProjectionPanel({
  projection,
  label,
}: {
  projection: ProjectionRow[];
  label: string | undefined;
}) {
  return (
    <Section title={label ?? 'Projection'}>
      <Callout tone="orange" title={label ?? 'Projection, not promise'}>
        <p className="measure">
          These rows assume a salary you have not been offered, a savings rate you have not held for a
          decade, and an exchange rate nobody can forecast. They show the shape of the route, not an
          amount you will have.
        </p>
      </Callout>
      {projection.length ? (
        <Table columns={PROJECTION_COLUMNS} rows={projection} rowKey={(r) => r.id} />
      ) : (
        <EmptyState
          title="No projection loaded"
          body="It comes from Part 16 of final.md. Run npm run setup."
        />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------ nz-unverified */

function UnverifiedPanel({ rows }: { rows: UnverifiedRow[] }) {
  return (
    <Section title="What could not be verified">
      <Callout tone="red" title="These are not facts">
        <p className="measure">
          Every line below failed verification. They are recorded because they were claimed somewhere,
          not because they are true. Do not plan on them, do not repeat them, and check each one
          against Immigration New Zealand before it matters.
        </p>
      </Callout>
      {rows.length ? (
        <ul className="stack-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Badge tone="red">Unverified</Badge>{' '}
              <span className="measure">{r.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nothing outstanding"
          body="No unverified claims are recorded for the New Zealand route. That is the good case, not an empty screen."
        />
      )}
    </Section>
  );
}

/* --------------------------------------------------------------------- main */

const SECTIONS: [string, string][] = [
  ['What Tier 1 requires', 'Loading what tier 1 requires.'],
  [
    'Wage thresholds and what New Zealand pays',
    'Loading wage thresholds and what new zealand pays.',
  ],
  ['Three corrections', 'Loading three corrections.'],
  ['The timeline', 'Loading the timeline.'],
  ['What the move costs', 'Loading what the move costs.'],
  ['What the salary is worth', 'Loading what the salary is worth.'],
  ['Projection, not promise', 'Loading projection, not promise.'],
  ['What could not be verified', 'Loading what could not be verified.'],
];

export function NewZealandScreen({
  verificationLogHtml,
  verificationLogFound,
}: {
  verificationLogHtml: string;
  verificationLogFound: boolean;
}) {
  const { data, error, loading, setData } = useResource<Payload>('/api/nz');

  /** Keeps the payload in step with a milestone that has just been saved. */
  function onSaved(id: number, patch: { status?: NzStatus; notes?: string }) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            milestones: prev.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          }
        : prev
    );
  }

  const appendixG = (
    <section className="stack" aria-label="Verification log">
      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Verification log</h2>
          <Badge tone="outline">Read only, Appendix G</Badge>
        </div>
        <p className="text-sm muted">
          Appendix G of final.md is a record, not seed data. It is never parsed into rows and never
          stored in the database. It is rendered here straight from the file.
        </p>
        {verificationLogFound ? (
          // renderMarkdown escapes every character of HTML before it applies a
          // single rule, so nothing in final.md can inject markup here.
          <div className="md md--wide" dangerouslySetInnerHTML={{ __html: verificationLogHtml }} />
        ) : (
          <p className="muted">Appendix G was not found in data/final.md.</p>
        )}
      </div>
    </section>
  );

  if (error) return <ErrorCard message={error} />;
  if (loading || !data)
    return (
      <>
        {SECTIONS.map(([label, text]) => (
          <section className="stack" aria-label={label} key={label}>
            <LoadingCard text={text} />
          </section>
        ))}
        {appendixG}
      </>
    );

  const milestones = data.milestones ?? [];

  return (
    <>
      <section className="stack" aria-label="What Tier 1 requires">
        <TierPanel requirements={data.requirements ?? []} milestones={milestones} />
      </section>

      <section className="stack" aria-label="Wage thresholds and what New Zealand pays">
        <WagesPanel facts={data.facts ?? { wage: [], salary: [] }} />
      </section>

      <section className="stack" aria-label="Three corrections">
        <CorrectionsPanel corrections={data.corrections ?? []} />
      </section>

      <section className="stack" aria-label="The timeline">
        <TimelinePanel milestones={milestones} onSaved={onSaved} />
      </section>

      <section className="stack" aria-label="What the move costs">
        <CostPanel
          costs={data.costs ?? []}
          total={data.cost_total ?? null}
          investor={data.investor_comparison ?? null}
        />
      </section>

      <section className="stack" aria-label="What the salary is worth">
        <SalaryPanel salary={data.salary ?? []} />
      </section>

      <section className="stack" aria-label="Projection, not promise">
        <ProjectionPanel projection={data.projection ?? []} label={data.projection_label} />
      </section>

      <section className="stack" aria-label="What could not be verified">
        <UnverifiedPanel rows={data.unverified ?? []} />
      </section>

      {appendixG}
    </>
  );
}

export default NewZealandScreen;
