'use client';

/**
 * after | Part 15, what happens after 24 January 2027.
 *
 * Gate 4 is not the finish line, it is where the plan changes shape, so this
 * screen is the only one in the application that looks past the 150 days. The
 * three branches are read only, because which one you are on is decided by
 * whether you have a job and not by a checkbox.
 *
 * The bridge items, the quarters and the year detail lines are real ticks against
 * continuation_progress, which is why the counter at the top is worth something.
 * The weekday shape is reference text and has nothing to tick.
 */

import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useResource } from '@/components/ui/useResource';
import { useToast } from '@/components/ToastProvider';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  LoadingSections,
  Meter,
  Section,
} from '@/components/ui/Basics';
import { Tick } from '@/components/ui/Controls';
import { Table, type Column } from '@/components/ui/Table';
import { api, type ApiError } from '@/lib/client/api';
import { int, shortDate } from '@/lib/client/format';

/* ------------------------------------------------------------------- types */

type ContinuationRow = {
  id: number;
  ord: number;
  kind: string;
  label: string;
  period: string;
  age_label: string | null;
  goal: string;
  detail: string | null;
  hours_text: string | null;
  done: boolean;
  completed_on: string | null;
  notes: string;
};

interface Payload {
  rows: ContinuationRow[];
  grouped: Record<string, ContinuationRow[]>;
  done_count: number;
  total_count: number;
}

/**
 * The seed text carries markdown emphasis around the lead clause of some lines.
 * Splitting on the markers and returning real elements keeps the emphasis the
 * document intended without ever putting a string through innerHTML.
 */
function emphasise(text: string | null | undefined): ReactNode[] {
  const out: ReactNode[] = [];
  String(text ?? '')
    .split('**')
    .forEach((part, i) => {
      if (part === '') return;
      out.push(
        i % 2 === 1 ? <strong key={i}>{part}</strong> : <Fragment key={i}>{part}</Fragment>
      );
    });
  return out;
}

/* ----------------------------------------------------------------- one tick */

