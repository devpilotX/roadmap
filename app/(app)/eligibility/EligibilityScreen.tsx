'use client';

/**
 * eligibility | Part 19, what can I apply for today.
 *
 * The whole screen hangs off one sentence, which the API supplies and this file
 * does not soften: eligible is not a reason to apply, eligible plus advised is.
 * Until 13 December 2026 the banner is red and says exactly that, whatever the
 * chips below it happen to show.
 *
 * Nothing here is stored. The server recomputes eligibility on every request from
 * finished weeks and real solved problems, so a chip appearing is evidence and not
 * a date arriving. Part 19.3 names one role a week early with the qualifier
 * "weakly", and that chip is drawn weak rather than full, because the document
 * itself draws that distinction.
 */

import { useResource } from '@/components/ui/useResource';
import {
  Badge,
  Callout,
  EmptyState,
  ErrorCard,
  LoadingSections,
  Section,
  StatGrid,
  type StatSpec,
} from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { int, shortDate } from '@/lib/client/format';

/* ------------------------------------------------------------------- types */

type EligibleRole = {
  code: string;
  role: string;
  band: string;
  verdict: string;
  set: string;
  unlocked_at_week: number;
  unlocked_at: string;
  strength: 'weak' | 'full';
};

type LadderRow = {
  id: number;
  week_key: string;
  week_n: number;
  reached_date: string;
  dsa_total: number;
  newly_holds: string;
  newly_eligible_text: string;
  band: string;
  apply_verdict: string;
  is_advised: boolean;
  week_done: boolean;
  dsa_met: boolean;
  reached: boolean;
  codes: string[];
};

type LadderDisplay = {
  week: string;
  reached_date: string;
  dsa_total: string;
  newly_holds: string;
  newly_eligible_text: string;
  band: string;
  apply_verdict: string;
  state: string;
  reached: boolean;
};

type NextUnlock = {
  week_key: string;
  week_n: number;
  reached_date: string;
  dsa_total: number;
  problems_needed: number;
  week_done: boolean;
  newly_holds: string;
  newly_eligible_text: string;
  codes: string[];
  band: string;
  sentence: string;
};

type DsaRow = {
  id: number;
  ord: number;
  problems: number;
  reached_about: string;
  gets_you_past: string;
  does_not_open: string;
  reached: boolean;
};

type ComboRow = {
  id: number;
  sort_order: number;
  stack_held: string;
  dsa_needed_text: string;
  dsa_needed: number;
  roles_unlocked_text: string;
  band: string;
  interview_you_face: string;
  codes: string[];
  dsa_met: boolean;
  stack_held_now: boolean;
};

type ExitRow = {
  id: number;
  exit_no: number;
  exit_label: string;
  exit_date: string;
  exit_week: number;
  roles_available: string;
  band: string;
  what_you_give_up: string;
  verdict: string;
  cost_note: string | null;
  before_gate3: boolean;
  is_past: boolean;
  days_away: number;
  costs_money: boolean;
};

type TextRow = { id: number; ord: number; text: string };

interface Payload {
  today: string;
  solved: number;
  total_roles: number;
  part12_roles: number;
  eligible_count: number;
  headline: string;
  eligible: EligibleRole[];
  advised: boolean;
  advised_badge: { label: string; tone: string };
  current_week_row: LadderRow | null;
  applications_open: boolean;
  banner: { tone: string; text: string };
  gate3_date: string;
  next_unlock: NextUnlock | null;
  ladder: LadderRow[];
  dsa_ladder: DsaRow[];
  dsa_position_index: number;
  dsa_callout: string;
  combos: ComboRow[];
  current_combo_index: number;
  exits: ExitRow[];
  early_exits: ExitRow[];
  early_exit_heading: string;
  completed_weeks: number[];
  definitions: TextRow[];
  break_plan: TextRow[];
  current_week: { n: number; dates_label: string } | null;
  dsa_source: string;
  problems_imported: boolean;
}

/* ------------------------------------------------------------------ banner */

