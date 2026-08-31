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

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useDebounced, useResource } from '@/components/ui/useResource';
import { Callout, ErrorCard, LoadingCard } from '@/components/ui/Basics';
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

  const s = summary.data;
  const l = leads.data;
  const d = deals.data;
  const c = care.data;
  const sc = scripts.data;

  /**
   * Ten panels, five endpoints, and no shared fate.
   *
   * This screen used to collapse every source into one `error` and one all or
   * nothing loading gate, so a single 500 from /api/money/scripts blanked the
   * target, the fifteen touches, the pipeline, the deals and the gates with it:
   * nine panels that had their rows in hand and could have drawn them. Each panel
   * is now listed against the sources it actually reads, and its three states are
   * resolved on their own:
   *   - rows in hand, draw them, and if a later refresh failed say so above them
   *     rather than throwing already good data away,
   *   - nothing to draw and an error, show that error here and nowhere else,
   *   - neither, keep the named loading card the panel had before, because a
   *     screen taking shape says more than one blank word.
   * The sentence shown is always the server's own. No failure is swallowed.
   */
  const panels: {
    label: string;
    loadingText: string;
    error: string | null;
    node: ReactNode | null;
  }[] = [
    {
      label: 'Money at a glance',
      loadingText: 'Loading money at a glance.',
      error: summary.error,
      node: s ? <MoneyStrip summary={s} /> : null,
    },
    {
      label: "Today's fifteen",
      loadingText: "Loading today's fifteen.",
      error: summary.error ?? leads.error,
      node: s && l ? <MoneyToday summary={s} leads={l} onLogged={afterLeadWrite} /> : null,
    },
    {
      label: 'The pipeline',
      loadingText: 'Loading the pipeline.',
      error: summary.error ?? leads.error,
      node:
        s && l ? (
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
        ) : null,
    },
    {
      label: 'Deals',
      loadingText: 'Loading deals.',
      // Four sources, because a deal row is drawn with its lead, its care plan and
      // the summary's own arithmetic. Any one of them missing means no deals table.
      error: summary.error ?? leads.error ?? deals.error ?? care.error,
      node:
        s && l && d && c ? (
          <MoneyDeals summary={s} leads={l} deals={d} care={c} onDone={afterDealWrite} />
        ) : null,
    },
    {
      label: 'Offers',
      loadingText: 'Loading offers.',
      error: summary.error,
      node: s ? <MoneyOffers summary={s} /> : null,
    },
    {
      label: 'The weekly plan',
      loadingText: 'Loading the weekly plan.',
      error: summary.error,
      node: s ? <MoneyPlan summary={s} /> : null,
    },
    {
      label: 'Money gates',
      loadingText: 'Loading money gates.',
      error: summary.error,
      node: s ? <MoneyGates summary={s} /> : null,
    },
    {
      label: 'Charts',
      loadingText: 'Loading charts.',
      error: summary.error,
      node: s ? <MoneyCharts summary={s} /> : null,
    },
    {
      label: 'Scripts',
      loadingText: 'Loading scripts.',
      // The only panel that reads /api/money/scripts, and the reason the old
      // single gate was so expensive: this endpoint failing cost nine other panels.
      error: scripts.error,
      node: sc ? <MoneyScripts scripts={sc} /> : null,
    },
    {
      label: 'Rules',
      loadingText: 'Loading rules.',
      error: summary.error,
      node: s ? <MoneyRules summary={s} /> : null,
    },
  ];

  return (
    <>
      {panels.map((p) => (
        <section className="stack" aria-label={p.label} key={p.label}>
          {p.node ? (
            <>
              {p.error ? (
                <Callout tone="orange" title="That did not refresh">
                  <p>{p.error}</p>
                  <p>What is below is the last good answer this panel had.</p>
                </Callout>
              ) : null}
              {p.node}
            </>
          ) : p.error ? (
            <ErrorCard message={p.error} />
          ) : (
            <LoadingCard text={p.loadingText} />
          )}
        </section>
      ))}
    </>
  );
}

export default MoneyScreen;
