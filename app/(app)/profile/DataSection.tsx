'use client';

/**
 * Your data. Everything this application knows about you can leave it in one
 * click, and the seeded plan goes with it, because the progress means nothing
 * without the plan it was measured against.
 */

import { Icon } from '@/components/Icon';
import { Section } from '@/components/ui/Basics';
import { Switch } from '@/components/ui/Controls';
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
  /**
   * Public progress is a switch with nothing on the other end of it.
   *
   * PATCH /api/me/settings does store the flag and does mint a slug, but no route
   * in this build serves a public page for that slug, so turning it on changed a
   * row and nothing else: the person is told their progress is public when it is
   * not published anywhere, which is the worst of the three possible states. It is
   * disabled and labelled rather than deleted, because the flag and the slug are
   * real columns that appear in your own export, and hiding the control would hide
   * that fact rather than explain it. The switch comes back on the day there is a
   * page behind it.
   */
  const publicProgress = Boolean(settings.public_progress);
  const slug = settings.public_slug ?? '';

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
          disabled
          // Disabled, so this can never fire. It exists because Switch is a
          // controlled component and every controlled component in this build owns
          // its handler; there is deliberately no write behind it.
          onChange={() => undefined}
          label={
            <span className="stack-sm">
              <span className="text-sm">Make my progress public, not available yet</span>
              <span className="field__hint">
                Nothing in this build serves a public page, so there is nothing for this switch to
                turn on, and it cannot be moved until there is a page behind it. Whichever way it is
                sitting, no page of yours is being served. The flag and the slug are real columns and
                are in your export either way.
              </span>
            </span>
          }
        />
        {slug ? (
          <p className="text-sm muted">{`Your account already holds the slug ${slug}, from before this control was disabled. Nothing serves it.`}</p>
        ) : (
          <p className="text-sm muted">No public slug has been generated for your account.</p>
        )}
      </div>
    </Section>
  );
}

export default DataSection;
