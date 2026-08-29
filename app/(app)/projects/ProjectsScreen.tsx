'use client';

/**
 * ProjectsScreen | Part 5, the four projects.
 *
 * One problem taken three times, then a second problem.
 *
 * The README checklist is the part that gets skipped, so it is nine real
 * checkboxes here rather than a line of advice, and the percentage on each card
 * is the README, not a feeling about how the project is going.
 *
 * "Live" requires a URL. The API enforces it and this screen refuses to send the
 * status without one, because a project nobody can open is not evidence.
 */

import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import {
  Badge,
  EmptyState,
  ErrorCard,
  ExternalLink,
  Meter,
  StatGrid,
  LoadingSections,
} from '@/components/ui/Basics';
import { Field, Tick } from '@/components/ui/Controls';
import { useResource } from '@/components/ui/useResource';
import { api, type ApiError } from '@/lib/client/api';
import { int } from '@/lib/client/format';

type Status = 'not_started' | 'in_progress' | 'shipped' | 'live';

const STATUS: { value: Status; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'live', label: 'Live' },
];

const TONE: Record<string, 'green' | 'orange' | 'blue' | 'outline'> = {
  not_started: 'outline',
  in_progress: 'blue',
  shipped: 'orange',
  live: 'green',
};

interface ReadmeSection {
  id: number;
  ord: number;
  title: string;
}

interface Project {
  id: number;
  code: string;
  name: string;
  repo: string;
  week_from: number;
  week_to: number;
  description: string;
  status: Status;
  live_url: string | null;
  repo_url: string | null;
  notes: string;
  readme_done: number[];
  readme_percent: number;
  is_active: boolean;
  pushes_this_week: number;
  commits_this_week: number;
}

interface Payload {
  readme_sections: ReadmeSection[];
  current_week: number | null;
  projects: Project[];
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge tone={TONE[status] ?? 'outline'}>
      {STATUS.find((s) => s.value === status)?.label ?? status}
    </Badge>
  );
}

/* -------------------------------------------------------------- one project */

