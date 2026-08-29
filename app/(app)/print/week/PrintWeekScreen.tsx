'use client';

/**
 * One week on one sheet of A4, for days without power.
 *
 * This serves the same Part 3 week data as the week detail screen, laid out for
 * paper rather than for a browser. Nothing here writes. A printed sheet cannot
 * tick a checkbox, so every box is drawn empty for a pen, and where a tick
 * already exists in the database it is stated in words beside the box instead of
 * being filled in. A sheet that came out of the printer already ticked would be
 * a sheet you cannot trust.
 *
 * The controls carry the no-print class, so the week picker, the navigation and
 * the print button all disappear when the sheet is printed and the paper starts
 * at the week itself.
 *
 * Two endpoints. GET /api/weeks fills the picker, because the option labels are
 * the real week titles and dates rather than bare numbers, and it is also how
 * the current week is found when the page is opened without ?week=. GET
 * /api/weeks/:n is the sheet.
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorCard, LoadingCard } from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { useResource } from '@/components/ui/useResource';
import { int, shortDate } from '@/lib/client/format';

const ICON_PRINT = 'M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8v-7Z';

interface WeekListRow {
  n: number;
  title: string;
  dates_label: string;
  is_current: boolean;
}

interface WeeksPayload {
  weeks: WeekListRow[];
}

interface DayRow {
  id: number;
  day_name: string;
  cal_date: string;
  dsa_day_target: number;
  learn_task: string;
  build_task: string;
  learn_done: boolean;
  build_done: boolean;
}

interface LinkRow {
  id: number;
  label: string;
  url: string;
  why: string | null;
  status: string;
}

interface ListRow {
  text: string;
}

interface SheetPayload {
  week: {
    n: number;
    title: string;
    dates_label: string;
    focus: string | null;
    dsa_target: number;
    dsa_cumulative: number;
  };
  phase: { code: string; name: string } | null;
  gate: { no: number; gate_date: string; condition_text: string } | null;
  sunday: {
    sunday_date: string;
    type_text: string;
    topic: string;
    kind: string;
    hours: number;
  } | null;
  learn: ListRow[];
  build: ListRow[];
  ships: ListRow[];
  trap: string | null;
  note: string | null;
  days: DayRow[];
  links: LinkRow[];
}

interface HandRow {
  day: string;
  solved: string;
  pushes: string;
  what: string;
}

/** An empty square to tick by hand. */
function TickBox() {
  return <span className="sheet__box" aria-hidden="true" />;
}

/**
 * A box, the text beside it, and a plain note when the item is already ticked in
 * the database. The words matter more than a colour, because a red or green fill
 * may not survive a monochrome printer.
 */
function BoxLine({ text, alreadyDone }: { text: ReactNode; alreadyDone?: boolean }) {
  return (
    <div className="row">
      <TickBox />
      <span className="grow">{text}</span>
      {alreadyDone ? <span className="text-xs muted">already ticked</span> : null}
    </div>
  );
}

function ListBlock({
  title,
  rows,
  emptyBody,
}: {
  title: string;
  rows: ListRow[];
  emptyBody: string;
}) {
  return (
    <div className="stack-sm">
      <h3>{title}</h3>
      {rows.length ? (
        <div className="stack-sm">
          {rows.map((r, i) => (
            <BoxLine text={r.text} key={`${title}-${i}`} />
          ))}
        </div>
      ) : (
        <EmptyState title={`Nothing listed under ${title.toLowerCase()}`} body={emptyBody} />
      )}
    </div>
  );
}

function TextBlock({
  title,
  body,
  fallback,
}: {
  title: string;
  body: string | null;
  fallback: string;
}) {
  return (
    <div className="stack-sm">
      <h3>{title}</h3>
      <p className="measure">{body ?? fallback}</p>
    </div>
  );
}