function BannerPanel({ d }: { d: Payload }) {
  const tone = d.banner.tone === 'green' ? 'eligbanner--green' : 'eligbanner--red';

  return (
    <>
      <p className={`eligbanner ${tone}`}>{d.banner.text}</p>
      <div className="row">
        <Badge tone={d.advised_badge.tone === 'green' ? 'green' : 'red'}>
          {d.advised_badge.label}
        </Badge>
        <Badge tone={d.applications_open ? 'green' : 'outline'}>
          {d.applications_open
            ? `Applications have been open since ${shortDate(d.gate3_date)}`
            : `Applications open at Gate 3 on ${shortDate(d.gate3_date)}`}
        </Badge>
        {d.current_week ? (
          <Badge tone="outline">{`Week ${d.current_week.n}, ${d.current_week.dates_label}`}</Badge>
        ) : (
          <Badge tone="outline">Outside the 21 week window</Badge>
        )}
      </div>
      {d.current_week_row ? (
        <p className="text-sm muted measure">
          {`The verdict on this week's row in Part 19.3: ${d.current_week_row.apply_verdict}`}
        </p>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------- headline */

function HeadlinePanel({ d }: { d: Payload }) {
  const stats: StatSpec[] = [
    {
      value: `${int(d.eligible_count)} of ${int(d.total_roles)}`,
      label: 'roles eligible today, on evidence',
      tone: d.eligible_count ? 'green' : 'red',
      hero: true,
    },
    {
      value: int(d.solved),
      label: 'problems solved',
      sub:
        d.dsa_source === 'problems'
          ? 'counted from the imported problem list'
          : 'counted from the day logs',
    },
    {
      value: d.completed_weeks.length,
      label: 'weeks finished in full',
      sub: d.completed_weeks.length
        ? `Weeks ${d.completed_weeks.join(', ')}`
        : 'all twelve ticks or it does not count',
    },
    {
      value: d.advised ? 'Advised' : 'Not advised',
      label: 'what Part 19.3 says about applying this week',
      tone: d.advised ? 'green' : 'red',
    },
  ];

  return (
    <>
      <div className="card stack-sm">
        <p className="eligheadline">{d.headline}</p>
        <p className="text-sm muted measure">
          {`${int(d.part12_roles)} of those ${int(d.total_roles)} are the Part 11 roles the 21 weeks are actually built for. The rest open earlier and pay less.`}
        </p>
      </div>
      <StatGrid stats={stats} />
    </>
  );
}

/* --------------------------------------------------------------- the chips */

function EligibleChip({ r }: { r: EligibleRole }) {
  return (
    <div className={`eligchip ${r.strength === 'weak' ? 'eligchip--weak' : ''}`}>
      <span className="rolechip__code">{r.code}</span>
      <div className="rolechip__name">
        <span>{r.role}</span>
        <p className="text-xs muted">
          {r.unlocked_at_week === 0
            ? 'Open from the launch block'
            : `Unlocked at week ${r.unlocked_at_week}`}
        </p>
        {r.strength === 'weak' ? (
          <p className="text-xs">
            Named a week early and qualified as weakly in Part 19.3. Treat it as a maybe, not a yes.
          </p>
        ) : null}
        {r.verdict ? <p className="text-xs muted measure">{r.verdict}</p> : null}
      </div>
      <span className="rolechip__band">{r.band || 'no band listed'}</span>
    </div>
  );
}

function EligibleNowPanel({ d }: { d: Payload }) {
  const full = d.eligible.filter((r) => r.strength === 'full');
  const weak = d.eligible.filter((r) => r.strength === 'weak');

  return (
    <Section
      title="Eligible now"
      lede="Eligible means a screen would not reject you outright. It does not mean you should send the application."
    >
      {d.eligible.length ? (
        <div className="eligchips">
          {d.eligible.map((r) => (
            <EligibleChip key={r.code} r={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing is unlocked yet"
          body="A role appears here when a row of the Part 19.3 ladder that names it has both of its conditions met: the week finished in full and the DSA total reached. Neither is met by the date arriving."
        />
      )}
      {d.eligible.length ? (
        <p className="text-xs muted">
          {`${full.length} held properly, ${weak.length} held weakly. A dashed border is a weak chip.`}
        </p>
      ) : null}
    </Section>
  );
}

/* ---------------------------------------------------------- the next unlock */

function ladderRow(r: LadderRow, solved: number): LadderDisplay {
  return {
    week: r.week_n === 0 ? 'Launch' : `Week ${r.week_n}`,
    reached_date: shortDate(r.reached_date),
    dsa_total: int(r.dsa_total),
    newly_holds: r.newly_holds,
    newly_eligible_text: r.newly_eligible_text,
    band: r.band,
    apply_verdict: r.apply_verdict,
    state: r.reached
      ? 'Reached'
      : r.week_done
        ? `Week done, ${int(Math.max(0, r.dsa_total - solved))} problems short`
        : r.dsa_met
          ? 'DSA met, week not finished'
          : 'Neither condition met',
    reached: r.reached,
  };
}

const LADDER_COLUMNS: Column<LadderDisplay>[] = [
  { key: 'week', label: 'Week' },
  { key: 'reached_date', label: 'Reached' },
  { key: 'dsa_total', label: 'DSA', num: true },
  { key: 'newly_holds', label: 'What you newly hold' },
  { key: 'newly_eligible_text', label: 'Newly eligible' },
  { key: 'band', label: 'Band' },
  { key: 'apply_verdict', label: 'Apply?' },
  {
    key: 'state',
    label: 'State',
    render: (r) => (
      <Badge tone={r.reached ? 'green' : 'outline'}>{r.reached ? 'Reached' : r.state}</Badge>
    ),
  },
];

function NextUnlockPanel({ d }: { d: Payload }) {
  const n = d.next_unlock;

  const stats: StatSpec[] = n
    ? [
        {
          value: int(n.problems_needed),
          label: 'more problems needed',
          tone: n.problems_needed ? 'orange' : 'green',
        },
        { value: int(n.dsa_total), label: 'the cumulative DSA total on that row' },
        {
          value: n.week_done ? 'Yes' : 'No',
          label: 'that week finished in full',
          tone: n.week_done ? 'green' : 'red',
        },
        { value: shortDate(n.reached_date), label: 'the date the plan reaches that row' },
      ]
    : [];

  return (
    <>
      <Section
        title="The next unlock"
        lede="Two conditions, both required: the week finished in full and the cumulative DSA total reached."
      >
        {n ? (
          <div className="card stack-sm">
            <p className="card__label">{n.week_n === 0 ? 'The launch block' : `Week ${n.week_n}`}</p>
            <p className="measure">{n.sentence}</p>
            <StatGrid stats={stats} columns={4} />
            <p className="text-sm">{`What it adds: ${n.newly_holds}`}</p>
            <p className="text-sm muted">{`Newly eligible: ${n.newly_eligible_text}`}</p>
            {n.codes.length ? (
              <div className="row">
                {n.codes.map((c) => (
                  <Badge tone="outline" key={c}>
                    {c}
                  </Badge>
                ))}
              </div>
            ) : null}
            {n.band && n.band !== 'none' ? <Badge tone="outline">{n.band}</Badge> : null}
          </div>
        ) : (
          <EmptyState
            title="Every row of the ladder is reached"
            body="There is no next unlock left in Part 19.3. From here the constraint is applications and interviews, not eligibility."
          />
        )}
      </Section>

      <Section title="The week by week ladder">
        {d.ladder.length ? (
          <details className="acc">
            <summary className="acc__summary">
              {`All ${d.ladder.length} rows of the Part 19.3 ladder`}
            </summary>
            <div className="acc__body">
              <Table
                columns={LADDER_COLUMNS}
                rows={d.ladder.map((r) => ladderRow(r, d.solved))}
                rowKey={(r) => r.week}
              />
            </div>
          </details>
        ) : (
          <EmptyState
            title="No ladder rows"
            body="They come from Part 19.3 of final.md. Run npm run setup."
          />
        )}
      </Section>
    </>
  );
}

/* ------------------------------------------------------- the DSA only ladder */

function DsaOnlyPanel({ d }: { d: Payload }) {
  const rows = d.dsa_ladder ?? [];
  const at = d.dsa_position_index >= 0 ? rows[d.dsa_position_index] : null;

  const columns: Column<DsaRow>[] = [
    { key: 'problems', label: 'Problems', num: true, render: (r) => int(r.problems) },
    { key: 'reached_about', label: 'Reached about' },
    { key: 'gets_you_past', label: 'What it gets you past' },
    { key: 'does_not_open', label: 'What it does not open' },
    {
      key: 'reached',
      label: 'Reached',
      render: (r) => (
        <Badge tone={r.reached ? 'green' : 'outline'}>{r.reached ? 'Yes' : 'Not yet'}</Badge>
      ),
    },
  ];

  return (
    <Section title="The DSA only ladder">
      {/* This callout is the point of the whole table and it goes above it. */}
      <Callout tone="red" title={d.dsa_callout}>
        <p className="measure">
          The count is a filter on the way in. Every row below tells you what it gets you past and
          what it does not open, and the second column is the longer one for a reason.
        </p>
      </Callout>
      {rows.length ? (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowCurrent={(_r, i) => i === d.dsa_position_index}
          caption={
            at
              ? `You are at ${int(d.solved)} solved, which sits on the ${int(at.problems)} row.`
              : `You are at ${int(d.solved)} solved, below the first row of this table.`
          }
        />
      ) : (
        <EmptyState
          title="No DSA rows"
          body="They come from Part 19.4 of final.md. Run npm run setup."
        />
      )}
    </Section>
  );
}

/* -------------------------------------------------------- the combo matrix */

function CombosPanel({ d }: { d: Payload }) {
  const rows = d.combos ?? [];
  const at = d.current_combo_index >= 0 ? rows[d.current_combo_index] : null;

  const columns: Column<ComboRow>[] = [
    { key: 'stack_held', label: 'Stack held' },
    { key: 'dsa_needed_text', label: 'DSA needed' },
    { key: 'roles_unlocked_text', label: 'Roles unlocked' },
    { key: 'band', label: 'Band' },
    { key: 'interview_you_face', label: 'The interview you face' },
    {
      key: 'stack_held_now',
      label: 'Held',
      render: (r) => (
        <div className="row">
          <Badge tone={r.stack_held_now ? 'green' : 'outline'}>
            {r.stack_held_now ? 'Stack held' : 'Stack short'}
          </Badge>
          <Badge tone={r.dsa_met ? 'green' : 'outline'}>
            {r.dsa_met ? 'DSA met' : `DSA short by ${int(Math.max(0, r.dsa_needed - d.solved))}`}
          </Badge>
        </div>
      ),
    },
  ];

  return (
    <Section title="The skill combination matrix">
      {rows.length ? (
        <Table
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowCurrent={(_r, i) => i === d.current_combo_index}
          caption={
            at
              ? `The furthest row you hold in full is ${at.stack_held}.`
              : 'No row of this matrix is held in full yet.'
          }
        />
      ) : (
        <EmptyState
          title="No combinations"
          body="The matrix comes from Part 19.6 of final.md. Run npm run setup."
        />
      )}
      <p className="text-sm muted measure">
        A row counts as held only when every role it unlocks is already eligible and its DSA figure is
        reached. The stack is the thing that moves the band, not the problem count on its own.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------- the exits */

function ExitCard({ e }: { e: ExitRow }) {
  return (
    <article className={`exitcard ${e.costs_money ? 'exitcard--costly' : ''}`}>
      <div className="between">
        <div className="row">
          <strong>{e.exit_label}</strong>
          <Badge tone="outline">{shortDate(e.exit_date)}</Badge>
          <Badge tone="outline">{`Week ${e.exit_week}`}</Badge>
        </div>
        <Badge tone={e.is_past ? 'outline' : 'blue'}>
          {e.is_past
            ? `${int(Math.abs(e.days_away))} days ago`
            : e.days_away === 0
              ? 'today'
              : `${int(e.days_away)} days away`}
        </Badge>
      </div>
      <p className="text-sm">{`Available: ${e.roles_available}`}</p>
      <Badge tone="outline">{e.band}</Badge>
      <div className="stack-sm">
        <p className="card__label">What you give up</p>
        <p className="measure text-sm">{e.what_you_give_up}</p>
      </div>
      <p className="measure text-sm">{e.verdict}</p>
      {e.cost_note ? <p className="exitcost measure">{e.cost_note}</p> : null}
    </article>
  );
}

function ExitsPanel({ d }: { d: Payload }) {
  const all = d.exits ?? [];
  const costly = d.early_exits ?? [];
  const later = all.filter((e) => !e.costs_money);

  return (
    <Section
      title="The four exits"
      lede="Every exit is a real option. Two of them are priced, and the price is per year, permanently."
    >
      {costly.length ? (
        <div className="stack-sm">
          <p className="costheading">{d.early_exit_heading}</p>
          <p className="text-sm measure">
            {`${costly.length === 1 ? 'This exit falls' : `These ${costly.length} exits fall`} before Gate 3 on ${shortDate(d.gate3_date)}. The cost line on each one is the annual figure Part 19.5 puts on leaving early, and it is not a one off.`}
          </p>
          {costly.map((e) => (
            <ExitCard key={e.id} e={e} />
          ))}
        </div>
      ) : null}
      {later.length ? (
        <div className="stack-sm">
          <p className="card__label">From Gate 3 onward</p>
          {later.map((e) => (
            <ExitCard key={e.id} e={e} />
          ))}
        </div>
      ) : null}
      {all.length ? null : (
        <EmptyState
          title="No exits listed"
          body="The four exits come from Part 19.5 of final.md. Run npm run setup."
        />
      )}
    </Section>
  );
}

/* ----------------------------------------------- definitions and break plan */

function BreakPlanPanel({ d }: { d: Payload }) {
  const plan = d.break_plan ?? [];
  const defs = d.definitions ?? [];

  return (
    <>
      <Section
        title="When to break this plan"
        lede="The plan is not sacred. These are the conditions under which abandoning it is the correct decision."
      >
        {plan.length ? (
          <ul className="stack-sm">
            {plan.map((p) => (
              <li className="measure" key={p.id}>
                {p.text}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No break conditions"
            body="They come from Part 19.7 of final.md. Run npm run setup."
          />
        )}
      </Section>

      <Section title="What eligible actually means here">
        {defs.length ? (
          <ul className="stack-sm">
            {defs.map((x) => (
              <li className="measure" key={x.id}>
                {x.text}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No definitions"
            body="They come from Part 19 of final.md. Run npm run setup."
          />
        )}
        <p className="text-xs muted measure">
          {d.problems_imported
            ? 'The solved count on this screen comes from the imported problem list, one row per problem.'
            : 'The solved count on this screen comes from the per day totals, because no 474 row problem list has been imported yet.'}
        </p>
      </Section>
    </>
  );
}

/* --------------------------------------------------------------------- main */

const SECTIONS: [string, string][] = [
  ['The rule', 'Loading the rule.'],
  ['The number', 'Loading the number.'],
  ['Eligible now', 'Loading eligible now.'],
  ['Next unlock', 'Loading next unlock.'],
  ['The DSA only ladder', 'Loading the dsa only ladder.'],
  ['The skill combination matrix', 'Loading the skill combination matrix.'],
  ['The four exits', 'Loading the four exits.'],
  ['When to break this plan', 'Loading when to break this plan.'],
];

export function EligibilityScreen() {
  const { data, error, loading } = useResource<Payload>('/api/eligibility');

  if (error) return <ErrorCard message={error} />;
  if (loading || !data)
    return (
      <LoadingSections
        sections={SECTIONS.map(([label, text]) => ({
          label,
          text,
          // The banner carrying the rule sits tighter than the panels below it.
          className: label === 'The rule' ? 'stack-sm' : 'stack',
        }))}
      />
    );

  return (
    <>
      <section className="stack-sm" aria-label="The rule">
        <BannerPanel d={data} />
      </section>

      <section className="stack" aria-label="The number">
        <HeadlinePanel d={data} />
      </section>

      <section className="stack" aria-label="Eligible now">
        <EligibleNowPanel d={data} />
      </section>

      <section className="stack" aria-label="Next unlock">
        <NextUnlockPanel d={data} />
      </section>

      <section className="stack" aria-label="The DSA only ladder">
        <DsaOnlyPanel d={data} />
      </section>

      <section className="stack" aria-label="The skill combination matrix">
        <CombosPanel d={data} />
      </section>

      <section className="stack" aria-label="The four exits">
        <ExitsPanel d={data} />
      </section>

      <section className="stack" aria-label="When to break this plan">
        <BreakPlanPanel d={data} />
      </section>
    </>
  );
}

export default EligibilityScreen;
