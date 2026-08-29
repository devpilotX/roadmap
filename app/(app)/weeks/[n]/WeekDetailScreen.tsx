'use client';

/**
 * WeekDetailScreen | one week in full.
 *
 * Focus, the learn list, the build list, the six day table with per day
 * checkboxes, ships, the trap, the note, and every link with a status toggle
 * and an Open and start button.
 */

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { useTimer } from '@/components/TimerProvider';
import {
  Badge,
  ButtonLink,
  Callout,
  ErrorCard,
  ExternalLink,
  Section,
  StatGrid,
  LoadingSections,
} from '@/components/ui/Basics';
import { Tick } from '@/components/ui/Controls';
import { Table, type Column } from '@/components/ui/Table';
import { optimistic, useResource } from '@/components/ui/useResource';
import { api, type ApiError } from '@/lib/client/api';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  gate: 'M6 3v18M18 3v18M6 8h12M6 15h12',
};

type LinkStatus = 'todo' | 'reading' | 'done';

interface Week {
  n: number;
  start_date: string;
  end_date: string;
  dates_label: string;
  title: string;
  phase_code: string;
  focus: string;
  dsa_target: number;
  dsa_cumulative: number;
  gate_no: number | null;
  phase_name: string;
}

interface Phase {
  code: string;
  name: string;
}

interface Gate {
  no: number;
  week_n: number;
  gate_date: string;
  condition_text: string;
}

interface Sunday {
  week_n: number;
  sunday_date: string;
  kind: string;
  hours: number;
  type_text: string;
  topic: string;
}

interface ListRow {
  id: number;
  week_n: number;
  ord: number;
  text: string;
}

interface DayRow {
  id: number;
  week_n: number;
  day_name: string;
  day_order: number;
  learn_task: string;
  build_task: string;
  dsa_day_target: number;
  cal_date: string;
  learn_done: boolean;
  build_done: boolean;
  completed_at: string | null;
  dsa_solved: number;
  day_colour: string | null;
  pushes: number;
  editable: boolean;
}

interface WeekLink {
  id: number;
  url: string;
  label: string;
  resource_id: number | null;
  why: string | null;
  cost: string | null;
  is_alive: boolean;
  last_checked: string | null;
  status: LinkStatus;
  minutes: number;
  notes: string;
}

interface Payload {
  week: Week;
  phase: Phase | null;
  gate: Gate | null;
  sunday: Sunday | null;
  learn: ListRow[];
  build: ListRow[];
  ships: ListRow[];
  trap: string | null;
  note: string | null;
  days: DayRow[];
  links: WeekLink[];
  neighbours: { prev: number | null; next: number | null };
}

function StatusBadge({ status }: { status: LinkStatus }) {
  if (status === 'done') return <Badge tone="green">Done</Badge>;
  if (status === 'reading') return <Badge tone="blue">Reading</Badge>;
  return <Badge tone="outline">Not started</Badge>;
}

/* ------------------------------------------------------------------- links */

