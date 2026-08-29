/**
 * types.ts | the five money payloads, and the enums the money hour moves through.
 *
 * Every list here mirrors a zod enum on the server, so a select on this screen
 * can only ever offer a value the database will accept.
 */

/** The last day of the roadmap. Used to decide which weeks have a real actual. */
export const LAST_DAY = '2027-01-24';

/** The lead statuses, in the order the pipeline actually moves. */
export const LANES = [
  { value: 'new', label: 'New' },
  { value: 'touched', label: 'Touched' },
  { value: 'replied', label: 'Replied' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'dead', label: 'Dead' },
] as const;

export const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'walkin', label: 'Walk in' },
  { value: 'instagram', label: 'Instagram' },
] as const;

export const DEAL_STATUS = [
  { value: 'quoted', label: 'Quoted' },
  { value: 'advance_paid', label: 'Advance paid' },
  { value: 'in_delivery', label: 'In delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'dead', label: 'Dead' },
] as const;

export const DEAL_TONE: Record<string, string> = {
  quoted: 'badge--outline',
  advance_paid: 'badge--blue',
  in_delivery: 'badge--blue',
  delivered: 'badge--orange',
  paid: 'badge--green',
  refunded: 'badge--red',
  dead: 'badge--red',
};

/**
 * The header the CSV importer reads. These are the twelve names in the
 * LEAD_COLUMNS constant of the import handler, which is where the server defines
 * them and which in turn takes them from the leads.csv sheet in Appendix B of
 * final.md. The constant is private to that module and no endpoint returns it,
 * so it is repeated here rather than fetched. If Appendix B ever changes, both
 * places have to change together.
 */
export const LEAD_CSV_COLUMNS = [
  'name',
  'category',
  'area',
  'phone',
  'website',
  'mobile broken',
  'rating',
  'reviews',
  'status',
  'last touch date',
  'next touch date',
  'notes',
];

/** The importer's own limit, from the zod schema on POST /api/leads/import. */
export const CSV_MAX_CHARS = 2_000_000;

export const laneLabel = (value: string): string =>
  LANES.find((l) => l.value === value)?.label ?? value;

export const dealLabel = (value: string): string =>
  DEAL_STATUS.find((s) => s.value === value)?.label ?? value;

/* ------------------------------------------------------- the money summary */

export type WeekTargetRow = {
  week_n: number;
  focus: string;
  target_text: string;
  target_low: number | null;
  target_high: number | null;
  actual: number;
  is_current: boolean;
};

export type MonthTargetRow = {
  id: number;
  ord: number;
  month_label: string;
  target_text: string;
  target_low: number | null;
  target_high: number | null;
  what_produces_it: string | null;
  is_total: number;
  actual: number;
};

export interface OfferRow {
  code: string;
  ord: number;
  name: string;
  scope: string;
  delivery: string;
  price_band_text: string;
  price_low: number;
  price_high: number;
  is_recurring: number;
  unlocked_from_week: number | null;
  locked: boolean;
  reason: string | null;
}

export interface ScriptDef {
  id: number;
  code: string;
  ord: number;
  channel: string;
  title: string;
  body: string;
  version: number;
  is_original: number;
  latest_version?: number;
}

export interface MoneyGateRow {
  code: string;
  ord: number;
  gate_date: string;
  condition_text: string;
  if_it_fails: string;
  passed: boolean;
  passed_at: string | null;
  amount_received: number | null;
  notes?: string | null;
  is_past: boolean;
  show_if_it_fails: boolean;
}

export type LaneRow = {
  id: number;
  ord: number;
  lane: string;
  what_it_is: string;
  time_to_first_rupee: string;
  ceiling: string;
  use_it_for: string;
};

export type HourShapeRow = {
  id: number;
  ord: number;
  day_name: string;
  first_forty: string;
  last_twenty: string;
};

export interface MoneySummary {
  today: string;
  week: { n: number; title: string; dates_label: string } | null;
  strip: {
    received_this_month: number;
    month_label: string;
    month_target: { low: number; high: number } | null;
    received_total: number;
    target_total: number;
    care_plan_count: number;
    care_plan_monthly: number;
    care_plan_target: number;
    days_since_last_touch: number | null;
    days_since_last_rupee: number | null;
  };
  week_plan: WeekTargetRow[];
  month_plan: MonthTargetRow[];
  offers: OfferRow[];
  scripts: ScriptDef[];
  money_gates: MoneyGateRow[];
  rules: { id: number; group_key: string; ord: number; rule: string }[];
  lanes: LaneRow[];
  hour_shape: HourShapeRow[];
  refuse: { id: number; ord: number; item: string }[];
  buyback: { id: number; ord: number; item: string }[];
  first_hour: { id: number; ord: number; step: string }[];
  lead_sources: { id: number; ord: number; source: string }[];
  touches: {
    touches: number;
    replies: number;
    reply_rate: number;
    last_touch: string | null;
    by_week: { week_n: number; touches: number; replies: number }[];
  };
  deals: {
    by_status: Record<string, { count: number; value: number }>;
    quoted: number;
    won: number;
    win_rate: number;
  };
  pipeline: Record<string, number>;
  touch_target_today: number | null;
  money_task_today: string | null;
  received_by_month: { month: string; label: string; amount: number }[];
  events: { on: string; amount: number; kind?: string; what?: string }[];
}

/* ---------------------------------------------------------------- the leads */

export interface Lead {
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
  notes?: string | null;
  touch_count?: number;
}

export interface LeadsPayload {
  leads: Lead[];
  next_15: Lead[];
  count: number;
  today: string;
}

/** What POST /api/leads/import sends back, on a dry run and on a real one. */
export interface ImportReport {
  read: number;
  written?: number;
  skipped: number;
  problems: string[];
  dry_run: boolean;
  would_write?: number;
  sample?: string[];
}

/* ---------------------------------------------------------------- the deals */

export interface Deal {
  id: number;
  lead_id: number | null;
  client_name: string;
  offer_code: string;
  price: number;
  advance_amount: number | null;
  advance_on: string | null;
  delivery_due: string | null;
  delivered_on: string | null;
  balance_amount: number | null;
  balance_on: string | null;
  status: string;
  referral_asked: number;
  notes: string | null;
  lead_name: string | null;
  offer_name: string;
  price_low: number;
  price_high: number;
  overdue: boolean;
  days_to_delivery: number | null;
}

export interface DealsPayload {
  today: string;
  deals: Deal[];
  stats: {
    by_status: Record<string, { count: number; value: number }>;
    quoted: number;
    won: number;
    win_rate: number;
  };
}

export type CarePlan = {
  id: number;
  client_name: string;
  monthly_amount: number;
  started_on: string;
  active: number;
  last_invoice_on: string | null;
  notes: string | null;
};

export interface CarePlansPayload {
  care_plans: CarePlan[];
  floor: { count: number; monthly: number };
  target: number;
}

/* -------------------------------------------------------------- the scripts */

export interface ScriptVersion {
  id: number;
  script_code: string;
  version: number;
  title: string;
  body: string;
  created_at: string;
}

export interface ScriptsPayload {
  scripts: ScriptDef[];
  versions: ScriptVersion[];
  substitutions: Record<string, string>;
  note: string;
}
