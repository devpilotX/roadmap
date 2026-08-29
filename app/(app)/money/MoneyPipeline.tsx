'use client';

/**
 * MoneyPipeline | the lead list, the seven lanes, and the two ways rows arrive.
 *
 * Part 17.6 asks for sixty leads a week, built inside the money hour. Typing
 * sixty rows into a web form is not that, which is why the CSV importer offers a
 * dry run first: an import that guesses wrong leaves rows on the list that then
 * have to be found and deleted by hand.
 */

import { useId, useState } from 'react';
import { optimistic } from '@/components/ui/useResource';
import { EmptyState, ErrorCard, Section, StatGrid } from '@/components/ui/Basics';
import { ChipFilter, Field, SearchBox } from '@/components/ui/Controls';
import { Table, type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/client/api';
import { int, shortDate } from '@/lib/client/format';
import {
  CSV_MAX_CHARS,
  LANES,
  LEAD_CSV_COLUMNS,
  laneLabel,
  type ImportReport,
  type Lead,
  type LeadsPayload,
  type MoneySummary,
} from './types';

/* ------------------------------------------------------------------ kanban */

/** A lead card that can be moved between lanes. The move is optimistic. */
function LeadCard({
  lead,
  onMove,
}: {
  lead: Lead;
  onMove: (lead: Lead, status: string) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="kancard stack-sm">
      <strong>{lead.name}</strong>
      <span className="text-xs muted">
        {[lead.category, lead.area].filter(Boolean).join(', ') || 'No category recorded'}
      </span>
      <span className="text-xs muted">
        {lead.next_touch_on ? `Next touch ${shortDate(lead.next_touch_on)}` : 'No follow up date'}
      </span>
      <span className="text-xs muted">{`${int(lead.touch_count ?? 0)} touches so far`}</span>
      <select
        className="select select--sm"
        aria-label={`Status of ${lead.name}`}
        value={lead.status}
        disabled={busy}
        onChange={async (e) => {
          const want = e.target.value;
          setBusy(true);
          try {
            await onMove(lead, want);
          } finally {
            setBusy(false);
          }
        }}
      >
        {LANES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Kanban({
  leads,
  onMove,
}: {
  leads: Lead[];
  onMove: (lead: Lead, status: string) => Promise<void>;
}) {
  if (!leads.length) {
    return (
      <EmptyState
        title="No leads match"
        body="Either the list is empty or the filters exclude everything. Clear the filters, or add the first lead with the form above. Part 17.6 asks for sixty leads a week built during the money hour, never during study."
      />
    );
  }

  return (
    <div className="kanban">
      {LANES.map((lane) => {
        const rows = leads.filter((l) =>
          l.status === lane.value || (lane.value === 'new' && !LANES.some((x) => x.value === l.status))
        );
        return (
          <div className="kancol" key={lane.value}>
            <div className="kancol__head">
              <span className="kancol__title">{lane.label}</span>
              <span className="kancol__count">{rows.length}</span>
            </div>
            <div className="kancol__list">
              {rows.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onMove={onMove} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- add a lead */

const EMPTY_LEAD = {
  name: '',
  category: '',
  area: '',
  phone: '',
  website: '',
  broken: false,
  notes: '',
};

/** The add lead form. Only the name is required, which is how a real list grows. */
function AddLeadForm({ onDone }: { onDone: () => Promise<void> }) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const [form, setForm] = useState(EMPTY_LEAD);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof EMPTY_LEAD>(key: K, value: (typeof EMPTY_LEAD)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <details className="acc">
      <summary className="acc__summary">Add a lead</summary>
      <div className="acc__body stack-sm">
        <div className="grid grid--3">
          <Field label="Name" htmlFor={`${uid}-name`}>
            <input
              id={`${uid}-name`}
              className="input"
              type="text"
              maxLength={200}
              placeholder="The business name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
            />
          </Field>
          <Field label="Category" htmlFor={`${uid}-category`}>
            <input
              id={`${uid}-category`}
              className="input"
              type="text"
              maxLength={120}
              placeholder="Dentist, gym, cafe"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
            />
          </Field>
          <Field label="Area" htmlFor={`${uid}-area`}>
            <input
              id={`${uid}-area`}
              className="input"
              type="text"
              maxLength={120}
              placeholder="The area"
              value={form.area}
              onChange={(e) => set('area', e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid--2">
          <Field label="Phone" htmlFor={`${uid}-phone`}>
            <input
              id={`${uid}-phone`}
              className="input"
              type="tel"
              maxLength={32}
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Website" htmlFor={`${uid}-website`}>
            <input
              id={`${uid}-website`}
              className="input"
              type="url"
              placeholder="https://their-site"
              value={form.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
        </div>
        <label className="tick">
          <input
            type="checkbox"
            className="tick__box"
            checked={form.broken}
            onChange={(e) => set('broken', e.target.checked)}
          />
          <span className="tick__body">
            <span className="tick__text">Their site is broken on mobile</span>
            <span className="tick__meta">That is the opening line, so it is worth recording.</span>
          </span>
        </label>
        <Field label="Notes" htmlFor={`${uid}-notes`}>
          <textarea
            id={`${uid}-notes`}
            className="textarea"
            rows={2}
            placeholder="Why they are worth a message."
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
        <div className="row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy}
            onClick={async () => {
              if (!form.name.trim()) {
                toastError('A lead needs a name. Everything else can wait.');
                return;
              }
              setBusy(true);
              try {
                await api.post('/api/leads', {
                  name: form.name.trim(),
                  category: form.category.trim() || null,
                  area: form.area.trim() || null,
                  phone: form.phone.trim() || null,
                  website: form.website.trim() || null,
                  mobile_broken: form.broken,
                  notes: form.notes.trim() || null,
                });
                toast(`${form.name.trim()} added.`, 'ok');
                setForm(EMPTY_LEAD);
                await onDone();
              } catch (err) {
                toastError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Add the lead
          </button>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------- the importer */

/**
 * Reads a chosen file as text. Blob.text() is used where the browser has it and
 * FileReader where it does not, because not every phone this runs on is current
 * and a file that will not open is ten minutes of the money hour lost.
 */
function readChosenFile(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () =>
      reject(new Error('That file could not be read. Open it and paste the rows instead.'));
    reader.readAsText(file);
  });
}

type ProblemRow = { reason: string };

const PROBLEM_COLUMNS: Column<ProblemRow>[] = [
  { key: 'reason', label: 'What the importer skipped, and why' },
];

/**
 * The report the importer sends back, drawn from the field names the handler
 * actually returns: read, written, skipped and problems on both runs, plus
 * would_write and sample on a dry run only. Nothing else is available, so
 * unknown columns are not counted here: the server ignores a column it does not
 * recognise and says nothing about it.
 */
function ImportReportView({ report }: { report: ImportReport }) {
  const dry = report.dry_run === true;
  const problems = report.problems ?? [];
  const written = Number(report.written ?? 0);
  const wouldWrite = Number(report.would_write ?? 0);
  const skipped = Number(report.skipped ?? 0);
  const sample = report.sample ?? [];

  return (
    <>
      <StatGrid
        stats={[
          { value: Number(report.read ?? 0), label: 'rows read, the header not counted', hero: true },
          dry
            ? {
                value: wouldWrite,
                label: 'rows that would be written',
                tone: wouldWrite ? 'blue' : undefined,
              }
            : { value: written, label: 'rows written', tone: written ? 'green' : undefined },
          {
            value: skipped,
            label: 'rows skipped, a duplicate or no name',
            tone: skipped ? 'orange' : undefined,
          },
          { value: problems.length, label: 'rows the importer had something to say about' },
        ]}
      />
      {dry ? (
        <p className="text-xs muted measure">
          Nothing was written. A dry run only spots names repeated inside the file, because the check
          against the leads already on your list happens during the real import, so the number above
          can still fall when you import.
        </p>
      ) : null}
      {dry && sample.length ? (
        <p className="text-xs muted measure">{`The first names it read: ${sample.join(', ')}.`}</p>
      ) : null}
      {problems.length ? (
        <Table
          columns={PROBLEM_COLUMNS}
          rows={problems.slice(0, 20).map((reason) => ({ reason: String(reason) }))}
          caption={
            problems.length > 20
              ? `The first 20 of ${int(problems.length)} rows the importer skipped, each with its reason`
              : `${int(problems.length)} skipped row${
                  problems.length === 1 ? '' : 's'
                }, each with its reason`
          }
        />
      ) : (
        <EmptyState
          title="No row was refused"
          body="Every row had a name and no name appeared twice, so the importer found nothing to skip."
        />
      )}
    </>
  );
}

/**
 * The CSV importer. Part 17.13 gives the first ten minutes of the money hour to
 * filling thirty rows, and the empty state on the touch list above already tells
 * the reader to import the sixty from a CSV, so the list is built in a
 * spreadsheet and pasted or uploaded here rather than typed in one lead at a
 * time. The check is offered first because an import that guesses wrong leaves
 * rows on the list that then have to be found and deleted by hand.
 */
function ImportLeadsForm({ onDone }: { onDone: () => Promise<void> }) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const [csv, setCsv] = useState('');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  /** Too long is refused here rather than at the server, which only sees a 400. */
  const tooLong = (text: string) => {
    if (text.length <= CSV_MAX_CHARS) return false;
    toastError(
      `That is ${int(text.length)} characters and the importer takes ${int(
        CSV_MAX_CHARS
      )}. Split the sheet and import it in two halves.`
    );
    return true;
  };

  async function run(dryRun: boolean) {
    const text = csv.trim();
    if (!text) {
      toastError('There is nothing to import. Paste the rows or choose a file first.');
      return;
    }
    if (tooLong(text)) return;

    setBusy(true);
    try {
      // queueable is turned off on purpose. The whole point of this call is the
      // report that comes back, which a queued replay would throw away, and a
      // dry run parked in the queue would return as a real write later on.
      const fresh = await api.post<ImportReport>(
        '/api/leads/import',
        { csv: text, dry_run: dryRun },
        { queueable: false }
      );
      setFailed(null);
      setReport(fresh);
      if (dryRun) {
        toast(
          `Checked. ${int(fresh.would_write ?? 0)} of ${int(fresh.read ?? 0)} rows would be written.`,
          'ok'
        );
      } else {
        toast(`${int(fresh.written ?? 0)} leads imported.`, 'ok');
        // The rows have to appear at once, so the leads and the strip are
        // re-fetched through the paths the rest of the screen already uses.
        await onDone();
      }
    } catch (err) {
      const message = (err as Error).message;
      setReport(null);
      setFailed(message);
      toastError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="acc">
      <summary className="acc__summary">Import leads from a CSV</summary>
      <div className="acc__body stack-sm">
        <p className="text-sm measure">
          Part 17.13 gives the first ten minutes of the hour to thirty rows, which is faster from a
          sheet than from this page one lead at a time.
        </p>

        <div className="card stack-sm">
          <p className="card__label">The header row the importer expects</p>
          <p className="text-xs mono measure">{LEAD_CSV_COLUMNS.join(',')}</p>
          <p className="text-xs muted measure">
            Only name is required and a row without one is skipped. Capitals and underscores are
            fine, because the header is lowercased and an underscore is read as a space. A column the
            importer does not know is ignored, so an export with extra columns still works.
          </p>
          <p className="text-xs muted measure">
            Mobile broken takes y, yes, true or 1. A status outside new, touched, replied, quoted,
            won, lost and dead is stored as new. The two dates have to be in the year-month-day form,
            as in 2026-08-28, or they are left empty. A rating outside 0 to 5 is left empty.
          </p>
        </div>

        <Field
          label="Choose a CSV file"
          htmlFor={`${uid}-file`}
          hint="The file is read on this device and dropped into the box below, where you can still edit it before importing."
        >
          <input
            id={`${uid}-file`}
            className="input"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const chosen = e.target.files?.[0];
              if (!chosen) return;
              try {
                const text = await readChosenFile(chosen);
                if (tooLong(text)) return;
                setCsv(text);
                toast(`${chosen.name} is in the box below. Check it before you import it.`, 'ok');
              } catch (err) {
                toastError((err as Error).message);
              }
            }}
          />
        </Field>

        <Field
          label="Or paste the rows"
          htmlFor={`${uid}-csv`}
          hint={
            csv.length
              ? `${int(csv.length)} characters of the ${int(CSV_MAX_CHARS)} the importer takes.`
              : undefined
          }
        >
          <textarea
            id={`${uid}-csv`}
            className="textarea"
            rows={8}
            placeholder="Paste the whole sheet here, the header row first."
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </Field>

        <div className="row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy}
            onClick={() => run(true)}
          >
            Check it first
          </button>
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => run(false)}>
            Import for real
          </button>
        </div>

        <p className="text-xs muted measure">
          Check it first writes nothing. Import for real adds every row it accepts and skips any name
          already on your list.
        </p>

        <div className="stack-sm">
          {failed ? <ErrorCard message={failed} /> : null}
          {!failed && report ? <ImportReportView report={report} /> : null}
          {!failed && !report ? (
            <EmptyState
              title="Nothing checked yet"
              body="Paste the rows or choose a file, then use Check it first. That reads the whole file and reports what it would do without writing a single lead."
            />
          ) : null}
        </div>
      </div>
    </details>
  );
}

/* -------------------------------------------------------------------- board */

export function MoneyPipeline({
  summary,
  leads,
  filters,
  onFilterChange,
  onQueryChange,
  query,
  onMove,
  onDone,
}: {
  summary: MoneySummary;
  leads: LeadsPayload;
  filters: { status: string; due: string };
  onFilterChange: (next: { status: string; due: string }) => void;
  onQueryChange: (value: string) => void;
  query: string;
  onMove: (lead: Lead, status: string) => Promise<void>;
  onDone: () => Promise<void>;
}) {
  const statusOptions: { value: string; label: string; count?: number }[] = [
    { value: '', label: 'Any status' },
    ...LANES.map((l) => ({
      value: l.value as string,
      label: l.label,
      count: summary.pipeline[l.value] ?? 0,
    })),
  ];

  const dueOptions = [
    { value: '', label: 'Any follow up' },
    { value: 'today', label: 'Due today' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'never', label: 'Never touched' },
  ];

  return (
    <Section
      title="The pipeline"
      lede="Move a lead with the select on its card. The move is written straight away and put back if the server refuses it."
    >
      <AddLeadForm onDone={onDone} />
      <ImportLeadsForm onDone={onDone} />

      <div className="filters">
        <SearchBox
          placeholder="Search a name, a category or an area"
          value={query}
          onChange={onQueryChange}
        />
        <ChipFilter
          options={statusOptions}
          current={filters.status}
          onChange={(v) => onFilterChange({ ...filters, status: v })}
        />
        <ChipFilter
          options={dueOptions}
          current={filters.due}
          onChange={(v) => onFilterChange({ ...filters, due: v })}
        />
      </div>

      <div className="stack">
        <Kanban leads={leads.leads ?? []} onMove={onMove} />
      </div>
    </Section>
  );
}

/** Exported so the screen can reuse the same optimistic move it always had. */
export async function moveLead({
  lead,
  status,
  setLeads,
  toast,
  toastError,
}: {
  lead: Lead;
  status: string;
  setLeads: (next: (prev: LeadsPayload | null) => LeadsPayload | null) => void;
  toast: (message: string, kind?: 'ok' | 'info' | 'warn' | 'error') => void;
  toastError: (message: string) => void;
}): Promise<void> {
  const previous = lead.status;
  if (status === previous) return;

  const paint = (next: string) =>
    setLeads((prev) =>
      prev
        ? {
            ...prev,
            leads: prev.leads.map((l) => (l.id === lead.id ? { ...l, status: next } : l)),
            next_15: prev.next_15.map((l) => (l.id === lead.id ? { ...l, status: next } : l)),
          }
        : prev
    );

  const ok = await optimistic({
    apply: () => paint(status),
    revert: () => paint(previous),
    write: async () => {
      await api.patch(`/api/leads/${lead.id}`, { status });
      return true;
    },
    onError: (err) => toastError(err.message),
  });
  if (ok) toast(`${lead.name} moved to ${laneLabel(status)}.`, 'ok');
}

export default MoneyPipeline;
