'use client';

/**
 * TodayScreen | the screen that gets opened 150 times.
 *
 * One fetch of /api/today draws everything. Every control writes immediately,
 * optimistically, and rolls back with a toast on failure. No task string is
 * written in this file: every one comes from the database.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '@/lib/client/api';
import { optimistic, useDebounced, useResource } from '@/components/ui/useResource';
import {
  Badge,
  ButtonLink,
  Callout,
  ColourBadge,
  EmptyState,
  ErrorCard,
  ExternalLink,
  LoadingCard,
  PageHead,
} from '@/components/ui/Basics';
import { Field, NumberInput, Tick } from '@/components/ui/Controls';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { useTimer } from '@/components/TimerProvider';
import { int, rupees, shortDate } from '@/lib/client/format';

const ICON = {
  play: 'M8 5l11 7-11 7z',
  plus: 'M12 5v14M5 12h14',
  check: 'M4 12l5 5L20 6',
  cross: 'M12 8v5M12 16h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  warn: 'M12 3 2 20h20L12 3ZM12 9v5M12 17h.01',
};

/* ------------------------------------------------------------------ types */

interface TodayLink {
  id: number | null;
  kind: 'week_link' | 'resource';
  url: string;
  label: string;
  resource_id: number | null;
  why: string | null;
  cost: string | null;
  is_alive: boolean;
  last_checked: string | null;
  status: string;
}

interface BlockBase {
  label: string;
  window: string;
  tracked: boolean;
  is_current: boolean;
  is_past: boolean;
  is_future: boolean;
  task: string | null;
}

interface DsaBlock extends BlockBase {
  code: 'DSA';
  target: number;
  target_is_zero: boolean;
  target_note: string | null;
  solved_today: number;
  minutes: number;
  cumulative: number;
  cumulative_target: number | null;
  source: string;
  next_problem: {
    id: number;
    name: string;
    difficulty: string;
    url: string | null;
    topic: string;
  } | null;
  problems_imported: boolean;
  links: TodayLink[];
  done: boolean;
}

interface LearnBlock extends BlockBase {
  code: 'LEARN';
  week_day_id: number | null;
  done: boolean;
  minutes: number;
  minutes_target: number;
  links: TodayLink[];
  links_week: number;
  links_are_early: boolean;
  links_note: string | null;
  video_minutes: number;
  video_cap: number;
}

interface BuildBlock extends BlockBase {
  code: 'BUILD';
  week_day_id: number | null;
  done: boolean;
  minutes: number;
  minutes_target: number;
  pushes_today: number;
  project: {
    id: number;
    code: string;
    name: string;
    repo: string;
    status: string;
    live_url: string | null;
    repo_url: string | null;
  } | null;
}

interface CloseBlock extends BlockBase {
  code: 'CLOSE';
  done: boolean;
  log_line: string;
  tomorrow_dsa: string;
  tomorrow_build: string;
  can_complete: boolean;
}

interface BreakBlock extends BlockBase {
  code: 'BREAK';
}

interface Lead {
  id: number;
  name: string;
  category: string | null;
  area: string | null;
  phone: string | null;
  website: string | null;
  mobile_broken: number;
  rating: number | null;
  reviews: number | null;
  status: string;
  last_touch_on: string | null;
  next_touch_on: string | null;
}

interface MoneyBlock extends BlockBase {
  code: 'MONEY';
  done: boolean;
  minutes: number;
  touches_today: number;
  touch_target: number;
  touches: { id: number; lead_id: number; channel: string; name: string }[];
  next_leads: Lead[];
  received_this_week: number;
  care_plans: unknown[];
}

interface NightBlock extends BlockBase {
  code: 'NIGHT';
  anki_done: boolean;
  anki_overdue: number;
  spoken_done: boolean;
  spoken_aloud: boolean;
  tomorrow_done: boolean;
}

type Block =
  | DsaBlock
  | LearnBlock
  | BuildBlock
  | CloseBlock
  | BreakBlock
  | MoneyBlock
  | NightBlock;

interface ColourState {
  colour: string;
  met: number;
  total: number;
}

interface Condition {
  code: string;
  label: string;
  met: boolean;
  detail: string;
}

interface Header {
  date: string;
  date_long: string;
  day_label: string | null;
  kind: string;
  in_roadmap: boolean;
  day_number: number | null;
  total_days: number;
  week: {
    n: number;
    title: string;
    dates_label: string;
    focus: string;
    dsa_target: number;
    dsa_cumulative: number;
    gate_no: number | null;
  } | null;
  phase: { code: string; name: string; blurb: string } | null;
  next_gate: {
    no: number;
    gate_date: string;
    condition_text: string;
    days_remaining: number;
    passed: boolean;
  } | null;
  days_to_end: number;
  streak: number;
  longest_streak: number;
  started_on: string;
  not_started_yet: boolean;
  days_until_start: number;
  start_note: string | null;
}

interface DayLog {
  log_date: string;
  exists: boolean;
  dsa_solved: number;
  learn_minutes: number;
  build_minutes: number;
  money_minutes: number;
  video_minutes: number;
  anki_overdue: number;
  blocked_on: string;
  notes: string;
  day_colour: string;
}

interface Warning {
  code: string;
  level: string;
  title: string;
  message: string;
}

interface FailedProblem {
  problem_id: number;
  name: string;
  difficulty: string;
  url: string | null;
  topic: string;
  times_failed: number;
  notes: string | null;
}