function LinkRow({
  link,
  onStatus,
}: {
  link: WeekLink;
  onStatus: (next: LinkStatus, write: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { toast } = useToast();
  const { openAndStart } = useTimer();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    await openAndStart({
      url: link.url,
      block: 'LEARN',
      resourceId: link.resource_id,
      weekLinkId: link.id,
      label: link.label,
    });
    await onStatus('reading', async () => undefined);
    setBusy(false);
  }

  async function mark(next: LinkStatus) {
    setBusy(true);
    const ok = await onStatus(next, () =>
      api.patch(`/api/week-links/${link.id}/progress`, { status: next })
    );
    if (ok) toast(`Marked ${next}.`, 'ok');
    setBusy(false);
  }

  return (
    <div className="linkrow">
      <div className="linkrow__main">
        <div className="linkrow__title">
          <ExternalLink href={link.url}>{link.label}</ExternalLink>
          <StatusBadge status={link.status} />
          {link.is_alive === false ? <Badge tone="red">Link check failed</Badge> : null}
        </div>
        {link.why ? <p className="linkrow__why">{link.why}</p> : null}
        {link.cost ? <p className="linkrow__why">Cost: {link.cost}</p> : null}
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
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void mark('reading')}>
          Reading
        </button>
        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void mark('done')}>
          Done
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- main */

export function WeekDetailScreen({ n, today }: { n: number; today: string }) {
  const { toast, toastError } = useToast();
  const { data, error, loading, refresh, setData } = useResource<Payload>(`/api/weeks/${n}`);

  if (error) return <ErrorCard message={error} />;
  if (loading || !data) {
    return (
      <LoadingSections
        sections={[
          { label: 'Week header', text: 'Loading week header.' },
          { label: 'Week detail', text: 'Loading week detail.' },
        ]}
      />
    );
  }

  const d = data;
  const w = d.week;

  /** Tick one half of one day, optimistically, and undo it if the server refuses. */
  async function tickDay(row: DayRow, field: 'learn_done' | 'build_done', want: boolean) {
    const swap = (value: boolean) =>
      setData((prev) =>
        prev
          ? {
              ...prev,
              days: prev.days.map((x) => (x.id === row.id ? { ...x, [field]: value } : x)),
            }
          : prev
      );
    const result = await optimistic({
      apply: () => swap(want),
      revert: () => swap(!want),
      write: () => api.patch(`/api/week-days/${row.id}/progress`, { [field]: want }),
      onError: (err: ApiError) => toastError(err.message),
    });
    if (result !== null) {
      toast('Saved.', 'ok');
      await refresh();
    }
  }

  async function setLinkStatus(
    link: WeekLink,
    next: LinkStatus,
    write: () => Promise<unknown>
  ): Promise<boolean> {
    const swap = (value: LinkStatus) =>
      setData((prev) =>
        prev
          ? {
              ...prev,
              links: prev.links.map((x) => (x.id === link.id ? { ...x, status: value } : x)),
            }
          : prev
      );
    const before = link.status;
    const result = await optimistic({
      apply: () => swap(next),
      revert: () => swap(before),
      write,
      onError: (err: ApiError) => toastError(err.message),
    });
    return result !== null;
  }

  const columns: Column<DayRow>[] = [
    { key: 'day_name', label: 'Day' },
    { key: 'cal_date', label: 'Date' },
    { key: 'dsa_day_target', label: 'DSA', num: true },
    {
      label: 'Learn, 09:30 to 12:30',
      render: (row) => (
        <Tick
          checked={row.learn_done}
          disabled={!row.editable}
          onChange={(want) => void tickDay(row, 'learn_done', want)}
          label={row.learn_task}
        />
      ),
    },
    {
      label: 'Build, 14:00 to 16:00',
      render: (row) => (
        <Tick
          checked={row.build_done}
          disabled={!row.editable}
          onChange={(want) => void tickDay(row, 'build_done', want)}
          label={row.build_task}
        />
      ),
    },
    {
      label: 'Solved',
      num: true,
      render: (row) => `${row.dsa_solved}/${row.dsa_day_target}`,
    },
  ];

  return (
    <>
      <section className="stack" aria-label="Week header">
        <div className="card">
          <div className="between">
            <div>
              {d.phase ? (
                <p className="card__label">
                  Phase {d.phase.code} {d.phase.name}
                </p>
              ) : null}
              <h2 className="page-head__title">
                Week {w.n}, {w.title}
              </h2>
              <p className="muted">{w.dates_label}</p>
            </div>
            <div className="row">
              {d.neighbours.prev ? (
                <ButtonLink href={`/weeks/${d.neighbours.prev}`}>Previous week</ButtonLink>
              ) : null}
              {d.neighbours.next ? (
                <ButtonLink href={`/weeks/${d.neighbours.next}`}>Next week</ButtonLink>
              ) : null}
              <ButtonLink href={`/print/week?week=${w.n}`}>Print</ButtonLink>
            </div>
          </div>
          {d.gate ? (
            <div className="callout callout--orange">
              <Icon path={ICON.gate} className="callout__icon" />
              <div className="callout__body">
                <p className="callout__title">
                  Gate {d.gate.no}, {d.gate.gate_date}
                </p>
                <p>{d.gate.condition_text}</p>
              </div>
            </div>
          ) : null}
        </div>

        <StatGrid
          stats={[
            { value: w.dsa_target, label: 'problems this week' },
            { value: w.dsa_cumulative, label: 'cumulative by the end of it' },
            {
              value: `${d.days.filter((x) => x.learn_done && x.build_done).length} of 6`,
              label: 'days finished in full',
            },
            { value: d.links.length, label: 'links for this week' },
          ]}
        />

        <Section title="Focus">
          <p className="measure">{w.focus}</p>
        </Section>
      </section>

      <section className="stack" aria-label="Week detail">
        <Section title="Learn">
          <ul>
            {d.learn.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </Section>

        <Section title="Build">
          <ul>
            {d.build.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </Section>

        <Section
          title="The six days"
          lede="One tick each for learn and build. Retroactive editing stops after 7 days."
        >
          <Table<DayRow>
            columns={columns}
            rows={d.days}
            rowKey={(row) => row.id}
            rowClass={() => 'daytable'}
            rowCurrent={(row) => row.cal_date === today}
          />
        </Section>

        <Section title="Ships at the end of this week">
          <ul>
            {d.ships.map((r) => (
              <li key={r.id}>{r.text}</li>
            ))}
          </ul>
        </Section>

        <Callout tone="red" title="The trap">
          <p>{d.trap ?? ''}</p>
        </Callout>

        <Callout tone="blue" title="Note">
          <p>{d.note ?? ''}</p>
        </Callout>

        <Section title={`Links for this week, ${d.links.length}`}>
          <div>
            {d.links.map((link) => (
              <LinkRow
                key={link.id}
                link={link}
                onStatus={(next, write) => setLinkStatus(link, next, write)}
              />
            ))}
          </div>
        </Section>

        {d.sunday ? (
          <Section title={`Sunday ${d.sunday.sunday_date}, ${d.sunday.type_text}`}>
            <p className="measure">{d.sunday.topic}</p>
          </Section>
        ) : null}
      </section>
    </>
  );
}

export default WeekDetailScreen;