function TickRow({ r, onBump }: { r: ContinuationRow; onBump: (delta: number) => void }) {
  const { toast, toastError } = useToast();
  const [done, setDone] = useState(r.done);
  const [completedOn, setCompletedOn] = useState<string | null>(r.completed_on);
  const [notes, setNotes] = useState(r.notes ?? '');
  const [saved, setSaved] = useState(r.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function onTick(want: boolean) {
    setBusy(true);
    try {
      const result = await api.patch<{ completed_on: string | null } | null>(
        `/api/after/${r.id}/progress`,
        { done: want }
      );
      setDone(want);
      setCompletedOn(result?.completed_on ?? null);
      onBump(want ? 1 : -1);
    } catch (err) {
      // An explicit revert, so nothing is ever left looking saved.
      setDone(!want);
      toastError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSaveNote() {
    if (notes === saved) return;
    const before = saved;
    try {
      await api.patch(`/api/after/${r.id}/progress`, { notes });
      setSaved(notes);
      toast('Note saved.');
    } catch (err) {
      setNotes(before);
      toastError((err as ApiError).message);
    }
  }

  return (
    <div className="stack-sm">
      <Tick
        checked={done}
        disabled={busy}
        onChange={(next) => void onTick(next)}
        label={emphasise(r.goal)}
        meta={completedOn ? `Ticked on ${shortDate(completedOn)}` : ''}
      />
      <input
        className="input input--sm"
        value={notes}
        placeholder="A note"
        aria-label={`Note for ${r.label}`}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => void onSaveNote()}
      />
    </div>
  );
}

/* -------------------------------------------------------------- the branches */

function BranchCard({ b }: { b: ContinuationRow }) {
  return (
    <article className="branchcard">
      <div className="between">
        <span className="branchcard__letter">{b.label}</span>
        <Badge tone="outline">{b.period}</Badge>
      </div>
      <h3 className="card__title">{b.goal}</h3>
      {b.detail ? <p className="measure text-sm">{emphasise(b.detail)}</p> : null}
      {b.hours_text ? <p className="text-sm muted">{`Hours: ${b.hours_text}`}</p> : null}
    </article>
  );
}

/* --------------------------------------------------------------------- main */

const SECTIONS: [string, string][] = [
  ['The three branches', 'Loading the three branches.'],
  ['February to March 2027', 'Loading february to march 2027.'],
  ['The weekday shape when employed', 'Loading the weekday shape when employed.'],
  ['Year one, two and three', 'Loading year one, two and three.'],
];

const WEEKDAY_COLUMNS: Column<ContinuationRow>[] = [
  { key: 'period', label: 'When' },
  { key: 'goal', label: 'What happens' },
  { key: 'hours_text', label: 'Hours', num: true },
];

export function AfterScreen() {
  const { data, error, loading } = useResource<Payload>('/api/after');
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (data) setDone(Number(data.done_count ?? 0));
  }, [data]);

  const bump = useCallback((delta: number) => {
    setDone((n) => Math.max(0, n + delta));
  }, []);

  if (error) return <ErrorCard message={error} />;
  if (loading || !data)
    return (
      <LoadingSections
        sections={SECTIONS.map(([label, text]) => ({
          label,
          text,
          // The three year sections sit further apart than the panels above them.
          className: label === 'Year one, two and three' ? 'stack-lg' : 'stack',
        }))}
      />
    );

  const g = data.grouped ?? {};
  const branches = g.branch ?? [];
  const bridge = g.bridge ?? [];
  const weekday = g.weekday ?? [];
  const years = g.year ?? [];
  const quarters = g.quarter ?? [];
  const details = g.year_detail ?? [];

  const total = Number(data.total_count ?? 0);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <>
      <section className="stack" aria-label="The three branches">
        <Section
          title="The three branches"
          lede="Gate 4 is not the finish line. It is where the plan changes shape."
        >
          <div className="card stat">
            <span className="stat__value stat__value--hero">{`${int(done)} of ${int(total)}`}</span>
            <span className="stat__label">{`${percent}% of the tickable items after Gate 4`}</span>
            <Meter percent={percent} />
            <span className="stat__sub">
              The bridge items, the four quarters and the year detail lines are the tickable ones. The
              branches and the weekday shape are reference.
            </span>
          </div>
          {branches.length ? (
            <div className="grid grid--3">
              {branches.map((b) => (
                <BranchCard key={b.id} b={b} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No branches listed"
              body="The three branches come from Part 15 of final.md. Run npm run setup."
            />
          )}
          <p className="text-sm muted measure">
            Which branch you are on is decided by whether you are employed on 1 February 2027, so
            there is nothing to choose here. Read the one that applies and ignore the other two.
          </p>
        </Section>
      </section>

      <section className="stack" aria-label="February to March 2027">
        <Section
          title="February to March 2027"
          lede={bridge.length ? `${bridge.length} items, each one tickable.` : ''}
        >
          {bridge.length ? (
            <div className="stack-sm">
              {bridge.map((r) => (
                <TickRow key={r.id} r={r} onBump={bump} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No bridge items"
              body="They come from Part 15 of final.md. Run npm run setup."
            />
          )}
          <p className="text-sm muted measure">
            Six weeks of finishing what the 21 weeks left open. The instruction not to start a fifth
            project is the one most likely to be ignored and the one that costs the most.
          </p>
        </Section>
      </section>

      <section className="stack" aria-label="The weekday shape when employed">
        <Section title="The weekday shape when employed">
          {weekday.length ? (
            <Table columns={WEEKDAY_COLUMNS} rows={weekday} rowKey={(r) => r.id} />
          ) : (
            <EmptyState
              title="No shape listed"
              body="It comes from Part 15 of final.md. Run npm run setup."
            />
          )}
          <p className="text-sm muted measure">
            This is branch A, the employed shape. Sunday is rest and it stays rest, exactly as it does
            inside the 21 weeks.
          </p>
        </Section>
      </section>

      <section className="stack-lg" aria-label="Year one, two and three">
        {years.length ? (
          years.map((y) => {
            const q = quarters.filter((row) => row.period === y.period);
            const dets = details.filter((row) => row.label === y.label);
            return (
              <Section
                key={y.id}
                title={`${y.label}, ${y.period}`}
                lede={y.age_label ? `You are ${y.age_label} through this one.` : ''}
              >
                <div className="row">
                  {y.age_label ? <Badge tone="outline">{y.age_label}</Badge> : null}
                  <Badge tone="outline">{y.period}</Badge>
                </div>
                <p className="measure">{`The goal: ${y.goal}`}</p>
                {q.length ? (
                  <div className="stack-sm">
                    <p className="card__label">By quarter</p>
                    {q.map((row) => (
                      <div className="stack-sm" key={row.id}>
                        <Badge tone="outline">{row.label}</Badge>
                        <TickRow r={row} onBump={bump} />
                      </div>
                    ))}
                  </div>
                ) : null}
                {dets.length ? (
                  <div className="stack-sm">
                    <p className="card__label">The detail</p>
                    {dets.map((row) => (
                      <TickRow key={row.id} r={row} onBump={bump} />
                    ))}
                  </div>
                ) : null}
                {q.length || dets.length ? null : (
                  <EmptyState
                    title="Nothing listed for this year"
                    body="The detail comes from Part 15 of final.md. Run npm run setup."
                  />
                )}
              </Section>
            );
          })
        ) : (
          <Section title="Year one, two and three">
            <EmptyState
              title="No years listed"
              body="They come from Part 15 of final.md. Run npm run setup."
            />
          </Section>
        )}
        <Callout tone="blue" title="Three years is the New Zealand threshold">
          <p className="measure">
            Year three exists because three years of verifiable experience is the New Zealand work
            visa skills threshold. The NZQA assessment and IELTS both take months, which is why they
            are listed a year before they are needed.
          </p>
          <Link className="btn btn--sm" href="/newzealand">
            Open the New Zealand plan
          </Link>
        </Callout>
      </section>
    </>
  );
}

export default AfterScreen;
