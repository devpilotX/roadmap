'use client';

/**
 * applications | Part 13, the application pipeline.
 *
 * Two numbers matter on this screen and both are shown at once. Gate 4 asks for
 * one hundred applications, which is the floor. The realistic total to a single
 * offer is 200 to 400, which is the target. Showing only the first number is how
 * people stop at one hundred and wonder why nothing landed.
 *
 * The board is the status enum from the applications table, in order, so a row
 * can only ever be in a state the database allows. A card can be dragged, and it
 * also carries a select, because a board that only works with a mouse is a board
 * half the time unusable.
 *
 * Mocks and writeups sit at the bottom of the same screen. They are the two
 * things that turn a sent application into a reply, and they have their own
 * targets from the API rather than any figure written here.
 */

import { useCallback, useId, useState, type ReactNode } from 'react';
import { optimistic, useResource } from '@/components/ui/useResource';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  ExternalLink,
  LoadingCard,
  Meter,
  Section,
  StatGrid,
} from '@/components/ui/Basics';
import { Field } from '@/components/ui/Controls';
import { Table, type Column } from '@/components/ui/Table';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/client/api';
import { int, pct, shortDate } from '@/lib/client/format';

/* ------------------------------------------------------------------ shapes */

type ApplicationRow = {
  id: number;
  company: string;
  role_title: string;
  role_code: string | null;
  source: string | null;
  applied_on: string;
  status: string;
  last_update: string | null;
  referral: number;
  salary_offered: string | null;
  jd_url: string | null;
  notes: string | null;
};

interface ApplicationsPayload {
  today: string;
  applications: ApplicationRow[];
  roles: { code: string; name: string }[];
  funnel: {
    by_status: Record<string, number>;
    total: number;
    referrals: number;
    referral_rate: number;
    interviews: number;
    interview_rate: number;
    offers: number;
  };
  gate4: { target: number; sent: number; remaining: number; percent: number };
  realistic: { low: number; high: number; percent_of_low: number; note: string };
  red_banner: string | null;
  applications_open: boolean;
}

type MockRow = {
  id: number;
  held_on: string;
  platform: string;
  topic: string;
  kind: string;
  score: number | null;
  what_broke: string | null;
};

interface MocksPayload {
  mocks: MockRow[];
  total: number;
  by_kind: Record<string, number>;
  week20_target: number;
  case_study_target: number;
  from_february_target: number;
  note: string;
}

interface WriteupRow {
  id: number;
  title: string;
  url: string;
  published_on: string;
  topic: string | null;
}

interface WriteupsPayload {
  writeups: WriteupRow[];
  total: number;
  target: number;
  note: string;
}

/* --------------------------------------------------------------- constants */

/** The status enum, in pipeline order. Nothing outside this list can be set. */
const STATUSES: { key: string; label: string; tone: 'outline' | 'blue' | 'orange' | 'green' | 'red' }[] =
  [
    { key: 'applied', label: 'Applied', tone: 'outline' },
    { key: 'screen', label: 'Screen', tone: 'blue' },
    { key: 'tech', label: 'Tech', tone: 'blue' },
    { key: 'onsite', label: 'Onsite', tone: 'orange' },
    { key: 'offer', label: 'Offer', tone: 'green' },
    { key: 'rejected', label: 'Rejected', tone: 'red' },
    { key: 'ghosted', label: 'Ghosted', tone: 'outline' },
  ];

const MOCK_KINDS = [
  { value: 'coding', label: 'Coding' },
  { value: 'system_design', label: 'System design' },
  { value: 'case_study', label: 'Case study' },
  { value: 'rag_design', label: 'RAG design' },
  { value: 'behavioural', label: 'Behavioural' },
];

const statusMeta = (key: string) => STATUSES.find((s) => s.key === key) ?? STATUSES[0];

const kindLabel = (value: string) => MOCK_KINDS.find((k) => k.value === value)?.label ?? value;

