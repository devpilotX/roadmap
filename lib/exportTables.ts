/**
 * exportTables.ts | one list of exportable tables, used by two callers.
 *
 * `GET /api/export/:table.csv`, `GET /api/export/all.json` and
 * `scripts/export-all.mjs` all read this map, so a table can never be
 * exportable through the API and invisible to the backup, or the other way
 * round. Part 18.8 of final.md wants the export to be the whole thing.
 *
 * `user: true` means the table carries a user_id and is scoped to the person
 * asking. `user: false` means it is reference data seeded from final.md, which
 * is the same for everybody and is included so an export stands alone: the
 * progress makes no sense without the plan it was measured against.
 */

export interface ExportSpec {
  user: boolean;
}

/** Tables a user may export. User tables are scoped to them; reference tables are open. */
export const EXPORTABLE: Record<string, ExportSpec> = {
  day_logs: { user: true },
  dsa_progress: { user: true },
  dsa_topic_progress: { user: true },
  week_day_progress: { user: true },
  resource_progress: { user: true },
  week_link_progress: { user: true },
  study_sessions: { user: true },
  gate_results: { user: true },
  money_gate_results: { user: true },
  sunday_logs: { user: true },
  project_progress: { user: true },
  github_repos: { user: true },
  github_pushes: { user: true },
  applications: { user: true },
  mock_interviews: { user: true },
  writeups: { user: true },
  leads: { user: true },
  lead_touches: { user: true },
  deals: { user: true },
  care_plans: { user: true },
  nz_progress: { user: true },
  continuation_progress: { user: true },
  money_script_versions: { user: true },
  audit_log: { user: true },
  weeks: { user: false },
  week_days: { user: false },
  calendar_days: { user: false },
  week_links: { user: false },
  resources: { user: false },
  resource_categories: { user: false },
  gates: { user: false },
  money_gates: { user: false },
  sundays: { user: false },
  projects: { user: false },
  offers: { user: false },
  money_week_targets: { user: false },
  money_scripts: { user: false },
  roles: { user: false },
  roles_early: { user: false },
  skills: { user: false },
  eligibility_weeks: { user: false },
  eligibility_dsa: { user: false },
  fast_exits: { user: false },
  skill_combos: { user: false },
  warning_rules: { user: false },
  corrections: { user: false },
  stack_versions: { user: false },
};

export const USER_TABLES = Object.keys(EXPORTABLE).filter((t) => EXPORTABLE[t].user);
export const REFERENCE_TABLES = Object.keys(EXPORTABLE).filter((t) => !EXPORTABLE[t].user);

/**
 * RFC 4180 CSV with CRLF endings, which is what Excel and Numbers expect.
 * A null becomes an empty cell, never the four letters "null".
 */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n'
  );
}
