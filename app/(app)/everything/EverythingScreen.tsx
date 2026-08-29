'use client';

/**
 * Everything A to Z.
 *
 * This screen exists for one reason: to prove nothing in final.md was lost on the
 * way into the database. Every trackable item in the roadmap appears here once,
 * grouped by the part it came from, with one completion percentage for the whole
 * thing and the same percentage for each group.
 *
 * A row is one of four states. Done and todo are obvious. Partial means it was
 * started but not finished, which for a week day means one of learn and build was
 * ticked. Reference means the row is read only content from the plan, such as the
 * New Zealand cost table, and it is deliberately left out of every percentage,
 * because counting a table you cannot tick would flatter the number.
 *
 * Source: GET /api/everything. There are no writes on this screen; each row links
 * to the screen that owns it.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import {
  EmptyState,
  ErrorCard,
  LoadingCard,
  Meter,
  Section,
  StatGrid,
} from '@/components/ui/Basics';
import { ChipFilter, SearchBox } from '@/components/ui/Controls';
import { useDebounced, useResource } from '@/components/ui/useResource';
import { int } from '@/lib/client/format';

type ItemState = 'done' | 'partial' | 'todo' | 'reference';

const STATE_LABEL: Record<string, string> = {
  done: 'Done',
  partial: 'Started',
  todo: 'Not started',
  reference: 'Reference, not counted',
};

interface Counts {
  total: number;
  trackable: number;
  done: number;
  partial: number;
  todo: number;
  percent: number;
}

interface GroupRow {
  key: string;
  title: string;
  source: string;
  counts: Counts;
}

interface ItemRow {
  id: string;
  label: string;
  text: string | null;
  state: ItemState;
  href: string;
  date?: string | null;
  week_n?: number | null;
  group: string;
  group_title: string;
}

interface Payload {
  today: string;
  global: Counts;
  groups: GroupRow[];
  items: ItemRow[];
  item_count: number;
}

type StateFilter = '' | ItemState;

export function EverythingScreen() {
  const { data, error, loading } = useResource<Payload>('/api/everything');
  const { toastError } = useToast();

  const [typed, setTyped] = useState('');
  const [needle, setNeedle] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('');
  const [group, setGroup] = useState('');

  // The old script debounced the list redraw by 200ms as you typed.
  const commit = useDebounced((value: string) => setNeedle(value), 200);

  useEffect(() => {
    if (error) toastError(error);
  }, [error, toastError]);

  if (error) {
    return (
      <section className="stack" aria-label="The global number">
        <ErrorCard message={error} />
      </section>
    );
  }

  if (loading || !data) {
    return (
      <>
        <section className="stack" aria-label="The global number">
          <LoadingCard text="Loading the global number." />
        </section>
        <section className="stack-sm" aria-label="Filters and search">
          <LoadingCard text="Loading filters and search." />
        </section>
        <section className="stack" aria-label="Per group">
          <LoadingCard text="Loading per group." />
        </section>
        <section className="stack" aria-label="Every item">
          <LoadingCard text="Loading every item." />
        </section>
      </>
    );
  }

  const g = data.global;

  const matches = (item: ItemRow) => {
    if (group && item.group !== group) return false;
    if (stateFilter && item.state !== stateFilter) return false;
    if (needle) {
      const hay = `${item.label} ${item.text ?? ''} ${item.group_title ?? ''}`.toLowerCase();
      if (!hay.includes(needle.toLowerCase())) return false;
    }
    return true;
  };

  const shown = data.items.filter(matches);
  // The old script rebuilt the accordions on every filter change, which reset
  // whether each one was open. The signature keeps that behaviour.
  const signature = `${needle}|${stateFilter}|${group}`;

  return (
    <>
      <section className="stack" aria-label="The global number">
        <Section
          title="One number for the whole roadmap"
          lede="Nothing here is a summary of a summary. Every row below is a real item you can open."
        >
          <div className="row">
            <span className="evglobal">{g.percent}%</span>
            <div className="stack-sm grow">
              <Meter percent={g.percent} tone={g.percent === 100 ? 'green' : undefined} />
              <p className="text-sm muted">
                {`${int(g.done)} of ${int(g.trackable)} tickable items are finished. ${int(
                  g.partial
                )} are started, ${int(g.todo)} are not. ${int(
                  g.total - g.trackable
                )} more rows are reference content and are not counted.`}
              </p>
            </div>
          </div>
          <StatGrid
            stats={[
              { value: g.done, label: 'items finished', tone: g.done ? 'green' : undefined },
              {
                value: g.partial,
                label: 'items started but not finished',
                tone: g.partial ? 'orange' : undefined,
              },
              { value: g.todo, label: 'items not started' },
              {
                value: data.item_count,
                label: 'rows on this page',
                sub: `${data.groups.length} groups, as of ${data.today}`,
              },
            ]}
          />
          <p className="text-sm muted measure">
            The percentage counts finished items only. A started item counts nothing until it is
            finished, because half a week day is not a week day.
          </p>
        </Section>
      </section>

      <section className="stack-sm" aria-label="Filters and search">
        <div className="card">
          <div className="filters">
            <SearchBox
              placeholder="Search every item in the roadmap"
              value={typed}
              onChange={(v) => {
                setTyped(v);
                commit(v);
              }}
            />
            <select
              className="select select--sm"
              aria-label="Filter by group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">Every group</option>
              {data.groups.map((grp) => (
                <option key={grp.key} value={grp.key}>
                  {`${grp.title} (${grp.counts.done} of ${grp.counts.trackable})`}
                </option>
              ))}
            </select>
            <ChipFilter<StateFilter>
              options={[
                { value: '', label: 'Any state' },
                { value: 'done', label: 'Done', count: g.done },
                { value: 'partial', label: 'Started', count: g.partial },
                { value: 'todo', label: 'Not started', count: g.todo },
                { value: 'reference', label: 'Reference', count: g.total - g.trackable },
              ]}
              current={stateFilter}
              onChange={setStateFilter}
            />
          </div>
        </div>
      </section>

      <section className="stack" aria-label="Per group">
        <Section title="The same number, per group">
          {data.groups.length ? (
            <div className="evgroups">
              {data.groups.map((grp) => {
                const active = group === grp.key;
                return (
                  <button
                    key={grp.key}
                    type="button"
                    className="evgroup"
                    aria-pressed={active}
                    onClick={() => setGroup(active ? '' : grp.key)}
                  >
                    <span className="evrow__label">{grp.title}</span>
                    <span className="evrow__text">{grp.source}</span>
                    <strong>{grp.counts.percent}%</strong>
                    <Meter
                      percent={grp.counts.percent}
                      tone={grp.counts.percent === 100 ? 'green' : undefined}
                    />
                    <span className="evrow__text">
                      {grp.counts.trackable
                        ? `${grp.counts.done} done, ${grp.counts.partial} started, ${grp.counts.todo} to go, of ${grp.counts.trackable} tickable`
                        : `${grp.counts.total} reference rows, nothing to tick`}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No groups"
              body="Nothing has been seeded yet. Run npm run setup and the groups appear from final.md."
            />
          )}
          <p className="text-xs muted">
            Select a group to narrow the list below. Select it again to clear it.
          </p>
        </Section>
      </section>

      <section className="stack" aria-label="Every item">
        {shown.length ? (
          <Section
            title="Every item"
            lede="Grouped by the part of final.md the item came from. Long groups start folded, and nothing is left out."
          >
            <p className="text-sm muted">
              {`Showing ${int(shown.length)} of ${int(data.item_count)} items.`}
            </p>
            {data.groups.map((grp) => {
              const rows = shown.filter((i) => i.group === grp.key);
              if (!rows.length) return null;
              return (
                <details
                  className="acc"
                  key={`${grp.key}-${signature}`}
                  open={rows.length <= 60 || Boolean(group)}
                >
                  <summary className="acc__summary">
                    <span className="grow">{`${grp.title}, ${rows.length} shown`}</span>
                    <span className="badge badge--outline">{grp.counts.percent}%</span>
                  </summary>
                  <div className="acc__body">
                    <div className="card card--flush">
                      {rows.map((item) => (
                        <div className="evrow" key={item.id}>
                          <span
                            className={`evrow__state evrow__state--${item.state}`}
                            aria-hidden="true"
                          />
                          <div>
                            <div className="evrow__label">{item.label}</div>
                            <div className="evrow__text">
                              {`${STATE_LABEL[item.state] ?? item.state}. ${item.text ?? ''}`}
                            </div>
                          </div>
                          {item.href ? (
                            <Link className="btn btn--sm btn--ghost" href={item.href}>
                              Open
                            </Link>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              );
            })}
          </Section>
        ) : (
          <Section title="Every item">
            <EmptyState
              title="Nothing matches those filters"
              body={`There are ${int(
                data.item_count
              )} items on this page. Clear the search, the group and the state and all of them come back.`}
            />
          </Section>
        )}
      </section>
    </>
  );
}

export default EverythingScreen;
