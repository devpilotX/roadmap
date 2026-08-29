'use client';

/**
 * Stats. Numbers only, no adjectives.
 *
 * Part 18, the tracking contract, asks for the plan and the actual side by side
 * rather than a single encouraging figure. So the DSA block draws the Part 3
 * cumulative target against what has actually been solved, and stops the actual
 * line at the last week that has finished, because drawing a line into the future
 * would invent data.
 *
 * The thirty minute video cap is a real limit, not advice. Every day that went
 * over it is listed by date at the bottom of this screen and none of them are
 * folded away.
 *
 * Source: GET /api/stats. There are no writes on this screen.
 */

import {
  EmptyState,
  ErrorCard,
  LoadingCard,
  Meter,
  PhaseDot,
  Section,
  StatGrid,
} from '@/components/ui/Basics';
import { Fill } from '@/components/ui/Fill';
import { BarChart, LineChart, type Bar, type LinePoint } from '@/components/ui/Charts';
import { useResource } from '@/components/ui/useResource';
import { int, minutesLabel, pct, phaseClass, rupees, shortDate } from '@/lib/client/format';

/** The six tracked blocks, in the order the day runs. */
const BLOCKS = [
  { code: 'DSA', label: 'DSA, 06:30 to 09:00' },
  { code: 'LEARN', label: 'Learn, 09:30 to 12:30' },
  { code: 'BUILD', label: 'Build, 14:00 to 16:00' },
  { code: 'CLOSE', label: 'Close, 16:00 to 16:30' },
  { code: 'MONEY', label: 'Money, 17:00 to 18:00' },
  { code: 'NIGHT', label: 'Night, Anki and spoken' },
] as const;

/** The application funnel, in the order an application actually travels. */
const FUNNEL = [
  { key: 'applied', label: 'Applied' },
  { key: 'screen', label: 'Screen' },
  { key: 'tech', label: 'Technical' },
  { key: 'onsite', label: 'Onsite' },
  { key: 'offer', label: 'Offer' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'ghosted', label: 'Ghosted' },
] as const;

interface CurvePoint {
  week_n: number;
  end_date: string;
  plan: number;
  actual: number | null;
  minutes: number;
}

interface WeekHours {
  week_n: number;
  dates_label: string;
  blocks: Record<string, number>;
  total_minutes: number;
}

interface DayHistoryRow {
  date: string;
  colour: string;
  met: number;
  total: number;
}

interface PhaseStat {
  phase_code: string;
  day_rows: number;
  learn_done: number;
  build_done: number;
  percent: number;
}

interface Payload {
  today: string;
  hours_by_block_by_week: WeekHours[];
  dsa_curve: CurvePoint[];
  dsa_solved: number;
  dsa_target: number;
  colours: { green: number; amber: number; red: number; neutral: number };
  streak: { current: number; longest: number };
  day_history: DayHistoryRow[];
  phases: PhaseStat[];
  applications: {
    by_status: Record<string, number>;
    total: number;
    target: number;
    conversion: { to_screen: number; to_offer: number };
  };
  money: {
    by_month: { month: string; label: string; amount: number }[];
    total: number;
    target: number;
    touches: {
      touches: number;
      replies: number;
      reply_rate: number;
      last_touch: string | null;
      by_week: { week_n: number; touches: number; replies: number }[];
    };
    deals: { quoted: number; won: number; win_rate: number };
    care_plans: { count: number; monthly: number };
  };
  video: {
    days_over_cap: number;
    cap: number;
    rows: { log_date: string; video_minutes: number }[];
    total_minutes: number;
  };
}

const SECTION_LOADING: { label: string; text: string }[] = [
  { label: 'Headline numbers', text: 'Loading headline numbers.' },
  { label: 'DSA against plan', text: 'Loading dsa against plan.' },
  { label: 'Hours by block by week', text: 'Loading hours by block by week.' },
  { label: 'Day colours and streaks', text: 'Loading day colours and streaks.' },
  { label: 'Completion by phase', text: 'Loading completion by phase.' },
  { label: 'Application funnel', text: 'Loading application funnel.' },
  { label: 'Money received by month', text: 'Loading money received by month.' },
  { label: 'Video minutes against the cap', text: 'Loading video minutes against the cap.' },
];

