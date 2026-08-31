'use client';

/**
 * CalendarScreen | the calendar, the day drawer, and Open and start.
 *
 * Month grid, Monday first, six study columns plus a distinct Sunday column.
 * Clicking a cell opens a right side drawer, never a new page.
 * Keyboard: left and right move a day, t jumps to today, Esc closes the drawer.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/client/api';
import { useDebounced, useResource } from '@/components/ui/useResource';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  ExternalLink,
  LoadingCard,
  LoadingSections,
} from '@/components/ui/Basics';
import { ChipFilter, Field, Tick } from '@/components/ui/Controls';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { useTimer } from '@/components/TimerProvider';
import { addDays, int, longDate, minutesLabel, MONTHS, shortDate } from '@/lib/client/format';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  push: 'M12 19V5M5 12l7-7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
};

const DAY_HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The six tracked blocks, with the windows exactly as the table in final.md Part 1
 * states them and the start minute BLOCKS in lib/dates carries. The start minute
 * matters because a manual row is filed at the start of its own block: that is how
 * the server derives started_at, so it is also the time the window rules have to
 * be checked against here.
 */
const TRACKED_BLOCKS: { code: string; label: string; start: number }[] = [
  { code: 'DSA', label: 'DSA, 06:30 to 09:00', start: 6 * 60 + 30 },
  { code: 'LEARN', label: 'Learn, 09:30 to 12:30', start: 9 * 60 + 30 },
  { code: 'BUILD', label: 'Build, 14:00 to 16:00', start: 14 * 60 },
  { code: 'CLOSE', label: 'Close, 16:00 to 16:30', start: 16 * 60 },
  { code: 'MONEY', label: 'Money hour, 17:00 to 18:00', start: 17 * 60 },
  { code: 'NIGHT', label: 'Night recall, after 21:00', start: 21 * 60 },
];

type View = 'month' | 'week' | 'day';

/* ------------------------------------------------------------------ types */

interface CalDay {
  cal_date: string;
  week_n: number | null;
  day_label: string;
  kind: string;
  dsa_target: number;
  dsa_solved: number;
  day_colour: string | null;
  logged: boolean;
  pushes: number;
  commits: number;
  sunday_kind: string | null;
}

interface CalWeek {
  n: number;
  start_date: string;
  end_date: string;
  title: string;
  dates_label: string;
  phase_code: string;
  gate_no: number | null;
}

interface CalendarPayload {
  from: string;
  to: string;
  today: string;
  first_day: string;
  last_day: string;
  weeks: CalWeek[];
  days: CalDay[];
  streak: number;
}

interface DrawerLink {
  id: number;
  url: string;
  label: string;
  resource_id: number | null;
  why: string | null;
  cost: string | null;
  is_alive: boolean;
  last_checked: string | null;
  status: string;
  minutes: number;
}

interface DrawerPayload {
  day: {
    cal_date: string;
    week_n: number | null;
    day_label: string;
    kind: string;
    dsa_target: number;
    learn_task: string;
    build_task: string;
    money_task: string;
  };
  week: {
    n: number;
    title: string;
    dates_label: string;
    focus: string;
    phase_code: string;
    gate_no: number | null;
  } | null;
  week_day: {
    id: number;
    cal_date: string;
    week_n: number;
    learn_done: number;
    build_done: number;
  } | null;
  sunday: Record<string, unknown> | null;
  links: DrawerLink[];
  log: Record<string, unknown> | null;
  pushes: {
    repo: string;
    counts_to_target: number;
    commit_count: number;
    pushed_at: string;
    message_head: string | null;
    source: string;
  }[];
  sessions: {
    id: number;
    block: string;
    started_at: string;
    ended_at: string | null;
    minutes: number;
    source: string;
    auto_closed: number;
    resource_id: number | null;
    week_link_id: number | null;
  }[];
  editable: boolean;
  editable_reason: string | null;
}

/* ---------------------------------------------------------------- helpers */

