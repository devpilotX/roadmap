'use client';

/**
 * Your data. Everything this application knows about you can leave it in one
 * click, and the seeded plan goes with it, because the progress means nothing
 * without the plan it was measured against.
 */

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ToastProvider';
import { Section } from '@/components/ui/Basics';
import { Switch } from '@/components/ui/Controls';
import { api, ApiError } from '@/lib/client/api';
import type { MeSettings } from './types';

const ICON_DOWNLOAD = 'M12 3v12M8 11l4 4 4-4M4 19h16';

/**
 * The tables the export routes accept. The user tables come first because those
 * are the ones that hold your own record.
 */
const USER_TABLES = [
  'day_logs',
  'dsa_progress',
  'dsa_topic_progress',
  'week_day_progress',
  'resource_progress',
  'week_link_progress',
  'study_sessions',
  'gate_results',
  'money_gate_results',
  'sunday_logs',
  'project_progress',
  'github_repos',
  'github_pushes',
  'applications',
  'mock_interviews',
  'writeups',
  'leads',
  'lead_touches',
  'deals',
  'care_plans',
  'nz_progress',
  'continuation_progress',
  'money_script_versions',
  'audit_log',
];

const REFERENCE_TABLES = [
  'weeks',
  'week_days',
  'calendar_days',
  'week_links',
  'resources',
  'resource_categories',
  'gates',
  'money_gates',
  'sundays',
  'projects',
  'offers',
  'money_week_targets',
  'money_scripts',
  'roles',
  'roles_early',
  'skills',
  'eligibility_weeks',
  'eligibility_dsa',
  'fast_exits',
  'skill_combos',
  'warning_rules',
  'corrections',
  'stack_versions',
];

function TableLinks({ names }: { names: string[] }) {
  return (
    <div className="row">
      {names.map((name) => (
        <a
          className="btn btn--sm btn--ghost"
          href={`/api/export/${name}.csv`}
          download={`${name}.csv`}
          key={name}
        >
          {name}
        </a>
      ))}
    </div>
  );
}

export function DataSection({ settings }: { settings: MeSettings }) {
  const { toastOk, toastError } = useToast();

  const [publicProgress, setPublicProgress] = useState(Boolean(settings.public_progress));
  const [slug, setSlug] = useState(settings.public_slug ?? '');
  const [everGenerated, setEverGenerated] = useState(Boolean(settings.public_slug));
  const [busy, setBusy] = useState(false);

  const slugLine = slug
    ? `Your public slug is ${slug}.`
    : everGenerated
      ? 'No public slug has been generated yet.'
      : 'No public slug has been generated yet. One is created the first time you turn this on.';

  const toggle = async (want: boolean) => {
    setPublicProgress(want);
    setBusy(true);
    try {
      const fresh = await api.patch<MeSettings>('/api/me/settings', { public_progress: want });
      setSlug(fresh.public_slug ?? '');
      setEverGenerated(true);
      toastOk(want ? 'Public progress turned on.' : 'Public progress turned off.');
    } catch (err) {
      setPublicProgress(!want);
      toastError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Your data"
      lede="Export routes are GET /api/export/all.json and GET /api/export/:table.csv."
    >
      <p className="measure">
        Everything this application knows about you can leave it in one click. The JSON export is the
        whole thing, your progress and the seeded plan it was measured against, because the progress
        means nothing without the plan.
      </p>
      <div className="row">
        <a className="btn btn--primary" href="/api/export/all.json" download="roadmap-export.json">
          <Icon path={ICON_DOWNLOAD} />
          Download everything as JSON
        </a>
      </div>

      <p className="card__label">Or one table at a time, as CSV</p>
      <p className="field__hint">Your own records. Each of these is scoped to you.</p>
      <TableLinks names={USER_TABLES} />
      <p className="field__hint">
        The seeded plan from final.md. The same for everybody, included so an export stands alone.
      </p>
      <TableLinks names={REFERENCE_TABLES} />

      <div className="stack-sm">
        <Switch
          checked={publicProgress}
          disabled={busy}
          onChange={(want) => void toggle(want)}
          label={
            <span className="stack-sm">
              <span className="text-sm">Make my progress public</span>
              <span className="field__hint">
                This stores a flag and a random slug against your account. Nothing in this build
                serves a public page yet, so turning it on does not expose anything today.
              </span>
            </span>
          }
        />
        <p className="text-sm muted">{slugLine}</p>
      </div>
    </Section>
  );
}

export default DataSection;
