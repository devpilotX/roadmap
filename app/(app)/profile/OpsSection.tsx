'use client';

/**
 * The operational record, from GET /api/ops.
 *
 * Until this existed the panel above could link to the export routes but could not
 * say whether a backup had ever actually been taken. A link to an export is not a
 * backup and a script that has never run is not a safety net, so this block reads
 * the rows the scripts themselves wrote and says plainly when nothing has run.
 *
 * Nothing here runs anything. There is no endpoint that executes a script, which
 * is why the commands are printed rather than offered as buttons.
 */

import type { ReactNode } from 'react';
import { EmptyState, ErrorCard, LoadingCard, Section } from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { useResource } from '@/components/ui/useResource';
import { int, shortDate } from '@/lib/client/format';
import type { BackupRow, DeadLinkRow, OpsCommand, OpsPayload } from './types';

/** The command labels GET /api/ops returns, so a command is quoted rather than written here. */
const OPS_LABEL = {
  links: 'Check every link',
  dump: 'Back up the database',
  export: 'Export everything to disk',
  dsa: 'Import a DSA export',
};

function commandFor(commands: OpsCommand[] | undefined, label: string): string | null {
  const hit = (commands ?? []).find((c) => c.label === label);
  return hit ? hit.command : null;
}

/** A run command as a sentence, or an honest gap if the API did not report one. */
function runLine(commands: OpsCommand[] | undefined, label: string): string {
  const cmd = commandFor(commands, label);
  return cmd ? `Run ${cmd}.` : `The command for "${label}" was not in the list below.`;
}

/**
 * DATE and DATETIME arrive as strings because dateStrings is on in the pool, so
 * the first ten characters are the date. A Date object is still handled, because
 * one bad assumption here would throw inside a date formatter.
 */
