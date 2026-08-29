'use client';

/**
 * LibraryScreen | every link in Part 7, all twenty categories, each one tickable.
 */

import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { useTimer } from '@/components/TimerProvider';
import {
  Badge,
  EmptyState,
  ErrorCard,
  ExternalLink,
  LoadingCard,
  StatGrid,
} from '@/components/ui/Basics';
import { ChipFilter, SearchBox } from '@/components/ui/Controls';
import { optimistic, useDebounced, useResource } from '@/components/ui/useResource';
import { api, type ApiError } from '@/lib/client/api';

const ICON = { play: 'M8 5l11 7-11 7z' };

type Status = 'todo' | 'reading' | 'done';

interface Category {
  no: number;
  name: string;
}

interface Resource {
  id: number;
  category_no: number;
  category_name: string;
  ord: number;
  url: string;
  label: string;
  why: string;
  cost: string;
  weeks: number[];
  is_alive: boolean;
  last_status: number | null;
  last_checked: string | null;
  status: Status;
  minutes: number;
  rating: number | null;
  notes: string;
}

interface Payload {
  categories: Category[];
  resources: Resource[];
  total: number;
  shown: number;
  tally: { todo: number; reading: number; done: number };
  dead: number;
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'done') return <Badge tone="green">Done</Badge>;
  if (status === 'reading') return <Badge tone="blue">Reading</Badge>;
  return <Badge tone="outline">Not started</Badge>;
}

/* --------------------------------------------------------------- one link */