/**
 * Everything inside `root` that a keyboard can land on. The same helper as the one
 * in components/AccountMenu.tsx, copied rather than shared because it is four
 * lines and importing a DOM helper out of a top bar popover to run the calendar
 * drawer would be the wrong dependency. The offsetParent test is what excludes the
 * buttons inside a collapsed `<details>`, which are in the markup but not reachable.
 */
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], select, input, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => el.offsetParent !== null);
}

/**
 * The two window rules blockAllowedAt applies in lib/dates, repeated here so the
 * form can quote the roadmap rather than let the server refuse the write with no
 * explanation. The server checks as well, and a database trigger checks after
 * that; this only gets there first. The MONEY wording is final.md Part 17.1
 * rule 1, quoted rather than paraphrased.
 */
function blockAllowedAt(code: string, minutes: number): { ok: boolean; message: string | null } {
  if (code === 'MONEY' && minutes < 16 * 60 + 30) {
    return {
      ok: false,
      message:
        'The money hour never borrows from study. If client work overruns, the client waits two days. The roadmap does not wait one hour.',
    };
  }
  if (['DSA', 'LEARN', 'BUILD', 'CLOSE'].includes(code) && minutes >= 17 * 60 && minutes < 18 * 60) {
    return {
      ok: false,
      message: 'A study block cannot be logged inside the money hour, 17:00 to 18:00.',
    };
  }
  return { ok: true, message: null };
}

function statusTone(status: string): 'green' | 'blue' | 'outline' {
  return status === 'done' ? 'green' : status === 'reading' ? 'blue' : 'outline';
}

function statusText(status: string): string {
  return status === 'done' ? 'Done' : status === 'reading' ? 'Reading' : 'Not started';
}

/* ------------------------------------------------------------------- cells */

function CalCell({
  day,
  today,
  weeks,
  onOpen,
}: {
  day: CalDay;
  today: string;
  weeks: CalWeek[];
  onOpen: (date: string) => void;
}) {
  const classes = ['calcell'];
  if (day.kind.startsWith('sunday_')) classes.push('calcell--sunday');
  if (day.kind === 'sunday_rest') classes.push('calcell--rest');
  if (day.kind === 'sunday_gate') classes.push('calcell--gate');
  if (day.kind === 'launch') classes.push('calcell--launch');
  if (day.cal_date === today) classes.push('calcell--today');
  if (day.cal_date > today) classes.push('calcell--future');

  const week = weeks.find((w) => w.n === day.week_n);
  const label =
    day.kind === 'launch'
      ? 'Launch'
      : day.kind === 'sunday_rest'
        ? 'Rest'
        : day.kind === 'sunday_gate'
          ? `Gate ${week?.gate_no ?? ''}`
          : day.kind === 'sunday_working'
            ? 'Working'
            : '';

  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-date={day.cal_date}
      aria-label={`${longDate(day.cal_date)}. ${label || 'Study day'}. DSA target ${
        day.dsa_target
      }, solved ${day.dsa_solved}. ${day.day_colour ?? 'not logged'}.`}
      onClick={() => onOpen(day.cal_date)}
    >
      <span className="calcell__top">
        <span className="calcell__date">{String(Number(day.cal_date.slice(8, 10)))}</span>
        <span className="calcell__week">
          {day.week_n ? `W${String(day.week_n).padStart(2, '0')}` : 'LNC'}
        </span>
      </span>
      <span className="calcell__mid">{label}</span>
      <span className="calcell__bottom">
        <span
          className={`calcell__dot calcell__dot--${day.day_colour ?? 'todo'}`}
          aria-hidden="true"
        />
        {day.pushes ? <Icon path={ICON.push} className="calcell__push" /> : null}
        <span className="calcell__dsa">{`${day.dsa_solved}/${day.dsa_target}`}</span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------- drawer fields */

/** A drawer field that saves on change, debounced, and says so. */
function DrawerField({
  id,
  label,
  value,
  multiline,
  disabled,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const commit = useDebounced((next: string) => onCommit(next), 400);
  const change = (next: string) => {
    setLocal(next);
    commit(next);
  };

  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <textarea
          id={id}
          className="textarea"
          value={local}
          disabled={disabled}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          value={local}
          disabled={disabled}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </Field>
  );
}

function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="drawer__section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function DrawerLinkRow({
  link,
  block,
  onError,
  onSaved,
}: {
  link: DrawerLink;
  block: string;
  onError: (message: string) => void;
  onSaved: (message: string) => void;
}) {
  const [status, setStatus] = useState(link.status);
  const [busy, setBusy] = useState(false);
  const { openAndStart } = useTimer();
  useEffect(() => setStatus(link.status), [link.status]);

  const mark = (next: string, text: string) => (
    <button
      type="button"
      className="btn btn--sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api.patch(`/api/week-links/${link.id}/progress`, { status: next });
          setStatus(next);
          onSaved(`Marked ${next}.`);
        } catch (err) {
          onError((err as ApiError).message);
        }
        setBusy(false);
      }}
    >
      {text}
    </button>
  );

  return (
    <div className="linkrow">
      <div className="linkrow__main">
        <div className="linkrow__title">
          <ExternalLink href={link.url}>{link.label}</ExternalLink>
          <Badge tone={statusTone(status)}>{statusText(status)}</Badge>
          {link.is_alive === false ? <Badge tone="red">Link check failed</Badge> : null}
        </div>
        {link.why ? <p className="linkrow__why">{link.why}</p> : null}
      </div>
      <div className="linkrow__actions">
        <button
          type="button"
          className="btn btn--sm btn--start"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await openAndStart({
              url: link.url,
              block,
              resourceId: link.resource_id,
              weekLinkId: link.id,
              label: link.label,
            });
            setStatus('reading');
            setBusy(false);
          }}
        >
          <Icon path={ICON.play} />
          Open and start
        </button>
        {mark('reading', 'Reading')}
        {mark('done', 'Done')}
      </div>
    </div>
  );
}

