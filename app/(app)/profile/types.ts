/**
 * The shapes GET /api/me returns, named after the API's own fields.
 */

export interface MeUser {
  id: number;
  email: string;
  display_name: string | null;
  created_at: string | null;
  last_login_at: string | null;
}

export interface MeProfile {
  user_id: number;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  github_user: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  site_1: string | null;
  site_2: string | null;
  site_3: string | null;
  upi_id: string | null;
  avatar_path: string | null;
  target_role: string | null;
  roadmap_start: string;
  roadmap_end: string;
  timezone: string;
  bio: string | null;
  has_github_token: boolean;
}

export interface MeSettings {
  user_id: number;
  theme: string;
  calendar_view: string;
  notify_blocks: string[];
  notify_gates: number;
  public_progress: number;
  public_slug: string | null;
  last_synced_at: string | null;
}

export interface MePayload {
  user: MeUser;
  profile: MeProfile | null;
  settings: MeSettings;
  today: string;
  timezone: string;
}

/* --------------------------------------------------------- GET /api/ops */

export interface BackupRow {
  id: number;
  ran_at: string | null;
  kind: string;
  file_name: string;
  bytes: number | null;
  ok: number;
  message: string | null;
}

export interface LinkCheckRun {
  id: number;
  started_at: string | null;
  finished_at: string | null;
  checked_count: number;
  dead_count: number;
  notes: string | null;
}

export interface DeadLinkRow {
  where: string;
  label: string;
  url: string;
  last_status: number | null;
  last_checked: string | null;
}

export interface DsaImportRow {
  id: number;
  source_name: string;
  rows_read: number;
  rows_written: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
  dry_run: number;
  report: string | null;
  created_at: string | null;
}

export interface OpsCommand {
  label: string;
  command: string;
}

export interface OpsPayload {
  link_check: {
    runs: LinkCheckRun[];
    last: LinkCheckRun | null;
    dead_resources: {
      category_no: number;
      ord: number;
      label: string;
      url: string;
      last_status: number | null;
      last_checked: string | null;
    }[];
    dead_week_links: {
      week_n: number;
      ord: number;
      label: string;
      url: string;
      last_status: number | null;
      last_checked: string | null;
    }[];
    dead_total: number;
    note: string;
  };
  backups: {
    rows: BackupRow[];
    last_dump: BackupRow | null;
    last_export: BackupRow | null;
    note: string;
  };
  dsa_imports: {
    rows: DsaImportRow[];
    last: DsaImportRow | null;
    note: string;
  };
  commands: OpsCommand[];
}
