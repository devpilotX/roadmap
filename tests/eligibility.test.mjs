/**
 * eligibility.test.mjs | Part 19.
 *
 * The sentence this file exists to protect: eligible is not a reason to apply,
 * eligible plus advised is. Also that a role only unlocks when both halves of
 * its ladder row are true, and that "weakly" stays weak until the document
 * itself says otherwise.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { GATE3_DATE, computeEligibility } from '../lib/eligibility.ts';
import { ROLE_CODES_ALL, ROLE_CODES_EARLY, ROLE_CODES_MAIN } from '../lib/roleCodes.ts';

const eligibilityWeeks = [
  {
    week_key: 'launch', week_n: 0, dsa_total: 6, reached_date: '2026-08-30',
    newly_holds: 'The basics', newly_eligible_text: 'Nothing yet',
    newly_eligible_codes: JSON.stringify([]), is_advised: 0, band: '',
  },
  {
    week_key: 'w4', week_n: 4, dsa_total: 96, reached_date: '2026-09-27',
    newly_holds: 'HTML, CSS, JS', newly_eligible_text: 'WEB, and FE weakly',
    newly_eligible_codes: JSON.stringify(['WEB', 'FE']), is_advised: 0, band: '3 to 4.5 LPA',
  },
  {
    week_key: 'w8', week_n: 8, dsa_total: 176, reached_date: '2026-10-25',
    newly_holds: 'React and an API', newly_eligible_text: 'FE, SUP',
    newly_eligible_codes: JSON.stringify(['FE', 'SUP']), is_advised: 1, band: '4 to 6 LPA',
  },
  {
    week_key: 'w16', week_n: 16, dsa_total: 336, reached_date: '2026-12-20',
    newly_holds: 'RAG in production', newly_eligible_text: 'AAE, FDE',
    newly_eligible_codes: JSON.stringify(['AAE', 'FDE']), is_advised: 1, band: '8 to 14 LPA',
  },
];

const rolesEarly = ROLE_CODES_EARLY.map((code, i) => ({
  code, role: `Early role ${code}`, entry_band: '3 to 5 LPA',
  band_low_lakh: 3, band_high_lakh: 5, verdict: 'Real, and dull.', sort_order: i + 1,
}));

const roles = ROLE_CODES_MAIN.map((code, i) => ({
  code, name: `Main role ${code}`, entry_band: '8 to 14 LPA',
  band_low_lakh: 8, band_high_lakh: 14, verdict: 'The target.', sort_order: i + 1,
}));

const eligibilityDsa = [
  { problems: 50, means: 'You can talk about arrays.' },
  { problems: 150, means: 'You can pass a first round.' },
  { problems: 300, means: 'You can pass most rounds.' },
];

const skillCombos = [
  { sort_order: 1, combo: 'HTML+CSS+JS', dsa_needed: 96, roles_unlocked_codes: JSON.stringify(['WEB']) },
  { sort_order: 2, combo: '+React', dsa_needed: 176, roles_unlocked_codes: JSON.stringify(['FE', 'SUP']) },
  { sort_order: 3, combo: '+RAG', dsa_needed: 336, roles_unlocked_codes: JSON.stringify(['AAE', 'FDE']) },
];

const fastExits = [
  { exit_no: 1, exit_date: '2026-10-25', label: 'Exit one', before_gate3: 1, cost_note: 'Costs you 14 LPA.' },
  { exit_no: 2, exit_date: '2026-11-22', label: 'Exit two', before_gate3: 1, cost_note: 'Costs you 10 LPA.' },
  { exit_no: 3, exit_date: '2026-12-20', label: 'Exit three', before_gate3: 0, cost_note: '' },
  { exit_no: 4, exit_date: '2027-01-24', label: 'Exit four', before_gate3: 0, cost_note: '' },
];

function compute(overrides = {}) {
  return computeEligibility({
    today: '2026-10-01',
    solved: 0,
    completedWeeks: [],
    eligibilityWeeks,
    rolesEarly,
    roles,
    eligibilityDsa,
    skillCombos,
    fastExits,
    currentWeek: null,
    ...overrides,
  });
}

describe('the sixteen roles', () => {
  it('is seven from Part 12 and nine from Part 19.2', () => {
    assert.equal(ROLE_CODES_MAIN.length, 7);
    assert.equal(ROLE_CODES_EARLY.length, 9);
    assert.equal(ROLE_CODES_ALL.length, 16);
  });

  it('has no duplicate codes', () => {
    assert.equal(new Set(ROLE_CODES_ALL).size, 16);
  });

  it('is reported as sixteen in the result', () => {
    assert.equal(compute().total_roles, 16);
    assert.equal(compute().part12_roles, 7);
  });
});

describe('a role needs both halves of its ladder row', () => {
  it('unlocks nothing on day one', () => {
    const r = compute();
    assert.equal(r.eligible_count, 0);
    assert.match(r.headline, /eligible for 0 of 16 roles/);
  });

  it('does not unlock on DSA alone', () => {
    const r = compute({ solved: 96, completedWeeks: [] });
    assert.equal(r.eligible_count, 0);
    const row = r.ladder.find((x) => x.week_n === 4);
    assert.equal(row.dsa_met, true);
    assert.equal(row.week_done, false);
    assert.equal(row.reached, false);
  });

  it('does not unlock on a finished week alone', () => {
    const r = compute({ solved: 10, completedWeeks: [1, 2, 3, 4] });
    assert.equal(r.eligible_count, 0);
    const row = r.ladder.find((x) => x.week_n === 4);
    assert.equal(row.week_done, true);
    assert.equal(row.dsa_met, false);
  });

  it('unlocks when both are true', () => {
    const r = compute({ solved: 96, completedWeeks: [4] });
    assert.deepEqual(r.eligible.map((e) => e.code).sort(), ['FE', 'WEB']);
  });

  it('treats the launch row as a solved count, not a week', () => {
    const r = compute({ solved: 6, completedWeeks: [] });
    assert.equal(r.ladder.find((x) => x.week_n === 0).reached, true);
  });
});

describe('"weakly" is honoured, then upgraded', () => {
  it('marks a whole row weak when the row text carries the qualifier', () => {
    // The qualifier sits on the row, not on one code inside it, so every code
    // that row introduces starts weak. Week 8 then names FE plainly.
    const r = compute({ solved: 96, completedWeeks: [4] });
    assert.equal(r.eligible.find((e) => e.code === 'FE').strength, 'weak');
    assert.equal(r.eligible.find((e) => e.code === 'WEB').strength, 'weak');
  });

  it('upgrades FE to full once week 8 names it without the qualifier', () => {
    const r = compute({ solved: 176, completedWeeks: [4, 8] });
    assert.equal(r.eligible.find((e) => e.code === 'FE').strength, 'full');
  });

  it('leaves a code weak when no later row restates it', () => {
    const r = compute({ solved: 176, completedWeeks: [4, 8] });
    assert.equal(r.eligible.find((e) => e.code === 'WEB').strength, 'weak');
  });

  it('never downgrades a full mention back to weak', () => {
    const r = compute({ solved: 336, completedWeeks: [4, 8, 16] });
    assert.equal(r.eligible.find((e) => e.code === 'FE').strength, 'full');
    assert.equal(r.eligible.find((e) => e.code === 'AAE').strength, 'full');
  });

  it('records which week unlocked each role', () => {
    const r = compute({ solved: 176, completedWeeks: [4, 8] });
    assert.equal(r.eligible.find((e) => e.code === 'WEB').unlocked_at_week, 4);
    assert.equal(r.eligible.find((e) => e.code === 'SUP').unlocked_at_week, 8);
  });
});

describe('eligible is not advised', () => {
  it('says not advised when the current week does not advise it', () => {
    const r = compute({ solved: 96, completedWeeks: [4], currentWeek: { n: 4 } });
    assert.equal(r.eligible_count, 2);
    assert.equal(r.advised, false);
    assert.equal(r.advised_badge.tone, 'red');
  });

  it('says advised when the current week row does', () => {
    const r = compute({ solved: 176, completedWeeks: [4, 8], currentWeek: { n: 8 } });
    assert.equal(r.advised, true);
    assert.equal(r.advised_badge.tone, 'green');
  });

  it('carries the sentence before Gate 3, and the opposite on the day', () => {
    const before = compute({ today: '2026-12-12' });
    assert.equal(before.applications_open, false);
    assert.match(before.banner.text, /Eligible is not a reason to apply/);

    const onTheDay = compute({ today: GATE3_DATE });
    assert.equal(onTheDay.applications_open, true);
    assert.equal(onTheDay.banner.tone, 'green');
  });

  it('puts Gate 3 on 13 December 2026', () => {
    assert.equal(GATE3_DATE, '2026-12-13');
  });
});

describe('the next unlock', () => {
  it('names the first row not yet reached and how far away it is', () => {
    // Forty solved already clears the launch row's six, so the next row is week 4.
    const r = compute({ solved: 40, completedWeeks: [] });
    assert.equal(r.next_unlock.week_n, 4);
    assert.equal(r.next_unlock.problems_needed, 56);

    const later = compute({ solved: 90, completedWeeks: [] });
    assert.equal(later.next_unlock.week_n, 4);
    assert.equal(later.next_unlock.problems_needed, 6);
    assert.match(later.next_unlock.sentence, /6 more problems and finish Week 4/);
  });

  it('names the launch row while fewer than six are solved', () => {
    const r = compute({ solved: 2, completedWeeks: [] });
    assert.equal(r.next_unlock.week_n, 0);
    assert.equal(r.next_unlock.problems_needed, 4);
    assert.match(r.next_unlock.sentence, /clear the launch block/);
  });

  it('uses the singular for one problem', () => {
    const r = compute({ solved: 95, completedWeeks: [] });
    assert.match(r.next_unlock.sentence, /1 more problem and/);
  });

  it('is null once every row is reached', () => {
    const r = compute({ solved: 500, completedWeeks: [0, 4, 8, 16] });
    assert.equal(r.next_unlock, null);
  });
});

describe('the DSA only ladder unlocks nothing', () => {
  it('says so out loud', () => {
    assert.equal(compute().dsa_callout, 'No number in this table unlocks a single role.');
  });

  it('marks the position without granting a role', () => {
    const r = compute({ solved: 200, completedWeeks: [] });
    assert.equal(r.dsa_position_index, 1, '200 is past 150 but not 300');
    assert.equal(r.eligible_count, 0);
  });

  it('is sorted by problem count', () => {
    const nums = compute().dsa_ladder.map((r) => r.problems);
    assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
  });
});

describe('the skill combination matrix', () => {
  it('only marks a stack held when every role in it is eligible', () => {
    const r = compute({ solved: 96, completedWeeks: [4] });
    assert.equal(r.combos[0].stack_held_now, true, 'WEB is eligible');
    assert.equal(r.combos[1].stack_held_now, false, 'SUP is not');
  });

  it('tracks the current position', () => {
    assert.equal(compute().current_combo_index, -1);
    const r = compute({ solved: 176, completedWeeks: [4, 8] });
    assert.equal(r.current_combo_index, 1);
  });
});

describe('the four exits', () => {
  it('keeps them in order and counts the days', () => {
    const r = compute({ today: '2026-10-01' });
    assert.deepEqual(r.exits.map((e) => e.exit_no), [1, 2, 3, 4]);
    assert.equal(r.exits[0].days_away, 24);
    assert.equal(r.exits[0].is_past, false);
  });

  it('marks the two before Gate 3 as costing money', () => {
    const r = compute();
    assert.equal(r.early_exits.length, 2);
    assert.equal(r.early_exit_heading, 'This costs you money');
    for (const e of r.early_exits) assert.equal(e.costs_money, true);
  });

  it('knows an exit that has already gone', () => {
    const r = compute({ today: '2026-11-01' });
    assert.equal(r.exits[0].is_past, true);
    assert.equal(r.exits[0].days_away < 0, true);
  });
});

describe('bad input is survived, not crashed on', () => {
  it('treats unparseable codes as no codes', () => {
    const r = computeEligibility({
      today: '2026-10-01', solved: 500, completedWeeks: [4],
      eligibilityWeeks: [{ week_key: 'w4', week_n: 4, dsa_total: 96, newly_eligible_codes: 'not json', is_advised: 0 }],
      rolesEarly, roles, eligibilityDsa: [], skillCombos: [], fastExits: [], currentWeek: null,
    });
    assert.equal(r.eligible_count, 0);
  });

  it('handles an empty ladder', () => {
    const r = computeEligibility({
      today: '2026-10-01', solved: 0, completedWeeks: [],
      eligibilityWeeks: [], rolesEarly, roles, eligibilityDsa: [], skillCombos: [], fastExits: [], currentWeek: null,
    });
    assert.equal(r.eligible_count, 0);
    assert.equal(r.next_unlock, null);
  });
});