/* ------------------------------------------------------------------ banners */

function Banners({ d }: { d: ApplicationsPayload }) {
  const out: ReactNode[] = [];

  if (d.red_banner) {
    out.push(
      <Callout key="red" tone="red" title="Applications should already be going out">
        <p className="measure">{d.red_banner}</p>
      </Callout>
    );
  }

  if (!d.applications_open) {
    out.push(
      <Callout key="closed" tone="blue" title="The pipeline is not open yet">
        <p className="measure">
          Part 13 opens applications at Gate 3 on 13 December 2026, not at Gate 4. Rows added before
          then are fine to keep as research, but the count that matters starts at Gate 3.
        </p>
      </Callout>
    );
  }

  if (d.funnel.total >= d.gate4.target && d.funnel.total < d.realistic.low) {
    out.push(
      <Callout
        key="floor"
        tone="orange"
        title={`${int(d.funnel.total)} sent. The Gate 4 condition is met and the job is not done.`}
      >
        <p className="measure">
          {`One hundred was the floor. ${int(d.realistic.low - d.funnel.total)} more takes you to ${int(
            d.realistic.low
          )}, which is the bottom of the realistic range.`}
        </p>
      </Callout>
    );
  }

  if (!out.length) return <p className="text-sm muted">No application warnings.</p>;
  return <>{out}</>;
}

/* ------------------------------------------------------------------ counter */

