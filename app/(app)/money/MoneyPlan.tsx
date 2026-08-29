'use client';

/**
 * MoneyPlan | Part 17.14 week by week, and the month by month plan.
 *
 * "Received by the end of that week" is cumulative from 28 August 2026, which is
 * how the plan states it, so the actual column is a running total rather than a
 * week's takings.
 */

import { EmptyState, Section } from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { rupees } from '@/lib/client/format';
import type { MonthTargetRow, MoneySummary, WeekTargetRow } from './types';

const WEEK_COLUMNS: Column<WeekTargetRow>[] = [
  {
    key: 'week_n',
    label: 'Week',
    num: true,
    render: (r) => `W${String(r.week_n).padStart(2, '0')}`,
  },
  { key: 'focus', label: 'Focus' },
  { key: 'target_text', label: 'Target' },
  {
    key: 'actual',
    label: 'Received by the end of it',
    num: true,
    render: (r) => rupees(r.actual),
  },
  {
    label: 'Against the floor',
    render: (r) => {
      if (!Number(r.target_low)) return <span className="badge badge--outline">No floor set</span>;
      return Number(r.actual) >= Number(r.target_low) ? (
        <span className="badge badge--green">Met</span>
      ) : (
        <span className="badge badge--outline">
          {`${rupees(Number(r.target_low) - Number(r.actual))} short`}
        </span>
      );
    },
  },
];

const MONTH_COLUMNS: Column<MonthTargetRow>[] = [
  { key: 'month_label', label: 'Month' },
  { key: 'target_text', label: 'Target' },
  { key: 'what_produces_it', label: 'What produces it' },
  { key: 'actual', label: 'Received', num: true, render: (r) => rupees(r.actual) },
  {
    label: '',
    render: (r) => (Number(r.is_total) === 1 ? <span className="badge badge--blue">Total</span> : null),
  },
];

export function MoneyPlan({ summary }: { summary: MoneySummary }) {
  const weekPlan = summary.week_plan ?? [];
  const monthPlan = summary.month_plan ?? [];

  return (
    <>
      <Section
        title="The weekly plan"
        lede="Received by the end of that week is cumulative from 28 August 2026, which is how the plan states it."
      >
        {weekPlan.length ? (
          <Table
            columns={WEEK_COLUMNS}
            rows={weekPlan}
            rowKey={(r) => r.week_n}
            rowCurrent={(r) => Boolean(r.is_current)}
            caption="Part 17.14, the money target for each of the 21 weeks"
          />
        ) : (
          <EmptyState
            title="No weekly money plan"
            body="The 21 week money targets come from Part 17.14 of final.md. Run npm run setup."
          />
        )}
      </Section>

      <Section title="The monthly plan">
        {monthPlan.length ? (
          <Table
            columns={MONTH_COLUMNS}
            rows={monthPlan}
            rowKey={(r) => r.id}
            caption="The month by month plan, and the total"
          />
        ) : (
          <EmptyState
            title="No monthly money plan"
            body="The monthly targets come from Part 17 of final.md. Run npm run setup."
          />
        )}
      </Section>
    </>
  );
}

export default MoneyPlan;
