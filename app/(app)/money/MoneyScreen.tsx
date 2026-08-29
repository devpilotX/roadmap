'use client';

/**
 * MoneyScreen | the money hour, Part 17.
 *
 * The target is Rs 90,000 received by 24 January 2027. Received means a dated
 * cash event: an advance on its advance date, a balance on its balance date, a
 * care plan on the month it was invoiced. A deal that somebody ticked as paid
 * with no dates on it is not money, and it is not counted in any total here. The
 * server does that arithmetic, so this screen only ever displays what the API
 * already worked out.
 *
 * The money hour is 17:00 to 18:00, six days a week, on top of the eight hours of
 * study. It never borrows from them. That is why the fifteen due touches are the
 * first list on the page: the hour has to be finishable inside the hour.
 *
 * Sources: GET /api/money/summary, /api/leads, /api/deals, /api/care-plans and
 * /api/money/scripts. Writes: POST /api/leads, POST /api/leads/import,
 * PATCH /api/leads/:id, POST /api/leads/:id/touch, POST /api/deals,
 * PATCH /api/deals/:id and PATCH /api/money-gates/:code/result.
 */

import { useCallback, useMemo, useState } from 'react';
import { useDebounced, useResource } from '@/components/ui/useResource';
import { ErrorCard, LoadingCard } from '@/components/ui/Basics';
import { useToast } from '@/components/ToastProvider';
import { MoneyStrip } from './MoneyStrip';
import { MoneyToday } from './MoneyToday';
import { MoneyPipeline, moveLead } from './MoneyPipeline';
import { MoneyDeals } from './MoneyDeals';
import { MoneyOffers } from './MoneyOffers';
import { MoneyPlan } from './MoneyPlan';
import { MoneyGates } from './MoneyGates';
import { MoneyCharts } from './MoneyCharts';
import { MoneyScripts } from './MoneyScripts';
import { MoneyRules } from './MoneyRules';
import type {
  CarePlansPayload,
  DealsPayload,
  Lead,
  LeadsPayload,
  MoneySummary,
  ScriptsPayload,
} from './types';

export function MoneyScreen() {
  const { toast, toastError } = useToast();

  /** Board filters, sent to /api/leads as query parameters. */
  const [filters, setFilters] = useState({ status: '', due: '' });
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const applyQuery = useDebounced((value: string) => setAppliedQuery(value), 250);
  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      applyQuery(value);
    },
    [applyQuery]
  );

  const leadsPath = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.due) params.set('due', filters.due);
    if (appliedQuery) params.set('q', appliedQuery);
    const q = params.toString();
    return q ? `/api/leads?${q}` : '/api/leads';
  }, [filters, appliedQuery]);

  const summary = useResource<MoneySummary>('/api/money/summary');
  const leads = useResource<LeadsPayload>(leadsPath);
  const deals = useResource<DealsPayload>('/api/deals');
  const care = useResource<CarePlansPayload>('/api/care-plans');
  const scripts = useResource<ScriptsPayload>('/api/money/scripts');

  const reloadLeads = leads.refresh;
  const reloadSummary = summary.refresh;

  const afterLeadWrite = useCallback(async () => {
    await reloadLeads();
    await reloadSummary();
  }, [reloadLeads, reloadSummary]);

  const dealsRefresh = deals.refresh;
  const careRefresh = care.refresh;

  const afterDealWrite = useCallback(async () => {
    await dealsRefresh();
    await careRefresh();
    await reloadSummary();
  }, [dealsRefresh, careRefresh, reloadSummary]);

  const setLeads = leads.setData;
  const onMove = useCallback(
    async (lead: Lead, status: string) => {
      await moveLead({ lead, status, setLeads, toast, toastError });
    },
    [setLeads, toast, toastError]
  );

  const error =
    summary.error ?? leads.error ?? deals.error ?? care.error ?? scripts.error ?? null;

  if (error) {
    return (
      <section className="stack" aria-label="Money at a glance">
        <ErrorCard message={error} />
      </section>
    );
  }

  const s = summary.data;
  const l = leads.data;
  const d = deals.data;
  const c = care.data;
  const sc = scripts.data;

  if (!s || !l || !d || !c || !sc) {
    return (
      <>
        <section className="stack" aria-label="Money at a glance">
          <LoadingCard text="Loading money at a glance." />
        </section>
        <section className="stack" aria-label="Today's fifteen">
          <LoadingCard text="Loading today's fifteen." />
        </section>
        <section className="stack" aria-label="The pipeline">
          <LoadingCard text="Loading the pipeline." />
        </section>
        <section className="stack" aria-label="Deals">
          <LoadingCard text="Loading deals." />
        </section>
        <section className="stack" aria-label="Offers">
          <LoadingCard text="Loading offers." />
        </section>
        <section className="stack" aria-label="The weekly plan">
          <LoadingCard text="Loading the weekly plan." />
        </section>
        <section className="stack" aria-label="Money gates">
          <LoadingCard text="Loading money gates." />
        </section>
        <section className="stack" aria-label="Charts">
          <LoadingCard text="Loading charts." />
        </section>
        <section className="stack" aria-label="Scripts">
          <LoadingCard text="Loading scripts." />
        </section>
        <section className="stack" aria-label="Rules">
          <LoadingCard text="Loading rules." />
        </section>
      </>
    );
  }

  return (
    <>
      <section className="stack" aria-label="Money at a glance">
        <MoneyStrip summary={s} />
      </section>

      <section className="stack" aria-label="Today's fifteen">
        <MoneyToday summary={s} leads={l} onLogged={afterLeadWrite} />
      </section>

      <section className="stack" aria-label="The pipeline">
        <MoneyPipeline
          summary={s}
          leads={l}
          filters={filters}
          onFilterChange={setFilters}
          query={query}
          onQueryChange={onQueryChange}
          onMove={onMove}
          onDone={afterLeadWrite}
        />
      </section>

      <section className="stack" aria-label="Deals">
        <MoneyDeals summary={s} leads={l} deals={d} care={c} onDone={afterDealWrite} />
      </section>

      <section className="stack" aria-label="Offers">
        <MoneyOffers summary={s} />
      </section>

      <section className="stack" aria-label="The weekly plan">
        <MoneyPlan summary={s} />
      </section>

      <section className="stack" aria-label="Money gates">
        <MoneyGates summary={s} />
      </section>

      <section className="stack" aria-label="Charts">
        <MoneyCharts summary={s} />
      </section>

      <section className="stack" aria-label="Scripts">
        <MoneyScripts scripts={sc} />
      </section>

      <section className="stack" aria-label="Rules">
        <MoneyRules summary={s} />
      </section>
    </>
  );
}

export default MoneyScreen;