function stampDay(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function whenLabel(value: unknown): string {
  const day = stampDay(value);
  return day ? shortDate(day) : 'at a time that was not recorded';
}

/** bytes is a BIGINT and nullable, so a missing size is said rather than shown as zero. */
function bytesLabel(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return 'size not recorded';
  const n = Number(bytes);
  if (!Number.isFinite(n)) return 'size not recorded';
  if (n < 1024) return `${int(n)} bytes`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** One backup line. `ok` is a flag on the row, so a failed run is not read as a backup. */
function BackupLine({
  what,
  row,
  neverText,
}: {
  what: string;
  row: BackupRow | null | undefined;
  neverText: string;
}) {
  if (!row) return <p className="measure">{neverText}</p>;
  const failed = Number(row.ok) !== 1;
  return (
    <div className="stack-sm">
      <p className="measure">
        {`The last ${what} ran on ${whenLabel(row.ran_at)}: ${row.file_name}, ${bytesLabel(
          row.bytes
        )}.`}
      </p>
      {failed ? (
        <p className="text-sm">
          {`That run is recorded as failed, so it is not a backup. ${
            row.message ?? 'No reason was recorded.'
          }`}
        </p>
      ) : null}
    </div>
  );
}

function BackupsBlock({
  backups,
  commands,
}: {
  backups: OpsPayload['backups'] | undefined;
  commands: OpsCommand[];
}) {
  return (
    <div className="stack-sm">
      <p className="card__label">Backups</p>
      <BackupLine
        what="database dump"
        row={backups?.last_dump}
        neverText={`No database dump has ever run. ${runLine(commands, OPS_LABEL.dump)}`}
      />
      <BackupLine
        what="export"
        row={backups?.last_export}
        neverText={`No export has ever run. ${runLine(commands, OPS_LABEL.export)}`}
      />
      {backups?.note ? <p className="text-sm muted measure">{backups.note}</p> : null}
    </div>
  );
}

/**
 * Dead links, from both lists the API returns. A dead link is flagged and kept,
 * never deleted, so this table is the list of things to replace rather than a
 * list of things that have gone.
 */
function deadLinkRows(linkCheck: OpsPayload['link_check'] | undefined): DeadLinkRow[] {
  return [
    ...(linkCheck?.dead_resources ?? []).map((r) => ({
      where: `Library, category ${r.category_no}, item ${r.ord}`,
      label: r.label,
      url: r.url,
      last_status: r.last_status,
      last_checked: r.last_checked,
    })),
    ...(linkCheck?.dead_week_links ?? []).map((r) => ({
      where: `Week ${r.week_n}, link ${r.ord}`,
      label: r.label,
      url: r.url,
      last_status: r.last_status,
      last_checked: r.last_checked,
    })),
  ];
}

const DEAD_COLUMNS: Column<DeadLinkRow>[] = [
  { key: 'where', label: 'Where' },
  { key: 'label', label: 'Link' },
  { key: 'url', label: 'Url', render: (r) => <span className="mono">{r.url}</span> },
  {
    key: 'last_status',
    label: 'Status',
    num: true,
    render: (r) =>
      r.last_status === null || r.last_status === undefined ? 'no answer' : String(r.last_status),
  },
  {
    key: 'last_checked',
    label: 'Last checked',
    render: (r) => {
      const day = stampDay(r.last_checked);
      return day ? shortDate(day) : 'not recorded';
    },
  },
];

function LinkCheckBlock({
  linkCheck,
  commands,
}: {
  linkCheck: OpsPayload['link_check'] | undefined;
  commands: OpsCommand[];
}) {
  const last = linkCheck?.last ?? null;
  const dead = deadLinkRows(linkCheck);
  const total = Number(linkCheck?.dead_total ?? 0);
  const heading = <p className="card__label">Link check</p>;

  if (!last) {
    return (
      <div className="stack-sm">
        {heading}
        <EmptyState
          title="The link check has never run"
          body={`No run is on record, so no url in the library or in the week links has been verified by this application. ${runLine(
            commands,
            OPS_LABEL.links
          )}`}
        />
        {linkCheck?.note ? <p className="text-sm muted measure">{linkCheck.note}</p> : null}
      </div>
    );
  }

  // finished_at is nullable: a run that was interrupted has a start and no end.
  const when = last.finished_at
    ? `finished on ${whenLabel(last.finished_at)}`
    : `started on ${whenLabel(last.started_at)} and has no finish time on record`;
  const runs = Number(linkCheck?.runs?.length ?? 0);

  return (
    <div className="stack-sm">
      {heading}
      <p className="measure">
        {`The last check ${when}. It checked ${int(last.checked_count)} urls and found ${int(
          last.dead_count
        )} dead. ${runs} run${runs === 1 ? '' : 's'} on record.`}
      </p>
      {last.notes ? <p className="text-sm muted measure">{last.notes}</p> : null}
      {total === 0 ? (
        <EmptyState
          title="Nothing is flagged as dead"
          body="No library resource and no week link carries a dead flag, so there is nothing on the replacement list."
        />
      ) : (
        <Table<DeadLinkRow>
          caption={`${total} dead link${total === 1 ? '' : 's'}, flagged and kept rather than deleted.`}
          columns={DEAD_COLUMNS}
          rows={dead}
          rowKey={(r, i) => `${r.where}-${i}`}
        />
      )}
      {linkCheck?.note ? <p className="text-sm muted measure">{linkCheck.note}</p> : null}
    </div>
  );
}

/**
 * The DSA import. dry_run defaults to 1 in the table, so a row is not evidence
 * that anything was written: the split is reported either way and the flag is
 * what decides whether /dsa has problem level data behind it.
 */
function DsaImportBlock({
  dsaImports,
  commands,
}: {
  dsaImports: OpsPayload['dsa_imports'] | undefined;
  commands: OpsCommand[];
}) {
  const last = dsaImports?.last ?? null;
  const rows = dsaImports?.rows ?? [];
  const real = rows.find((r) => Number(r.dry_run) !== 1) ?? null;
  const heading = <p className="card__label">DSA import</p>;

  if (!last) {
    return (
      <div className="stack-sm">
        {heading}
        <EmptyState
          title="No DSA import has ever run"
          body={`/dsa is still topic level: the 474 problem names are not on file, so there is nothing to tick problem by problem. ${runLine(
            commands,
            OPS_LABEL.dsa
          )}`}
        />
        {dsaImports?.note ? <p className="text-sm muted measure">{dsaImports.note}</p> : null}
      </div>
    );
  }

  return (
    <div className="stack-sm">
      {heading}
      <p className="measure">
        {`The last import ran on ${whenLabel(last.created_at)} from ${last.source_name}. ${int(
          last.rows_read
        )} rows read, ${int(last.rows_written)} written. Easy ${int(
          last.easy_count
        )}, medium ${int(last.medium_count)}, hard ${int(last.hard_count)}.`}
      </p>
      <p className="text-sm">
        {Number(last.dry_run) === 1
          ? 'That was a dry run, so it reported what it would do and wrote nothing.'
          : 'That was not a dry run, so those rows were written.'}
      </p>
      {real ? null : (
        <p className="measure">
          Every import on record is a dry run, so no problem has been written and /dsa is still topic
          level.
        </p>
      )}
      {dsaImports?.note ? <p className="text-sm muted measure">{dsaImports.note}</p> : null}
    </div>
  );
}

const COMMAND_COLUMNS: Column<OpsCommand>[] = [
  { key: 'label', label: 'What it does' },
  { key: 'command', label: 'What to run', render: (c) => <span className="mono">{c.command}</span> },
];

function CommandsBlock({ commands }: { commands: OpsCommand[] }) {
  return (
    <div className="stack-sm">
      <p className="card__label">The runbook</p>
      {commands.length ? (
        <Table<OpsCommand> columns={COMMAND_COLUMNS} rows={commands} rowKey={(c) => c.label} />
      ) : (
        <EmptyState
          title="No commands were reported"
          body="GET /api/ops returned an empty command list, so there is no runbook to show."
        />
      )}
    </div>
  );
}

export function OpsSection() {
  const { data, error, loading } = useResource<OpsPayload>('/api/ops');

  // The operational record is a second read and it sits below the export links.
  // It is fetched inside its own boundary because it is the one panel on this
  // screen that depends on rows a script may never have written, and a failure
  // there must not take the profile, the links and the password with it.
  let body: ReactNode;
  if (error) {
    body = <ErrorCard message={error} />;
  } else if (loading || !data) {
    body = <LoadingCard text="Loading what has actually run." />;
  } else {
    const commands = data.commands ?? [];
    body = (
      <Section
        title="What has actually run"
        lede="From GET /api/ops. Nothing on this screen runs a script: these are the commands to run yourself."
      >
        <p className="measure">
          These rows are written by the scripts themselves. If a script has never run, this says so
          rather than implying the work is covered.
        </p>
        <BackupsBlock backups={data.backups} commands={commands} />
        <LinkCheckBlock linkCheck={data.link_check} commands={commands} />
        <DsaImportBlock dsaImports={data.dsa_imports} commands={commands} />
        <CommandsBlock commands={commands} />
      </Section>
    );
  }

  return <div className="stack">{body}</div>;
}

export default OpsSection;
