'use client';

/**
 * pushes | Part 18.4, the push tracker.
 *
 * The one signal a recruiter can verify without talking to you, so it is the one
 * that is worth being strict about:
 *   - the target is six push days a week
 *   - a red banner at 48 hours with no push on a study week
 *   - the streak is cancelled at 72 hours, stated with the timestamp
 *   - client repositories never count, and are kept in their own collapsed list
 *   - the kind of a repository is set on this screen, because the kind is what
 *     decides whether it counts and a misfiled client repo quietly inflates the target
 *   - empty, backdated and padded commits are not tracked and not welcome. A push
 *     of more than twenty commits with no file changes is flagged, not counted.
 */

import { useCallback, useId, useMemo, useState, type ReactNode } from 'react';
import { useResource } from '@/components/ui/useResource';
import {
  Callout,
  EmptyState,
  ErrorCard,
  LoadingCard,
  Section,
  StatGrid,
} from '@/components/ui/Basics';
import { ContributionGrid, type GridCell } from '@/components/ui/Charts';
import { Field } from '@/components/ui/Controls';
import { Table, type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/client/api';
import { int } from '@/lib/client/format';

/* ------------------------------------------------------------------ shapes */

interface GridDay {
  date: string;
  pushes: number;
  commits: number;
  repos: string[];
  suspicious: boolean;
}

type RuleRow = { id: number; ord: number; rule: string; value: string };

interface SummaryRepo {
  id: number;
  full_name: string;
  kind: string;
  counts_to_target: boolean;
  commits: number;
  pushes: number;
  last_push: string | null;
}

interface PushesPayload {
  from: string;
  to: string;
  today: string;
  rules: RuleRow[];
  github_user: string | null;
  has_token: boolean;
  grid: GridDay[];
  repos: SummaryRepo[];
  current_run: number;
  longest_run: number;
  last_push: { repo: string; pushed_at: string; hours_since: number | null } | null;
  hours_since_last_push: number | null;
  red_banner: boolean;
  streak_cancelled: boolean;
  sync_state: {
    resource_key: string;
    last_status: number | null;
    last_run_at: string | null;
    mode: string | null;
    last_error: string | null;
  }[];
  flagged: number;
  /** From the stored sync state: the mode the last sync actually ran in. */
  last_sync_mode: string;
  /** Derived from whether a token is set, which is what mode_cost describes. */
  mode: string;
  mode_cost: string;
  week: {
    monday: string;
    sunday: string;
    push_days: number;
    target: number;
    commits: number;
  };
  week1: {
    repo: string;
    commits: number;
    target: number;
    window: string | null;
    applies: boolean;
  };
  honesty_line: string;
}

interface RegistryRepo {
  id: number;
  full_name: string;
  kind: string;
  counts_to_target: number;
  project_id: number | null;
}

interface RegistryPayload {
  repos: RegistryRepo[];
}

interface MergedRepo {
  id: number;
  full_name: string;
  kind: string;
  counts_to_target: boolean;
  project_id: number | null;
  commits: number;
  pushes: number;
  last_push: string | null;
}

interface SyncReport {
  repos_checked: number;
  pushes_written: number;
  not_modified: number;
  flagged: number;
  errors: string[];
  rate_limited: boolean;
}

/* ----------------------------------------------------------------- helpers */

function hoursText(h: number | null | undefined): string {
  if (h === null || h === undefined) return 'never';
  const n = Number(h);
  if (n < 1) return `${Math.round(n * 60)} minutes ago`;
  if (n < 48) return `${n.toFixed(1)} hours ago`;
  return `${Math.floor(n / 24)} days ago`;
}

/** Commit count to a heat level. Four levels, so the grid reads at a glance. */
function levelFor(info: GridCell | undefined): string {
  if (!info || !info.commits) return '';
  if (info.suspicious) return 'heatcell--flag';
  if (info.commits >= 10) return 'heatcell--l4';
  if (info.commits >= 5) return 'heatcell--l3';
  if (info.commits >= 2) return 'heatcell--l2';
  return 'heatcell--l1';
}

/**
 * The four kinds the API accepts, taken from the zod enum on /api/repos.
 * counts_to_target is deliberately absent: the server derives it from the kind,
 * so it is never sent and only ever displayed.
 */
const REPO_KINDS = [
  { value: 'project', label: 'Project' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'client', label: 'Client' },
  { value: 'other', label: 'Other' },
];

/**
 * The registry from GET /api/repos joined to the push counts from GET /api/pushes.
 *
 * Both read github_repos, but only /api/repos runs ensureRepos, which registers
 * the four project repositories and the tracker repository named in Part 18.4.
 * Reading the summary alone leaves a new account with an empty list until the
 * first sync, which is why the registry is the base and the counts are joined on.
 */
function mergeRepos(registry: RegistryRepo[], summaryRepos: SummaryRepo[]): MergedRepo[] {
  const counted = new Map((summaryRepos ?? []).map((r) => [Number(r.id), r]));
  return (registry ?? [])
    .map((r) => {
      const c = counted.get(Number(r.id));
      return {
        id: r.id,
        full_name: r.full_name,
        kind: r.kind,
        project_id: r.project_id,
        counts_to_target: Number(r.counts_to_target) === 1,
        commits: Number(c?.commits ?? 0),
        pushes: Number(c?.pushes ?? 0),
        last_push: c?.last_push ?? null,
      };
    })
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

/* ------------------------------------------------------------------ banners */

function Banners({ d }: { d: PushesPayload }) {
  const out: ReactNode[] = [];

  if (d.streak_cancelled) {
    out.push(
      <Callout key="cancelled" tone="red" title="The streak is cancelled">
        <p>
          {`72 hours have gone by with no push. The last push was ${
            d.last_push ? `to ${d.last_push.repo} at ${d.last_push.pushed_at}` : 'never recorded'
          }. Every other box being ticked does not change this.`}
        </p>
      </Callout>
    );
  } else if (d.red_banner) {
    out.push(
      <Callout key="red" tone="red" title="48 hours with no push">
        <p>
          {d.last_push
            ? `The last push was to ${d.last_push.repo}, ${hoursText(
                d.hours_since_last_push
              )}. At 72 hours the streak is cancelled.`
            : 'There is no push on record at all. At 72 hours the streak is cancelled.'}
        </p>
      </Callout>
    );
  }

  if (!d.github_user) {
    out.push(
      <Callout key="nouser" tone="orange" title="No GitHub username is set">
        <p>Add it on Profile and the sync can run. Manual entry below works either way.</p>
      </Callout>
    );
  }

  if (d.flagged) {
    out.push(
      <Callout
        key="flagged"
        tone="orange"
        title={`${d.flagged} push${d.flagged === 1 ? '' : 'es'} flagged, not counted`}
      >
        <p>{d.honesty_line}</p>
      </Callout>
    );
  }

  if (d.week1?.applies) {
    const w1 = d.week1;
    out.push(
      <Callout
        key="week1"
        tone={w1.commits >= w1.target ? 'green' : 'blue'}
        title={`Week 1: ${int(w1.commits)} of ${w1.target} commits`}
      >
        <p>{`On ${w1.repo}, over ${w1.window}. Week 1 is counted in commits, not in push days.`}</p>
      </Callout>
    );
  }

  if (!out.length) return <p className="text-sm muted">No push warnings. Keep it that way.</p>;
  return <>{out}</>;
}

/* ------------------------------------------------------------------- repos */

/**
 * One repository, with the kind editable in place.
 *
 * The select is the whole write: PATCH /api/repos/:id takes a kind and nothing
 * else. The badge beside it is not moved until the response arrives, because
 * counts_to_target is recomputed on the server and a badge that guessed would be
 * claiming an outcome this screen does not decide.
 */
function RepoRow({ r, onReclassified }: { r: MergedRepo; onReclassified: () => Promise<void> }) {
  const { toast, toastError } = useToast();
  const [kind, setKind] = useState(r.kind);
  const [counts, setCounts] = useState(r.counts_to_target);
  const [busy, setBusy] = useState(false);

  return (
    <div className={`repolist__row ${kind === 'client' ? 'repolist__row--client' : ''}`}>
      <div className="stack-sm">
        <span className="mono">{r.full_name}</span>
        <span className="text-xs muted">
          {r.last_push ? `last push ${r.last_push}` : 'no push recorded'}
        </span>
      </div>
      <select
        className="select select--sm"
        aria-label={`Kind of repository ${r.full_name}`}
        value={kind}
        disabled={busy}
        onChange={async (e) => {
          const before = kind;
          const beforeCounts = counts;
          const want = e.target.value;
          setKind(want);
          setBusy(true);
          try {
            const fresh = await api.patch<{
              full_name: string;
              kind: string;
              counts_to_target: number;
            }>(`/api/repos/${r.id}`, { kind: want });
            const nowCounts = Number(fresh.counts_to_target) === 1;
            setKind(fresh.kind);
            setCounts(nowCounts);
            toast(
              `${fresh.full_name} is now ${fresh.kind}, so it ${
                nowCounts ? 'counts' : 'does not count'
              } towards the push target. Every day in the window was recomputed.`
            );
            // The handler recomputes the whole 150 day window, so the grid and
            // the week counter above are stale the moment this lands. They are
            // redrawn from the server rather than patched by hand.
            await onReclassified();
          } catch (err) {
            // Explicit revert. The select is the only thing that moved, so
            // putting it back is enough to stop the row looking reclassified
            // when it is not.
            setKind(before);
            setCounts(beforeCounts);
            toastError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {REPO_KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </select>
      <span className="num text-sm">{`${int(r.pushes)} pushes`}</span>
      <span className={`badge ${counts ? 'badge--green' : 'badge--outline'}`}>
        {`${int(r.commits)} commits, ${counts ? 'counts' : 'does not count'}`}
      </span>
    </div>
  );
}

/**
 * Adding a repository, and the rule that makes the kind worth setting.
 *
 * Part 18.4 lists the repositories that count as "itc-reclaim, itc-reclaim-api,
 * itc-reclaim-ops, tender-fit, and the tracker repository", and client work
 * repositories as "Tracked separately, they never count towards the study
 * target". The kind carries that distinction, which is why it is the one field
 * on the form and the one field on every row.
 */
function RepoAdmin({
  weeklyTarget,
  onDone,
}: {
  weeklyTarget: number;
  onDone: () => Promise<void>;
}) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const [fullName, setFullName] = useState('');
  const [kind, setKind] = useState('project');
  const [busy, setBusy] = useState(false);

  return (
    <Section
      title="Add a repository"
      lede="The kind is the only field. Everything else about a repository is either synced or derived."
    >
      <form
        className="stack-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          const name = fullName.trim();
          if (!name) {
            toastError('A repository needs a name before it can be added.');
            return;
          }
          setBusy(true);
          try {
            const row = await api.post<{
              full_name: string;
              kind: string;
              counts_to_target: number;
            }>('/api/repos', { full_name: name, kind });
            toast(
              `${row.full_name} added as ${row.kind}, which ${
                Number(row.counts_to_target) === 1 ? 'counts' : 'does not count'
              } towards the push target.`
            );
            setFullName('');
            await onDone();
          } catch (err) {
            toastError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid grid--2">
          <Field
            label="Repository"
            htmlFor={`${uid}-name`}
            hint="A bare name is read as your own account. A name with a slash in it is used exactly as written."
          >
            <input
              id={`${uid}-name`}
              className="input"
              type="text"
              maxLength={200}
              placeholder="owner/name, or just the name"
              aria-label="Repository full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field
            label="Kind"
            htmlFor={`${uid}-kind`}
            hint="Project and tracker count. Client and other do not."
          >
            <select
              id={`${uid}-kind`}
              className="select select--sm"
              aria-label="Kind of the new repository"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {REPO_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="between">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Add the repository
          </button>
          <span className="text-xs muted">
            A name already on the list has its kind changed rather than being added twice. To
            reclassify a repository that already has pushes, use the select on its row instead.
          </span>
        </div>
      </form>

      <Callout tone="blue" title="What the kind decides">
        <p className="measure">
          {`Project and tracker repositories count towards the ${weeklyTarget} push days a week. Client and other never do. Part 18.4 puts client work repositories under "Tracked separately, they never count towards the study target", and that is the whole reason this field exists. You set the kind and nothing else: whether a repository counts is worked out from the kind on the server and shown back to you as a consequence.`}
        </p>
        <p className="measure">
          Changing a kind recomputes every day in the 150 day window on the server. Day colours, the
          run and the streak can all move as a result, so the grid and the week counter above are
          redrawn as soon as the change lands.
        </p>
      </Callout>
    </Section>
  );
}

/* ----------------------------------------------------------- manual entry */

function ManualForm({
  repos,
  today,
  onDone,
}: {
  repos: MergedRepo[];
  today: string;
  onDone: () => Promise<void>;
}) {
  const uid = useId();
  const { toast, toastError } = useToast();
  const counting = repos.filter((r) => r.counts_to_target);
  const options = counting.length ? counting : repos;

  const [repoId, setRepoId] = useState(options[0] ? String(options[0].id) : '');
  const [date, setDate] = useState(today);
  const [count, setCount] = useState('1');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="stack-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!repoId) {
          toastError('There is no repository to record against yet. Run a sync first, or add one.');
          return;
        }
        setBusy(true);
        try {
          await api.post('/api/pushes', {
            repo_id: Number(repoId),
            push_date: date,
            commit_count: Number(count) || 1,
            message_head: message,
          });
          toast('Push recorded.');
          setMessage('');
          await onDone();
        } catch (err) {
          toastError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid--4">
        <Field label="Repository" htmlFor={`${uid}-repo`}>
          <select
            id={`${uid}-repo`}
            className="select"
            aria-label="Repository"
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
          >
            {options.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.full_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor={`${uid}-date`}>
          <input
            id={`${uid}-date`}
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Commits" htmlFor={`${uid}-count`}>
          <input
            id={`${uid}-count`}
            className="input input--num"
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        <Field label="Message" htmlFor={`${uid}-message`}>
          <input
            id={`${uid}-message`}
            className="input"
            type="text"
            maxLength={255}
            placeholder="One line about what it was."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
      </div>
      <div className="between">
        <button type="submit" className="btn btn--primary" disabled={busy}>
          Record the push
        </button>
        <span className="text-xs muted">
          Manual entry always exists, so a sync that cannot run is never a dead end.
        </span>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------- rules */

const RULE_COLUMNS: Column<RuleRow>[] = [
  { key: 'rule', label: 'Rule' },
  { key: 'value', label: 'What it means' },
];

/* --------------------------------------------------------------------- main */

export function PushesScreen() {
  const pushes = useResource<PushesPayload>('/api/pushes');
  const registry = useResource<RegistryPayload>('/api/repos');
  const { toast, toastError } = useToast();
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(async () => {
    await Promise.all([pushes.refresh(), registry.refresh()]);
  }, [pushes, registry]);

  const d = pushes.data;
  const byDate = useMemo(
    () => new Map<string, GridCell>((d?.grid ?? []).map((g) => [g.date, g as GridCell])),
    [d]
  );
  const repos = useMemo(
    () => mergeRepos(registry.data?.repos ?? [], d?.repos ?? []),
    [registry.data, d]
  );

  const error = pushes.error ?? registry.error;

  if (error) {
    return (
      <section className="stack-sm" aria-label="Push warnings">
        <ErrorCard message={error} />
      </section>
    );
  }

  if (pushes.loading || registry.loading || !d || !registry.data) {
    return (
      <>
        <section className="stack-sm" aria-label="Push warnings">
          <LoadingCard text="Loading push warnings." />
        </section>
        <section className="stack" aria-label="Push summary">
          <LoadingCard text="Loading push summary." />
        </section>
        <section className="stack" aria-label="The 150 day grid">
          <LoadingCard text="Loading the 150 day grid." />
        </section>
        <section className="stack" aria-label="Repositories">
          <LoadingCard text="Loading repositories." />
        </section>
        <section className="stack" aria-label="Manual entry">
          <LoadingCard text="Loading manual entry." />
        </section>
      </>
    );
  }

  const counting = repos.filter((r) => r.counts_to_target);
  const clients = repos.filter((r) => !r.counts_to_target);
  const totalCommits = (d.grid ?? []).reduce((a, g) => a + g.commits, 0);
  const pushDays = (d.grid ?? []).length;

  async function sync() {
    setSyncing(true);
    try {
      const report = await api.post<SyncReport>('/api/pushes/sync', {});
      const bits = [
        `${report.repos_checked} repositories checked`,
        `${report.pushes_written} pushes stored`,
        report.not_modified ? `${report.not_modified} unchanged and free` : null,
        report.flagged ? `${report.flagged} flagged` : null,
      ].filter(Boolean);
      toast(bits.join(', ') + '.');
      if (report.rate_limited) {
        toastError('GitHub rate limited the sync. It backed off rather than hammering.');
      }
      for (const e of report.errors ?? []) toastError(e);
      await reload();
    } catch (err) {
      toastError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <>
      <section className="stack-sm" aria-label="Push warnings">
        <Banners d={d} />
      </section>

      <section className="stack" aria-label="Push summary">
        <StatGrid
          stats={[
            {
              value: `${d.week.push_days} of ${d.week.target}`,
              label: 'push days this week',
              tone:
                d.week.push_days >= d.week.target
                  ? 'green'
                  : d.week.push_days >= d.week.target - 2
                    ? 'orange'
                    : 'red',
              hero: true,
              sub: `${d.week.monday} to ${d.week.sunday}, ${int(d.week.commits)} commits`,
            },
            {
              value: d.current_run,
              label: 'day run, current',
              tone: d.current_run ? 'green' : 'red',
              sub: `longest ${d.longest_run}`,
            },
            {
              value: hoursText(d.hours_since_last_push),
              label: 'since the last push that counts',
              tone: d.streak_cancelled ? 'red' : d.red_banner ? 'orange' : 'green',
              sub: d.last_push ? d.last_push.repo : 'nothing on record',
            },
            { value: d.mode, label: 'sync mode', sub: d.mode_cost },
          ]}
        />
        <div className="between">
          <div className="row">
            <button type="button" className="btn btn--primary" disabled={syncing} onClick={sync}>
              {syncing ? 'Syncing.' : 'Sync now'}
            </button>
            <span className="text-sm muted">
              {d.github_user ? `as ${d.github_user}` : 'no username set'}
            </span>
            {/* The stored sync state, which is the only place the mode of the
                last run is reported. It can differ from the mode above, which is
                derived from whether a token is set right now. */}
            <span className="text-xs muted">{`last sync ${d.last_sync_mode}`}</span>
          </div>
          <span className="text-xs muted measure">{d.honesty_line}</span>
        </div>
      </section>

      <section className="stack" aria-label="The 150 day grid">
        <Section
          title="The 150 days"
          lede="Only repositories that count towards the target are drawn here."
        >
          <ContributionGrid
            from={d.from}
            to={d.to}
            byDate={byDate}
            today={d.today}
            colourFor={(info) => levelFor(info)}
          />
          <div className="legend">
            <span className="legend__key">Quiet</span>
            <span className="legend__key">
              <span className="legend__swatch" />1 commit
            </span>
            <span className="legend__key">
              <span className="legend__swatch" />
              10 or more
            </span>
            <span className="legend__key">
              <span className="legend__swatch" />
              Flagged
            </span>
          </div>
          <p className="text-sm muted">
            {`${pushDays} of 150 days carry a push on a repository that counts, ${int(
              totalCommits
            )} commits in total. Today is outlined.`}
          </p>
        </Section>
      </section>

      <section className="stack" aria-label="Repositories">
        <Section
          title={`Repositories that count, ${counting.length}`}
          lede="Client work is real work and it is not roadmap evidence. It is kept apart on purpose."
        >
          {counting.length ? (
            <div className="repolist">
              {counting.map((r) => (
                <RepoRow key={r.id} r={r} onReclassified={reload} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No repositories count yet"
              body="The four project repositories and the tracker repository are registered the moment this screen loads. If this list is empty, every repository on file has been set to client or other. Add one below, or change a kind on its row."
            />
          )}
          {clients.length ? (
            <details className="acc">
              <summary className="acc__summary">
                {`Client and other repositories, ${clients.length}. These never count towards the target.`}
              </summary>
              <div className="acc__body">
                <div className="repolist">
                  {clients.map((r) => (
                    <RepoRow key={r.id} r={r} onReclassified={reload} />
                  ))}
                </div>
              </div>
            </details>
          ) : null}
        </Section>
        <RepoAdmin weeklyTarget={d.week.target} onDone={reload} />
      </section>

      <section className="stack" aria-label="Manual entry">
        <Section title="Record a push by hand">
          <ManualForm repos={repos} today={d.today} onDone={reload} />
        </Section>
        {(d.rules ?? []).length ? (
          <Section title="The rules from Part 18.4">
            <Table columns={RULE_COLUMNS} rows={d.rules} rowKey={(r) => r.id} />
          </Section>
        ) : null}
      </section>
    </>
  );
}

export default PushesScreen;
