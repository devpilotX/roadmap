'use client';

/**
 * MoneyGates | Part 17.12, M1 to M4.
 *
 * Counted from money received, never from money promised. A gate that has gone
 * past unmet shows what final.md says happens next, open, rather than folded away.
 */

import { useId, useState } from 'react';
import { Callout, EmptyState, Section } from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/client/api';
import { rupees, shortDate } from '@/lib/client/format';
import type { MoneyGateRow, MoneySummary } from './types';

function MoneyGateCard({ g }: { g: MoneyGateRow }) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const [passed, setPassed] = useState(g.passed);
  /** The badge follows the server, not the tick, so nothing looks met before it is. */
  const [saved, setSaved] = useState(g.passed);
  const [amount, setAmount] = useState(
    g.amount_received === null || g.amount_received === undefined ? '' : String(g.amount_received)
  );
  const [notes, setNotes] = useState(g.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function write(nextPassed: boolean, revert?: () => void) {
    setBusy(true);
    try {
      await api.patch(`/api/money-gates/${g.code}/result`, {
        passed: nextPassed,
        amount_received: amount === '' ? null : Number(amount),
        notes,
      });
      toast(`Money gate ${g.code} saved.`, 'ok');
      return true;
    } catch (err) {
      if (revert) revert();
      toastError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack-sm">
      <div className="between">
        <div className="row">
          <strong>{g.code}</strong>
          <span className="badge badge--outline">{shortDate(g.gate_date)}</span>
          {saved ? (
            <span className="badge badge--green">Met</span>
          ) : g.is_past ? (
            <span className="badge badge--red">Missed</span>
          ) : (
            <span className="badge badge--outline">Not yet</span>
          )}
        </div>
        {g.amount_received !== null && g.amount_received !== undefined ? (
          <span className="text-sm muted">{rupees(g.amount_received)}</span>
        ) : null}
      </div>

      <p className="measure">{g.condition_text}</p>

      <label className="tick">
        <input
          type="checkbox"
          className="tick__box"
          checked={passed}
          disabled={busy}
          onChange={async (e) => {
            const want = e.target.checked;
            setPassed(want);
            const ok = await write(want, () => setPassed(!want));
            if (ok) setSaved(want);
          }}
        />
        <span className="tick__body">
          <span className="tick__text">Met</span>
          <span className="tick__meta">Money received, not money promised.</span>
        </span>
      </label>

      <div className="grid grid--2">
        <Field label="Received so far" htmlFor={`${uid}-amount`}>
          <input
            id={`${uid}-amount`}
            className="input input--num"
            type="number"
            min={0}
            step={100}
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Notes" htmlFor={`${uid}-notes`}>
          <textarea
            id={`${uid}-notes`}
            className="textarea"
            rows={2}
            placeholder="What came in, and from whom."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      <div className="row">
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy}
          onClick={async () => {
            const ok = await write(passed);
            if (ok) setSaved(passed);
          }}
        >
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

export function MoneyGates({ summary }: { summary: MoneySummary }) {
  const gates = summary.money_gates ?? [];

  return (
    <Section
      title="The four money gates"
      lede="Part 17.12. Counted from money received, never from money promised."
    >
      {gates.length ? (
        gates.map((g) => <MoneyGateCard key={g.code} g={g} />)
      ) : (
        <EmptyState
          title="No money gates"
          body="The four money gates come from Part 17.12 of final.md. Run npm run setup."
        />
      )}
    </Section>
  );
}

export default MoneyGates;