function ProjectCard({
  p,
  sections,
  onSaved,
}: {
  p: Project;
  sections: ReadmeSection[];
  onSaved: () => Promise<void>;
}) {
  const { toast, toastError } = useToast();

  const [status, setStatus] = useState<Status>(p.status);
  const [live, setLive] = useState(p.live_url ?? '');
  const [repo, setRepo] = useState(p.repo_url ?? '');
  const [note, setNote] = useState(p.notes ?? '');
  const [done, setDone] = useState<number[]>(p.readme_done.map(Number));
  const [busy, setBusy] = useState(false);
  const [pendingSection, setPendingSection] = useState<number | null>(null);

  const total = sections.length || 1;
  const percent = Math.round((done.length / total) * 100);

  async function write(patch: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await api.patch(`/api/projects/${p.id}/progress`, patch);
      toast('Saved.');
      return true;
    } catch (err) {
      toastError((err as ApiError).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleSection(id: number, want: boolean) {
    const next = want ? [...done, id] : done.filter((x) => x !== id);
    setPendingSection(id);
    try {
      await api.patch(`/api/projects/${p.id}/progress`, { readme_done: next });
      setDone(next);
      await onSaved();
    } catch (err) {
      toastError((err as ApiError).message);
    } finally {
      setPendingSection(null);
    }
  }

  async function changeStatus(want: Status) {
    if ((want === 'live' || want === 'shipped') && !live.trim()) {
      toastError('Shipped and live both need a URL. Put the address in and save it first.');
      return;
    }
    if (await write({ status: want })) {
      setStatus(want);
      await onSaved();
    }
  }

  async function save() {
    if (await write({ live_url: live.trim(), repo_url: repo.trim(), notes: note })) {
      await onSaved();
    }
  }

  return (
    <div className={`projcard ${p.is_active ? 'projcard--active' : ''}`}>
      <div className="projcard__head">
        <div className="row">
          <span className="projcard__code">{p.code}</span>
          <h2 className="card__title">{p.name}</h2>
        </div>
        <div className="row">
          <StatusBadge status={status} />
          <Badge tone="outline">
            Weeks {p.week_from} to {p.week_to}
          </Badge>
          {p.is_active ? <Badge tone="blue">Current</Badge> : null}
        </div>
      </div>

      <p className="measure">{p.description}</p>

      <div className="row">
        <span className="text-sm muted">Repository {p.repo}</span>
        <span className="text-sm muted">
          {int(p.pushes_this_week)} pushes and {int(p.commits_this_week)} commits this week
        </span>
      </div>

      <div className="stack-sm">
        <span className="text-sm muted">
          README {done.length} of {sections.length}
        </span>
        <Meter percent={percent} tone={percent === 100 ? 'green' : undefined} />
      </div>

      <details className="acc">
        <summary className="acc__summary">
          The {sections.length} README sections a stranger reads first
        </summary>
        <div className="acc__body">
          <ul className="readmelist">
            {sections.map((s) => (
              <li key={s.id}>
                <Tick
                  checked={done.includes(Number(s.id))}
                  disabled={pendingSection === Number(s.id)}
                  pending={pendingSection === Number(s.id)}
                  onChange={(want) => void toggleSection(Number(s.id), want)}
                  label={s.title}
                />
              </li>
            ))}
          </ul>
        </div>
      </details>

      <div className="grid grid--3">
        <Field label="Status" htmlFor={`p-status-${p.id}`}>
          <select
            id={`p-status-${p.id}`}
            className="select select--sm"
            aria-label={`Status of ${p.name}`}
            value={status}
            disabled={busy}
            onChange={(e) => void changeStatus(e.target.value as Status)}
          >
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Live URL" htmlFor={`p-live-${p.id}`}>
          <input
            id={`p-live-${p.id}`}
            className="input"
            type="url"
            value={live}
            placeholder="https://the-live-site"
            onChange={(e) => setLive(e.target.value)}
          />
        </Field>

        <Field label="Repository URL" htmlFor={`p-repo-${p.id}`}>
          <input
            id={`p-repo-${p.id}`}
            className="input"
            type="url"
            value={repo}
            placeholder={`https://github.com/you/${p.repo}`}
            onChange={(e) => setRepo(e.target.value)}
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor={`p-notes-${p.id}`}>
        <textarea
          id={`p-notes-${p.id}`}
          className="textarea"
          rows={2}
          placeholder="What is actually blocking it."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <div className="between">
        <div className="row">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={busy}
            onClick={() => void save()}
          >
            Save
          </button>
          {p.live_url ? (
            <ExternalLink href={p.live_url} className="btn btn--sm btn--ghost">
              Open the live site
            </ExternalLink>
          ) : null}
          {p.repo_url ? (
            <ExternalLink href={p.repo_url} className="btn btn--sm btn--ghost">
              Open the repository
            </ExternalLink>
          ) : null}
        </div>
        <span className="text-xs muted">A screenshot is not a shipped project. A URL is.</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- main */

export function ProjectsScreen() {
  const { data, error, loading, refresh } = useResource<Payload>('/api/projects');

  if (error) return <ErrorCard message={error} />;
  if (loading || !data) {
    return (
      <LoadingSections
        sections={[
          { label: 'Project summary', text: 'Loading project summary.' },
          { label: 'The four projects', text: 'Loading the four projects.', className: 'stack-lg' },
        ]}
      />
    );
  }

  const sections = data.readme_sections ?? [];
  const projects = data.projects ?? [];

  const live = projects.filter((p) => p.status === 'live').length;
  const shipped = projects.filter((p) => p.status === 'shipped' || p.status === 'live').length;
  const readmeDone = projects.filter((p) => p.readme_percent === 100).length;
  const active = projects.find((p) => p.is_active);

  return (
    <>
      <section className="stack" aria-label="Project summary">
        <StatGrid
          stats={[
            {
              value: `${live} of ${projects.length}`,
              label: 'live, at a URL a stranger can open',
              tone: live ? 'green' : 'red',
              hero: true,
            },
            { value: `${shipped} of ${projects.length}`, label: 'shipped or live' },
            {
              value: `${readmeDone} of ${projects.length}`,
              label: `READMEs finished, all ${sections.length} sections`,
            },
            {
              value: active ? active.code : '-',
              label: active
                ? 'the project this week belongs to'
                : data.current_week
                  ? 'no project owns this week'
                  : 'outside the roadmap window',
              sub: active ? active.name : '',
            },
          ]}
        />
        <p className="text-sm muted measure">
          One problem taken three times, then a second problem. The README is what a stranger reads
          before they read a line of your code, so it is a checklist here and not a suggestion.
        </p>
      </section>

      <section className="stack-lg" aria-label="The four projects">
        {projects.length ? (
          projects.map((p) => (
            <ProjectCard key={p.id} p={p} sections={sections} onSaved={refresh} />
          ))
        ) : (
          <EmptyState
            title="No projects yet"
            body="The four projects come from Part 5 of final.md. Run npm run setup."
          />
        )}
      </section>
    </>
  );
}

export default ProjectsScreen;
