'use client';

/**
 * SundaysScreen | the 21 Sundays.
 *
 * Ten working, four gate audits, seven rest. The rest Sundays are the ones that
 * get sacrificed first and they are the reason the other 143 days work, so this
 * screen will not let you tick one. The API refuses it too; the refusal is stated
 * here rather than discovered.
 */

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  StatGrid,
  LoadingSections,
} from '@/components/ui/Basics';
import { Field, Tick } from '@/components/ui/Controls';
import { useResource } from '@/components/ui/useResource';
import { api, type ApiError } from '@/lib/client/api';
import { shortDate } from '@/lib/client/format';

type Kind = 'working' | 'gate' | 'rest';

const KIND: Record<Kind, { label: string; tone: 'blue' | 'orange' | 'outline'; row: string }> = {
  working: { label: 'Working', tone: 'blue', row: '' },
  gate: { label: 'Gate audit', tone: 'orange', row: 'sundayrow--gate' },
  rest: { label: 'Rest', tone: 'outline', row: 'sundayrow--rest' },
};

interface SundayRow {
  week_n: number;
  sunday_date: string;
  kind: Kind;
  hours: number;
  type_text: string;
  topic: string;
  week_title: string | null;
  completed: boolean;
  hours_logged: number;
  notes: string;
  is_today: boolean;
  is_past: boolean;
}

interface Payload {
  today: string;
  sundays: SundayRow[];
  totals: { working: number; gate: number; rest: number };
}

/* --------------------------------------------------------------- one Sunday */

function Row({ s, onSaved }: { s: SundayRow; onSaved: () => Promise<void> }) {
  const { toast, toastError } = useToast();
  const kind = KIND[s.kind] ?? KIND.working;
  const isRest = s.kind === 'rest';

  const [completed, setCompleted] = useState(s.completed);
  const [hours, setHours] = useState(s.hours_logged ? String(s.hours_logged) : '');
  const [notes, setNotes] = useState(s.notes ?? '');
  const [busy, setBusy] = useState(false);

  async function write(patch: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await api.patch(`/api/sundays/${s.week_n}/log`, patch);
      toast(`Sunday of week ${s.week_n} saved.`);
      return true;
    } catch (err) {
      toastError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function tick(want: boolean) {
    const ok = await write({ completed: want, hours: Number(hours) || 0, notes });
    if (ok) {
      setCompleted(want);
      await onSaved();
    }
  }

  async function save() {
    const ok = await write(
      isRest ? { notes } : { completed, hours: Number(hours) || 0, notes }
    );
    if (ok) await onSaved();
  }

  const state = completed ? (
    <Badge tone="green">Done</Badge>
  ) : isRest ? (
    <Badge tone="outline">Rest</Badge>
  ) : s.is_past ? (
    <Badge tone="red">Missed</Badge>
  ) : (
    <Badge tone="outline">Not yet</Badge>
  );

  return (
    <div className={`sundayrow ${kind.row} ${s.is_today ? 'card--now' : ''}`}>
      <span className="sundayrow__week">W{String(s.week_n).padStart(2, '0')}</span>
      <Badge tone={kind.tone}>{kind.label}</Badge>

      <div className="stack-sm grow">
        <div className="row">
          <span className="text-sm">{shortDate(s.sunday_date)}</span>
          {s.is_today ? <Badge tone="blue">Today</Badge> : null}
          <span className="text-xs muted">{s.type_text}</span>
        </div>
        <p className="measure text-sm">{s.topic}</p>
        {s.week_title ? (
          <p className="text-xs muted">
            Week {s.week_n}: {s.week_title}
          </p>
        ) : null}

        <details className="acc">
          <summary className="acc__summary">{isRest ? 'The note field' : 'Log this Sunday'}</summary>
          <div className="acc__body stack-sm">
            <Tick
              checked={completed}
              disabled={isRest || busy}
              onChange={(want) => void tick(want)}
              label={isRest ? 'Nothing to tick' : 'Done'}
              meta={
                isRest
                  ? 'Rest Sunday. No code. No screens before noon. This is load bearing.'
                  : `${s.hours} hours is what this Sunday asks for.`
              }
            />

            {isRest ? null : (
              <Field label={`Hours, against ${s.hours}`} htmlFor={`s-hours-${s.week_n}`}>
                <input
                  id={`s-hours-${s.week_n}`}
                  className="input input--num input--sm"
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={hours}
                  placeholder="0"
                  onChange={(e) => setHours(e.target.value)}
                />
              </Field>
            )}

            <Field label="Notes" htmlFor={`s-notes-${s.week_n}`}>
              <textarea
                id={`s-notes-${s.week_n}`}
                className="textarea"
                rows={2}
                placeholder={
                  isRest
                    ? 'A note, if you want one. Nothing else on a rest Sunday.'
                    : 'What you actually did.'
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            <div className="row">
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy}
                onClick={() => void save()}
              >
                Save
              </button>
            </div>
          </div>
        </details>
      </div>

      <div className="right stack-sm">
        {state}
        {isRest ? null : (
          <span className="text-xs muted">
            {s.hours_logged || 0} of {s.hours} h
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- main */

export function SundaysScreen() {
  const { data, error, loading, refresh } = useResource<Payload>('/api/sundays');

  if (error) return <ErrorCard message={error} />;
  if (loading || !data) {
    return (
      <LoadingSections
        sections={[
          { label: 'Sunday summary', text: 'Loading sunday summary.' },
          { label: 'The 21 Sundays', text: 'Loading the 21 sundays.' },
        ]}
      />
    );
  }

  const sundays = data.sundays ?? [];
  const t = data.totals ?? { working: 0, gate: 0, rest: 0 };

  const workable = sundays.filter((s) => s.kind !== 'rest');
  const done = workable.filter((s) => s.completed).length;
  const missed = workable.filter((s) => s.is_past && !s.completed).length;
  const hours = sundays.reduce((a, s) => a + Number(s.hours_logged || 0), 0);
  const next = sundays.find((s) => !s.is_past);

  return (
    <>
      <section className="stack" aria-label="Sunday summary">
        <StatGrid
          stats={[
            {
              value: `${done} of ${workable.length}`,
              label: 'working and gate Sundays done',
              tone: done === workable.length && workable.length ? 'green' : undefined,
              hero: true,
            },
            {
              value: `${t.working} · ${t.gate} · ${t.rest}`,
              label: 'working, gate audits, rest',
            },
            { value: `${hours} h`, label: 'hours logged on Sundays' },
            {
              value: next ? `W${next.week_n}` : 'Done',
              label: next
                ? `${KIND[next.kind]?.label ?? next.kind} on ${shortDate(next.sunday_date)}`
                : 'every Sunday is behind you',
              tone: missed ? 'red' : undefined,
              sub: missed ? `${missed} missed` : '',
            },
          ]}
        />
        <Callout tone="blue" title="The seven rest Sundays are not spare capacity">
          <p className="measure">
            No code. No screens before noon. This is load bearing. They cannot be ticked here, and
            the server refuses them too, because the week after a sacrificed rest Sunday is the week
            the reds start.
          </p>
        </Callout>
      </section>

      <section className="stack" aria-label="The 21 Sundays">
        {sundays.length ? (
          <div className="card card--flush">
            {sundays.map((s) => (
              <Row key={s.week_n} s={s} onSaved={refresh} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Sundays"
            body="The 21 Sundays come from Part 3 of final.md. Run npm run setup."
          />
        )}
      </section>
    </>
  );
}

export default SundaysScreen;
