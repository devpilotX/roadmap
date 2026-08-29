'use client';

/**
 * GatesScreen | the four gates and the four money gates.
 *
 * A gate is not a checkpoint you hope to reach. It is answered yes or no, and a
 * yes needs an evidence URL, because a screenshot is not evidence.
 *
 * A money gate that has passed unmet shows what final.md says happens next. That
 * text is not softened and it is not hidden.
 */

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  ExternalLink,
  Section,
  StatGrid,
  LoadingSections,
} from '@/components/ui/Basics';
import { Field, Tick } from '@/components/ui/Controls';
import { useResource } from '@/components/ui/useResource';
import { api, type ApiError } from '@/lib/client/api';
import { rupees, shortDate } from '@/lib/client/format';

interface Gate {
  no: number;
  week_n: number;
  gate_date: string;
  condition_text: string;
  week_title: string | null;
  days_remaining: number;
  is_past: boolean;
  passed: boolean;
  passed_at: string | null;
  evidence_url: string | null;
  notes: string;
}

interface MoneyGate {
  code: string;
  ord: number;
  gate_date: string;
  condition_text: string;
  if_it_fails: string;
  days_remaining: number;
  is_past: boolean;
  passed: boolean;
  passed_at: string | null;
  amount_received: number | null;
  notes: string;
  show_if_it_fails: boolean;
}

interface Payload {
  today: string;
  gates: Gate[];
  money_gates: MoneyGate[];
}

interface Countable {
  passed: boolean;
  is_past: boolean;
  days_remaining: number;
  passed_at?: string | null;
}

function toneFor(g: Countable): string {
  if (g.passed) return 'gatecard--passed';
  if (g.is_past) return 'gatecard--overdue';
  if (g.days_remaining <= 14) return 'gatecard--soon';
  return '';
}

function countdown(g: Countable): { big: string; small: string } {
  if (g.passed) {
    return {
      big: 'Passed',
      small: g.passed_at ? `on ${shortDate(String(g.passed_at).slice(0, 10))}` : '',
    };
  }
  if (g.days_remaining === 0) return { big: 'Today', small: 'answer it today' };
  if (g.days_remaining < 0) {
    return { big: `${Math.abs(g.days_remaining)}d`, small: 'overdue, and not passed' };
  }
  return { big: `${g.days_remaining}d`, small: 'to go' };
}

/* ----------------------------------------------------------- the four gates */

