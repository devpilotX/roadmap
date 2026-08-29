'use client';

/**
 * MoneyToday | the money hour, 17:00 to 18:00, and the fifteen due touches.
 *
 * The hour has to be finishable inside the hour, which is why the fifteen due
 * touches are the first list on the page. One tap logs a WhatsApp touch. The
 * folded form is there for the times the channel, the script or the reply matter.
 */

import { useId, useState } from 'react';
import {
  EmptyState,
  ExternalLink,
  Section,
  StatGrid,
} from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/client/api';
import { int, shortDate } from '@/lib/client/format';
import { CHANNELS, laneLabel, type Lead, type LeadsPayload, type MoneySummary } from './types';

function DueBadge({ lead, today }: { lead: Lead; today: string }) {
  if (!lead.next_touch_on) return <span className="badge badge--blue">Never touched</span>;
  if (lead.next_touch_on < today) {
    return (
      <span className="badge badge--red">{`Overdue since ${shortDate(lead.next_touch_on)}`}</span>
    );
  }
  if (lead.next_touch_on === today) return <span className="badge badge--orange">Due today</span>;
  return <span className="badge badge--outline">{`Due ${shortDate(lead.next_touch_on)}`}</span>;
}

/** One lead, with the full touch form folded away behind the quick button. */
function TouchRow({
  lead,
  index,
  today,
  scripts,
  onLogged,
}: {
  lead: Lead;
  index: number;
  today: string;
  scripts: { code: string; title: string }[];
  onLogged: () => Promise<void>;
}) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const [channel, setChannel] = useState('whatsapp');
  const [scriptCode, setScriptCode] = useState('');
  const [reply, setReply] = useState(false);
  const [nextIn, setNextIn] = useState('2');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function write(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.post(`/api/leads/${lead.id}/touch`, body);
      toast(`Touch logged for ${lead.name}.`, 'ok');
      await onLogged();
    } catch (err) {
      toastError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const facts = [
    lead.category,
    lead.area,
    lead.rating ? `${lead.rating} stars` : null,
    lead.reviews ? `${lead.reviews} reviews` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="touchrow">
      <span className="badge badge--outline">{String(index + 1)}</span>
      <div className="stack-sm">
        <div className="row">
          <strong>{lead.name}</strong>
          <DueBadge lead={lead} today={today} />
          <span className="badge badge--outline">{laneLabel(lead.status)}</span>
          {lead.mobile_broken ? (
            <span className="badge badge--orange">Broken on mobile</span>
          ) : null}
        </div>
        {facts ? <p className="text-xs muted">{facts}</p> : null}
        <div className="row">
          {lead.phone ? (
            <a className="btn btn--sm btn--ghost" href={`tel:${lead.phone}`}>
              Call
            </a>
          ) : null}
          {lead.phone ? (
            <ExternalLink
              className="btn btn--sm btn--ghost"
              href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`}
            >
              WhatsApp
            </ExternalLink>
          ) : null}
          {lead.website ? (
            <ExternalLink className="btn btn--sm btn--ghost" href={lead.website}>
              Open their site
            </ExternalLink>
          ) : null}
        </div>
        <details className="acc">
          <summary className="acc__summary">
            Log it with the channel, the script and the reply
          </summary>
          <div className="acc__body stack-sm">
            <div className="grid grid--3">
              <Field label="Channel" htmlFor={`${uid}-channel`}>
                <select
                  id={`${uid}-channel`}
                  className="select select--sm"
                  aria-label={`Channel for ${lead.name}`}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Script" htmlFor={`${uid}-script`}>
                <select
                  id={`${uid}-script`}
                  className="select select--sm"
                  aria-label={`Script used for ${lead.name}`}
                  value={scriptCode}
                  onChange={(e) => setScriptCode(e.target.value)}
                >
                  <option value="">No script</option>
                  {scripts.map((s) => (
                    <option key={s.code} value={s.code}>
                      {`${s.code} ${s.title}`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Next touch in days"
                htmlFor={`${uid}-next`}
                hint="Follow up one is 48 hours later, so two is the default."
              >
                <input
                  id={`${uid}-next`}
                  className="input input--num input--sm"
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  value={nextIn}
                  onChange={(e) => setNextIn(e.target.value)}
                />
              </Field>
            </div>
            <label className="tick">
              <input
                type="checkbox"
                className="tick__box"
                checked={reply}
                onChange={(e) => setReply(e.target.checked)}
              />
              <span className="tick__body">
                <span className="tick__text">They replied</span>
                <span className="tick__meta">
                  A reply moves the lead to replied. Silence is not a reply.
                </span>
              </span>
            </label>
            <Field label="Notes" htmlFor={`${uid}-notes`}>
              <textarea
                id={`${uid}-notes`}
                className="textarea"
                rows={2}
                placeholder="What you said, and what came back."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div className="row">
              <button
                type="button"
                className="btn btn--sm"
                disabled={busy}
                onClick={() =>
                  write({
                    channel,
                    script_code: scriptCode || null,
                    reply,
                    next_touch_in_days: Number(nextIn) || 0,
                    notes,
                  })
                }
              >
                Log this touch
              </button>
            </div>
          </div>
        </details>
      </div>
      <div className="right">
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={busy}
          onClick={() => write({ channel: 'whatsapp' })}
        >
          Log a WhatsApp touch
        </button>
      </div>
    </div>
  );
}

export function MoneyToday({
  summary,
  leads,
  onLogged,
}: {
  summary: MoneySummary;
  leads: LeadsPayload;
  onLogged: () => Promise<void>;
}) {
  const target = summary.touch_target_today;
  const task = summary.money_task_today;
  const fifteen = leads.next_15 ?? [];
  const touchedToday = (leads.leads ?? []).filter((l) => l.last_touch_on === leads.today).length;

  return (
    <Section
      title="The money hour, 17:00 to 18:00"
      lede="Six days a week, on top of the eight hours of study. It never borrows from them."
    >
      <p className="measure">{task ?? 'There is no money task on the calendar for today.'}</p>

      <StatGrid
        stats={[
          {
            value: target ? `${touchedToday} of ${target}` : String(touchedToday),
            label: target
              ? 'leads touched today, against the target Appendix C states'
              : 'leads touched today',
            tone: target && touchedToday >= target ? 'green' : target ? 'red' : undefined,
            hero: true,
          },
          { value: int(summary.touches.touches), label: 'touches logged in total' },
          {
            value: `${summary.touches.reply_rate}%`,
            label: 'reply rate',
            sub: `${int(summary.touches.replies)} replies`,
          },
          {
            value: summary.touches.last_touch ? shortDate(summary.touches.last_touch) : 'Never',
            label: 'the last touch you logged',
          },
        ]}
      />

      <p className="text-xs muted measure">
        Touched today is counted from the last touch date on each lead, so it is the number of leads
        reached today rather than the number of messages sent.
      </p>

      {fifteen.length ? (
        <div className="card card--flush">
          {fifteen.map((lead, i) => (
            <TouchRow
              key={lead.id}
              lead={lead}
              index={i}
              today={leads.today}
              scripts={summary.scripts ?? []}
              onLogged={onLogged}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No leads are waiting"
          body="The fifteen due touches are drawn from leads that are not won, lost or dead, soonest follow up first. Add a lead below, or import the sixty from a CSV, and this list fills itself."
        />
      )}
    </Section>
  );
}

export default MoneyToday;