/** One of the two ticks for a day, kept honest with an immediate rollback. */
function DayTick({
  label,
  value,
  weekDayId,
  field,
  disabled,
  onSaved,
  onError,
}: {
  label: string;
  value: boolean;
  weekDayId: number;
  field: 'learn_done' | 'build_done';
  disabled: boolean;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [checked, setChecked] = useState(value);
  useEffect(() => setChecked(value), [value]);

  return (
    <Tick
      checked={checked}
      disabled={disabled}
      label={label}
      onChange={async (want) => {
        setChecked(want);
        try {
          await api.patch(`/api/week-days/${weekDayId}/progress`, { [field]: want });
          await onSaved();
        } catch (err) {
          setChecked(!want);
          onError((err as ApiError).message);
        }
      }}
    />
  );
}

/**
 * Manual session entry, which the daily API calls the fallback that always
 * exists. The timer is the normal way minutes get logged, but a timer nobody
 * started leaves the day at zero with no way to correct it, and this is that way.
 * It lives in the drawer because the drawer already knows its date, so
 * session_date is implied rather than typed, and the date is the one field a
 * person filing yesterday's hour would get wrong.
 */
function ManualSessionForm({
  date,
  editable,
  editableReason,
  onSaved,
}: {
  date: string;
  editable: boolean;
  editableReason: string | null;
  onSaved: () => Promise<void>;
}) {
  const { toast, toastError } = useToast();
  const [block, setBlock] = useState(TRACKED_BLOCKS[0].code);
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const refuse = (message: string) => {
    setError(message);
    toast(message, 'warn');
  };

  const save = async () => {
    setError('');

    // The seven day limit, as the server itself computed it for this date. Part
    // 18.7 rule 3: retroactive editing is limited to 7 days, history is not
    // rewritten, and a day cannot be logged before it happens. editable_reason is
    // the server's own sentence, so the two never disagree.
    if (!editable) {
      refuse(
        editableReason ?? 'Retroactive editing is limited to 7 days. History is not rewritten.'
      );
      return;
    }

    const chosen = TRACKED_BLOCKS.find((b) => b.code === block);
    const allowed = blockAllowedAt(block, chosen ? chosen.start : 0);
    if (!allowed.ok) {
      refuse(allowed.message!);
      return;
    }

    const mins = Number(minutes);
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) {
      refuse('Minutes must be a whole number from 1 to 600.');
      return;
    }

    setBusy(true);
    try {
      const created = await api.post<{ minutes: number; block: string; session_date: string }>(
        '/api/sessions/manual',
        {
          block,
          session_date: date,
          minutes: mins,
          note: note.trim() || null,
        }
      );
      // What the server actually stored, not what was typed, so a clamp or a trim
      // is visible rather than hidden.
      toast(
        `Logged ${minutesLabel(created.minutes)} of ${created.block} on ${shortDate(
          created.session_date
        )}.`,
        'ok'
      );
      // Nothing here was drawn ahead of the write, so the refresh is the first time
      // the new minutes appear anywhere. The whole drawer is rebuilt, which also
      // updates the DSA count and the cell's day colour.
      await onSaved();
    } catch (err) {
      // No optimistic change was applied, so there is nothing to revert: the drawer
      // still shows only the minutes the server holds.
      setError((err as ApiError).message);
      toastError((err as ApiError).message);
    }
    setBusy(false);
  };

  return (
    <details className="acc">
      <summary className="acc__summary">Log time you forgot to start the timer for</summary>
      <div className="acc__body stack-sm">
        <p className="text-xs muted">
          {`Filed against ${longDate(date)}, the day this drawer is showing.`}
        </p>

        <Field label="Block" htmlFor="ms-block">
          <select
            id="ms-block"
            className="select"
            aria-label="Which block these minutes belong to"
            value={block}
            onChange={(e) => setBlock(e.target.value)}
          >
            {TRACKED_BLOCKS.map((b) => (
              <option key={b.code} value={b.code}>
                {b.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Minutes" htmlFor="ms-minutes" hint="A whole number from 1 to 600.">
          <input
            id="ms-minutes"
            className="input input--num"
            type="number"
            min={1}
            max={600}
            step={1}
            inputMode="numeric"
            aria-label="Minutes, 1 to 600"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </Field>

        <Field
          label="Note, optional"
          htmlFor="ms-note"
          hint="Up to 255 characters, stored with the session."
        >
          <input
            id="ms-note"
            className="input"
            type="text"
            maxLength={255}
            aria-label="Note, optional"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {/* Both rules stated before the button rather than after the refusal,
            because the point is that the roadmap explains itself. */}
        <Callout tone="orange" title="Two rules this form will not let you break">
          <p>
            The money hour never borrows from study. If client work overruns, the client waits two
            days. The roadmap does not wait one hour.
          </p>
          <p>A study block cannot be logged inside the money hour, 17:00 to 18:00.</p>
          <p>Retroactive editing is limited to 7 days. History is not rewritten.</p>
        </Callout>

        {/* Present and empty by default, so the panel does not jump when a
            refusal appears. */}
        <p className="field__error" aria-live="polite" role={error ? 'alert' : undefined}>
          {error}
        </p>

        <div className="row">
          <button
            type="button"
            className="btn btn--sm btn--primary"
            disabled={busy}
            onClick={() => void save()}
          >
            Log these minutes
          </button>
        </div>

        {!editable ? <p className="text-xs muted">{editableReason ?? ''}</p> : null}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------ drawer */

function DrawerBody({
  date,
  data,
  error,
  loading,
  onSaved,
}: {
  date: string;
  data: DrawerPayload | null;
  error: string | null;
  loading: boolean;
  onSaved: () => Promise<void>;
}) {
  const { toast, toastError } = useToast();

  const saved = onSaved;

  if (error) return <ErrorCard message={error} />;
  if (loading || !data) return <LoadingCard />;

  const d = data;
  const isRest = d.day.kind === 'sunday_rest';

  const writeLog = (field: string) => async (value: string) => {
    try {
      await api.put(`/api/day-logs/${date}`, { [field]: value });
      toast('Saved.', 'ok');
    } catch (err) {
      toastError((err as ApiError).message);
    }
  };

  return (
    <>
      {isRest ? (
        <Callout tone="plain" title="Rest Sunday">
          <p>{d.day.learn_task}</p>
          <p>{d.day.money_task}</p>
        </Callout>
      ) : (
        <>
          <DrawerSection title="Learn, 09:30 to 12:30">
            <p className="measure">{d.day.learn_task}</p>
          </DrawerSection>
          <DrawerSection title="Build, 14:00 to 16:00">
            <p className="measure">{d.day.build_task}</p>
          </DrawerSection>
        </>
      )}

      <DrawerSection title="Money, 17:00 to 18:00">
        <p className="measure">{d.day.money_task}</p>
      </DrawerSection>

      <DrawerSection title="DSA">
        <div className="row bigrow">
          <div className="stat">
            <span className="stat__value">{int(Number(d.log?.dsa_solved ?? 0))}</span>
            <span className="stat__label">{`of ${d.day.dsa_target} target`}</span>
          </div>
          <div className="stat">
            <span className="stat__value">{minutesLabel(Number(d.log?.dsa_minutes ?? 0))}</span>
            <span className="stat__label">logged</span>
          </div>
        </div>
      </DrawerSection>

      {d.week_day ? (
        <DrawerSection title="The two ticks for this day">
          <DayTick
            label="Learn done"
            value={Number(d.week_day.learn_done) === 1}
            weekDayId={d.week_day.id}
            field="learn_done"
            disabled={!d.editable}
            onSaved={async () => {
              toast('Saved.', 'ok');
              await saved();
            }}
            onError={toastError}
          />
          <DayTick
            label="Build done"
            value={Number(d.week_day.build_done) === 1}
            weekDayId={d.week_day.id}
            field="build_done"
            disabled={!d.editable}
            onSaved={async () => {
              toast('Saved.', 'ok');
              await saved();
            }}
            onError={toastError}
          />
          {!d.editable ? <p className="text-xs muted">{d.editable_reason ?? ''}</p> : null}
        </DrawerSection>
      ) : null}

      {d.links.length ? (
        <DrawerSection title={`Every link for week ${d.week?.n ?? ''}, ${d.links.length}`}>
          <div>
            {d.links.map((l) => (
              <DrawerLinkRow
                key={l.id}
                link={l}
                block="LEARN"
                onError={toastError}
                onSaved={(m) => toast(m, 'ok')}
              />
            ))}
          </div>
        </DrawerSection>
      ) : null}

      {/* The log line, blockers and notes, editable inside the 7 day window. */}
      <DrawerSection title="The log for this day">
        <DrawerField
          id="dr-log"
          label="Log line"
          value={String(d.log?.close_log_line ?? '')}
          multiline
          disabled={!d.editable}
          onCommit={writeLog('close_log_line')}
        />
        <DrawerField
          id="dr-blocked"
          label="Blocked on"
          value={String(d.log?.blocked_on ?? '')}
          disabled={!d.editable}
          onCommit={writeLog('blocked_on')}
        />
        <DrawerField
          id="dr-notes"
          label="Notes"
          value={String(d.log?.notes ?? '')}
          multiline
          disabled={!d.editable}
          onCommit={writeLog('notes')}
        />
        {!d.editable ? (
          <Callout tone="orange">
            <p>{d.editable_reason ?? ''}</p>
          </Callout>
        ) : null}
      </DrawerSection>

      <DrawerSection title="Pushes on this date">
        {d.pushes.length ? (
          <div>
            {d.pushes.map((p, i) => (
              <div className="linkrow" key={`${p.repo}-${i}`}>
                <div className="linkrow__main">
                  <div className="linkrow__title">
                    <span>{p.repo}</span>
                    {Number(p.counts_to_target) === 1 ? null : (
                      <Badge tone="outline">Client, does not count</Badge>
                    )}
                  </div>
                  <p className="linkrow__why">{p.message_head ?? ''}</p>
                </div>
                <div className="linkrow__actions">
                  <Badge tone="green">{`${p.commit_count} commits`}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted text-sm">No push on this date.</p>
        )}
      </DrawerSection>

      <DrawerSection title="Sessions">
        {d.sessions.length ? (
          <div>
            {d.sessions.map((s) => (
              <div className="linkrow" key={s.id}>
                <div className="linkrow__main">
                  <div className="linkrow__title">
                    <span>{s.block}</span>
                    {Number(s.auto_closed) === 1 ? (
                      <Badge tone="orange">Auto closed at the end of the block</Badge>
                    ) : null}
                    {s.source === 'manual' ? <Badge tone="outline">Manual</Badge> : null}
                  </div>
                  <p className="linkrow__why">
                    {`${s.started_at} to ${s.ended_at ?? 'still running'}`}
                  </p>
                </div>
                <div className="linkrow__actions">
                  <Badge>{minutesLabel(s.minutes)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No session on this date"
            body="Nothing was timed on this day. If you worked and forgot to start the timer, log the minutes with the form below."
          />
        )}
        {/* Directly under the list it corrects, so the empty state above can
            point straight at it. */}
        <ManualSessionForm
          date={date}
          editable={d.editable}
          editableReason={d.editable_reason}
          onSaved={saved}
        />
      </DrawerSection>
    </>
  );
}

/* ----------------------------------------------------------------- screen */

export function CalendarScreen() {
  const params = useSearchParams();
  const wantedDate = params.get('date');
  const wantedView = params.get('view');

  const { data, error, loading, refresh } = useResource<CalendarPayload>('/api/calendar');
  const [view, setView] = useState<View>(
    wantedView === 'week' || wantedView === 'day' || wantedView === 'month' ? wantedView : 'month'
  );
  const [focusDate, setFocusDate] = useState<string | null>(null);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  // Whatever had focus when the drawer opened, so closing can hand it back. There
  // is no single trigger the way AccountMenu has one button: a cell, the Today
  // button and a linked ?date= all open the same drawer.
  const triggerRef = useRef<HTMLElement | null>(null);
  // Focus moves into the drawer when it opens, and only then. The open date changes
  // under the arrow keys, and re-focusing the panel on every one of those would
  // drag focus out of whatever field was being typed into.
  const wasOpen = useRef(false);
  const linkedOnce = useRef(false);

  // One fetch for the whole drawer, so its heading, its week line and its body
  // can never show two different days.
  const drawer = useResource<DrawerPayload>(openDate ? `/api/calendar/${openDate}` : null);

  const drawerSaved = async () => {
    await refresh();
    await drawer.refresh();
  };

  const openDrawer = (date: string) => {
    // Only on the way from closed to open. The scrim covers the grid while the
    // drawer is open, so this should not be reachable from inside it, but recording
    // an element that is about to be hidden as the place to return focus to would
    // lose focus to the body, and the guard costs nothing.
    if (!openDate) triggerRef.current = document.activeElement as HTMLElement | null;
    setOpenDate(date);
    setFocusDate(date);
  };

  /**
   * Closing hands focus back to whatever opened the drawer, which is the one half
   * of the pattern a click on the scrim has to skip: that person is already
   * pointing somewhere else, and pulling focus back to a calendar cell would fight
   * them for it.
   */
  const closeDrawer = useCallback(
    ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
      setOpenDate(null);
      if (restoreFocus) triggerRef.current?.focus();
    },
    []
  );

  // A date can be linked to directly, which is what the command palette does.
  useEffect(() => {
    if (!data || linkedOnce.current) return;
    linkedOnce.current = true;
    if (wantedDate && data.days.some((d) => d.cal_date === wantedDate)) {
      setFocusDate(wantedDate);
      setOpenDate(wantedDate);
    }
  }, [data, wantedDate]);

  useEffect(() => {
    const isOpen = openDate !== null;
    if (isOpen && !wasOpen.current) drawerRef.current?.focus();
    wasOpen.current = isOpen;
  }, [openDate]);

  /* ---- Escape, and Tab held inside the drawer, while it is open ---- */
  useEffect(() => {
    if (!openDate) return;

    const onKey = (event: KeyboardEvent) => {
      // Escape lives here rather than in the grid handler below, because that one
      // steps aside for a field and Escape has to work while a note is being typed.
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = drawerRef.current;
      if (!panel) return;
      const items = focusables(panel);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panel)) {
        // The panel itself is the shift case worth naming: it holds focus on open,
        // and it is the last element in the document, so Tab backwards out of it
        // would land on the page behind an aria-modal dialog.
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openDate, closeDrawer]);

  /* ---- keyboard ---- */
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.matches === 'function' && target.matches('input, textarea, select'))
        return;
      if (e.key === 't' || e.key === 'T') {
        // Opened from the keyboard, so record the return address the same way
        // openDrawer does, and only when it is actually an open: t pressed inside an
        // open drawer would otherwise file an element that is about to be hidden as
        // the place to send focus back to. This effect cannot call openDrawer
        // without re-binding the listener on every render.
        if (!openDate) triggerRef.current = document.activeElement as HTMLElement | null;
        setFocusDate(data.today);
        setOpenDate(data.today);
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const step = e.key === 'ArrowRight' ? 1 : -1;
        const from = focusDate ?? data.today;
        const to = addDays(from, step);
        if (!data.days.some((d) => d.cal_date === to)) return;
        e.preventDefault();
        setFocusDate(to);
        if (openDate) setOpenDate(to);
        document.querySelector(`.calcell[data-date="${to}"]`)?.scrollIntoView({ block: 'nearest' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [data, focusDate, openDate]);

  const changeView = async (next: View) => {
    setView(next);
    try {
      await api.patch('/api/me/settings', { calendar_view: next });
    } catch {
      // Remembering the view is a convenience, not a requirement.
    }
  };

  if (error && !data) return <ErrorCard message={error} />;
  if (loading || !data) {
    return (
      <LoadingSections
        sections={[
          // The controls card is the Suspense fallback in page.tsx, because this
          // component cannot render until useSearchParams resolves.
          { label: 'The month grid', text: 'Loading the month grid.', className: '' },
          { label: 'Calendar notes', text: 'Loading calendar notes.' },
        ]}
      />
    );
  }

  const today = data.today;
  const anchor = focusDate ?? today;

  /* ---- the grid ---- */

  let gridNodes: ReactNode = null;

  if (view === 'month') {
    const byMonth = new Map<string, CalDay[]>();
    for (const d of data.days) {
      const key = d.cal_date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key)!.push(d);
    }
    gridNodes = [...byMonth.entries()].map(([key, days]) => {
      const [y, m] = key.split('-').map(Number);
      const firstIdx = (new Date(`${days[0].cal_date}T00:00:00Z`).getUTCDay() + 6) % 7;
      return (
        <div className="calmonth" key={key}>
          <h2 className="calmonth__title">{`${MONTHS[m - 1]} ${y}`}</h2>
          <div className="calgrid">
            {DAY_HEADS.map((head, i) => (
              <div
                key={`${head}-${i}`}
                className={i === 6 ? 'calgrid__head calgrid__head--sunday' : 'calgrid__head'}
              >
                {head}
              </div>
            ))}
            {Array.from({ length: firstIdx }, (_, i) => (
              <div className="calcell calcell--empty" key={`empty-${i}`} />
            ))}
            {days.map((d) => (
              <CalCell
                key={d.cal_date}
                day={d}
                today={today}
                weeks={data.weeks}
                onOpen={openDrawer}
              />
            ))}
          </div>
        </div>
      );
    });
  } else if (view === 'week') {
    const day = data.days.find((d) => d.cal_date === anchor) ?? data.days[0];
    const week = data.weeks.find((w) => w.n === day.week_n);
    const from = week ? week.start_date : anchor;
    const to = week ? week.end_date : anchor;
    const days = data.days.filter((d) => d.cal_date >= from && d.cal_date <= to);
    gridNodes = (
      <>
        <h2 className="calmonth__title">
          {week ? `Week ${week.n}, ${week.dates_label}` : 'Launch block'}
        </h2>
        {week ? <p className="muted">{week.title}</p> : null}
        <div className="weekstrip">
          {days.map((d) => (
            <CalCell
              key={d.cal_date}
              day={d}
              today={today}
              weeks={data.weeks}
              onOpen={openDrawer}
            />
          ))}
        </div>
      </>
    );
  } else {
    const day = data.days.find((d) => d.cal_date === anchor);
    gridNodes = day ? (
      <>
        <h2 className="calmonth__title">{longDate(anchor)}</h2>
        <div className="weekstrip dayview">
          <CalCell day={day} today={today} weeks={data.weeks} onOpen={openDrawer} />
        </div>
      </>
    ) : (
      <EmptyState
        title="That day is outside the roadmap"
        body="The window runs 28 August 2026 to 24 January 2027."
      />
    );
  }

  return (
    <>
      <section className="stack-sm" aria-label="Calendar controls">
        <div className="card">
          <div className="between">
            <ChipFilter<View>
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week strip' },
                { value: 'day', label: 'Single day' },
              ]}
              current={view}
              onChange={(v) => void changeView(v)}
            />
            <div className="row">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => openDrawer(today)}
              >
                Today
              </button>
              <a className="btn btn--sm" href="/api/calendar.ics" download="roadmap-2026-2027.ics">
                Subscribe on your phone
              </a>
              <button type="button" className="btn btn--sm" onClick={() => window.print()}>
                Print
              </button>
            </div>
          </div>
          <p className="text-xs muted">
            Keyboard: <kbd>left</kbd> and <kbd>right</kbd> move a day, <kbd>t</kbd> jumps to today,{' '}
            <kbd>Esc</kbd> closes the drawer.
          </p>
        </div>
      </section>

      <section aria-label="The month grid">{gridNodes}</section>

      <section className="stack" aria-label="Calendar notes">
        <div className="card">
          <p className="card__label">How to read this</p>
          <ul>
            <li>Six study columns plus a distinct Sunday column, Monday first.</li>
            <li>
              A dashed cell is a rest Sunday. An outlined cell is a gate audit Sunday. A blue cell is
              a launch day.
            </li>
            <li>
              The dot is the day colour. The arrow means there was a push. The fraction is solved of
              target.
            </li>
            <li>Today keeps a permanent ring. Future days stay readable, not greyed out.</li>
          </ul>
        </div>
      </section>

      <div
        className="scrim"
        data-open={openDate ? '1' : '0'}
        onClick={() => closeDrawer({ restoreFocus: false })}
        aria-hidden="true"
      />
      {/* `hidden` is what makes a closed drawer genuinely closed. It was only ever
          translated off screen, so it stayed in the accessibility tree and in the
          tab order: a keyboard user tabbing past the calendar walked into an
          invisible panel of fields, and a screen reader announced a dialog nobody
          had opened. The trade is the 120 ms slide, which cannot run from
          display: none; correctness is worth more than the animation, and under
          prefers-reduced-motion there was no slide anyway. See .drawer[hidden] in
          screens.css, which is what stops .drawer's own display: flex overriding it. */}
      <aside
        className="drawer"
        data-open={openDate ? '1' : '0'}
        hidden={!openDate}
        role="dialog"
        aria-modal="true"
        aria-labelledby="c-drawer-title"
        tabIndex={-1}
        ref={drawerRef}
      >
        <div className="drawer__head">
          <div className="grow">
            <h2 className="drawer__title" id="c-drawer-title">
              {openDate ? longDate(openDate) : 'A day'}
            </h2>
            <p className="drawer__sub">
              {!openDate || drawer.loading || !drawer.data
                ? 'Loading'
                : drawer.data.week
                  ? `Week ${drawer.data.week.n}, ${drawer.data.week.dates_label}. ${drawer.data.week.title}`
                  : 'Launch block'}
            </p>
          </div>
          <button
            type="button"
            className="iconbtn"
            aria-label="Close the day"
            onClick={() => closeDrawer()}
          >
            <Icon path={ICON.close} />
          </button>
        </div>
        <div className="drawer__body">
          {openDate ? (
            <DrawerBody
              key={openDate}
              date={openDate}
              data={drawer.data}
              error={drawer.error}
              loading={drawer.loading}
              onSaved={drawerSaved}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}

export default CalendarScreen;