interface Payload {
  header: Header;
  clock: {
    time: string;
    minutes: number;
    is_fake: boolean;
    current_block: string | null;
    next_block: string | null;
    next_block_label: string | null;
    next_block_window: string | null;
    minutes_to_next: number | null;
    countdown: string | null;
    minutes_to_tomorrow_first: number | null;
  };
  day: {
    cal_date: string;
    kind: string;
    day_label: string;
    dsa_target: number;
    learn_task: string;
    build_task: string;
    money_task: string;
  } | null;
  sunday: {
    week_n: number;
    kind: string;
    hours: number;
    type_text: string;
    topic: string;
    completed: boolean;
    hours_logged: number;
    notes: string;
  } | null;
  gate: {
    no: number;
    gate_date: string;
    condition_text: string;
    is_today: boolean;
    days_remaining: number;
    result: { passed: number; evidence_url: string | null; notes: string | null } | null;
  } | null;
  blocks: Block[];
  day_log: DayLog;
  conditions: {
    spec: unknown[];
    list: Condition[];
    met: number;
    total: number;
    colour: string;
  };
  failed_twice: FailedProblem[];
  warnings: Warning[];
  yesterday: {
    date: string;
    exists: boolean;
    line: string | null;
    colour: string | null;
    blocked_on?: string | null;
    dsa_solved?: number;
  };
  open_session: unknown;
}

/** Everything a block card needs to write. */
interface Ctx {
  date: string;
  writeDay: (
    patch: Record<string, unknown>,
    handlers: { apply: () => void; revert: () => void }
  ) => Promise<{ log: unknown; colour: ColourState | null } | null>;
  patchBlock: (code: string, patch: Record<string, unknown>) => void;
  applyColour: (colour: ColourState | null | undefined) => void;
  refresh: () => Promise<void>;
  toast: (message: string, kind?: 'ok' | 'info' | 'warn' | 'error') => void;
  toastError: (message: string) => void;
  openAndStart: (args: {
    url: string;
    block: string;
    resourceId?: number | null;
    weekLinkId?: number | null;
    label?: string;
  }) => Promise<unknown>;
  startSession: (args: { block: string; label?: string }) => Promise<unknown>;
}

/* ---------------------------------------------------------------- helpers */

/**
 * The live clock.
 *
 * The block windows are known on the client, so the countdown ticks every ten
 * seconds without a request. A refetch only happens when the block that owns the
 * current minute actually changes, or every five minutes as a floor, so the
 * screen is never stale and the server is never hammered.
 */
const WINDOWS: [string, number, number][] = [
  ['DSA', 390, 540],
  ['LEARN', 570, 750],
  ['BUILD', 840, 960],
  ['CLOSE', 960, 990],
  ['BREAK', 990, 1020],
  ['MONEY', 1020, 1080],
  ['NIGHT', 1260, 1440],
];

function localMinutes(): number {
  // The server clock decides what writes. This is only used to notice that a
  // boundary has passed and a refetch is worth making.
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.getHours() * 60 + ist.getMinutes();
}

function blockAt(minutes: number): string | null {
  const hit = WINDOWS.find(([, s, e]) => minutes >= s && minutes < e);
  return hit ? hit[0] : null;
}

function countdownAt(minutes: number): string | null {
  const upcoming = WINDOWS.filter(([, s]) => s > minutes).sort((a, b) => a[1] - b[1])[0];
  if (!upcoming) return null;
  const left = upcoming[1] - minutes;
  return left < 60 ? `${left} m` : `${Math.floor(left / 60)} h ${left % 60} m`;
}

/* ------------------------------------------------------- input primitives */

/** A number field that writes on change, debounced, and rolls back on refusal. */
function NumField({
  value,
  min,
  max,
  ariaLabel,
  onCommit,
  ms = 350,
  className = 'input input--sm input--num',
}: {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  onCommit: (value: number, revert: () => void) => void;
  ms?: number;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const base = useRef(value);
  useEffect(() => {
    setLocal(value);
    base.current = value;
  }, [value]);
  const commit = useDebounced((next: number) => {
    onCommit(next, () => setLocal(base.current));
  }, ms);

  return (
    <NumberInput
      value={local}
      min={min}
      max={max}
      label={ariaLabel}
      className={className}
      onChange={(next) => {
        setLocal(next);
        commit(next);
      }}
    />
  );
}

/** A text or textarea field that writes on change, debounced. */
function TextField({
  id,
  label,
  value,
  placeholder,
  multiline = false,
  onCommit,
  ms = 400,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onCommit: (value: string, revert: () => void) => void;
  ms?: number;
}) {
  const [local, setLocal] = useState(value);
  const base = useRef(value);
  useEffect(() => {
    setLocal(value);
    base.current = value;
  }, [value]);
  const commit = useDebounced((next: string) => {
    onCommit(next, () => setLocal(base.current));
  }, ms);

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
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="input"
          type="text"
          value={local}
          placeholder={placeholder}
          onChange={(e) => change(e.target.value)}
        />
      )}
    </Field>
  );
}

