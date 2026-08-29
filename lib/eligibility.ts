/**
 * eligibility.ts | Part 19, computed live and never stored.
 *
 * The one rule that governs this file: eligible is not a reason to apply.
 * Eligible plus advised is.
 *
 * A role counts as eligible today when there is a row in the Part 19.3 ladder
 * that names it, and both of that row's conditions are actually met:
 *   - the week it belongs to has been finished, from week_day_progress
 *   - the DSA total for that week has been reached, from real solved problems
 *
 * Part 19.3 names FE one week early with the qualifier "weakly". That mention is
 * honoured, and the resulting chip is marked weak rather than full, because the
 * document itself draws that distinction.
 */

import { ROLE_CODES_ALL, ROLE_CODES_MAIN } from './roleCodes';

const GATE3_DATE = '2026-12-13';

function parseCodes(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export interface EligibilityInput {
  today: string;
  /** Real solved problem count. */
  solved: number;
  /** Week numbers finished in full. */
  completedWeeks: number[];
  eligibilityWeeks: Record<string, any>[];
  rolesEarly: Record<string, any>[];
  roles: Record<string, any>[];
  eligibilityDsa: Record<string, any>[];
  skillCombos: Record<string, any>[];
  fastExits: Record<string, any>[];
  currentWeek: { n: number | string } | null;
}

export function computeEligibility(input: EligibilityInput) {
  const {
    today,
    solved,
    completedWeeks,
    eligibilityWeeks,
    rolesEarly,
    roles,
    eligibilityDsa,
    skillCombos,
    fastExits,
    currentWeek,
  } = input;

  const done = new Set(completedWeeks);
  const weekReached = (weekN: number): boolean => (weekN === 0 ? solved >= 6 : done.has(weekN));

  const ladder: Record<string, any>[] = eligibilityWeeks
    .map((row) => ({
      ...row,
      week_n: Number(row.week_n),
      dsa_total: Number(row.dsa_total),
      codes: parseCodes(row.newly_eligible_codes),
      is_advised: Number(row.is_advised) === 1,
      week_done: weekReached(Number(row.week_n)),
      dsa_met: solved >= Number(row.dsa_total),
      reached: weekReached(Number(row.week_n)) && solved >= Number(row.dsa_total),
    }))
    .sort((a, b) => a.week_n - b.week_n);

  /* ---- which of the sixteen roles are eligible, and how strongly ---- */

  const strength = new Map<string, { via: string; week_n: number; weak: boolean }>();
  for (const row of ladder) {
    if (!row.reached) continue;
    const weak = /weakly/i.test(String(row.newly_eligible_text ?? ''));
    for (const code of row.codes) {
      const existing = strength.get(code);
      // A later, unqualified mention upgrades a weak one to full.
      if (!existing || (existing.weak && !weak)) {
        strength.set(code, { via: row.week_key, week_n: row.week_n, weak });
      }
    }
  }

  const earlyByCode = new Map(rolesEarly.map((r) => [r.code, r]));
  const mainByCode = new Map(roles.map((r) => [r.code, r]));

  const eligible = ROLE_CODES_ALL.filter((c) => strength.has(c)).map((code) => {
    const early = earlyByCode.get(code);
    const main = mainByCode.get(code);
    const s = strength.get(code)!;
    return {
      code,
      role: early ? early.role : main?.name ?? code,
      band: early ? early.entry_band : main?.entry_band ?? '',
      band_low_lakh: Number(early?.band_low_lakh ?? main?.band_low_lakh ?? 0),
      band_high_lakh: Number(early?.band_high_lakh ?? main?.band_high_lakh ?? 0),
      verdict: early ? early.verdict : main?.verdict ?? '',
      set: early ? 'early' : 'part12',
      unlocked_at_week: s.week_n,
      unlocked_at: s.via,
      strength: s.weak ? 'weak' : 'full',
    };
  });

  /* ---- advised, taken from the current week's row ---- */

  const currentRow = currentWeek
    ? ladder.find((r) => r.week_n === Number(currentWeek.n)) ?? null
    : null;
  const advised = currentRow ? currentRow.is_advised : false;
  const applicationsOpen = today >= GATE3_DATE;

  /* ---- next unlock ---- */

  const next = ladder.find((r) => !r.reached) ?? null;
  const nextUnlock = next
    ? {
        week_key: next.week_key,
        week_n: next.week_n,
        reached_date: next.reached_date,
        dsa_total: next.dsa_total,
        problems_needed: Math.max(0, next.dsa_total - solved),
        week_done: next.week_done,
        newly_holds: next.newly_holds,
        newly_eligible_text: next.newly_eligible_text,
        codes: next.codes,
        band: next.band,
        sentence:
          next.week_n === 0
            ? `Solve ${Math.max(0, next.dsa_total - solved)} more problems to clear the launch block.`
            : `Solve ${Math.max(0, next.dsa_total - solved)} more ${
                Math.max(0, next.dsa_total - solved) === 1 ? 'problem' : 'problems'
              } and finish Week ${next.week_n}.`,
      }
    : null;

  /* ---- the DSA only ladder, with the current position marked ---- */

  const dsaLadder = eligibilityDsa
    .map((r) => ({ ...r, problems: Number(r.problems), reached: solved >= Number(r.problems) }))
    .sort((a, b) => a.problems - b.problems);
  const dsaPositionIndex = (() => {
    let idx = -1;
    dsaLadder.forEach((r, i) => {
      if (r.reached) idx = i;
    });
    return idx;
  })();

  /* ---- the skill combination matrix, with the held row highlighted ---- */

  const combos: Record<string, any>[] = skillCombos
    .map((c): Record<string, any> => ({
      ...c,
      dsa_needed: Number(c.dsa_needed),
      codes: parseCodes(c.roles_unlocked_codes),
      dsa_met: solved >= Number(c.dsa_needed),
      // The stack is held when every role this row unlocks is already eligible.
      stack_held_now: parseCodes(c.roles_unlocked_codes).every((code) => strength.has(code)),
    }))
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
  const currentComboIndex = (() => {
    let idx = -1;
    combos.forEach((c, i) => {
      if (c.stack_held_now && c.dsa_met) idx = i;
    });
    return idx;
  })();

  /* ---- the four exits, with the rupee cost attached to the early ones ---- */

  const exits: Record<string, any>[] = fastExits
    .map((e): Record<string, any> => ({
      ...e,
      before_gate3: Number(e.before_gate3) === 1,
      is_past: e.exit_date < today,
      days_away: Math.round(
        (new Date(`${e.exit_date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) /
          86400000
      ),
      costs_money: Number(e.before_gate3) === 1,
      cost_note: e.cost_note,
    }))
    .sort((a, b) => Number(a.exit_no) - Number(b.exit_no));

  return {
    today,
    solved,
    total_roles: ROLE_CODES_ALL.length,
    part12_roles: ROLE_CODES_MAIN.length,
    eligible_count: eligible.length,
    headline: `You are eligible for ${eligible.length} of ${ROLE_CODES_ALL.length} roles today`,
    eligible,
    advised,
    advised_badge: advised
      ? { label: 'Advised', tone: 'green' }
      : { label: 'Not advised', tone: 'red' },
    current_week_row: currentRow,
    applications_open: applicationsOpen,
    banner: applicationsOpen
      ? { tone: 'green', text: 'Applications start today' }
      : { tone: 'red', text: 'Eligible is not a reason to apply. Eligible plus advised is.' },
    gate3_date: GATE3_DATE,
    next_unlock: nextUnlock,
    ladder,
    dsa_ladder: dsaLadder,
    dsa_position_index: dsaPositionIndex,
    dsa_callout: 'No number in this table unlocks a single role.',
    combos,
    current_combo_index: currentComboIndex,
    exits,
    early_exits: exits.filter((e) => e.before_gate3),
    early_exit_heading: 'This costs you money',
    completed_weeks: [...done].sort((a, b) => a - b),
  };
}

export type EligibilityResult = ReturnType<typeof computeEligibility>;

export { GATE3_DATE };
