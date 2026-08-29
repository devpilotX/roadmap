'use client';

/**
 * MoneyCharts | plan against actual, received by month, touches by week.
 *
 * The plan line is the weekly floor from Part 17.14. The actual line is dated
 * cash events only, and it stops at the current week because later weeks have
 * not happened.
 */

import { EmptyState, Section } from '@/components/ui/Basics';
import { BarChart, LineChart } from '@/components/ui/Charts';
import { int, rupees } from '@/lib/client/format';
import { LAST_DAY, type MoneySummary } from './types';

export function MoneyCharts({ summary }: { summary: MoneySummary }) {
  const weekPlan = summary.week_plan ?? [];
  const currentWeek = summary.week?.n ?? (summary.today > LAST_DAY ? 21 : 0);

  const points = weekPlan.map((t) => ({
    label: `W${t.week_n}`,
    plan: Number(t.target_low ?? 0),
    actual: t.week_n <= currentWeek ? Number(t.actual ?? 0) : null,
  }));

  const months = summary.received_by_month ?? [];
  const byWeek = summary.touches.by_week ?? [];

  return (
    <>
      <Section
        title="Plan against actual"
        lede="The plan line is the weekly floor. The actual line is dated cash events only."
      >
        {points.length ? (
          <LineChart
            points={points}
            yLabel="rupees, cumulative"
            summary={`The floor from Part 17.14 against what has actually arrived, cumulative from 28 August 2026. ${
              currentWeek
                ? `The actual line stops at week ${currentWeek}, because later weeks have not happened.`
                : 'No week has happened yet, so there is no actual line.'
            }`}
          />
        ) : (
          <EmptyState
            title="No weekly targets"
            body="The money plan comes from Part 17.14 of final.md. Run npm run setup."
          />
        )}
      </Section>

      <Section title="Received by month">
        {months.length ? (
          <BarChart
            bars={months.map((m) => ({ label: m.label.slice(0, 3), value: m.amount }))}
            summary={`${rupees(summary.strip.received_total)} in total across ${
              months.length
            } months with money in them.`}
          />
        ) : (
          <EmptyState
            title="No money received yet"
            body="A bar appears here the first time an advance, a balance or a care plan invoice has a date on it."
          />
        )}
      </Section>

      <Section title="Touches by week">
        {byWeek.length ? (
          <BarChart
            bars={byWeek.map((w) => ({ label: `W${w.week_n}`, value: w.touches }))}
            summary={`${int(summary.touches.touches)} touches, ${int(
              summary.touches.replies
            )} replies, a reply rate of ${summary.touches.reply_rate}%.`}
          />
        ) : (
          <EmptyState
            title="No touches logged yet"
            body="Every touch you log from the list above appears here, grouped into the week it happened in."
          />
        )}
      </Section>
    </>
  );
}

export default MoneyCharts;
