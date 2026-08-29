'use client';

/**
 * MoneyDeals | deals, and the recurring floor underneath them.
 *
 * Fifty per cent advance before you start. No advance, no work. The dates on a
 * deal are the only thing that counts towards the Rs 90,000, which is why they
 * are editable on the row rather than buried on another screen.
 */

import { useId, useState } from 'react';
import { EmptyState, Section, StatGrid } from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { Table, type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/client/api';
import { rupees, shortDate } from '@/lib/client/format';
import {
  DEAL_STATUS,
  DEAL_TONE,
  dealLabel,
  type CarePlan,
  type CarePlansPayload,
  type Deal,
  type DealsPayload,
  type LeadsPayload,
  type MoneySummary,
} from './types';

/* --------------------------------------------------------------- one deal */

function DealRow({ deal, onDone }: { deal: Deal; onDone: () => Promise<void> }) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState(
    deal.advance_amount === null ? '' : String(deal.advance_amount)
  );
  const [advanceOn, setAdvanceOn] = useState(deal.advance_on ?? '');
  const [deliveryDue, setDeliveryDue] = useState(deal.delivery_due ?? '');
  const [deliveredOn, setDeliveredOn] = useState(deal.delivered_on ?? '');
  const [balanceAmount, setBalanceAmount] = useState(
    deal.balance_amount === null ? '' : String(deal.balance_amount)
  );
  const [balanceOn, setBalanceOn] = useState(deal.balance_on ?? '');
  const [referral, setReferral] = useState(Number(deal.referral_asked) === 1);
  const [notes, setNotes] = useState(deal.notes ?? '');
  const [status, setStatus] = useState(deal.status);
  /** The badge is not moved until the response arrives. */
  const [saved, setSaved] = useState(deal.status);

  async function write(patch: Record<string, unknown>, revert?: () => void) {
    setBusy(true);
    try {
      await api.patch(`/api/deals/${deal.id}`, patch);
      toast(`Deal with ${deal.client_name} saved.`, 'ok');
      await onDone();
      return true;
    } catch (err) {
      if (revert) revert();
      toastError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const facts = [
    deal.lead_name ? `From the lead ${deal.lead_name}` : 'Not linked to a lead',
    deal.advance_on
      ? `advance ${rupees(deal.advance_amount ?? 0)} on ${shortDate(deal.advance_on)}`
      : 'no advance recorded',
    deal.balance_on
      ? `balance ${rupees(deal.balance_amount ?? 0)} on ${shortDate(deal.balance_on)}`
      : 'no balance recorded',
    deal.delivery_due
      ? `delivery due ${shortDate(deal.delivery_due)}${
          deal.days_to_delivery === null ? '' : `, ${deal.days_to_delivery} days away`
        }`
      : 'no delivery date',
  ].join('. ');

  return (
    <div className="linkrow">
      <div className="linkrow__main">
        <div className="linkrow__title">
          <strong>{deal.client_name}</strong>
          <span className="badge badge--outline">{`${deal.offer_code} ${deal.offer_name}`}</span>
          <span className={`badge ${DEAL_TONE[saved] ?? 'badge--outline'}`}>
            {dealLabel(saved)}
          </span>
          <span className="badge badge--outline">{rupees(deal.price)}</span>
          {deal.overdue ? <span className="badge badge--red">Delivery overdue</span> : null}
          {Number(deal.referral_asked) === 1 ? (
            <span className="badge badge--green">Referral asked</span>
          ) : null}
        </div>
        <p className="linkrow__why">{facts}</p>

        <details className="acc">
          <summary className="acc__summary">The dates that make it money</summary>
          <div className="acc__body stack-sm">
            <p className="text-xs muted measure">
              Only these dates count towards the Rs 90,000. An advance counts on its advance date and
              a balance on its balance date. Fifty per cent advance before you start: no advance, no
              work.
            </p>
            <div className="grid grid--3">
              <Field label="Advance amount" htmlFor={`${uid}-adv-amount`}>
                <input
                  id={`${uid}-adv-amount`}
                  className="input input--num input--sm"
                  type="number"
                  min={0}
                  step={100}
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                />
              </Field>
              <Field label="Advance received on" htmlFor={`${uid}-adv-on`}>
                <input
                  id={`${uid}-adv-on`}
                  className="input input--sm"
                  type="date"
                  value={advanceOn}
                  onChange={(e) => setAdvanceOn(e.target.value)}
                />
              </Field>
              <Field label="Delivery due" htmlFor={`${uid}-due`}>
                <input
                  id={`${uid}-due`}
                  className="input input--sm"
                  type="date"
                  value={deliveryDue}
                  onChange={(e) => setDeliveryDue(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid--3">
              <Field label="Delivered on" htmlFor={`${uid}-delivered`}>
                <input
                  id={`${uid}-delivered`}
                  className="input input--sm"
                  type="date"
                  value={deliveredOn}
                  onChange={(e) => setDeliveredOn(e.target.value)}
                />
              </Field>
              <Field label="Balance amount" htmlFor={`${uid}-bal-amount`}>
                <input
                  id={`${uid}-bal-amount`}
                  className="input input--num input--sm"
                  type="number"
                  min={0}
                  step={100}
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                />
              </Field>
              <Field label="Balance received on" htmlFor={`${uid}-bal-on`}>
                <input
                  id={`${uid}-bal-on`}
                  className="input input--sm"
                  type="date"
                  value={balanceOn}
                  onChange={(e) => setBalanceOn(e.target.value)}
                />
              </Field>
            </div>
            <label className="tick">
              <input
                type="checkbox"
                className="tick__box"
                checked={referral}
                onChange={(e) => setReferral(e.target.checked)}
              />
              <span className="tick__body">
                <span className="tick__text">Referral asked</span>
                <span className="tick__meta">
                  Asked at delivery, while they are pleased, not a week later.
                </span>
              </span>
            </label>
            <Field label="Notes" htmlFor={`${uid}-notes`}>
              <textarea
                id={`${uid}-notes`}
                className="textarea"
                rows={2}
                placeholder="What was agreed."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <div className="row">
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={busy}
                onClick={() =>
                  write({
                    advance_amount: advanceAmount === '' ? null : Number(advanceAmount),
                    advance_on: advanceOn || null,
                    delivery_due: deliveryDue || null,
                    delivered_on: deliveredOn || null,
                    balance_amount: balanceAmount === '' ? null : Number(balanceAmount),
                    balance_on: balanceOn || null,
                    referral_asked: referral,
                    notes,
                  })
                }
              >
                Save the dates
              </button>
            </div>
          </div>
        </details>
      </div>
      <div className="linkrow__actions">
        <select
          className="select select--sm"
          aria-label={`Status of the deal with ${deal.client_name}`}
          value={status}
          disabled={busy}
          onChange={async (e) => {
            const want = e.target.value;
            const previous = status;
            setStatus(want);
            const ok = await write({ status: want }, () => setStatus(previous));
            if (ok) setSaved(want);
          }}
        >
          {DEAL_STATUS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- a new deal */

/** A new deal. The server refuses a price under the offer floor and a locked offer. */
function AddDealForm({
  summary,
  leads,
  onDone,
}: {
  summary: MoneySummary;
  leads: LeadsPayload;
  onDone: () => Promise<void>;
}) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const offers = summary.offers ?? [];

  const [clientName, setClientName] = useState('');
  const [offerCode, setOfferCode] = useState(offers[0]?.code ?? '');
  const [price, setPrice] = useState('');
  const [leadId, setLeadId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceOn, setAdvanceOn] = useState('');
  const [deliveryDue, setDeliveryDue] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const chosen = offers.find((o) => o.code === offerCode);
  const floorHint = chosen
    ? `${chosen.code} runs ${rupees(chosen.price_low)} to ${rupees(
        chosen.price_high
      )}. Quote at the top of the band, settle in the middle, never under the floor.`
    : '';

  return (
    <details className="acc">
      <summary className="acc__summary">Record a deal</summary>
      <div className="acc__body stack-sm">
        <div className="grid grid--3">
          <Field label="Client" htmlFor={`${uid}-client`}>
            <input
              id={`${uid}-client`}
              className="input"
              type="text"
              maxLength={200}
              placeholder="The client name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
            />
          </Field>
          <Field label="Offer" htmlFor={`${uid}-offer`} hint={floorHint || undefined}>
            <select
              id={`${uid}-offer`}
              className="select select--sm"
              aria-label="The offer being sold"
              value={offerCode}
              onChange={(e) => setOfferCode(e.target.value)}
            >
              {offers.map((o) => (
                <option key={o.code} value={o.code}>
                  {`${o.code} ${o.name}, ${o.price_band_text}`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Price" htmlFor={`${uid}-price`}>
            <input
              id={`${uid}-price`}
              className="input input--num"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid--3">
          <Field label="From the lead" htmlFor={`${uid}-lead`}>
            <select
              id={`${uid}-lead`}
              className="select select--sm"
              aria-label="The lead this came from"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
            >
              <option value="">Not linked to a lead</option>
              {(leads.leads ?? []).map((l) => (
                <option key={l.id} value={String(l.id)}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Advance amount" htmlFor={`${uid}-adv`}>
            <input
              id={`${uid}-adv`}
              className="input input--num"
              type="number"
              min={0}
              step={100}
              placeholder="0"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
            />
          </Field>
          <Field label="Advance received on" htmlFor={`${uid}-adv-on`}>
            <input
              id={`${uid}-adv-on`}
              className="input"
              type="date"
              value={advanceOn}
              onChange={(e) => setAdvanceOn(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid--2">
          <Field label="Delivery due" htmlFor={`${uid}-due`}>
            <input
              id={`${uid}-due`}
              className="input"
              type="date"
              value={deliveryDue}
              onChange={(e) => setDeliveryDue(e.target.value)}
            />
          </Field>
          <Field label="Notes" htmlFor={`${uid}-notes`}>
            <textarea
              id={`${uid}-notes`}
              className="textarea"
              rows={2}
              placeholder="The scope, in one line."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
        </div>

        <div className="row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy}
            onClick={async () => {
              if (!clientName.trim()) {
                toastError('A deal needs a client name.');
                return;
              }
              setBusy(true);
              try {
                await api.post('/api/deals', {
                  client_name: clientName.trim(),
                  offer_code: offerCode,
                  price: Number(price) || 0,
                  lead_id: leadId ? Number(leadId) : null,
                  advance_amount: advanceAmount === '' ? null : Number(advanceAmount),
                  advance_on: advanceOn || null,
                  delivery_due: deliveryDue || null,
                  notes: notes.trim() || null,
                });
                toast(`Deal with ${clientName.trim()} recorded.`, 'ok');
                setClientName('');
                setPrice('');
                setAdvanceAmount('');
                setAdvanceOn('');
                setDeliveryDue('');
                setNotes('');
                await onDone();
              } catch (err) {
                toastError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Record the deal
          </button>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------- care plans */

function carePlanColumns(): Column<CarePlan>[] {
  return [
    { key: 'client_name', label: 'Client' },
    {
      key: 'monthly_amount',
      label: 'A month',
      num: true,
      render: (r) => rupees(r.monthly_amount),
    },
    { key: 'started_on', label: 'Started', render: (r) => shortDate(r.started_on) },
    {
      key: 'last_invoice_on',
      label: 'Last invoiced',
      render: (r) =>
        r.last_invoice_on ? shortDate(r.last_invoice_on) : 'Never, so it counts nothing yet',
    },
    {
      key: 'active',
      label: 'State',
      render: (r) =>
        Number(r.active) === 1 ? (
          <span className="badge badge--green">Active</span>
        ) : (
          <span className="badge badge--outline">Stopped</span>
        ),
    },
  ];
}

function CarePlanTable({ care }: { care: CarePlansPayload }) {
  const plans = care.care_plans ?? [];
  if (!plans.length) {
    return (
      <EmptyState
        title="No care plans yet"
        body={`O8 is the only recurring offer and the target is ${care.target} plans. They are the floor that stops January depending on one big job. The floor is Rs 1,200 a month and the server refuses anything under it.`}
      />
    );
  }
  return (
    <Table
      columns={carePlanColumns()}
      rows={plans}
      rowKey={(r) => r.id}
      caption={`${care.floor.count} active plans, ${rupees(care.floor.monthly)} a month`}
    />
  );
}

/* -------------------------------------------------------------------- main */

export function MoneyDeals({
  summary,
  leads,
  deals,
  care,
  onDone,
}: {
  summary: MoneySummary;
  leads: LeadsPayload;
  deals: DealsPayload;
  care: CarePlansPayload;
  onDone: () => Promise<void>;
}) {
  const rows = deals.deals ?? [];
  const stats = deals.stats;
  const overdue = rows.filter((d) => d.overdue).length;

  return (
    <>
      <Section title="Deals" lede="Fifty per cent advance before you start. No advance, no work.">
        <StatGrid
          stats={[
            { value: stats.quoted, label: 'deals quoted' },
            {
              value: stats.won,
              label: 'deals taken past the advance',
              tone: stats.won ? 'green' : undefined,
            },
            { value: `${stats.win_rate}%`, label: 'win rate' },
            {
              value: overdue,
              label: 'deliveries past their due date',
              tone: overdue ? 'red' : undefined,
            },
          ]}
        />
        <AddDealForm summary={summary} leads={leads} onDone={onDone} />
        {rows.length ? (
          <div className="card card--flush">
            {rows.map((d) => (
              <DealRow key={d.id} deal={d} onDone={onDone} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No deals yet"
            body="A deal is recorded when a price has been quoted, not when the money arrives. Record it here and the advance and balance dates are what count towards the target."
          />
        )}
      </Section>

      <Section
        title="Care plans, O8"
        lede="The recurring floor. Five plans is the target, and a plan only counts money from the month it was last invoiced."
      >
        <CarePlanTable care={care} />
      </Section>
    </>
  );
}

export default MoneyDeals;
