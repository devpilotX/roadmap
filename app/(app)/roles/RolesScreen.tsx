'use client';

/**
 * roles | Part 12, and everything that sits around it.
 *
 * This screen answers four questions in one place, because answering them in
 * four places is how a person ends up guessing:
 *
 *   1. What are the roles, what do they pay, and what do they test?
 *   2. Where do I actually apply, and by what rules?
 *   3. How do I prepare for the interview each one runs?
 *   4. What goes on the resume right now, and when does each role open?
 *
 * Every sentence on this screen comes out of the database, which means out of
 * final.md. Nothing here is advice this app invented, and where the roadmap gives
 * a figure with a caveat, the caveat comes with it.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useResource } from '@/components/ui/useResource';
import { useToast } from '@/components/ToastProvider';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  ExternalLink,
  LoadingSections,
  Meter,
  Section,
  StatGrid,
  type StatSpec,
} from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { int, shortDate } from '@/lib/client/format';

/* ------------------------------------------------------------------- types */

type AppCounts = { total: number; by_status: Record<string, number> };

type UnlockedBy = {
  milestone: string;
  unlock_date: string;
  is_past: boolean;
  days_away: number;
};

type Role = {
  code: string;
  name: string;
  short_name: string;
  entry_band: string;
  ceiling: string;
  verdict: string;
  what_they_test: string;
  which_project: string;
  rank_order: number;
  skills_total: number;
  skills_have: number;
  skills_missing: string[];
  unlocked_by: UnlockedBy | null;
  applications: AppCounts;
};

type EarlyRole = {
  id: number;
  code: string;
  role: string;
  earliest_text: string;
  entry_band: string;
  verdict: string;
  is_open: boolean | null;
  days_away: number | null;
  applications: AppCounts;
};

type SkillRow = {
  id: number;
  name: string;
  roles_text: string;
  where_built: string;
  week_n: number | null;
  have: boolean;
};

type ResourceRow = {
  id: number;
  url: string;
  label: string;
  why: string;
  cost: string;
  weeks: number[];
  status: string;
  is_alive: boolean;
};

type RuleRow = { ord: number; text: string };

type WhatTestsRow = {
  code: string;
  short_name: string;
  what_they_test: string;
  which_project: string;
};

type MockRow = {
  id: number;
  held_on: string;
  platform: string;
  topic: string;
  kind: string;
  score: number | null;
  what_broke: string;
};

type ResumeStage = {
  id: number;
  ord: number;
  stage: string;
  headline: string;
  gate_no: number | null;
  passed: boolean;
};

type UnlockRow = {
  id: number;
  ord: number;
  milestone: string;
  unlock_date: string;
  roles_text: string;
  verdict: string;
  codes: string[];
  is_past: boolean;
  days_away: number;
};

type Threshold = {
  id: number;
  cumulative: number;
  reached_label: string;
  unlocks: string;
  reached: boolean;
};

type WhereToApply = {
  boards: ResourceRow[];
  rules: RuleRow[];
  rules_source: string;
  note: string;
};

type InterviewPrep = {
  resources: ResourceRow[];
  category: string;
  what_they_test: WhatTestsRow[];
  mocks: MockRow[];
  mocks_by_kind: Record<string, number>;
};

interface Payload {
  today: string;
  solved: number;
  roles: Role[];
  roles_early: EarlyRole[];
  skills: SkillRow[];
  skills_have: number;
  skills_total: number;
  where_to_apply: WhereToApply | null;
  interview_prep: InterviewPrep | null;
  resume_stages: ResumeStage[] | null;
  unlocks: UnlockRow[] | null;
  dsa_thresholds: Threshold[];
  dsa_note: string;
}

interface Normalised extends Payload {
  missing: string[];
  stale: boolean;
}

/* -------------------------------------------------------------- the badges */

const STATUS_BADGE: Record<string, ['green' | 'blue' | 'outline', string]> = {
  done: ['green', 'Done'],
  reading: ['blue', 'Reading'],
  todo: ['outline', 'Not started'],
};

function StatusBadge({ status }: { status: string }) {
  const [tone, label] = STATUS_BADGE[status] ?? STATUS_BADGE.todo;
  return <Badge tone={tone}>{label}</Badge>;
}

const NO_APPS: AppCounts = { total: 0, by_status: {} };

