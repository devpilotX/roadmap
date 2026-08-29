/**
 * format.ts | the formatting helpers every screen shares.
 *
 * Deliberately free of any browser or server dependency, so a server component
 * and a client component format the same number the same way.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** Indian digit grouping, which is what every number in this app uses. */
export function int(n: unknown): string {
  return Number(n ?? 0).toLocaleString('en-IN');
}

export function rupees(n: unknown): string {
  return `Rs ${Number(n ?? 0).toLocaleString('en-IN')}`;
}

export function pct(part: unknown, whole: unknown): number {
  if (!Number(whole)) return 0;
  return Math.round((Number(part) / Number(whole)) * 100);
}

/** Clamped to 0 to 100, for a meter width. */
export function clampPct(value: unknown): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

export function minutesLabel(m: unknown): string {
  const n = Math.max(0, Math.round(Number(m) || 0));
  if (n < 60) return `${n} m`;
  const h = Math.floor(n / 60);
  const rest = n % 60;
  return rest ? `${h} h ${rest} m` : `${h} h`;
}

export function weekdayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return DAYS[(d.getUTCDay() + 6) % 7];
}

/** "Friday, 28 August 2026" */
export function longDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${weekdayOf(iso)}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** "28 Aug 2026" */
export function shortDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return String(iso);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000
  );
}

export type DayColour = 'green' | 'amber' | 'red' | 'neutral';

/** The badge class and label for a day colour. */
export function colourBadge(colour: string | null | undefined): {
  cls: string;
  label: string;
} {
  const map: Record<string, { cls: string; label: string }> = {
    green: { cls: 'badge--green', label: 'Green day' },
    amber: { cls: 'badge--orange', label: 'Amber day' },
    red: { cls: 'badge--red', label: 'Red day' },
    neutral: { cls: 'badge--outline', label: 'Neutral, rest Sunday' },
  };
  return map[String(colour)] ?? map.red;
}

/** The phase class for A to F, used for the dot and the bar. */
export function phaseClass(code: string | null | undefined): string {
  const c = String(code ?? '').trim().toLowerCase();
  return /^[a-f]$/.test(c) ? `phase-${c}` : '';
}

export { MONTHS, DAYS };