function GateCard({ g, onSaved }: { g: Gate; onSaved: () => Promise<void> }) {
  const { toast, toastError } = useToast();
  const [passed, setPassed] = useState(g.passed);
  const [evidence, setEvidence] = useState(g.evidence_url ?? '');
  const [notes, setNotes] = useState(g.notes ?? '');
  const [busy, setBusy] = useState(false);

  const c = countdown({ ...g, passed });

  async function write(patch: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await api.patch(`/api/gates/${g.no}/result`, patch);
      toast(`Gate ${g.no} saved.`);
      return true;
    } catch (err) {
      toastError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function tick(want: boolean) {
    if (want && !evidence.trim()) {
      toastError('A gate is passed only with an evidence URL. Put the address in first.');
      return;
    }
    const ok = await write({
      passed: want,
      evidence_url: evidence.trim() || null,
      notes,
    });
    if (ok) {
      setPassed(want);
      await onSaved();
    }
  }

  async function save() {
    if (await write({ passed, evidence_url: evidence.trim() || null, notes })) {
      await onSaved();
    }
  }

  return (
    <div className={`gatecard ${toneFor({ ...g, passed })}`}>
      <div className="between">
        <div className="row">
          <span className="gatecard__no">Gate {g.no}</span>
          <Badge tone="outline">{shortDate(g.gate_date)}</Badge>
          <Badge tone="outline">Week {g.week_n}</Badge>
        </div>
        <div className="right">
          <div className="gatecard__days">{c.big}</div>
          <div className="text-xs muted">{c.small}</div>
        </div>
      </div>

      {g.week_title ? <p className="text-sm muted">{g.week_title}</p> : null}
      <p className="measure">{g.condition_text}</p>

      <Tick
        checked={passed}
        disabled={busy}
        onChange={(want) => void tick(want)}
        label="Passed"
        meta="A yes needs the evidence URL below. A screenshot is not evidence."
      />

      <div className="grid grid--2">
        <Field label="Evidence URL" htmlFor={`g-ev-${g.no}`}>
          <input
            id={`g-ev-${g.no}`}
            className="input"
            type="url"
            value={evidence}
            placeholder="https://the-thing-that-proves-it"
            onChange={(e) => setEvidence(e.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor={`g-notes-${g.no}`}>
          <textarea
            id={`g-notes-${g.no}`}
            className="textarea"
            rows={2}
            placeholder="What actually happened."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="row">
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void save()}>
          Save notes and evidence
        </button>
        {g.evidence_url ? (
          <ExternalLink href={g.evidence_url} className="btn btn--sm btn--ghost">
            Open the evidence
          </ExternalLink>
        ) : null}
      </div>

      {!passed && g.is_past ? (
        <Callout tone="red" title="This gate has passed and it is not marked passed">
          <p>
            Answer it honestly. A gate left blank is a gate not passed, and the next one is already
            closer.
          </p>
        </Callout>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------- the four money gates */

function MoneyGateCard({ g, onSaved }: { g: MoneyGate; onSaved: () => Promise<void> }) {
  const { toast, toastError } = useToast();
  const [passed, setPassed] = useState(g.passed);
  const [amount, setAmount] = useState(g.amount_received === null ? '' : String(g.amount_received));
  const [notes, setNotes] = useState(g.notes ?? '');
  const [busy, setBusy] = useState(false);

  const c = countdown({ ...g, passed });

  async function write(patch: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await api.patch(`/api/money-gates/${g.code}/result`, patch);
      toast(`Money gate ${g.code} saved.`);
      return true;
    } catch (err) {
      toastError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const payload = (want: boolean) => ({
    passed: want,
    amount_received: amount === '' ? null : Number(amount),
    notes,
  });

  async function tick(want: boolean) {
    if (await write(payload(want))) {
      setPassed(want);
      await onSaved();
    }
  }

  async function save() {
    if (await write(payload(passed))) await onSaved();
  }

  return (
    <div className={`gatecard ${toneFor({ ...g, passed })}`}>
      <div className="between">
        <div className="row">
          <span className="gatecard__no">{g.code}</span>
          <Badge tone="outline">{shortDate(g.gate_date)}</Badge>
        </div>
        <div className="right">
          <div className="gatecard__days">{c.big}</div>
          <div className="text-xs muted">{c.small}</div>
        </div>
      </div>

      <p className="measure">{g.condition_text}</p>

      <Tick
        checked={passed}
        disabled={busy}
        onChange={(want) => void tick(want)}
        label="Met"
        meta="Money received, not money promised."
      />

      <div className="grid grid--2">
        <Field
          label="Received so far"
          htmlFor={`mg-amount-${g.code}`}
          hint={g.amount_received ? rupees(g.amount_received) : 'Rupees actually in the account.'}
        >
          <input
            id={`mg-amount-${g.code}`}
            className="input input--num"
            type="number"
            min={0}
            step={100}
            value={amount}
            placeholder="0"
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor={`mg-notes-${g.code}`}>
          <textarea
            id={`mg-notes-${g.code}`}
            className="textarea"
            rows={2}
            placeholder="What came in, and from whom."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="row">
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void save()}>
          Save
        </button>
      </div>

      {g.show_if_it_fails ? (
        <Callout tone="red" title="This gate was missed. Here is what final.md says happens now.">
          <p className="measure">{g.if_it_fails}</p>
        </Callout>
      ) : (
        <details className="acc">
          <summary className="acc__summary">If it fails</summary>
          <div className="acc__body">
            <p className="measure">{g.if_it_fails}</p>
          </div>
        </details>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- main */

export function GatesScreen() {
  const { data, error, loading, refresh } = useResource<Payload>('/api/gates');

  if (error) return <ErrorCard message={error} />;
  if (loading || !data) {
    return (
      <LoadingSections
        sections={[
          { label: 'The four gates', text: 'Loading the four gates.' },
          { label: 'The four money gates', text: 'Loading the four money gates.' },
        ]}
      />
    );
  }

  const gates = data.gates ?? [];
  const money = data.money_gates ?? [];

  const passed = gates.filter((g) => g.passed).length;
  const missed = gates.filter((g) => g.is_past && !g.passed).length;
  const next = gates.find((g) => !g.is_past && !g.passed) ?? null;
  const moneyPassed = money.filter((g) => g.passed).length;

  return (
    <>
      <section className="stack" aria-label="The four gates">
        <StatGrid
          stats={[
            {
              value: `${passed} of ${gates.length}`,
              label: 'gates passed, with evidence',
              tone: passed === gates.length && gates.length ? 'green' : undefined,
              hero: true,
            },
            { value: `${moneyPassed} of ${money.length}`, label: 'money gates met' },
            {
              value: next ? `Gate ${next.no}` : missed ? 'Overdue' : 'All done',
              label: next
                ? `in ${next.days_remaining} days, on ${shortDate(next.gate_date)}`
                : missed
                  ? 'a gate went past unanswered'
                  : 'nothing outstanding',
              tone: next && next.days_remaining <= 14 ? 'orange' : missed ? 'red' : undefined,
            },
            {
              value: missed,
              label: 'gates that went past unpassed',
              tone: missed ? 'red' : undefined,
            },
          ]}
        />
        <p className="text-sm muted measure">
          A gate is not a checkpoint you hope to reach. It is a yes or a no on a fixed date, and a
          yes needs a URL that someone else can open.
        </p>
        {gates.length ? (
          gates.map((g) => <GateCard key={g.no} g={g} onSaved={refresh} />)
        ) : (
          <EmptyState
            title="No gates"
            body="The four gates come from final.md. Run npm run setup."
          />
        )}
      </section>

      <section className="stack" aria-label="The four money gates">
        <Section title="The four money gates" id="g-money-section">
          <p className="text-sm muted measure">
            Part 17.12. These are counted from money received, never from money promised. A gate
            that was missed shows the consequence final.md states, unedited.
          </p>
          {money.length ? (
            money.map((g) => <MoneyGateCard key={g.code} g={g} onSaved={refresh} />)
          ) : (
            <EmptyState title="No money gates" body="They come from Part 17.12 of final.md." />
          )}
        </Section>
      </section>
    </>
  );
}

export default GatesScreen;