/**
 * Fills in anything the payload does not carry.
 *
 * If the running server is older than this file, the extra fields are simply
 * absent, and reaching into them would throw and replace the whole page with an
 * error card. Normalising once here means an old server produces a page missing
 * some panels rather than no page at all, and `stale` lets us say why in plain
 * words instead of showing "cannot read properties of undefined".
 */
function normalise(d: Partial<Payload>): Normalised {
  const roles = (d.roles ?? []).map((r) => ({
    ...r,
    applications: r.applications ?? NO_APPS,
    skills_total: r.skills_total ?? 0,
    skills_have: r.skills_have ?? 0,
    skills_missing: r.skills_missing ?? [],
    unlocked_by: r.unlocked_by ?? null,
  }));

  const rolesEarly = (d.roles_early ?? []).map((r) => ({
    ...r,
    applications: r.applications ?? NO_APPS,
    is_open: r.is_open ?? null,
    days_away: r.days_away ?? null,
  }));

  const missing: string[] = [];
  if (!d.where_to_apply) missing.push('where to apply');
  if (!d.interview_prep) missing.push('interview preparation');
  if (!d.resume_stages) missing.push('the resume stages');
  if (!d.unlocks) missing.push('the unlock ladder');

  return {
    today: d.today ?? '',
    solved: d.solved ?? 0,
    roles,
    roles_early: rolesEarly,
    skills: d.skills ?? [],
    skills_have: d.skills_have ?? 0,
    skills_total: d.skills_total ?? 0,
    where_to_apply: d.where_to_apply ?? null,
    interview_prep: d.interview_prep ?? null,
    resume_stages: d.resume_stages ?? null,
    unlocks: d.unlocks ?? null,
    dsa_thresholds: d.dsa_thresholds ?? [],
    dsa_note: d.dsa_note ?? 'No number in this table unlocks a single role on its own.',
    missing,
    stale: missing.length > 0,
  };
}

/** Shown in place of a panel the server did not send. */
function StaleCard({ what }: { what: string }) {
  return (
    <Callout tone="orange" title={`${what} is not in this server's response`}>
      <p>
        The server is running an older version of GET /api/roles than this screen expects. Restart it
        and reload this page.
      </p>
    </Callout>
  );
}

/* --------------------------------------------------------------- the seven */