/** A button that cannot be pressed twice while its write is in flight. */
function PendingButton({
  className,
  onClick,
  children,
}: {
  className: string;
  onClick: () => Promise<unknown> | void;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------ minute rows */

const MINUTE_FIELD: Record<string, string> = {
  LEARN: 'learn_minutes',
  BUILD: 'build_minutes',
  DSA: 'dsa_minutes',
  MONEY: 'money_minutes',
};

function MinutesField({
  block,
  label,
  current,
  target,
  ctx,
}: {
  block: string;
  label: string;
  current: number;
  target: number | null;
  ctx: Ctx;
}) {
  return (
    <div className="row-tight">
      <NumField
        value={current ?? 0}
        min={0}
        max={1440}
        ariaLabel={`${label} minutes logged`}
        onCommit={(value, revert) => {
          const field = MINUTE_FIELD[block] ?? 'money_minutes';
          void ctx.writeDay({ [field]: value }, { apply: () => {}, revert });
        }}
      />
      <span className="text-xs muted">{target ? `of ${target} minutes` : 'minutes'}</span>
    </div>
  );
}

function VideoField({ b, ctx }: { b: LearnBlock; ctx: Ctx }) {
  const [local, setLocal] = useState(b.video_minutes ?? 0);
  useEffect(() => setLocal(b.video_minutes ?? 0), [b.video_minutes]);
  const commit = useDebounced((value: number) => {
    void ctx.writeDay({ video_minutes: value }, { apply: () => {}, revert: () => {} });
  }, 350);

  const over = local > b.video_cap;
  return (
    <div className="row-tight videorow">
      <span className="text-sm">Video minutes</span>
      <NumberInput
        value={local}
        min={0}
        max={600}
        label="Video minutes today"
        className="input input--sm input--num"
        onChange={(next) => {
          setLocal(next);
          commit(next);
        }}
      />
      <span className={over ? 'text-xs' : 'text-xs muted'}>
        {over
          ? `${local - b.video_cap} minutes over the cap. This came out of LEARN, it was not added on top.`
          : `Cap ${b.video_cap} minutes a day, taken from inside this block.`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ links */

function statusTone(status: string): 'green' | 'blue' | 'outline' {
  return status === 'done' ? 'green' : status === 'reading' ? 'blue' : 'outline';
}

function statusText(status: string): string {
  return status === 'done' ? 'Done' : status === 'reading' ? 'Reading' : 'Not started';
}

function LinkRow({ link, block, ctx }: { link: TodayLink; block: string; ctx: Ctx }) {
  const [status, setStatus] = useState(link.status);
  useEffect(() => setStatus(link.status), [link.status]);

  const mark = (next: string, text: string) => (
    <PendingButton
      className="btn btn--sm"
      onClick={async () => {
        try {
          const path = link.id
            ? `/api/week-links/${link.id}/progress`
            : `/api/resources/${link.resource_id}/progress`;
          await api.patch(path, { status: next });
          setStatus(next);
        } catch (err) {
          ctx.toastError((err as ApiError).message);
        }
      }}
    >
      {text}
    </PendingButton>
  );

  return (
    <div className="linkrow">
      <div className="linkrow__main">
        <div className="linkrow__title">
          <ExternalLink href={link.url}>{link.label}</ExternalLink>
          <Badge tone={statusTone(status)}>{statusText(status)}</Badge>
          {link.cost ? <Badge tone="outline">{link.cost}</Badge> : null}
          {link.is_alive === false ? <Badge tone="red">Link check failed</Badge> : null}
        </div>
        {link.why ? <p className="linkrow__why">{link.why}</p> : null}
      </div>
      <div className="linkrow__actions">
        <PendingButton
          className="btn btn--sm btn--start"
          onClick={async () => {
            await ctx.openAndStart({
              url: link.url,
              block,
              resourceId: link.resource_id ?? null,
              weekLinkId: link.id ?? null,
              label: link.label,
            });
            setStatus('reading');
          }}
        >
          <Icon path={ICON.play} />
          Open and start
        </PendingButton>
        {mark('reading', 'Reading')}
        {mark('done', 'Done')}
      </div>
    </div>
  );
}

/**
 * The links for a block. Open in the now card, collapsed in a compact card, so
 * every link on this screen is always one or two clicks away.
 */
function LinksBlock({
  code,
  links,
  note,
  open,
  title,
  ctx,
}: {
  code: string;
  links: TodayLink[];
  note: string | null;
  open: boolean;
  title: string;
  ctx: Ctx;
}) {
  if (!links?.length) return null;

  const list = (
    <div>
      {links.map((l) => (
        <LinkRow key={`${l.kind}-${l.id ?? l.resource_id}`} link={l} block={code} ctx={ctx} />
      ))}
    </div>
  );
  const noteNode = note ? <p className="text-xs muted">{note}</p> : null;

  if (open) {
    return (
      <div className="card__foot">
        <p className="card__label">{`${title}, ${links.length}`}</p>
        {noteNode}
        {list}
      </div>
    );
  }
  return (
    <details className="acc linkacc">
      <summary className="acc__summary">
        <Icon path={ICON.play} className="btn__icon" />
        {`${title}, ${links.length}`}
      </summary>
      <div className="acc__body">
        {noteNode}
        {list}
      </div>
    </details>
  );
}

/* ------------------------------------------------------------ block cards */

function DsaBody({ b, big, ctx }: { b: DsaBlock; big: boolean; ctx: Ctx }) {
  return (
    <>
      <p className="card__label">{`DSA  ${b.window}`}</p>
      <div className="row bigrow">
        <div className="stat">
          <span className="stat__value stat__value--lg">{int(b.solved_today)}</span>
          <span className="stat__label">
            {b.target_is_zero ? 'solved today, no target set for today' : `of ${b.target} today`}
          </span>
        </div>
        <div className="stat">
          <span className="stat__value">{int(b.cumulative)}</span>
          <span className="stat__label">
            {b.cumulative_target
              ? `of ${int(b.cumulative_target)} planned by the end of this week`
              : 'solved of 474 on the sheet'}
          </span>
        </div>
      </div>
      <p className={big ? 'tasktext tasktext--big' : 'tasktext'}>{b.task ?? ''}</p>
      {b.target_note ? <p className="text-xs muted">{b.target_note}</p> : null}

      {big ? (
        <>
          <div className="row">
            <PendingButton
              className="btn btn--primary"
              onClick={async () => {
                const before = b.solved_today;
                try {
                  if (b.problems_imported && b.next_problem) {
                    await api.patch(`/api/dsa/problems/${b.next_problem.id}/progress`, {
                      status: 'solved',
                    });
                  } else {
                    await api.put(`/api/day-logs/${ctx.date}`, { dsa_increment: 1 });
                  }
                  ctx.patchBlock('DSA', { solved_today: before + 1 });
                  await ctx.refresh();
                } catch (err) {
                  ctx.toastError((err as ApiError).message);
                }
              }}
            >
              <Icon path={ICON.plus} />
              Solved one more
            </PendingButton>
            <MinutesField block="DSA" label="DSA" current={b.minutes} target={null} ctx={ctx} />
          </div>

          {b.next_problem ? (
            <div className="card__foot">
              <p className="card__label">Next unsolved, in topic order</p>
              <div className="between">
                <div>
                  <strong>{b.next_problem.name}</strong>
                  <p className="text-sm muted">{`${b.next_problem.topic}, ${b.next_problem.difficulty}`}</p>
                </div>
                <button
                  type="button"
                  className="btn btn--start"
                  onClick={() =>
                    void ctx.openAndStart({
                      url:
                        b.next_problem?.url ||
                        'https://takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z',
                      block: 'DSA',
                      label: b.next_problem?.name,
                    })
                  }
                >
                  <Icon path={ICON.play} />
                  Open and start
                </button>
              </div>
            </div>
          ) : !b.problems_imported ? (
            <Callout tone="blue" title="Problem level import is pending">
              <p>
                final.md does not contain the 474 problem names and this app never invents one.
                Open the sheet below, solve, then count the day here. Import a real export to get
                per problem ticks.
              </p>
              <ButtonLink href="/dsa">Open the DSA tracker</ButtonLink>
            </Callout>
          ) : null}

          <LinksBlock
            code={b.code}
            links={b.links}
            note={null}
            open
            title="The DSA links from Part 7"
            ctx={ctx}
          />
        </>
      ) : (
        <LinksBlock
          code={b.code}
          links={b.links}
          note={null}
          open={false}
          title="The DSA links from Part 7"
          ctx={ctx}
        />
      )}
    </>
  );
}

function LearnBody({ b, big, ctx }: { b: LearnBlock; big: boolean; ctx: Ctx }) {
  const toggle = async (want: boolean) => {
    const apply = () => ctx.patchBlock('LEARN', { done: want });
    const revert = () => ctx.patchBlock('LEARN', { done: !want });
    if (!b.week_day_id) {
      await ctx.writeDay({ learn_done: want }, { apply, revert });
      return;
    }
    const d = await optimistic<{ colour: ColourState | null }>({
      apply,
      revert,
      write: () => api.patch(`/api/week-days/${b.week_day_id}/progress`, { learn_done: want }),
      onError: (err) => ctx.toastError(err.message),
    });
    if (d?.colour) ctx.applyColour(d.colour);
  };

  return (
    <>
      <p className="card__label">{`Learn  ${b.window}`}</p>
      <p className={big ? 'tasktext tasktext--big' : 'tasktext'}>
        {b.task ?? 'No learn task today.'}
      </p>
      {big ? (
        <>
          <Tick
            checked={b.done}
            onChange={(want) => void toggle(want)}
            label={`Learn done, ${b.minutes_target} minutes`}
          />
          <div className="row">
            <MinutesField
              block="LEARN"
              label="Learn"
              current={b.minutes}
              target={b.minutes_target}
              ctx={ctx}
            />
          </div>
          <VideoField b={b} ctx={ctx} />
          <LinksBlock
            code={b.code}
            links={b.links}
            note={b.links_note}
            open
            title={
              b.links_are_early ? `Week ${b.links_week} links, ready early` : "This week's links"
            }
            ctx={ctx}
          />
        </>
      ) : (
        <LinksBlock
          code={b.code}
          links={b.links}
          note={b.links_note}
          open={false}
          title={b.links_are_early ? `Week ${b.links_week} links` : "This week's links"}
          ctx={ctx}
        />
      )}
    </>
  );
}

function BuildBody({ b, big, ctx }: { b: BuildBlock; big: boolean; ctx: Ctx }) {
  const toggle = async (want: boolean) => {
    const apply = () => ctx.patchBlock('BUILD', { done: want });
    const revert = () => ctx.patchBlock('BUILD', { done: !want });
    if (!b.week_day_id) {
      await ctx.writeDay({ build_done: want }, { apply, revert });
      return;
    }
    const d = await optimistic<{ colour: ColourState | null }>({
      apply,
      revert,
      write: () => api.patch(`/api/week-days/${b.week_day_id}/progress`, { build_done: want }),
      onError: (err) => ctx.toastError(err.message),
    });
    if (d?.colour) ctx.applyColour(d.colour);
  };

  return (
    <>
      <p className="card__label">{`Build  ${b.window}`}</p>
      <p className={big ? 'tasktext tasktext--big' : 'tasktext'}>
        {b.task ?? 'No build task today.'}
      </p>
      {big ? (
        <>
          <Tick
            checked={b.done}
            onChange={(want) => void toggle(want)}
            label={`Build done, ${b.minutes_target} minutes, at least one push`}
          />
          <div className="row">
            <MinutesField
              block="BUILD"
              label="Build"
              current={b.minutes}
              target={b.minutes_target}
              ctx={ctx}
            />
            <Badge tone={b.pushes_today > 0 ? 'green' : 'red'}>
              {`${b.pushes_today} ${b.pushes_today === 1 ? 'commit' : 'commits'} pushed today`}
            </Badge>
          </div>
          {b.project ? (
            <div className="card__foot">
              <p className="card__label">The active project</p>
              <div className="between">
                <div>
                  <strong>{`${b.project.code}  ${b.project.name}`}</strong>
                  <p className="text-sm muted">{`Repository ${b.project.repo}`}</p>
                  {b.project.live_url ? (
                    <ExternalLink href={b.project.live_url} className="text-sm">
                      {b.project.live_url}
                    </ExternalLink>
                  ) : (
                    <p className="text-sm muted">
                      No live URL recorded yet. Deployed means a stranger opens the link and it
                      works.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--start"
                  onClick={() =>
                    void ctx.startSession({ block: 'BUILD', label: b.project?.name })
                  }
                >
                  <Icon path={ICON.play} />
                  Start a build session
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function CloseBody({ b, big, ctx }: { b: CloseBlock; big: boolean; ctx: Ctx }) {
  const write = (field: string) => async (value: string, revert: () => void) => {
    await ctx.writeDay({ [field]: value }, { apply: () => {}, revert });
    await ctx.refresh();
  };

  return (
    <>
      <p className="card__label">{`Close  ${b.window}`}</p>
      <p className="tasktext">{b.task}</p>
      {big ? (
        <>
          <TextField
            id="close-log"
            label="One log line for today"
            value={b.log_line}
            placeholder="What shipped, what blocked."
            multiline
            onCommit={write('close_log_line')}
          />
          <TextField
            id="close-dsa"
            label="Tomorrow's first DSA problem"
            value={b.tomorrow_dsa}
            placeholder="Name the problem."
            onCommit={write('close_tomorrow_dsa')}
          />
          <TextField
            id="close-build"
            label="Tomorrow's first build task"
            value={b.tomorrow_build}
            placeholder="Name the task."
            onCommit={write('close_tomorrow_build')}
          />
          <Tick
            checked={b.done}
            disabled={!b.can_complete && !b.done}
            label="Close done"
            meta={
              !b.can_complete && !b.done
                ? 'All three fields are needed. Tomorrow is decided before you stand up.'
                : undefined
            }
            onChange={(want) => {
              void ctx
                .writeDay(
                  { close_done: want },
                  {
                    apply: () => ctx.patchBlock('CLOSE', { done: want }),
                    revert: () => ctx.patchBlock('CLOSE', { done: !want }),
                  }
                )
                .catch(() => {});
            }}
          />
        </>
      ) : null}
    </>
  );
}

function BreakBody({ b }: { b: BreakBlock }) {
  return (
    <>
      <p className="card__label">{`Break  ${b.window}`}</p>
      <p className="tasktext">{b.task}</p>
    </>
  );
}

function MoneyBody({ b, big, ctx }: { b: MoneyBlock; big: boolean; ctx: Ctx }) {
  return (
    <>
      <p className="card__label">{`Money hour  ${b.window}`}</p>
      <p className={big ? 'tasktext tasktext--big' : 'tasktext'}>
        {b.task ?? 'No money task today.'}
      </p>
      <div className="row bigrow">
        <div className="stat">
          <span className="stat__value">{int(b.touches_today)}</span>
          <span className="stat__label">
            {b.touch_target ? `of ${b.touch_target} touches today` : 'touches today'}
          </span>
        </div>
        <div className="stat">
          <span className="stat__value">{rupees(b.received_this_week)}</span>
          <span className="stat__label">received this week</span>
        </div>
      </div>

      {big ? (
        <>
          <Tick
            checked={b.done}
            label="Money task done"
            onChange={(want) => {
              void ctx
                .writeDay(
                  { money_done: want },
                  {
                    apply: () => ctx.patchBlock('MONEY', { done: want }),
                    revert: () => ctx.patchBlock('MONEY', { done: !want }),
                  }
                )
                .catch(() => {});
            }}
          />
          <div className="row">
            <MinutesField block="MONEY" label="Money" current={b.minutes} target={60} ctx={ctx} />
          </div>

          {b.next_leads?.length ? (
            <div className="card__foot">
              <p className="card__label">{`The next ${b.next_leads.length} due`}</p>
              <div className="stack-sm">
                {b.next_leads.map((lead) => (
                  <div className="linkrow" key={lead.id}>
                    <div className="linkrow__main">
                      <div className="linkrow__title">
                        <span>{lead.name}</span>
                        {lead.mobile_broken ? (
                          <Badge tone="orange">Broken on mobile</Badge>
                        ) : null}
                      </div>
                      <p className="linkrow__why">
                        {[
                          lead.category,
                          lead.area,
                          lead.rating ? `${lead.rating} stars` : null,
                          lead.reviews ? `${lead.reviews} reviews` : null,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                    <div className="linkrow__actions">
                      {lead.phone ? (
                        <a className="btn btn--sm" href={`tel:${lead.phone}`}>
                          Call
                        </a>
                      ) : null}
                      {lead.phone ? (
                        <a
                          className="btn btn--sm"
                          href={`https://wa.me/${String(lead.phone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      <PendingButton
                        className="btn btn--sm btn--primary"
                        onClick={async () => {
                          try {
                            await api.post(`/api/leads/${lead.id}/touch`, {
                              channel: 'whatsapp',
                            });
                            ctx.toast(`Touch logged for ${lead.name}.`, 'ok');
                            void ctx.refresh();
                          } catch (err) {
                            ctx.toastError((err as ApiError).message);
                          }
                        }}
                      >
                        Log a touch
                      </PendingButton>
                    </div>
                  </div>
                ))}
              </div>
              <ButtonLink href="/money">Open the money hour</ButtonLink>
            </div>
          ) : (
            <div className="card__foot">
              <EmptyState
                title="There are no leads on the list yet"
                body="Part 17.13 says the first ten minutes are for filling 30 rows from Google Maps. Open the money hour and add them, or import a leads.csv."
              />
              <ButtonLink href="/money">Open the money hour</ButtonLink>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}

function NightBody({ b, big, ctx }: { b: NightBlock; big: boolean; ctx: Ctx }) {
  const flag = (field: string, key: keyof NightBlock) => (want: boolean) => {
    void ctx
      .writeDay(
        { [field]: want },
        {
          apply: () => ctx.patchBlock('NIGHT', { [key]: want }),
          revert: () => ctx.patchBlock('NIGHT', { [key]: !want }),
        }
      )
      .catch(() => {});
  };

  return (
    <>
      <p className="card__label">{`Night recall  ${b.window}`}</p>
      <p className="tasktext">{b.task}</p>
      {big ? (
        <>
          <Tick
            checked={b.anki_done}
            label="Anki at zero overdue"
            onChange={flag('night_anki_done', 'anki_done')}
          />
          <div className="row-tight">
            <span className="text-sm">Cards overdue</span>
            <NumField
              value={b.anki_overdue ?? 0}
              min={0}
              max={9999}
              ariaLabel="Anki cards overdue"
              onCommit={(value, revert) => {
                void ctx
                  .writeDay(
                    { anki_overdue: value, night_anki_done: value === 0 },
                    { apply: () => {}, revert }
                  )
                  .then(() => ctx.refresh());
              }}
            />
          </div>
          <Tick
            checked={b.spoken_done}
            label="Spoken explanation done"
            onChange={flag('night_spoken_done', 'spoken_done')}
          />
          <Tick
            checked={b.spoken_aloud}
            label="Spoken aloud, not read"
            meta="Four nights of six must be spoken, not read."
            onChange={(want) => {
              void ctx.writeDay(
                { night_spoken_aloud: want },
                {
                  apply: () => ctx.patchBlock('NIGHT', { spoken_aloud: want }),
                  revert: () => ctx.patchBlock('NIGHT', { spoken_aloud: !want }),
                }
              );
            }}
          />
          <Tick
            checked={b.tomorrow_done}
            label="Tomorrow decided"
            onChange={flag('night_tomorrow_done', 'tomorrow_done')}
          />
        </>
      ) : null}
    </>
  );
}

function BlockBody({ b, big, ctx }: { b: Block; big: boolean; ctx: Ctx }) {
  switch (b.code) {
    case 'DSA':
      return <DsaBody b={b} big={big} ctx={ctx} />;
    case 'LEARN':
      return <LearnBody b={b} big={big} ctx={ctx} />;
    case 'BUILD':
      return <BuildBody b={b} big={big} ctx={ctx} />;
    case 'CLOSE':
      return <CloseBody b={b} big={big} ctx={ctx} />;
    case 'BREAK':
      return <BreakBody b={b} />;
    case 'MONEY':
      return <MoneyBody b={b} big={big} ctx={ctx} />;
    default:
      return <NightBody b={b} big={big} ctx={ctx} />;
  }
}

function BlockCard({ b, big, ctx }: { b: Block; big: boolean; ctx: Ctx }) {
  const done = 'done' in b ? b.done : false;
  const classes = ['card'];
  if (big) classes.push('card--now');
  else if (b.is_past && b.tracked && !done) classes.push('card--missed');
  else if (done) classes.push('card--done');

  return (
    <div className={classes.join(' ')}>
      {big ? null : (
        <Badge tone="outline">
          {b.is_past ? 'Earlier today' : b.is_future ? 'Later today' : 'Now'}
        </Badge>
      )}
      <BlockBody b={b} big={big} ctx={ctx} />
    </div>
  );
}

/* ------------------------------------------------------------- rest Sunday */

/**
 * Shown on any day inside the 150 day window that falls before the day this
 * person actually starts.
 *
 * The window itself cannot move: final.md fixes all 150 dates and the four gate
 * dates, and the seed verifier enforces them. The start date can, and a day
 * before it is neutral rather than red, so the tracker does not open with a
 * failure that was never possible to avoid.
 */
function NotStartedCard({ h }: { h: Header }) {
  const days = Number(h.days_until_start ?? 0);
  return (
    <div className="card card--rest card--pad-lg">
      <p className="card__label">
        {h.day_label
          ? `${h.day_label}, day ${h.day_number} of ${h.total_days}`
          : 'Before the start'}
      </p>
      <h2 className="resttitle">{days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`}</h2>
      <p className="restbody">{h.start_note ?? ''}</p>
      <p className="muted measure">
        Today is neutral. It does not break a streak, it is not a red day, and no warning is raised
        about it. The 150 day window and the four gate dates come from final.md and do not move, so
        the days before your start simply do not count against you.
      </p>
      <div className="row">
        <ButtonLink href="/profile" className="btn btn--ghost btn--sm">
          Change the start date
        </ButtonLink>
        <ButtonLink href="/weeks" className="btn btn--ghost btn--sm">
          Read what week 1 asks for
        </ButtonLink>
        <ButtonLink href="/library" className="btn btn--ghost btn--sm">
          Open the library
        </ButtonLink>
      </div>
      <p className="text-xs muted">
        Nothing stops you starting early. Tick anything you do and the day is scored like any other.
      </p>
    </div>
  );
}

function RestSundayCard({ data, ctx }: { data: Payload; ctx: Ctx }) {
  const [notes, setNotes] = useState(data.day_log.notes ?? '');
  const commit = useDebounced((value: string) => {
    api
      .put(`/api/day-logs/${data.header.date}`, { notes: value })
      .catch((err: ApiError) => ctx.toastError(err.message));
  }, 500);

  return (
    <div className="card card--rest card--pad-lg">
      <p className="card__label">{`Week ${data.sunday?.week_n} Sunday`}</p>
      <h2 className="resttitle">Rest</h2>
      <p className="restbody">{data.sunday?.topic}</p>
      <p className="muted measure">
        The money hour is also rest today. No outreach, no delivery. A rest Sunday never breaks a
        streak and never counts as a green day. It is simply neutral.
      </p>
      <Field label="Note" htmlFor="rest-notes">
        <textarea
          id="rest-notes"
          className="textarea"
          value={notes}
          placeholder="A note, if you want one. Nothing else is tickable today."
          onChange={(e) => {
            setNotes(e.target.value);
            commit(e.target.value);
          }}
        />
      </Field>
    </div>
  );
}

function GateSundayCard({ data, ctx }: { data: Payload; ctx: Ctx }) {
  const gate = data.gate!;
  const [evidence, setEvidence] = useState(gate.result?.evidence_url ?? '');
  const passed = Number(gate.result?.passed ?? 0) === 1;

  return (
    <div className="card card--now">
      <p className="card__label">{`Gate audit Sunday, ${data.sunday?.type_text}`}</p>
      <h2 className="gatetitle">{`Gate ${gate.no}`}</h2>
      <p className="tasktext tasktext--big">{gate.condition_text}</p>
      <Field
        label="Evidence URL"
        htmlFor="gate-evidence"
        hint="A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is."
      >
        <input
          id="gate-evidence"
          className="input"
          type="url"
          placeholder="https://the live URL a stranger can open"
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
        />
      </Field>
      <Tick
        checked={passed}
        label={`Gate ${gate.no} passed`}
        onChange={async (want) => {
          try {
            await api.patch(`/api/gates/${gate.no}/result`, {
              passed: want,
              evidence_url: evidence || null,
            });
            ctx.toast(want ? `Gate ${gate.no} marked passed.` : `Gate ${gate.no} unmarked.`, 'ok');
            void ctx.refresh();
          } catch (err) {
            ctx.toastError((err as ApiError).message);
          }
        }}
      />
      <p className="muted text-sm">{data.sunday?.topic}</p>
    </div>
  );
}

/* ----------------------------------------------------------------- screen */

export function TodayScreen({ todayLong }: { todayLong: string }) {
  const { data, error, loading, refresh, setData } = useResource<Payload>('/api/today');
  const { toast, toastError } = useToast();
  const { openAndStart, startSession } = useTimer();

  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const hasData = useRef(false);
  const lastBlock = useRef<string | null>(null);
  const lastFetch = useRef(Date.now());
  const reportedError = useRef<string | null>(null);
  hasData.current = Boolean(data);

  /* ---- a later refresh failing is a toast, because the screen still holds
          the last good draw. The first one failing is not: it draws an error
          card, which a tracker opened 150 times must never replace with a
          permanent "Loading". ---- */
  useEffect(() => {
    if (!error || !data) return;
    if (reportedError.current === error) return;
    reportedError.current = error;
    toastError(`Today could not refresh: ${error}`);
  }, [error, data, toastError]);

  /* ---- live tracking ---- */
  useEffect(() => {
    lastBlock.current = blockAt(localMinutes());
    lastFetch.current = Date.now();

    const tick = () => {
      if (!hasData.current) return;
      const minutes = localMinutes();
      setNowMinutes(minutes);
      const nextBlock = blockAt(minutes);
      const boundaryCrossed = lastBlock.current !== null && nextBlock !== lastBlock.current;
      const stale = Date.now() - lastFetch.current > 5 * 60 * 1000;
      lastBlock.current = nextBlock;
      if (boundaryCrossed || stale) {
        lastFetch.current = Date.now();
        void refresh();
      }
    };

    const onStopped = () => void refresh();
    const onFlushed = () => void refresh();
    const onFocus = () => {
      lastFetch.current = Date.now();
      void refresh();
    };

    document.addEventListener('timer:stopped', onStopped);
    document.addEventListener('queue:flushed', onFlushed);
    window.addEventListener('focus', onFocus);
    const handle = window.setInterval(tick, 10000);

    return () => {
      document.removeEventListener('timer:stopped', onStopped);
      document.removeEventListener('queue:flushed', onFlushed);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(handle);
    };
  }, [refresh]);

  if (error && !data) {
    return (
      <>
        <PageHead
          title={todayLong}
          lede="Loading the day."
          actions={
            <div className="row">
              <ButtonLink href="/calendar">Calendar</ButtonLink>
              <ButtonLink href="/print/week">Print this week</ButtonLink>
            </div>
          }
        />
        <ErrorCard message={error} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <PageHead
          title={todayLong}
          lede="Loading the day."
          actions={
            <div className="row">
              <ButtonLink href="/calendar">Calendar</ButtonLink>
              <ButtonLink href="/print/week">Print this week</ButtonLink>
            </div>
          }
        />
        <LoadingCard text="Reading the clock and today's tasks." />
      </>
    );
  }

  const h = data.header;

  /* ------------------------------------------------------------- writers */

  const patchBlock = (code: string, patch: Record<string, unknown>) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            blocks: prev.blocks.map((b) => (b.code === code ? ({ ...b, ...patch } as Block) : b)),
          }
        : prev
    );
  };

  const applyColour = (colour: ColourState | null | undefined) => {
    if (!colour) return;
    setData((prev) =>
      prev
        ? {
            ...prev,
            conditions: {
              ...prev.conditions,
              colour: colour.colour ?? prev.conditions.colour,
              met: colour.met ?? prev.conditions.met,
              total: colour.total ?? prev.conditions.total,
            },
            day_log: { ...prev.day_log, day_colour: colour.colour ?? prev.day_log.day_colour },
          }
        : prev
    );
  };

  const writeDay = async (
    patch: Record<string, unknown>,
    handlers: { apply: () => void; revert: () => void }
  ) => {
    const result = await optimistic<{ log: unknown; colour: ColourState | null }>({
      apply: handlers.apply,
      revert: handlers.revert,
      write: () => api.put(`/api/day-logs/${h.date}`, patch),
      onError: (err) => toastError(err.message),
    });
    if (result?.log) {
      setData((prev) =>
        prev
          ? { ...prev, day_log: { ...prev.day_log, ...(result.log as object) } as DayLog }
          : prev
      );
    }
    if (result?.colour) applyColour(result.colour);
    return result;
  };

  const ctx: Ctx = {
    date: h.date,
    writeDay,
    patchBlock,
    applyColour,
    refresh,
    toast,
    toastError,
    openAndStart,
    startSession,
  };

  /* --------------------------------------------------------------- head */

  const weekLine = h.week
    ? `Week ${h.week.n}, ${h.week.dates_label}. ${h.week.title}`
    : h.in_roadmap
      ? 'Launch block. Three days before Week 1 starts on Monday 31 August.'
      : 'Outside the 150 day window.';

  const dsaBlock = data.blocks.find((b): b is DsaBlock => b.code === 'DSA');

  /* ------------------------------------------------------------- blocks */

  const isRestSunday = data.day?.kind === 'sunday_rest';
  const isGateSunday = data.day?.kind === 'sunday_gate' && Boolean(data.gate);
  const current = data.blocks.find((b) => b.is_current);

  const before: Block[] = [];
  const after: Block[] = [];
  let nowBlock: Block | null = null;

  if (!isRestSunday) {
    for (const b of data.blocks) {
      if (data.day?.kind?.startsWith('sunday_') && (b.code === 'BUILD' || b.code === 'CLOSE'))
        continue;
      if (!isGateSunday && b === current) nowBlock = b;
      else if (b.is_past) before.push(b);
      else after.push(b);
    }
  }

  // Outside every window the now card shows the next block and a countdown.
  const nextBlock = data.blocks.find((b) => b.code === data.clock.next_block);
  const countdown =
    nowMinutes !== null ? (countdownAt(nowMinutes) ?? data.clock.countdown) : data.clock.countdown;

  const conditionsCount = data.conditions.total
    ? `${data.conditions.met} of ${data.conditions.total} met. All ${data.conditions.total}, or the day is not green.`
    : 'All six, or the day is not green.';

  const y = data.yesterday;

  return (
    <>
      <PageHead
        title={h.date_long}
        lede={weekLine}
        actions={
          <div className="row">
            <ButtonLink href="/calendar">Calendar</ButtonLink>
            <ButtonLink href="/print/week">Print this week</ButtonLink>
          </div>
        }
      />

      <div className="todaystrip" aria-label="Where today sits in the roadmap">
        <div className="todaystrip__item">
          <span className="stat__value">{h.day_number ? int(h.day_number) : '-'}</span>
          <span className="stat__label">of 150 days</span>
        </div>
        <div className="todaystrip__item">
          <span className="stat__value">
            {h.week ? `W${String(h.week.n).padStart(2, '0')}` : 'Launch'}
          </span>
          <span className="stat__label">
            {h.phase ? `Phase ${h.phase.code} ${h.phase.name}` : 'Before Week 1'}
          </span>
        </div>
        <div className="todaystrip__item">
          <span className="stat__value">
            {h.next_gate ? int(h.next_gate.days_remaining) : '-'}
          </span>
          <span className="stat__label">
            {h.next_gate
              ? `to Gate ${h.next_gate.no}, ${shortDate(h.next_gate.gate_date)}`
              : 'no gate left'}
          </span>
        </div>
        <div className="todaystrip__item">
          <span className="stat__value">{int(h.days_to_end)}</span>
          <span className="stat__label">to 24 Jan 2027</span>
        </div>
        <div className="todaystrip__item">
          <span className="stat__value">{int(h.streak)}</span>
          <span className="stat__label">day streak</span>
        </div>
        <div className="todaystrip__item">
          <span className="stat__value">{int(dsaBlock?.cumulative ?? 0)}</span>
          <span className="stat__label">
            {`problems solved of ${int(h.week?.dsa_cumulative ?? 415)} planned by this week`}
          </span>
        </div>
      </div>

      {/* A rest Sunday replaces the whole screen, and so does a day before the
          start date, because on neither is there anything to tick. */}
      {h.not_started_yet ? (
        <div>
          <NotStartedCard h={h} />
        </div>
      ) : isRestSunday ? (
        <div>
          <RestSundayCard data={data} ctx={ctx} />
        </div>
      ) : (
        <div className="split">
          <div className="stack">
            <section className="stack-sm" aria-label="Earlier blocks">
              {before.map((b) => (
                <BlockCard key={b.code} b={b} big={false} ctx={ctx} />
              ))}
            </section>

            <section aria-label="The block you are in now">
              {isGateSunday ? <GateSundayCard data={data} ctx={ctx} /> : null}
              {nowBlock ? <BlockCard b={nowBlock} big ctx={ctx} /> : null}
              {!current && !isGateSunday ? (
                <div className="card card--now">
                  <p className="card__label">{`It is ${data.clock.time}. No block is open.`}</p>
                  {nextBlock ? (
                    <div className="stack-sm">
                      <div className="stat">
                        <span className="stat__value stat__value--lg">{countdown ?? ''}</span>
                        <span className="stat__label">
                          {`until ${nextBlock.label}, ${nextBlock.window}`}
                        </span>
                      </div>
                      <p className="tasktext">{nextBlock.task ?? ''}</p>
                    </div>
                  ) : (
                    <div className="stack-sm">
                      <p>
                        Every block for today is behind you. The day ends at 16:30 whether or not it
                        went well.
                      </p>
                      <ButtonLink href="/calendar" className="btn">
                        Look at tomorrow
                      </ButtonLink>
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <section className="stack-sm" aria-label="Later blocks">
              {after.map((b) => (
                <BlockCard key={b.code} b={b} big={false} ctx={ctx} />
              ))}
            </section>
          </div>

          <aside className="stack" aria-label="Today at a glance">
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Six conditions</h2>
                <span>
                  <ColourBadge colour={data.conditions.colour} />
                </span>
              </div>
              <p className="text-sm muted">{conditionsCount}</p>
              <ul className="condlist">
                {data.conditions.list.length ? (
                  data.conditions.list.map((c) => (
                    <li key={c.code} className={`cond ${c.met ? 'cond--met' : 'cond--unmet'}`}>
                      <Icon path={c.met ? ICON.check : ICON.cross} className="cond__icon" />
                      <div>
                        <span className="cond__label">{c.label}</span>
                        <span className="cond__detail">{c.detail}</span>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="muted text-sm">A rest Sunday has no conditions. It is neutral.</li>
                )}
              </ul>
            </div>

            {data.failed_twice.length ? (
              <div className="card">
                <div className="card__head">
                  <h2 className="card__title">Failed twice</h2>
                  <span className="badge badge--red">{data.failed_twice.length}</span>
                </div>
                <p className="text-sm muted">Each one stays here until it is solved cold.</p>
                <ul className="condlist">
                  {data.failed_twice.map((p) => (
                    <li key={p.problem_id} className="cond cond--unmet">
                      <Icon path={ICON.warn} className="cond__icon" />
                      <div>
                        <span className="cond__label">{p.name}</span>
                        <span className="cond__detail">{`${p.topic}, ${p.difficulty}`}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.warnings.length ? (
              <div className="card">
                <div className="card__head">
                  <h2 className="card__title">Active warnings</h2>
                </div>
                <div className="stack-sm">
                  {data.warnings.map((w) => (
                    <Callout
                      key={w.code}
                      tone={w.level === 'red' ? 'red' : 'orange'}
                      title={`${w.code}  ${w.title}`}
                    >
                      <p className="text-sm">{w.message}</p>
                    </Callout>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Yesterday</h2>
                <span>{y.colour ? <ColourBadge colour={y.colour} /> : null}</span>
              </div>
              <p className="text-sm muted">
                {y.exists
                  ? y.line || 'No log line was written yesterday.'
                  : `Nothing was logged on ${y.date}. Missed days stay visible. The pattern of misses is the most useful data you will collect.`}
              </p>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

export default TodayScreen;
