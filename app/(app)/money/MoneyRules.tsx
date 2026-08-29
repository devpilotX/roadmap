'use client';

/**
 * MoneyRules | the rules of the hour, the shape of it, the lanes, and the lists.
 *
 * The money hour never borrows from study. Everything on this block is reference
 * from Part 17 of final.md, so nothing here is editable.
 */

import { Callout, EmptyState, Section } from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import type { HourShapeRow, LaneRow, MoneySummary } from './types';

const SHAPE_COLUMNS: Column<HourShapeRow>[] = [
  { key: 'day_name', label: 'Day' },
  { key: 'first_forty', label: 'First forty minutes' },
  { key: 'last_twenty', label: 'Last twenty minutes' },
];

const LANE_COLUMNS: Column<LaneRow>[] = [
  { key: 'lane', label: 'Lane' },
  { key: 'what_it_is', label: 'What it is' },
  { key: 'time_to_first_rupee', label: 'Time to the first rupee' },
  { key: 'ceiling', label: 'Ceiling' },
  { key: 'use_it_for', label: 'Use it for' },
];

function SimpleList({
  title,
  items,
  body,
}: {
  title: string;
  items: { id: number; text: string }[];
  body: string;
}) {
  return (
    <Section title={title}>
      {items.length ? (
        <ol className="measure">
          {items.map((r) => (
            <li key={r.id}>{r.text}</li>
          ))}
        </ol>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()}`} body={body} />
      )}
    </Section>
  );
}

export function MoneyRules({ summary }: { summary: MoneySummary }) {
  const rules = summary.rules ?? [];
  const lanes = summary.lanes ?? [];
  const shape = summary.hour_shape ?? [];
  const sources = summary.lead_sources ?? [];

  const byGroup = new Map<string, { id: number; rule: string }[]>();
  for (const r of rules) {
    if (!byGroup.has(r.group_key)) byGroup.set(r.group_key, []);
    byGroup.get(r.group_key)!.push(r);
  }
  const groups = [...byGroup.entries()];

  return (
    <>
      <Callout
        tone="blue"
        title="The money hour is 17:00 to 18:00 and it never borrows from study"
      >
        <p className="measure">
          Six days a week, on top of the eight hours. If the hour is lost, it is lost: it is not taken
          back out of the DSA block, the LEARN block or the BUILD block the next morning. That rule is
          the reason the money and the degree can both survive to January.
        </p>
      </Callout>

      <Section title="The rules">
        {groups.length ? (
          groups.map(([group, rows]) => (
            <details className="acc" key={group} open={groups.length <= 3}>
              <summary className="acc__summary">
                {`${group.replace(/_/g, ' ')}, ${rows.length} rules`}
              </summary>
              <div className="acc__body">
                <ol className="measure">
                  {rows.map((r) => (
                    <li key={r.id}>{r.rule}</li>
                  ))}
                </ol>
              </div>
            </details>
          ))
        ) : (
          <EmptyState
            title="No money rules"
            body="They come from Part 17 of final.md. Run npm run setup."
          />
        )}
      </Section>

      <Section title="The shape of the hour">
        {shape.length ? (
          <Table
            columns={SHAPE_COLUMNS}
            rows={shape}
            rowKey={(r) => r.id}
            caption="Part 17.5, what the first forty minutes and the last twenty are for"
          />
        ) : (
          <EmptyState
            title="No shape for the hour"
            body="Part 17.5 of final.md defines it. Run npm run setup."
          />
        )}
      </Section>

      <Section title="The lanes">
        {lanes.length ? (
          <Table
            columns={LANE_COLUMNS}
            rows={lanes}
            rowKey={(r) => r.id}
            caption="Part 17.2, the ways money can arrive and what each one is worth"
          />
        ) : (
          <EmptyState title="No lanes" body="Part 17.2 of final.md defines them. Run npm run setup." />
        )}
      </Section>

      <SimpleList
        title="The first hour, step by step"
        items={(summary.first_hour ?? []).map((r) => ({ id: r.id, text: r.step }))}
        body="Part 17 of final.md lists them. Run npm run setup."
      />
      <SimpleList
        title="What to refuse"
        items={(summary.refuse ?? []).map((r) => ({ id: r.id, text: r.item }))}
        body="Part 17 of final.md lists them. Run npm run setup."
      />
      <SimpleList
        title="What to buy back with the money"
        items={(summary.buyback ?? []).map((r) => ({ id: r.id, text: r.item }))}
        body="Part 17 of final.md lists them. Run npm run setup."
      />

      <Section
        title="Where the leads come from"
        lede="Sixty leads a week, built inside the money hour and never inside a study block."
      >
        {sources.length ? (
          <ul className="measure">
            {sources.map((s) => (
              <li key={s.id}>{s.source}</li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No lead sources"
            body="Part 17.6 of final.md lists them. Run npm run setup."
          />
        )}
      </Section>
    </>
  );
}

export default MoneyRules;