function LinksBlock({ links }: { links: LinkRow[] }) {
  if (!links.length) {
    return (
      <div className="stack-sm">
        <h3>Links for this week</h3>
        <EmptyState
          title="No links on this week"
          body="The 120 week links come from Part 8 of final.md. Run npm run setup."
        />
      </div>
    );
  }
  // The full address is printed as text, because a hyperlink is no use on paper.
  return (
    <div className="stack-sm">
      <h3>{`Links for this week, ${int(links.length)}`}</h3>
      <div className="stack-sm">
        {links.map((l) => (
          <div className="row" key={l.id}>
            <TickBox />
            <span className="grow">
              <span>{l.label}</span>
              <br />
              <span className="text-xs">{l.url}</span>
              {l.why ? <br /> : null}
              {l.why ? <span className="text-xs muted">{l.why}</span> : null}
            </span>
            <span className="text-xs muted">
              {l.status === 'done' ? 'done' : l.status === 'reading' ? 'reading' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SundayBlock({ sunday }: { sunday: SheetPayload['sunday'] }) {
  if (!sunday) {
    return (
      <div className="stack-sm">
        <h3>The Sunday</h3>
        <EmptyState
          title="No Sunday on this week"
          body="The 21 Sundays come from Part 3 of final.md. Run npm run setup."
        />
      </div>
    );
  }
  return (
    <div className="stack-sm">
      <h3>{`Sunday ${shortDate(sunday.sunday_date)}, ${sunday.type_text}`}</h3>
      <p className="measure">{sunday.topic}</p>
      {sunday.kind === 'rest' ? (
        <p className="text-sm">
          Rest Sunday. No code. No screens before noon. This is load bearing, and there is nothing
          on this sheet to tick.
        </p>
      ) : (
        <p className="text-sm">{`${sunday.hours} hours is what this Sunday asks for.`}</p>
      )}
    </div>
  );
}

const HAND_COLUMNS: Column<HandRow>[] = [
  { key: 'day', label: 'Day' },
  { key: 'solved', label: 'DSA solved', num: true },
  { key: 'pushes', label: 'Pushes', num: true },
  { key: 'what', label: 'What broke, and what shipped' },
];

const HAND_ROWS: HandRow[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
].map((day) => ({ day, solved: '', pushes: '', what: '' }));

function HandwritingBlock() {
  return (
    <div className="stack-sm">
      <h3>What actually happened</h3>
      <p className="text-sm muted">
        Written by hand, then typed into the tracker when the power is back.
      </p>
      <Table<HandRow> columns={HAND_COLUMNS} rows={HAND_ROWS} rowKey={(r) => r.day} />
    </div>
  );
}

function Sheet({ d }: { d: SheetPayload }) {
  const w = d.week;
  const days = d.days ?? [];

  const dayColumns: Column<DayRow>[] = [
    { key: 'day_name', label: 'Day' },
    { key: 'cal_date', label: 'Date', render: (r) => shortDate(r.cal_date) },
    { key: 'dsa_day_target', label: 'DSA', num: true },
    {
      label: 'Learn, 09:30 to 12:30',
      render: (r) => <BoxLine text={r.learn_task} alreadyDone={r.learn_done} />,
    },
    {
      label: 'Build, 14:00 to 16:00',
      render: (r) => <BoxLine text={r.build_task} alreadyDone={r.build_done} />,
    },
  ];

  return (
    <div className="pwwrap">
      <div className="sheet stack">
        <div className="sheet__head">
          <p className="card__label">
            {d.phase ? `Phase ${d.phase.code}, ${d.phase.name}` : 'Phase unknown'}
          </p>
          <h2 className="sheet__title">{`Week ${w.n} of 21 | ${w.title}`}</h2>
          <p>{w.dates_label}</p>
          <p className="text-sm">
            {`DSA this week ${int(w.dsa_target)}, cumulative by the end of it ${int(
              w.dsa_cumulative
            )}.`}
          </p>
          {d.gate ? (
            <p className="text-sm">
              {`Gate ${d.gate.no} falls on ${shortDate(d.gate.gate_date)}: ${d.gate.condition_text}`}
            </p>
          ) : null}
        </div>

        <TextBlock title="Focus" body={w.focus} fallback="No focus recorded for this week." />

        {days.length ? (
          <Table<DayRow>
            columns={dayColumns}
            rows={days}
            rowKey={(r) => r.id}
            caption="Six days. One tick for learn and one for build."
          />
        ) : (
          <EmptyState
            title="No days on this week"
            body="The six days come from Part 3 of final.md. Run npm run setup."
          />
        )}

        <ListBlock
          title="Learn"
          rows={d.learn ?? []}
          emptyBody="The learn list comes from Part 3 of final.md."
        />
        <ListBlock
          title="Build"
          rows={d.build ?? []}
          emptyBody="The build list comes from Part 3 of final.md."
        />
        <ListBlock
          title="Ships at the end of this week"
          rows={d.ships ?? []}
          emptyBody="The ships list comes from Part 3 of final.md."
        />
        <TextBlock
          title="The trap"
          body={d.trap}
          fallback="No trap is recorded for this week. That is unusual; check the seed."
        />
        <TextBlock title="Note" body={d.note} fallback="No note is recorded for this week." />
        <LinksBlock links={d.links ?? []} />
        <SundayBlock sunday={d.sunday ?? null} />
        <HandwritingBlock />
        <p className="text-xs muted">
          {`Printed from The Roadmap Tracker. Week ${w.n} of 21, ${w.dates_label}. Nothing on this sheet was written back to the database.`}
        </p>
      </div>
    </div>
  );
}

/** Reads ?week=, and keeps it in step with the picker so a reload stays put. */
function wantedWeek(raw: string | null): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 21 ? n : null;
}

export function PrintWeekScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const list = useResource<WeeksPayload>('/api/weeks');
  const weeks = list.data?.weeks ?? [];

  const asked = wantedWeek(params.get('week'));
  const current = asked ?? weeks.find((w) => w.is_current)?.n ?? 1;

  const sheet = useResource<SheetPayload>(weeks.length ? `/api/weeks/${current}` : null);

  if (list.error) {
    return (
      <>
        <section className="stack-sm" aria-label="Choose a week">
          <ErrorCard message={list.error} />
        </section>
        <section className="stack" aria-label="The sheet">
          <EmptyState
            title="The sheet did not load"
            body="Nothing here writes anything, so nothing was lost. Reload once the error above is dealt with."
          />
        </section>
      </>
    );
  }

  if (list.loading || !list.data) {
    return (
      <>
        <section className="stack-sm" aria-label="Choose a week">
          <LoadingCard text="Loading choose a week." />
        </section>
        <section className="stack" aria-label="The sheet">
          <LoadingCard text="Loading the sheet." />
        </section>
      </>
    );
  }

  if (!weeks.length) {
    return (
      <>
        <section className="stack-sm" aria-label="Choose a week">
          <EmptyState
            title="No weeks to print"
            body="The 21 weeks come from Part 3 of final.md. Run npm run setup."
          />
        </section>
        <section className="stack" aria-label="The sheet">
          <EmptyState
            title="Nothing to print"
            body="There is no week to lay out until the roadmap has been seeded."
          />
        </section>
      </>
    );
  }

  const pick = (next: number) => {
    if (next < 1 || next > weeks.length) return;
    router.replace(`/print/week?week=${next}`, { scroll: false });
  };

  const currentWeek = weeks.find((w) => w.is_current);

  return (
    <>
      {/* no-print is what removes this whole panel from the paper. */}
      <section className="stack-sm" aria-label="Choose a week">
        <div className="card stack-sm no-print">
          <div className="row">
            <label className="field grow" htmlFor="pw-week">
              <span className="field__label">Week</span>
              <select
                id="pw-week"
                className="select"
                aria-label="Which week to print"
                value={String(current)}
                onChange={(e) => pick(Number(e.target.value))}
              >
                {weeks.map((w) => (
                  <option value={String(w.n)} key={w.n}>
                    {`Week ${String(w.n).padStart(2, '0')}, ${w.title} (${w.dates_label})`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <button
              type="button"
              className="btn btn--sm"
              disabled={current <= 1}
              onClick={() => pick(current - 1)}
            >
              Previous week
            </button>
            <button
              type="button"
              className="btn btn--sm"
              disabled={current >= weeks.length}
              onClick={() => pick(current + 1)}
            >
              Next week
            </button>
            <button type="button" className="btn btn--primary" onClick={() => window.print()}>
              <Icon path={ICON_PRINT} />
              Print this sheet
            </button>
          </div>
          <p className="text-sm muted measure">
            {currentWeek
              ? `Today falls in week ${currentWeek.n}, ${currentWeek.title}. The sheet prints A4 portrait, one week to a page, and these controls do not print.`
              : 'Today is outside the 21 week window, so week 1 is shown unless you pick another. The sheet prints A4 portrait, one week to a page, and these controls do not print.'}
          </p>
          <Link className="btn btn--sm btn--ghost" href={`/weeks/${current}`}>
            Open this week on screen
          </Link>
        </div>
      </section>

      <section className="stack" aria-label="The sheet">
        {sheet.error ? (
          <ErrorCard message={sheet.error} />
        ) : sheet.loading || !sheet.data ? (
          <LoadingCard text={`Loading week ${current}.`} />
        ) : (
          <Sheet d={sheet.data} />
        )}
      </section>
    </>
  );
}

export default PrintWeekScreen;