/** One week as a single bar split into its blocks. Widths are real geometry. */
function HourBar({ week }: { week: WeekHours }) {
  const total = Number(week.total_minutes) || 0;
  return (
    <div className="hourbar">
      <span>{`W${String(week.week_n).padStart(2, '0')}`}</span>
      <div className="row">
        <div className="grow">
          <div className="hourbar__track">
            {BLOCKS.map((b) => {
              const minutes = Number(week.blocks[b.code] ?? 0);
              if (!minutes) return null;
              return (
                <Fill
                  key={b.code}
                  percent={(minutes / total) * 100}
                  className={`hourbar__seg hourbar__seg--${b.code}`}
                  title={`${b.label}: ${minutesLabel(minutes)}`}
                />
              );
            })}
          </div>
        </div>
        <span className="text-xs muted">{total ? minutesLabel(total) : 'nothing logged'}</span>
      </div>
    </div>
  );
}

function PhaseRow({ p }: { p: PhaseStat }) {
  const ticks = Number(p.learn_done) + Number(p.build_done);
  const possible = Number(p.day_rows) * 2;
  return (
    <div className="stack-sm">
      <div className="between">
        <div className="row">
          <PhaseDot code={p.phase_code} />
          <strong>{`Phase ${p.phase_code}`}</strong>
        </div>
        <span className="text-sm muted">{`${ticks} of ${possible} ticks, ${p.percent}%`}</span>
      </div>
      <div className={`phasebar ${phaseClass(p.phase_code)}`.trim()} />
      <Meter percent={p.percent} tone={p.percent === 100 ? 'green' : undefined} />
      <span className="text-xs muted">
        {`${int(p.day_rows)} week days in this phase, each with a learn row and a build row.`}
      </span>
    </div>
  );
}