function ResourceRow({
  r,
  onStatus,
}: {
  r: Resource;
  onStatus: (next: Status, write: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { toast, toastError } = useToast();
  const { openAndStart } = useTimer();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(r.notes ?? '');

  const saveNotes = useDebounced(async (value: string) => {
    try {
      await api.patch(`/api/resources/${r.id}/progress`, { notes: value });
    } catch (err) {
      toastError((err as ApiError).message);
    }
  }, 400);

  async function start() {
    setBusy(true);
    await openAndStart({ url: r.url, block: 'LEARN', resourceId: r.id, label: r.label });
    await onStatus('reading', async () => undefined);
    setBusy(false);
  }

  async function mark(next: Status) {
    setBusy(true);
    const ok = await onStatus(next, () =>
      api.patch(`/api/resources/${r.id}/progress`, { status: next })
    );
    if (ok) toast(`Marked ${next}.`, 'ok');
    setBusy(false);
  }

  return (
    <div className="linkrow">
      <div className="linkrow__main">
        <div className="linkrow__title">
          <ExternalLink href={r.url}>{r.label}</ExternalLink>
          <StatusBadge status={r.status} />
          <Badge tone="outline">{r.cost}</Badge>
          {r.weeks.length ? <Badge>Week {r.weeks.join(', ')}</Badge> : null}
          {r.is_alive === false ? (
            <Badge tone="red">
              {r.last_checked ? `Link check failed on ${r.last_checked}` : 'Link check failed'}
            </Badge>
          ) : r.last_checked ? (
            <Badge tone="green">Checked {r.last_checked}</Badge>
          ) : null}
        </div>
        <p className="linkrow__why">{r.why}</p>
        <input
          className="input input--sm"
          value={notes}
          placeholder="A note"
          aria-label={`Note for ${r.label}`}
          onChange={(e) => {
            setNotes(e.target.value);
            saveNotes(e.target.value);
          }}
        />
      </div>
      <div className="linkrow__actions">
        <button
          type="button"
          className="btn btn--sm btn--start"
          disabled={busy}
          onClick={() => void start()}
        >
          <Icon path={ICON.play} />
          Open and start
        </button>
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy}
          onClick={() => void mark('reading')}
        >
          Reading
        </button>
        <button
          type="button"
          className="btn btn--sm"
          disabled={busy}
          onClick={() => void mark('done')}
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- main */

export function LibraryScreen() {
  const { toastError } = useToast();
  const [category, setCategory] = useState('');
  const [week, setWeek] = useState('');
  const [cost, setCost] = useState('');
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [typed, setTyped] = useState('');

  const pushQ = useDebounced((value: string) => setQ(value), 250);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ category, week, cost, status, q })) {
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    return `/api/resources${qs ? `?${qs}` : '?'}`;
  }, [category, week, cost, status, q]);

  const { data, error, setData } = useResource<Payload>(path);

  async function setResourceStatus(
    r: Resource,
    next: Status,
    write: () => Promise<unknown>
  ): Promise<boolean> {
    const swap = (value: Status) =>
      setData((prev) =>
        prev
          ? {
              ...prev,
              resources: prev.resources.map((x) => (x.id === r.id ? { ...x, status: value } : x)),
            }
          : prev
      );
    const before = r.status;
    const result = await optimistic({
      apply: () => swap(next),
      revert: () => swap(before),
      write,
      onError: (err: ApiError) => toastError(err.message),
    });
    return result !== null;
  }

  const byCategory = new Map<number, Resource[]>();
  for (const r of data?.resources ?? []) {
    if (!byCategory.has(r.category_no)) byCategory.set(r.category_no, []);
    byCategory.get(r.category_no)!.push(r);
  }
  const blocks = (data?.categories ?? [])
    .map((c) => ({ c, rows: byCategory.get(c.no) ?? [] }))
    .filter((b) => b.rows.length > 0);

  return (
    <>
      <section className="stack" aria-label="Library summary">
        {error ? (
          <ErrorCard message={error} />
        ) : !data ? (
          <LoadingCard text="Loading library summary." />
        ) : (
          <StatGrid
            stats={[
              {
                value: `${data.tally.done} of ${data.total}`,
                label: 'links finished',
                tone: data.tally.done ? 'green' : undefined,
              },
              {
                value: data.tally.reading,
                label: 'in progress',
                tone: data.tally.reading ? 'blue' : undefined,
              },
              { value: data.categories.length, label: 'categories' },
              {
                value: data.dead,
                label: 'links flagged by the checker',
                tone: data.dead ? 'red' : undefined,
                sub: 'A dead link is flagged, never deleted.',
              },
            ]}
          />
        )}
      </section>

      <section className="stack-sm" aria-label="Filters">
        {!data ? (
          <LoadingCard text="Loading filters." />
        ) : (
          <div className="card">
            <div className="filters">
              <SearchBox
                placeholder="Search a link or a reason"
                value={typed}
                onChange={(v) => {
                  setTyped(v);
                  pushQ(v);
                }}
              />

              <select
                className="select select--sm"
                aria-label="Filter by category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Every category</option>
                {data.categories.map((c) => (
                  <option key={c.no} value={String(c.no)}>
                    {String(c.no).padStart(2, '0')} {c.name}
                  </option>
                ))}
              </select>

              <select
                className="select select--sm"
                aria-label="Filter by week"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
              >
                <option value="">Any week</option>
                {Array.from({ length: 21 }, (_, i) => i + 1).map((i) => (
                  <option key={i} value={String(i)}>
                    Week {i}
                  </option>
                ))}
              </select>

              <ChipFilter
                label="Filter by cost"
                current={cost}
                onChange={setCost}
                options={[
                  { value: '', label: 'Any cost' },
                  { value: 'Free', label: 'Free' },
                  { value: 'Paid', label: 'Paid' },
                  { value: 'Owned', label: 'Owned' },
                ]}
              />

              <ChipFilter
                label="Filter by status"
                current={status}
                onChange={setStatus}
                options={[
                  { value: '', label: 'Any status' },
                  { value: 'todo', label: 'Not started' },
                  { value: 'reading', label: 'Reading' },
                  { value: 'done', label: 'Done' },
                ]}
              />
            </div>
          </div>
        )}
      </section>

      <section className="stack" aria-label="The links">
        {!data ? (
          <LoadingCard text="Loading the links." />
        ) : blocks.length ? (
          blocks.map(({ c, rows }) => (
            <details className="catcard" key={c.no} open={rows.length <= 12}>
              <summary className="catcard__head">
                <span className="catcard__no">{String(c.no).padStart(2, '0')}</span>
                <strong className="grow">{c.name}</strong>
                <span className="badge badge--outline">
                  {rows.filter((r) => r.status === 'done').length} of {rows.length}
                </span>
              </summary>
              <div className="catcard__body">
                {rows.map((r) => (
                  <ResourceRow
                    key={r.id}
                    r={r}
                    onStatus={(next, write) => setResourceStatus(r, next, write)}
                  />
                ))}
              </div>
            </details>
          ))
        ) : (
          <EmptyState
            title="Nothing matches those filters"
            body="Clear a filter and the whole library comes back. There are 127 links in Part 7."
          />
        )}
      </section>
    </>
  );
}

export default LibraryScreen;