function Counter({ d }: { d: ApplicationsPayload }) {
  const g = d.gate4;
  const r = d.realistic;

  return (
    <>
      <StatGrid
        stats={[
          {
            value: `${int(g.sent)} of ${int(g.target)}`,
            label: 'sent against the Gate 4 condition, which is the floor',
            tone: g.sent >= g.target ? 'green' : g.sent ? 'orange' : 'red',
            hero: true,
            sub: g.remaining
              ? `${int(g.remaining)} left to clear the floor`
              : 'the floor is cleared',
          },
          {
            value: `${int(r.low)} to ${int(r.high)}`,
            label: 'the realistic total to one offer, which is the target',
            sub: `${r.percent_of_low}% of the way to ${int(r.low)}`,
          },
          {
            value: `${d.funnel.interview_rate}%`,
            label: 'reached a screen or further',
            sub: `${int(d.funnel.interviews)} of ${int(d.funnel.total)}`,
            tone: d.funnel.interviews ? 'blue' : undefined,
          },
          {
            value: `${d.funnel.referral_rate}%`,
            label: 'went in with a referral',
            sub: `${int(d.funnel.referrals)} of ${int(d.funnel.total)}, and ${int(
              d.funnel.offers
            )} offers so far`,
          },
        ]}
      />

      <div className="card stack-sm">
        <p className="card__label">Both numbers, side by side</p>
        <div className="appcounter">
          <span className="appcounter__value">{int(g.sent)}</span>
          <span className="text-sm muted">
            {`applications sent. ${int(g.target)} passes Gate 4. ${int(r.low)} to ${int(
              r.high
            )} is what actually produces an offer.`}
          </span>
          <Meter percent={g.percent} tone={g.percent === 100 ? 'green' : undefined} />
          <span className="text-xs muted">
            {`${g.percent}% of the Gate 4 floor of ${int(g.target)}`}
          </span>
          <Meter
            percent={r.percent_of_low}
            tone={r.percent_of_low === 100 ? 'green' : undefined}
          />
          <span className="text-xs muted">
            {`${r.percent_of_low}% of ${int(r.low)}, the bottom of the realistic range`}
          </span>
        </div>
        <p className="text-sm muted measure">{r.note}</p>
      </div>

      <div className="card stack-sm">
        <p className="card__label">Where they are</p>
        {d.funnel.total ? (
          <div className="funnelbar">
            {STATUSES.map((s) => {
              const n = d.funnel.by_status[s.key] ?? 0;
              return (
                <div className="funnelbar__row" key={s.key}>
                  <span>{s.label}</span>
                  <Meter
                    percent={pct(n, d.funnel.total)}
                    tone={s.key === 'offer' && n ? 'green' : undefined}
                  />
                  <span className="num">{int(n)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Nothing has been sent yet"
            body="Add the first application below. The funnel fills itself from the board."
          />
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- board */

function AppCard({
  a,
  onMove,
  onDelete,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  a: ApplicationRow;
  onMove: (a: ApplicationRow, status: string) => void;
  onDelete: (a: ApplicationRow) => Promise<void>;
  onDragStart: (a: ApplicationRow) => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const meta = statusMeta(a.status);
  const [busy, setBusy] = useState(false);

  return (
    <article
      className="kancard"
      draggable
      data-id={String(a.id)}
      data-status={a.status}
      data-dragging={dragging ? '1' : undefined}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(a.id));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(a);
      }}
      onDragEnd={onDragEnd}
    >
      <p className="kancard__title">{a.company}</p>
      <p className="kancard__meta">{a.role_title}</p>
      <p className="kancard__meta">
        {`Applied ${shortDate(a.applied_on)}`}
        {a.last_update ? ` · updated ${shortDate(a.last_update)}` : ''}
      </p>
      <div className="row">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {a.role_code ? <Badge tone="outline">{a.role_code}</Badge> : null}
        {Number(a.referral) === 1 ? <Badge tone="green">Referral</Badge> : null}
      </div>
      {a.source ? <p className="kancard__meta">{`Via ${a.source}`}</p> : null}
      {a.salary_offered ? <p className="kancard__meta">{`Offered ${a.salary_offered}`}</p> : null}
      {a.notes ? <p className="kancard__meta">{a.notes}</p> : null}
      <div className="row">
        <select
          className="select select--sm"
          aria-label={`Status of ${a.company}`}
          value={a.status}
          onChange={(e) => onMove(a, e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                `Delete the ${a.company} application? It is soft deleted and can be restored from the API.`
              )
            ) {
              return;
            }
            setBusy(true);
            try {
              await onDelete(a);
            } finally {
              setBusy(false);
            }
          }}
        >
          Delete
        </button>
      </div>
      {a.jd_url ? (
        <ExternalLink href={a.jd_url} className="text-xs">
          The job description
        </ExternalLink>
      ) : null}
    </article>
  );
}

function Board({
  d,
  onMove,
  onDelete,
}: {
  d: ApplicationsPayload;
  onMove: (a: ApplicationRow, status: string) => void;
  onDelete: (a: ApplicationRow) => Promise<void>;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);

  return (
    <Section
      title="The board"
      lede="Seven columns, because those are the seven statuses the database accepts."
    >
      {d.applications.length ? (
        <div className="kanban">
          {STATUSES.map((s) => {
            const rows = d.applications.filter((a) => a.status === s.key);
            return (
              <div
                key={s.key}
                className="kancol"
                data-status={s.key}
                data-dragover={over === s.key ? '1' : undefined}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(s.key);
                }}
                onDragLeave={() => setOver((cur) => (cur === s.key ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  const id = Number(e.dataTransfer.getData('text/plain'));
                  const row = d.applications.find((a) => a.id === id);
                  if (row) onMove(row, s.key);
                }}
              >
                <div className="kancol__head">
                  <span className="kancol__title">{s.label}</span>
                  <span className="kancol__count">{rows.length}</span>
                </div>
                <div className="kancol__list">
                  {rows.map((a) => (
                    <AppCard
                      key={a.id}
                      a={a}
                      onMove={onMove}
                      onDelete={onDelete}
                      dragging={dragId === a.id}
                      onDragStart={(row) => setDragId(row.id)}
                      onDragEnd={() => setDragId(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="The board is empty"
          body="Every column is a value of the status column in the database. Add an application above and it appears under Applied."
        />
      )}
      <p className="text-xs muted">
        Drag a card between columns, or use the select on the card. Changing the status also stamps
        the last update date.
      </p>
    </Section>
  );
}

/* --------------------------------------------------------------- add a form */

const EMPTY_APP = {
  company: '',
  title: '',
  roleCode: '',
  source: '',
  status: 'applied',
  referral: false,
  salary: '',
  jd: '',
  notes: '',
};

function AddForm({ d, onDone }: { d: ApplicationsPayload; onDone: () => Promise<void> }) {
  const uid = useId();
  const [form, setForm] = useState(EMPTY_APP);
  const [appliedOn, setAppliedOn] = useState(d.today);
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();

  const set = <K extends keyof typeof EMPTY_APP>(key: K, value: (typeof EMPTY_APP)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Section
      title="Add an application"
      lede="One row per application. The count on this screen is only as honest as this form."
    >
      <form
        className="stack-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!form.company.trim() || !form.title.trim() || !appliedOn) {
            toastError('Company, role title and the date applied are all needed.');
            return;
          }
          setBusy(true);
          try {
            await api.post('/api/applications', {
              company: form.company.trim(),
              role_title: form.title.trim(),
              role_code: form.roleCode || null,
              source: form.source.trim() || null,
              applied_on: appliedOn,
              status: form.status,
              referral: form.referral,
              salary_offered: form.salary.trim() || null,
              jd_url: form.jd.trim() || null,
              notes: form.notes.trim() || null,
            });
            toast(`${form.company.trim()} added.`);
            setForm(EMPTY_APP);
            setAppliedOn(d.today);
            await onDone();
          } catch (err) {
            toastError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid grid--3">
          <Field label="Company" htmlFor={`${uid}-company`}>
            <input
              id={`${uid}-company`}
              className="input"
              type="text"
              maxLength={200}
              required
              placeholder="The company"
              value={form.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </Field>
          <Field label="Role title" htmlFor={`${uid}-title`}>
            <input
              id={`${uid}-title`}
              className="input"
              type="text"
              maxLength={200}
              required
              placeholder="The title on the advert"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <Field
            label="Role code"
            htmlFor={`${uid}-role`}
            hint="One of the sixteen roles, if it maps to one."
          >
            <select
              id={`${uid}-role`}
              className="select"
              aria-label="Which of the roles this is"
              value={form.roleCode}
              onChange={(e) => set('roleCode', e.target.value)}
            >
              <option value="">No role code</option>
              {d.roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {`${r.code}  ${r.name}`}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid--3">
          <Field label="Source" htmlFor={`${uid}-source`}>
            <input
              id={`${uid}-source`}
              className="input"
              type="text"
              maxLength={120}
              placeholder="Naukri, referral, careers page"
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
            />
          </Field>
          <Field label="Applied on" htmlFor={`${uid}-date`}>
            <input
              id={`${uid}-date`}
              className="input"
              type="date"
              required
              value={appliedOn}
              onChange={(e) => setAppliedOn(e.target.value)}
            />
          </Field>
          <Field label="Status" htmlFor={`${uid}-status`}>
            <select
              id={`${uid}-status`}
              className="select"
              aria-label="Starting status"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid--3">
          <Field label="Salary quoted" htmlFor={`${uid}-salary`}>
            <input
              id={`${uid}-salary`}
              className="input"
              type="text"
              maxLength={120}
              placeholder="What was quoted, if anything"
              value={form.salary}
              onChange={(e) => set('salary', e.target.value)}
            />
          </Field>
          <Field label="Job description URL" htmlFor={`${uid}-jd`}>
            <input
              id={`${uid}-jd`}
              className="input"
              type="url"
              maxLength={500}
              placeholder="https://the-advert"
              value={form.jd}
              onChange={(e) => set('jd', e.target.value)}
            />
          </Field>
          <label className="tick">
            <input
              type="checkbox"
              className="tick__box"
              checked={form.referral}
              onChange={(e) => set('referral', e.target.checked)}
            />
            <span className="tick__body">
              <span className="tick__text">Went in with a referral</span>
              <span className="tick__meta">
                A referral is the single largest change to a reply rate.
              </span>
            </span>
          </label>
        </div>

        <Field label="Notes" htmlFor={`${uid}-notes`}>
          <textarea
            id={`${uid}-notes`}
            className="textarea"
            rows={2}
            placeholder="Who it went to, what you sent."
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        <div className="between">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            Add the application
          </button>
          <span className="text-xs muted">
            Company, role title and the date are the only required fields.
          </span>
        </div>
      </form>
    </Section>
  );
}

/* -------------------------------------------------------- mocks and writeups */

function MockForm({ onDone }: { onDone: () => Promise<void> }) {
  const uid = useId();
  const [heldOn, setHeldOn] = useState('');
  const [platform, setPlatform] = useState('');
  const [topic, setTopic] = useState('');
  const [kind, setKind] = useState('coding');
  const [score, setScore] = useState('');
  const [broke, setBroke] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();

  return (
    <form
      className="stack-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!heldOn || !platform.trim() || !topic.trim()) {
          toastError('The date, the platform and the topic are all needed.');
          return;
        }
        setBusy(true);
        try {
          await api.post('/api/mocks', {
            held_on: heldOn,
            platform: platform.trim(),
            topic: topic.trim(),
            kind,
            score: score === '' ? null : Number(score),
            what_broke: broke.trim() || null,
          });
          toast('Mock recorded.');
          setHeldOn('');
          setPlatform('');
          setTopic('');
          setKind('coding');
          setScore('');
          setBroke('');
          await onDone();
        } catch (err) {
          toastError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid--3">
        <Field label="Held on" htmlFor={`${uid}-held`}>
          <input
            id={`${uid}-held`}
            className="input"
            type="date"
            required
            value={heldOn}
            onChange={(e) => setHeldOn(e.target.value)}
          />
        </Field>
        <Field label="Platform" htmlFor={`${uid}-platform`}>
          <input
            id={`${uid}-platform`}
            className="input"
            type="text"
            maxLength={120}
            required
            placeholder="Exponent, interviewing.io, a friend"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          />
        </Field>
        <Field label="Topic" htmlFor={`${uid}-topic`}>
          <input
            id={`${uid}-topic`}
            className="input"
            type="text"
            maxLength={200}
            required
            placeholder="What it covered"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid--2">
        <Field label="Kind" htmlFor={`${uid}-kind`}>
          <select
            id={`${uid}-kind`}
            className="select"
            aria-label="Kind of mock"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {MOCK_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Score"
          htmlFor={`${uid}-score`}
          hint="Leave it blank if there was no score."
        >
          <input
            id={`${uid}-score`}
            className="input input--num"
            type="number"
            min={0}
            max={10}
            placeholder="out of 10"
            value={score}
            onChange={(e) => setScore(e.target.value)}
          />
        </Field>
      </div>
      <Field label="What broke" htmlFor={`${uid}-broke`}>
        <textarea
          id={`${uid}-broke`}
          className="textarea"
          rows={2}
          placeholder="What actually broke. This is the only part worth reading later."
          value={broke}
          onChange={(e) => setBroke(e.target.value)}
        />
      </Field>
      <div className="row">
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          Record the mock
        </button>
      </div>
    </form>
  );
}

function WriteupForm({ onDone }: { onDone: () => Promise<void> }) {
  const uid = useId();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [publishedOn, setPublishedOn] = useState('');
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast, toastError } = useToast();

  return (
    <form
      className="stack-sm"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !url.trim() || !publishedOn) {
          toastError('The title, the URL and the date published are all needed.');
          return;
        }
        setBusy(true);
        try {
          await api.post('/api/writeups', {
            title: title.trim(),
            url: url.trim(),
            published_on: publishedOn,
            topic: topic.trim() || null,
          });
          toast('Writeup recorded.');
          setTitle('');
          setUrl('');
          setPublishedOn('');
          setTopic('');
          await onDone();
        } catch (err) {
          toastError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid grid--2">
        <Field label="Title" htmlFor={`${uid}-title`}>
          <input
            id={`${uid}-title`}
            className="input"
            type="text"
            maxLength={255}
            required
            placeholder="The title as published"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>
        <Field
          label="URL"
          htmlFor={`${uid}-url`}
          hint="It has to be a full http or https address."
        >
          <input
            id={`${uid}-url`}
            className="input"
            type="url"
            maxLength={500}
            required
            placeholder="https://where-it-is-published"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid--2">
        <Field label="Published on" htmlFor={`${uid}-pub`}>
          <input
            id={`${uid}-pub`}
            className="input"
            type="date"
            required
            value={publishedOn}
            onChange={(e) => setPublishedOn(e.target.value)}
          />
        </Field>
        <Field label="Topic" htmlFor={`${uid}-topic`}>
          <input
            id={`${uid}-topic`}
            className="input"
            type="text"
            maxLength={200}
            placeholder="ITC Reclaim, Ragas, the MCP server"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
      </div>
      <div className="row">
        <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
          Record the writeup
        </button>
      </div>
    </form>
  );
}

const MOCK_COLUMNS: Column<MockRow>[] = [
  { key: 'held_on', label: 'Held on', render: (r) => shortDate(r.held_on) },
  { key: 'platform', label: 'Platform' },
  { key: 'topic', label: 'Topic' },
  { key: 'kind', label: 'Kind', render: (r) => kindLabel(r.kind) },
  {
    key: 'score',
    label: 'Score',
    num: true,
    render: (r) => (r.score === null ? '' : `${r.score} of 10`),
  },
  { key: 'what_broke', label: 'What broke' },
];

function Extras({
  mocks,
  writeups,
  onDone,
}: {
  mocks: MocksPayload;
  writeups: WriteupsPayload;
  onDone: () => Promise<void>;
}) {
  const caseStudies = mocks.by_kind?.case_study ?? 0;

  return (
    <>
      <Section title="Mock interviews">
        <StatGrid
          columns={3}
          stats={[
            {
              value: `${int(mocks.total)} of ${int(mocks.week20_target)}`,
              label: 'mocks, against the Week 20 target',
              tone: mocks.total >= mocks.week20_target ? 'green' : mocks.total ? 'orange' : 'red',
            },
            {
              value: `${int(caseStudies)} of ${int(mocks.case_study_target)}`,
              label: 'case studies rather than coding mocks',
              tone: caseStudies >= mocks.case_study_target ? 'green' : undefined,
            },
            {
              value: `${int(mocks.from_february_target)} a week`,
              label: 'the rate from February onward',
            },
          ]}
        />
        <p className="text-sm muted measure">{mocks.note}</p>
        {mocks.mocks.length ? (
          <Table columns={MOCK_COLUMNS} rows={mocks.mocks} rowKey={(r) => r.id} />
        ) : (
          <EmptyState
            title="No mocks recorded"
            body="Ten in Week 20, four of them case studies, then two a week from February. A mock you did not write up is a mock you will repeat."
          />
        )}
        <details className="acc">
          <summary className="acc__summary">Record a mock</summary>
          <div className="acc__body">
            <MockForm onDone={onDone} />
          </div>
        </details>
      </Section>

      <Section title="Writeups">
        <StatGrid
          columns={3}
          stats={[
            {
              value: `${int(writeups.total)} of ${int(writeups.target)}`,
              label: 'published',
              tone: writeups.total >= writeups.target ? 'green' : writeups.total ? 'orange' : 'red',
            },
          ]}
        />
        <p className="text-sm muted measure">{writeups.note}</p>
        {writeups.writeups.length ? (
          <div className="stack-sm">
            {writeups.writeups.map((w) => (
              <div className="linkrow" key={w.id}>
                <div className="linkrow__main">
                  <div className="linkrow__title">
                    <ExternalLink href={w.url}>{w.title}</ExternalLink>
                    <span className="badge badge--outline">{shortDate(w.published_on)}</span>
                  </div>
                  {w.topic ? <p className="linkrow__why">{w.topic}</p> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing published yet"
            body="Three pieces: the ITC Reclaim reconciliation logic, the Ragas numbers and what they revealed, and the MCP server. These are what recruiters actually read."
          />
        )}
        <details className="acc">
          <summary className="acc__summary">Record a writeup</summary>
          <div className="acc__body">
            <WriteupForm onDone={onDone} />
          </div>
        </details>
      </Section>
    </>
  );
}

/* --------------------------------------------------------------------- main */

export function ApplicationsScreen() {
  const apps = useResource<ApplicationsPayload>('/api/applications');
  const mocks = useResource<MocksPayload>('/api/mocks');
  const writeups = useResource<WriteupsPayload>('/api/writeups');
  const { toast, toastError } = useToast();

  const reload = useCallback(async () => {
    await Promise.all([apps.refresh(), mocks.refresh(), writeups.refresh()]);
  }, [apps, mocks, writeups]);

  const error = apps.error ?? mocks.error ?? writeups.error;
  const loading =
    apps.loading || mocks.loading || writeups.loading || !apps.data || !mocks.data || !writeups.data;

  const setApps = apps.setData;

  const onMove = useCallback(
    async (a: ApplicationRow, status: string) => {
      const from = a.status;
      if (status === from) return;
      const paint = (next: string) =>
        setApps((prev) =>
          prev
            ? {
                ...prev,
                applications: prev.applications.map((row) =>
                  row.id === a.id ? { ...row, status: next } : row
                ),
              }
            : prev
        );
      const ok = await optimistic({
        apply: () => paint(status),
        revert: () => paint(from),
        write: async () => {
          await api.patch(`/api/applications/${a.id}`, { status });
          return true;
        },
        onError: (err) => toastError(err.message),
      });
      if (ok) toast(`${a.company} moved to ${statusMeta(status).label}.`);
    },
    [setApps, toast, toastError]
  );

  const onDelete = useCallback(
    async (a: ApplicationRow) => {
      try {
        await api.del(`/api/applications/${a.id}`);
        await reload();
        toast(`${a.company} deleted.`);
      } catch (err) {
        toastError((err as Error).message);
      }
    },
    [reload, toast, toastError]
  );

  if (error) {
    return (
      <section className="stack-sm" aria-label="Application warnings">
        <ErrorCard message={error} />
      </section>
    );
  }

  if (loading) {
    return (
      <>
        <section className="stack-sm" aria-label="Application warnings">
          <LoadingCard text="Loading application warnings." />
        </section>
        <section className="stack" aria-label="The counter">
          <LoadingCard text="Loading the counter." />
        </section>
        <section className="stack" aria-label="Add an application">
          <LoadingCard text="Loading add an application." />
        </section>
        <section className="stack" aria-label="The funnel">
          <LoadingCard text="Loading the funnel." />
        </section>
        <section className="stack" aria-label="Mocks and writeups">
          <LoadingCard text="Loading mocks and writeups." />
        </section>
      </>
    );
  }

  const d = apps.data!;

  return (
    <>
      <section className="stack-sm" aria-label="Application warnings">
        <Banners d={d} />
      </section>
      <section className="stack" aria-label="The counter">
        <Counter d={d} />
      </section>
      <section className="stack" aria-label="Add an application">
        <AddForm d={d} onDone={reload} />
      </section>
      <section className="stack" aria-label="The funnel">
        <Board d={d} onMove={onMove} onDelete={onDelete} />
      </section>
      <section className="stack" aria-label="Mocks and writeups">
        <Extras mocks={mocks.data!} writeups={writeups.data!} onDone={reload} />
      </section>
    </>
  );
}

export default ApplicationsScreen;
