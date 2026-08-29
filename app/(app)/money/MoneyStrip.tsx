'use client';

/**
 * MoneyStrip | Rs 90,000 received by 24 January 2027, and the six numbers that
 * say whether it is still on.
 *
 * Received means a dated cash event. The server does that arithmetic, so this
 * block only ever displays what the API already worked out.
 */

import { Meter, Section, Stat } from '@/components/ui/Basics';
import { int, pct, rupees } from '@/lib/client/format';
import type { MoneySummary } from './types';

export function MoneyStrip({ summary }: { summary: MoneySummary }) {
  const s = summary.strip;
  const percent = pct(s.received_total, s.target_total);
  const monthBand = s.month_target
    ? `${rupees(s.month_target.low)} to ${rupees(s.month_target.high)} is the plan`
    : 'no month target in the plan for this month';

  return (
    <Section title="Rs 90,000 received by 24 January 2027">
      <div className="moneystrip">
        <Stat
          value={rupees(s.received_total)}
          label={`received of ${rupees(s.target_total)}`}
          sub={`${percent}% of the target`}
          tone={percent >= 100 ? 'green' : undefined}
          hero
        />
        <Stat
          value={rupees(s.received_this_month)}
          label={`received in ${s.month_label}`}
          sub={monthBand}
        />
        <Stat
          value={`${s.care_plan_count} of ${s.care_plan_target}`}
          label="care plans running"
          sub={`${rupees(s.care_plan_monthly)} a month, the recurring floor`}
          tone={s.care_plan_count >= s.care_plan_target ? 'green' : undefined}
        />
        <Stat
          value={s.days_since_last_touch === null ? 'Never' : `${int(s.days_since_last_touch)} d`}
          label="since the last touch"
          sub={s.days_since_last_touch === null ? 'no lead has ever been touched' : ''}
          tone={
            s.days_since_last_touch === null || s.days_since_last_touch > 2 ? 'red' : undefined
          }
        />
        <Stat
          value={s.days_since_last_rupee === null ? 'Never' : `${int(s.days_since_last_rupee)} d`}
          label="since the last rupee arrived"
          sub={s.days_since_last_rupee === null ? 'no cash event recorded yet' : ''}
          tone={
            s.days_since_last_rupee === null || s.days_since_last_rupee > 14 ? 'red' : undefined
          }
        />
        <Stat
          value={`${summary.deals.win_rate}%`}
          label="win rate on quoted deals"
          sub={`${summary.deals.won} won of ${summary.deals.quoted} quoted`}
        />
      </div>

      <Meter percent={percent} tone={percent >= 100 ? 'green' : undefined} />

      <p className="text-sm muted measure">
        Received is counted from dated cash events only: an advance on its advance date, a balance on
        its balance date, a care plan on the month it was invoiced. A deal ticked as paid with no
        dates on it is not money and is not in this total.
      </p>

      {summary.week ? (
        <p className="text-xs muted">
          {`Week ${summary.week.n}, ${summary.week.title}. ${summary.week.dates_label}.`}
        </p>
      ) : (
        <p className="text-xs muted">{`${summary.today} is outside the 21 week window.`}</p>
      )}
    </Section>
  );
}

export default MoneyStrip;