function RoleCard({ r }: { r: Role }) {
  const open = r.unlocked_by ? r.unlocked_by.is_past : true;
  const pct = r.skills_total ? Math.round((r.skills_have / r.skills_total) * 100) : 0;

  return (
    <div className={`rolecard ${Number(r.rank_order) === 1 ? 'rolecard--primary' : ''}`}>
      <div className="between">
        <div className="row">
          <span className="rolecard__rank">{String(r.rank_order)}</span>
          <div>
            <h2 className="card__title">{r.short_name}</h2>
            <p className="text-xs muted">{`${r.code}  ·  ${r.name}`}</p>
          </div>
        </div>
        <div className="right">
          <div className="rolecard__band">{r.entry_band}</div>
          <div className="text-xs muted">{`ceiling ${r.ceiling}`}</div>
        </div>
      </div>

      <p className="measure">{r.verdict}</p>

      <div className="card__foot stack-sm">
        <p className="card__label">What the interview actually tests</p>
        <p className="measure text-sm">{r.what_they_test}</p>
        <p className="card__label">Which of your projects carries it</p>
        <p className="measure text-sm">{r.which_project}</p>
      </div>

      <div className="card__foot stack-sm">
        <div className="between">
          <span className="card__label">
            {`Skills held for this role, ${r.skills_have} of ${r.skills_total}`}
          </span>
          {r.applications.total ? (
            <Badge tone="blue">{`${int(r.applications.total)} applications sent`}</Badge>
          ) : (
            <Badge tone="outline">no applications yet</Badge>
          )}
        </div>
        <Meter percent={pct} tone={pct === 100 ? 'green' : undefined} />
        {r.skills_missing.length ? (
          <details className="acc">
            <summary className="acc__summary">{`Still missing ${r.skills_missing.length}`}</summary>
            <div className="acc__body">
              <ul className="linklist">
                {r.skills_missing.map((s) => (
                  <li className="text-sm" key={s}>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ) : (
          <p className="text-sm muted">Every skill this role names is held.</p>
        )}
      </div>

      {r.unlocked_by ? (
        <Callout
          tone={open ? 'green' : 'blue'}
          title={
            open
              ? `Open since ${shortDate(r.unlocked_by.unlock_date)}`
              : `Opens ${shortDate(r.unlocked_by.unlock_date)}, ${r.unlocked_by.days_away} days away`
          }
        >
          <p>{r.unlocked_by.milestone.replace(/\*\*/g, '')}</p>
        </Callout>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------- where to apply */

function WhereToApplyPanel({ d }: { d: Normalised }) {
  const w = d.where_to_apply!;
  const boardRows = w.boards ?? [];
  const ruleRows = w.rules ?? [];

  const boardColumns: Column<ResourceRow>[] = [
    { key: 'label', label: 'Where', render: (r) => <ExternalLink href={r.url}>{r.label}</ExternalLink> },
    { key: 'why', label: 'Why this one' },
    { key: 'cost', label: 'Cost' },
    {
      key: 'status',
      label: 'You',
      render: (r) => (
        <span className="row-tight">
          <StatusBadge status={r.status} />
          {r.is_alive === false ? <Badge tone="red">link check failed</Badge> : null}
        </span>
      ),
    },
  ];

  return (
    <Section
      title="Where to apply"
      lede="The five places final.md names, and the seven rules it gives for using them."
    >
      <p className="measure">{w.note ?? ''}</p>
      {boardRows.length ? (
        <Table columns={boardColumns} rows={boardRows} rowKey={(r) => r.id} />
      ) : (
        <EmptyState
          title="No boards on file"
          body="They come from Part 7, category 19 of final.md."
        />
      )}
      <div className="card__foot stack-sm">
        <p className="card__label">{`The rules, from ${w.rules_source ?? 'Part 4, Week 21'}`}</p>
        {ruleRows.length ? (
          <ol className="linklist">
            {ruleRows.map((r) => (
              <li className="linklist__row" key={r.ord}>
                <p className="measure text-sm">{r.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            title="No apply rules on file"
            body="They come from the Week 21 LEARN block. Run npm run setup."
          />
        )}
      </div>
      <div className="row">
        <Link className="btn btn--sm" href="/applications">
          Track an application
        </Link>
        <Link className="btn btn--sm btn--ghost" href="/weeks/21">
          Read Week 21 in full
        </Link>
        <Link className="btn btn--sm btn--ghost" href="/eligibility">
          Am I advised to apply yet?
        </Link>
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------- interview prep */

function InterviewPrepPanel({ d }: { d: Normalised }) {
  const p = d.interview_prep!;
  const resources = p.resources ?? [];
  const whatTests = p.what_they_test ?? [];
  const mocks = p.mocks ?? [];

  const linkColumns: Column<ResourceRow>[] = [
    { key: 'label', label: 'Resource', render: (r) => <ExternalLink href={r.url}>{r.label}</ExternalLink> },
    { key: 'why', label: 'Why this one' },
    { key: 'cost', label: 'Cost' },
    { key: 'weeks', label: 'Weeks', render: (r) => ((r.weeks ?? []).length ? r.weeks.join(', ') : 'any') },
    { key: 'status', label: 'You', render: (r) => <StatusBadge status={r.status} /> },
  ];

  const perRoleColumns: Column<WhatTestsRow>[] = [
    { key: 'code', label: 'Role' },
    { key: 'short_name', label: 'Name' },
    { key: 'what_they_test', label: 'What the interview tests' },
    { key: 'which_project', label: 'What you answer it with' },
  ];

  const mockColumns: Column<MockRow>[] = [
    { key: 'held_on', label: 'Held', render: (m) => shortDate(m.held_on) },
    { key: 'kind', label: 'Kind' },
    { key: 'platform', label: 'Platform' },
    { key: 'topic', label: 'Topic' },
    { key: 'score', label: 'Score', num: true, render: (m) => (m.score === null ? '' : `${m.score}`) },
    { key: 'what_broke', label: 'What broke' },
  ];

  const kinds = Object.entries(p.mocks_by_kind ?? {});

  return (
    <Section
      title="Interview preparation"
      lede="Part 7, category 16, plus what Part 12 says each role tests."
    >
      <p className="measure">
        Two halves. The six links below are the ones final.md picks, and the table under them is what
        each of the seven roles actually asks you in the room, taken from Part 12 rather than from a
        blog post.
      </p>
      {resources.length ? (
        <Table columns={linkColumns} rows={resources} rowKey={(r) => r.id} />
      ) : (
        <EmptyState
          title="No prep links on file"
          body={`They come from ${p.category ?? 'Part 7, category 16'}.`}
        />
      )}
      <div className="card__foot stack-sm">
        <p className="card__label">What each role tests, and what you answer it with</p>
        {whatTests.length ? (
          <Table columns={perRoleColumns} rows={whatTests} rowKey={(r) => r.code} />
        ) : (
          <EmptyState title="No roles on file" body="They come from Part 12." />
        )}
      </div>
      <div className="card__foot stack-sm">
        <div className="between">
          <p className="card__label">{`Your mocks, ${mocks.length}`}</p>
          <div className="row">
            {kinds.map(([k, n]) => (
              <Badge tone="outline" key={k}>{`${k} ${n}`}</Badge>
            ))}
          </div>
        </div>
        {mocks.length ? (
          <Table columns={mockColumns} rows={mocks} rowKey={(m) => m.id} />
        ) : (
          <EmptyState
            title="No mocks logged yet"
            body="Week 20 is the mock week. Log them on the Applications screen and they appear here with what broke, which is the only part worth re-reading."
          />
        )}
        <div className="row">
          <Link className="btn btn--sm" href="/applications">
            Log a mock interview
          </Link>
          <Link className="btn btn--sm btn--ghost" href="/library">
            Open the full library
          </Link>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------- the resume */

function ResumePanel({ d }: { d: Normalised }) {
  const stages = d.resume_stages ?? [];
  const firstOpen = stages.filter((x) => !x.passed)[0];

  const columns: Column<ResumeStage>[] = [
    { key: 'stage', label: 'At' },
    { key: 'headline', label: 'What the resume says' },
    {
      key: 'passed',
      label: 'Gate',
      render: (r) =>
        r.passed ? <Badge tone="green">passed</Badge> : <Badge tone="outline">not yet</Badge>,
    },
  ];

  return (
    <Section
      title="What goes on the resume, at each gate"
      lede="The resume is a consequence of the gates, not a separate project."
    >
      <p className="measure">
        Part 13. The first line is the one people skip: at Gate 1 the honest answer is that there is
        nothing to send yet. A resume with nothing behind it is the fastest way to be filtered out
        before there is anything to filter.
      </p>
      <Table
        columns={columns}
        rows={stages}
        rowKey={(r) => r.id}
        rowCurrent={(r) => !r.passed && firstOpen?.ord === r.ord}
      />
      <div className="row">
        <Link className="btn btn--sm btn--ghost" href="/gates">
          Open the gates
        </Link>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------- the nine early */

function EarlyRolesPanel({ d }: { d: Normalised }) {
  return (
    <Section
      title="The nine earlier roles, from Part 19.2"
      lede="Ordered as final.md orders them, earliest first."
    >
      <p className="measure">
        These open before the seven do. They pay less and they are real. The date on each one is the
        earliest it is honestly available, not the date you should take it.
      </p>
      <div className="grid grid--3">
        {d.roles_early.map((r) => (
          <div className={`rolechip ${r.is_open ? '' : 'offercard--locked'}`} key={r.id}>
            <div className="between">
              <span className="rolechip__code">{r.code}</span>
              {r.is_open ? (
                <Badge tone="green">open</Badge>
              ) : (
                <Badge tone="outline">{`${r.days_away} days`}</Badge>
              )}
            </div>
            <span className="rolechip__name">{r.role}</span>
            <span className="rolechip__band">{r.entry_band}</span>
            {/* earliest_text already reads "Week 3, 20 Sep 2026", so the date is
                not appended again. */}
            <p className="text-xs muted">{`Earliest ${r.earliest_text}`}</p>
            <p className="text-sm measure">{r.verdict}</p>
            {r.applications.total ? (
              <Badge tone="blue">{`${int(r.applications.total)} sent`}</Badge>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------ the skill matrix */

function SkillMatrixPanel({ d }: { d: Normalised }) {
  const columns: Column<SkillRow>[] = [
    {
      key: 'have',
      label: 'Held',
      render: (s) => (
        <span className={s.have ? 'skillrow__have' : 'skillrow__not'}>{s.have ? 'yes' : 'no'}</span>
      ),
    },
    { key: 'name', label: 'Skill' },
    { key: 'roles_text', label: 'Which roles want it' },
    { key: 'where_built', label: 'Where you build it' },
    { key: 'week_n', label: 'Week', num: true, render: (s) => (s.week_n ? `W${s.week_n}` : '') },
  ];

  return (
    <Section
      title={`The skill matrix, ${d.skills_have} of ${d.skills_total} held`}
      lede="Part 12. Twenty five skills, each tied to the week that builds it."
    >
      <p className="measure">
        A skill counts as held when the week that builds it is finished in full, six LEARN ticks and
        six BUILD ticks. Reading about it is not holding it.
      </p>
      <Meter
        percent={d.skills_total ? Math.round((d.skills_have / d.skills_total) * 100) : 0}
        tone={d.skills_have === d.skills_total ? 'green' : undefined}
      />
      <Table
        columns={columns}
        rows={d.skills}
        rowKey={(s) => s.id}
        rowClass={(s) => (s.have ? 'card--done' : '')}
      />
    </Section>
  );
}

/* --------------------------------------------------------- the unlocks */

function UnlockLadderPanel({ d }: { d: Normalised }) {
  const rows = d.unlocks ?? [];
  const thresholds = d.dsa_thresholds ?? [];
  const firstOpen = rows.filter((x) => !x.is_past)[0];

  const unlockColumns: Column<UnlockRow>[] = [
    { key: 'unlock_date', label: 'Date', render: (u) => shortDate(u.unlock_date) },
    {
      key: 'milestone',
      label: 'Milestone',
      render: (u) => String(u.milestone ?? '').replace(/\*\*/g, ''),
    },
    {
      key: 'codes',
      label: 'Roles it opens',
      render: (u) =>
        (u.codes ?? []).length ? (
          <div className="row-tight">
            {u.codes.map((c) => (
              <Badge tone="outline" key={c}>
                {c}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="muted text-sm">none on its own</span>
        ),
    },
    { key: 'verdict', label: 'What it means' },
    {
      key: 'is_past',
      label: 'Reached',
      render: (u) =>
        u.is_past ? (
          <Badge tone="green">yes</Badge>
        ) : (
          <Badge tone="outline">{`${u.days_away} days`}</Badge>
        ),
    },
  ];

  const thresholdColumns: Column<Threshold>[] = [
    { key: 'cumulative', label: 'Problems', num: true },
    { key: 'reached_label', label: 'Reached about' },
    { key: 'unlocks', label: 'What it unlocks' },
    {
      key: 'reached',
      label: 'You',
      render: (t) =>
        t.reached ? (
          <Badge tone="green">reached</Badge>
        ) : (
          <Badge tone="outline">{`${t.cumulative - d.solved} to go`}</Badge>
        ),
    },
  ];

  return (
    <Section title="When each role opens" lede="Part 13, the unlock ladder, against today.">
      {rows.length ? (
        <Table
          columns={unlockColumns}
          rows={rows}
          rowKey={(u) => u.id}
          rowCurrent={(u) => !u.is_past && firstOpen?.ord === u.ord}
        />
      ) : (
        <EmptyState title="No unlock ladder" body="It comes from Part 13 of final.md." />
      )}
      <div className="card__foot stack-sm">
        <Callout tone="red" title={d.dsa_note}>
          <p>
            {`You are at ${int(d.solved)} problems. The table below is what the number alone buys you, which is a screen, not an offer.`}
          </p>
        </Callout>
        {thresholds.length ? (
          <Table columns={thresholdColumns} rows={thresholds} rowKey={(t) => t.id} />
        ) : (
          <EmptyState title="No DSA thresholds" body="They come from Part 13." />
        )}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------------------- main */

const SECTIONS: [string, string][] = [
  ['Where you stand', 'Loading where you stand.'],
  ['The seven roles', 'Loading the seven roles.'],
  ['Where to apply', 'Loading where to apply.'],
  ['Interview preparation', 'Loading interview preparation.'],
  ['The resume at each gate', 'Loading the resume at each gate.'],
  ['The nine earlier roles', 'Loading the nine earlier roles.'],
  ['The skill matrix', 'Loading the skill matrix.'],
  ['When each role opens', 'Loading when each role opens.'],
];

export function RolesScreen() {
  const { data, error, loading } = useResource<Partial<Payload>>('/api/roles');
  const { toastError } = useToast();

  // The old screen showed the message twice: once in the panel, once as a toast.
  useEffect(() => {
    if (error) toastError(error);
  }, [error, toastError]);

  if (error) return <ErrorCard message={error} />;
  if (loading || !data)
    return (
      <LoadingSections
        sections={SECTIONS.map(([label, text]) => ({
          label,
          text,
          // The seven role cards sit further apart than the panels around them.
          className: label === 'The seven roles' ? 'stack-lg' : 'stack',
        }))}
      />
    );

  const d = normalise(data);

  const openNow = d.roles.filter((r) => !r.unlocked_by || r.unlocked_by.is_past).length;
  const earlyOpen = d.roles_early.filter((r) => r.is_open).length;
  const nextRole = d.roles.find((r) => r.unlocked_by && !r.unlocked_by.is_past) ?? null;
  const totalApps = [...d.roles, ...d.roles_early].reduce(
    (a, r) => a + (r.applications?.total ?? 0),
    0
  );

  const stats: StatSpec[] = [
    {
      value: `${d.skills_have} of ${d.skills_total}`,
      label: 'skills held, from finished weeks',
      tone: d.skills_total && d.skills_have === d.skills_total ? 'green' : undefined,
      hero: true,
    },
    {
      value: `${openNow} of ${d.roles.length}`,
      label: 'of the seven open today',
      tone: openNow ? 'green' : undefined,
    },
    {
      value: `${earlyOpen} of ${d.roles_early.length}`,
      label: 'of the nine earlier roles open today',
    },
    {
      value: nextRole ? nextRole.code : 'All open',
      label: nextRole
        ? `opens ${shortDate(nextRole.unlocked_by!.unlock_date)}`
        : 'nothing left to unlock',
      sub: totalApps ? `${int(totalApps)} applications sent` : 'no applications yet',
    },
  ];

  return (
    <>
      <section className="stack" aria-label="Where you stand">
        {d.stale ? (
          <Callout tone="orange" title="This server is older than this screen">
            <p>
              {`It did not send ${d.missing.join(', ')}. Restart the server and reload, and those panels will fill. Everything below is drawn from what it did send.`}
            </p>
          </Callout>
        ) : null}
        <StatGrid stats={stats} />
        <p className="text-sm muted measure">
          Eligible is not a reason to apply. Eligible plus advised is, and whether you are advised is
          on the Eligibility screen. This page is what the roles are, where they live and how they
          are tested.
        </p>
      </section>

      <section className="stack-lg" aria-label="The seven roles">
        {d.roles.length ? (
          d.roles.map((r) => <RoleCard key={r.code} r={r} />)
        ) : (
          <EmptyState
            title="No roles"
            body="The seven roles come from Part 12 of final.md. Run npm run setup."
          />
        )}
      </section>

      {/* Each panel is independent, so one missing field cannot take the rest of
          the page with it. */}
      <section className="stack" aria-label="Where to apply">
        {d.where_to_apply ? <WhereToApplyPanel d={d} /> : <StaleCard what="Where to apply" />}
      </section>

      <section className="stack" aria-label="Interview preparation">
        {d.interview_prep ? <InterviewPrepPanel d={d} /> : <StaleCard what="Interview preparation" />}
      </section>

      <section className="stack" aria-label="The resume at each gate">
        {d.resume_stages ? <ResumePanel d={d} /> : <StaleCard what="The resume at each gate" />}
      </section>

      <section className="stack" aria-label="The nine earlier roles">
        {d.roles_early.length ? (
          <EarlyRolesPanel d={d} />
        ) : (
          <EmptyState title="No earlier roles" body="They come from Part 19.2." />
        )}
      </section>

      <section className="stack" aria-label="The skill matrix">
        {d.skills.length ? (
          <SkillMatrixPanel d={d} />
        ) : (
          <EmptyState title="No skills" body="They come from Part 12." />
        )}
      </section>

      <section className="stack" aria-label="When each role opens">
        {d.unlocks ? <UnlockLadderPanel d={d} /> : <StaleCard what="The unlock ladder" />}
      </section>
    </>
  );
}

export default RolesScreen;