export function StatsScreen() {
  const { data, error, loading } = useResource<Payload>('/api/stats');

  if (error) {
    return (
      <section className="stack" aria-label="Headline numbers">
        <ErrorCard message={error} />
      </section>
    );
  }

  if (loading || !data) {
    return (
      <>
        {SECTION_LOADING.map((s) => (
          <section className="stack" aria-label={s.label} key={s.label}>
            <LoadingCard text={s.text} />
          </section>
        ))}
      </>
    );
  }

  const d = data;

  /* ---------------------------------------------------------- headline */

  const dsaPercent = pct(d.dsa_solved, d.dsa_target);
  const moneyPercent = pct(d.money.total, d.money.target);
  const logged = d.day_history.filter((x) => x.colour !== 'neutral').length;

  /* --------------------------------------------------------------- dsa */

  const curve = d.dsa_curve ?? [];
  const done = curve.filter((c) => c.actual !== null);
  const last = done[done.length - 1] ?? null;
  const gap = last ? Number(last.actual) - Number(last.plan) : 0;

  const points: LinePoint[] = curve.map((c) => ({
    label: `W${c.week_n}`,
    plan: Number(c.plan ?? 0),
    actual: c.actual === null ? null : Number(c.actual),
  }));

  const minuteBars: Bar[] = curve
    .filter((c) => Number(c.minutes) > 0)
    .map((c) => ({ label: `W${c.week_n}`, value: Number(c.minutes) }));

  /* ------------------------------------------------------------- hours */

  const weeks = d.hours_by_block_by_week ?? [];
  const withTime = weeks.filter((w) => Number(w.total_minutes) > 0);

  /* -------------------------------------------------------------- days */

  const history = d.day_history ?? [];
  const coloured = history.filter((x) => x.colour !== 'neutral').length;

  /* ------------------------------------------------------------ funnel */

  const a = d.applications;
  const maxFunnel = Math.max(1, ...FUNNEL.map((f) => Number(a.by_status[f.key] ?? 0)));

  /* ------------------------------------------------------------- money */

  const m = d.money;
  const months = m.by_month ?? [];
  const moneyPct = pct(m.total, m.target);

  /* ------------------------------------------------------------- video */

  const v = d.video;
  const videoRows = v.rows ?? [];
  const over = videoRows.filter((r) => Number(r.video_minutes) > v.cap);

  return (
    <>
      <section className="stack" aria-label="Headline numbers">
        <Section title="Where the numbers actually stand">
          <StatGrid
            stats={[
              {
                value: `${int(d.dsa_solved)} of ${int(d.dsa_target)}`,
                label: 'DSA problems solved against the target for 24 January',
                sub: `${dsaPercent}% of the way`,
                tone: dsaPercent >= 100 ? 'green' : undefined,
                hero: true,
              },
              {
                value: `${int(d.streak.current)} d`,
                label: 'current green streak',
                sub: `the longest so far is ${int(d.streak.longest)} days`,
                tone: d.streak.current ? 'green' : 'red',
              },
              {
                value: `${int(d.colours.green)} green`,
                label: `of ${int(logged)} days that could be coloured`,
                sub: `${int(d.colours.amber)} amber, ${int(d.colours.red)} red, ${int(
                  d.colours.neutral
                )} neutral`,
              },
              {
                value: rupees(d.money.total),
                label: `received of ${rupees(d.money.target)}`,
                sub: `${moneyPercent}% of the money target`,
                tone: moneyPercent >= 100 ? 'green' : undefined,
              },
            ]}
          />
          <StatGrid
            columns={4}
            stats={[
              {
                value: `${int(d.applications.total)} of ${int(d.applications.target)}`,
                label: 'applications sent against Gate 4',
              },
              {
                value: int(d.video.days_over_cap),
                label: `days over the ${d.video.cap} minute video cap`,
                tone: d.video.days_over_cap ? 'red' : 'green',
              },
              {
                value: int(d.money.touches.touches),
                label: 'money touches logged',
                sub: `${d.money.touches.reply_rate}% replied`,
              },
              {
                value: `${d.money.care_plans.count}`,
                label: 'care plans running',
                sub: `${rupees(d.money.care_plans.monthly)} a month`,
              },
            ]}
          />
          <p className="text-xs muted">{`Everything on this page is as of ${d.today}.`}</p>
        </Section>
      </section>

      <section className="stack" aria-label="DSA against plan">
        <Section
          title="DSA, plan against actual"
          lede="The target is a cumulative number on a date, not a daily average."
        >
          <div className="statsection stack-sm">
            {points.length ? (
              <LineChart
                points={points}
                yLabel="problems, cumulative"
                summary={
                  last
                    ? `The plan line is the Part 3 cumulative target. At the end of week ${
                        last.week_n
                      } the target was ${int(last.plan)} and the actual was ${int(
                        last.actual
                      )}, ${gap >= 0 ? `${int(gap)} ahead` : `${int(Math.abs(gap))} behind`}. The actual line stops there because later weeks have not finished.`
                    : 'No week has finished yet, so there is a plan line and no actual line.'
                }
              />
            ) : (
              <EmptyState
                title="No DSA curve"
                body="The 21 week cumulative targets come from Part 3 of final.md. Run npm run setup."
              />
            )}
          </div>
          {minuteBars.length ? (
            <div className="statsection stack-sm">
              <p className="card__label">Minutes spent in the DSA block, by week</p>
              <BarChart
                bars={minuteBars}
                summary={`${minutesLabel(
                  minuteBars.reduce((acc, b) => acc + b.value, 0)
                )} logged in the morning block across ${minuteBars.length} weeks.`}
                valueFormat={(x) => String(x)}
              />
            </div>
          ) : (
            <div className="statsection">
              <EmptyState
                title="No DSA minutes logged yet"
                body="The morning block records its own minutes. Start the timer on Today and the bars fill in from the first week."
              />
            </div>
          )}
        </Section>
      </section>

      <section className="stack" aria-label="Hours by block by week">
        <Section
          title="Hours by block, by week"
          lede="Minutes come from the block timers, so an untracked hour shows as an untracked hour."
        >
          {withTime.length ? (
            <div className="statsection stack-sm">
              <div className="row">
                {BLOCKS.map((b) => (
                  <span className="row" key={b.code}>
                    {/* The swatch borrows the segment class so the colour can only ever
                        come from screens.css, and .blockswatch fixes its size there
                        too, because no style attribute is ever written into markup. */}
                    <span
                      className={`blockswatch hourbar__seg--${b.code}`}
                      aria-hidden="true"
                    />
                    <span className="text-xs muted">{b.label}</span>
                  </span>
                ))}
              </div>
              {weeks.map((w) => (
                <HourBar week={w} key={w.week_n} />
              ))}
            </div>
          ) : (
            <div className="statsection">
              <EmptyState
                title="No minutes logged yet"
                body="Every block on Today has a timer and a minutes field. As soon as one week has minutes in it, this becomes the honest picture of where the day actually went."
              />
            </div>
          )}
          {withTime.length ? (
            <div className="statsection stack-sm">
              <p className="card__label">Total tracked minutes per week</p>
              <BarChart
                bars={weeks.map((w) => ({ label: `W${w.week_n}`, value: Number(w.total_minutes) }))}
                summary={`${minutesLabel(
                  weeks.reduce((acc, w) => acc + Number(w.total_minutes), 0)
                )} tracked in total. The plan is eight hours a day across six days, which is 2,880 minutes in a full week.`}
                valueFormat={(x) => String(x)}
              />
            </div>
          ) : null}
        </Section>
      </section>

      <section className="stack" aria-label="Day colours and streaks">
        <Section title="Day colours and streaks">
          <div className="statsection stack-sm">
            {history.length ? (
              <div className="colourstrip">
                {history.map((day) => (
                  <span
                    key={day.date}
                    className={`colourstrip__day colourstrip__day--${day.colour}`}
                    title={`${day.date}: ${day.colour}, ${day.met} of ${day.total} conditions met`}
                  />
                ))}
              </div>
            ) : null}
            {history.length ? (
              <p className="text-xs muted">
                {`${history.length} days from the start of the roadmap to today, oldest first. Hover a square for the date and how many of the day conditions it met.`}
              </p>
            ) : null}
            {history.length ? null : (
              <EmptyState
                title="No days coloured yet"
                body="A day gets its colour from the conditions in Part 18, counted at the end of it. Nothing is coloured until something is logged."
              />
            )}
          </div>
          <StatGrid
            stats={[
              {
                value: d.colours.green,
                label: 'green days',
                tone: 'green',
                sub: coloured ? `${pct(d.colours.green, coloured)}% of coloured days` : '',
              },
              {
                value: d.colours.amber,
                label: 'amber days',
                tone: d.colours.amber ? 'orange' : undefined,
              },
              { value: d.colours.red, label: 'red days', tone: d.colours.red ? 'red' : undefined },
              {
                value: d.colours.neutral,
                label: 'neutral days',
                sub: 'the rest Sundays, which have nothing to tick',
              },
            ]}
          />
          <p className="text-sm muted measure">
            A red day is data, not a verdict. The pattern of reds is the most useful thing on this
            page, which is why none of them are removed.
          </p>
        </Section>
      </section>

      <section className="stack" aria-label="Completion by phase">
        <Section
          title="Completion by phase"
          lede="Two ticks per week day, one for learn and one for build. The API returns the phase codes only, so the phase names are on the weeks screen."
        >
          {(d.phases ?? []).length ? (
            <div className="statsection stack">
              {d.phases.map((p) => (
                <PhaseRow p={p} key={p.phase_code} />
              ))}
            </div>
          ) : (
            <div className="statsection">
              <EmptyState
                title="No phases"
                body="The six phases come from Part 3 of final.md. Run npm run setup."
              />
            </div>
          )}
        </Section>
      </section>

      <section className="stack" aria-label="Application funnel">
        <Section title="The application funnel">
          <div className="statsection stack-sm">
            {a.total ? (
              <div className="funnelbar">
                {FUNNEL.map((f) => {
                  const n = Number(a.by_status[f.key] ?? 0);
                  return (
                    <div className="funnelbar__row" key={f.key}>
                      <span className="text-sm">{f.label}</span>
                      <Meter
                        percent={Math.round((n / maxFunnel) * 100)}
                        tone={f.key === 'offer' && n ? 'green' : undefined}
                      />
                      <span className="right text-sm">{int(n)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No applications yet"
                body={`Gate 4 asks for ${a.target} applications. The realistic number is two to four hundred, and none of them exist until they are recorded on the applications screen.`}
              />
            )}
          </div>
          <StatGrid
            stats={[
              {
                value: `${int(a.total)} of ${int(a.target)}`,
                label: 'applications recorded against Gate 4',
                tone: a.total >= a.target ? 'green' : undefined,
              },
              { value: `${a.conversion.to_screen}%`, label: 'reached a screen' },
              { value: `${a.conversion.to_offer}%`, label: 'reached an offer' },
              {
                value: int(a.by_status.ghosted ?? 0),
                label: 'ghosted, which is the normal outcome',
              },
            ]}
          />
        </Section>
      </section>

      <section className="stack" aria-label="Money received by month">
        <Section
          title="Money received by month"
          lede="The money hour is 17:00 to 18:00 and it never borrows from study, so these numbers were earned on top of the eight hours."
        >
          <div className="statsection stack-sm">
            {months.length ? (
              <BarChart
                bars={months.map((x) => ({ label: x.label.slice(0, 3), value: x.amount }))}
                summary={`${rupees(m.total)} received in total, which is ${moneyPct}% of the ${rupees(
                  m.target
                )} target. Counted from dated cash events only.`}
                valueFormat={(x) => String(x)}
              />
            ) : (
              <EmptyState
                title="No money received yet"
                body="A bar appears the first time an advance, a balance or a care plan invoice has a date on it. A deal ticked as paid with no dates is not money."
              />
            )}
            <Meter percent={moneyPct} tone={moneyPct >= 100 ? 'green' : undefined} />
          </div>
          <StatGrid
            stats={[
              {
                value: rupees(m.total),
                label: `of ${rupees(m.target)} by 24 January 2027`,
                tone: moneyPct >= 100 ? 'green' : undefined,
              },
              {
                value: `${m.deals.won} of ${m.deals.quoted}`,
                label: 'deals taken past the advance',
                sub: `${m.deals.win_rate}% win rate`,
              },
              {
                value: int(m.touches.touches),
                label: 'touches logged',
                sub: `${int(m.touches.replies)} replies, ${m.touches.reply_rate}%`,
              },
              {
                value: m.care_plans.count,
                label: 'care plans running',
                sub: `${rupees(m.care_plans.monthly)} a month, the recurring floor`,
              },
            ]}
          />
        </Section>
      </section>

      <section className="stack" aria-label="Video minutes against the cap">
        <Section title={`Video minutes against the ${v.cap} minute cap`}>
          {over.length ? (
            <div className="callout callout--red">
              <div className="callout__body">
                <p className="callout__title">
                  {`${over.length} days went over the ${v.cap} minute cap`}
                </p>
                <p className="measure">
                  The cap is a limit, not a guideline. Watching is not building, and every minute
                  over it came out of the block that was supposed to produce something.
                </p>
              </div>
            </div>
          ) : null}
          <StatGrid
            stats={[
              {
                value: int(v.days_over_cap),
                label: `days over the ${v.cap} minute cap`,
                tone: v.days_over_cap ? 'red' : 'green',
                hero: true,
              },
              { value: minutesLabel(v.total_minutes), label: 'video watched in total' },
              { value: int(videoRows.length), label: 'days with any video at all' },
              {
                value: videoRows.length
                  ? minutesLabel(Math.round(v.total_minutes / videoRows.length))
                  : '0 m',
                label: 'average on a day that had video',
              },
            ]}
          />
          {videoRows.length ? (
            <div className="statsection stack-sm">
              <p className="card__label">Every day that had video, oldest first</p>
              {videoRows.map((r) => {
                const minutes = Number(r.video_minutes);
                const isOver = minutes > v.cap;
                return (
                  <div className="videorow between" key={r.log_date}>
                    <span className="text-sm">{shortDate(r.log_date)}</span>
                    <span className="text-sm">{minutesLabel(minutes)}</span>
                    {isOver ? (
                      <span className="badge badge--red">
                        {`${minutes - v.cap} minutes over the cap`}
                      </span>
                    ) : (
                      <span className="badge badge--green">Inside the cap</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="statsection">
              <EmptyState
                title="No video minutes recorded"
                body={`Nothing has been logged against the ${v.cap} minute cap yet. The field is on the Learn block on Today, and days over the cap will appear here by date.`}
              />
            </div>
          )}
        </Section>
      </section>
    </>
  );
}

export default StatsScreen;
