'use client';

/**
 * The Saturday review, Part 18.6.
 *
 * Twenty minutes inside the BUILD block, seven questions, written rather than
 * thought about. The seven come from Part 18.6 of final.md and they split cleanly
 * in two. Some are arithmetic and are answered here from the API, which is what
 * the numbers section is for. The rest are judgements no script can make, so the
 * questions section gives each one a card and room to write.
 *
 * There is no review endpoint. No route exposes the seeded review_questions
 * table, so the seven prompts below are the text of Part 18.6 itself rather than a
 * field from a response. That is stated on the screen as well as here, because a
 * screen that quietly hardcodes plan content is the sort of drift this application
 * is meant to prevent.
 *
 * There is likewise no endpoint that stores a written answer. Nothing typed on
 * this screen is sent anywhere, and the page says so plainly rather than showing
 * a save button that does nothing. The answers belong in log.md, so there is a
 * button that puts the whole review on the clipboard ready to paste.
 *
 * Sources: GET /api/today and GET /api/stats.
 */

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '@/components/ToastProvider';
import { EmptyState, ErrorCard, LoadingCard, Section, StatGrid } from '@/components/ui/Basics';
import { Table, type Column } from '@/components/ui/Table';
import { useResource } from '@/components/ui/useResource';
import { int, minutesLabel, pct, rupees, shortDate } from '@/lib/client/format';

/**
 * The seven questions, verbatim from Part 18.6. `answerable` marks the ones the
 * numbers above can answer, so the card can point at them instead of pretending
 * the number is not already known.
 */
const QUESTIONS: { n: number; question: string; answerable: boolean }[] = [
  {
    n: 1,
    question: 'DSA: target versus actual, and the running cumulative against Part 3.',
    answerable: true,
  },
  {
    n: 2,
    question: 'What shipped this week that a stranger can open in a browser.',
    answerable: false,
  },
  {
    n: 3,
    question: 'What is in failed-twice.md that was not there last Saturday.',
    answerable: false,
  },
  { n: 4, question: 'Pushes this week, by repository.', answerable: false },
  { n: 5, question: 'Money: touches, replies, quotes, rupees received.', answerable: true },
  {
    n: 6,
    question: 'Which single thing cost the most time for the least return.',
    answerable: false,
  },
  {
    n: 7,
    question:
      'One sentence: is the next gate still reachable, yes or no. If no, what gets cut on Wednesday.',
    answerable: false,
  },
];

/** Where the evidence for each question actually lives, when it is not on this page. */
const POINTERS: Record<number, { text: string; href: string }> = {
  2: {
    text: 'The live URL is on the projects screen. A screenshot is not a shipped project.',
    href: '/projects',
  },
  3: {
    text: 'Every failed twice problem, with the mechanism you wrote down.',
    href: '/dsa',
  },
  4: {
    text: 'Pushes by repository, by day. This screen has no per repository figure, so it comes from there.',
    href: '/pushes',
  },
  6: {
    text: 'Hours by block, by week, if you want to check your answer against the minutes.',
    href: '/stats',
  },
  7: { text: 'The gate, its date and its condition, unedited.', href: '/gates' },
};

interface TodayBlock {
  code: string;
  solved_today?: number;
  project?: {
    code: string;
    name: string;
    status: string;
    live_url: string | null;
  } | null;
}

interface TodayPayload {
  header: {
    date: string;
    date_long: string;
    week: {
      n: number;
      title: string;
      dsa_target: number;
      dsa_cumulative: number;
    } | null;
    next_gate: {
      no: number;
      gate_date: string;
      condition_text: string;
      days_remaining: number;
      passed: boolean;
    } | null;
  };
  blocks: TodayBlock[];
  failed_twice: unknown[];
}

interface ByWeekRow {
  week_n: number;
  touches: number;
  replies: number;
}

interface StatsPayload {
  dsa_curve: { week_n: number; plan: number; actual: number | null; minutes: number }[];
  dsa_solved: number;
  dsa_target: number;
  colours: { green: number; amber: number; red: number; neutral: number };
  streak: { current: number; longest: number };
  money: {
    total: number;
    target: number;
    touches: {
      touches: number;
      replies: number;
      reply_rate: number;
      last_touch: string | null;
      by_week: ByWeekRow[];
    };
    deals: { quoted: number; won: number; win_rate: number };
  };
  video: { days_over_cap: number; cap: number };
}

export function ReviewScreen() {
  const today = useResource<TodayPayload>('/api/today');
  const stats = useResource<StatsPayload>('/api/stats');
  const { toast, toastError } = useToast();

  const [answers, setAnswers] = useState<Record<number, string>>({});

  const error = today.error ?? stats.error;
  if (error) {
    return (
      <section className="stack" aria-label="This week in numbers">
        <ErrorCard message={error} />
      </section>
    );
  }

  if (today.loading || stats.loading || !today.data || !stats.data) {
    return (
      <>
        <section className="stack" aria-label="This week in numbers">
          <LoadingCard text="Loading this week in numbers." />
        </section>
        <section className="stack" aria-label="The seven questions">
          <LoadingCard text="Loading the seven questions." />
        </section>
      </>
    );
  }

  const t = today.data;
  const s = stats.data;

  const week = t.header.week;
  const curve = s.dsa_curve ?? [];
  const thisWeek = week ? (curve.find((c) => c.week_n === week.n) ?? null) : null;
  const finished = curve.filter((c) => c.actual !== null);
  const last = finished[finished.length - 1] ?? null;

  const dsaBlock = t.blocks.find((b) => b.code === 'DSA') ?? null;
  const buildBlock = t.blocks.find((b) => b.code === 'BUILD') ?? null;
  const money = s.money;
  const gate = t.header.next_gate;

  const byWeekColumns: Column<ByWeekRow>[] = [
    {
      key: 'week_n',
      label: 'Week',
      num: true,
      render: (r) => `W${String(r.week_n).padStart(2, '0')}`,
    },
    { key: 'touches', label: 'Touches', num: true, render: (r) => int(r.touches) },
    { key: 'replies', label: 'Replies', num: true, render: (r) => int(r.replies) },
  ];

  const answeredCount = QUESTIONS.filter((q) => (answers[q.n] ?? '').trim()).length;

  const copyReview = async () => {
    const lines = [`Saturday review, ${t.header.date_long}`, ''];
    for (const q of QUESTIONS) {
      lines.push(`${q.n}. ${q.question}`);
      lines.push((answers[q.n] ?? '').trim() || '(not answered)');
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('The review is on the clipboard. Paste it into log.md.', 'ok');
    } catch {
      toastError(
        'This browser would not let the page write to the clipboard. Select the text and copy it by hand.'
      );
    }
  };

  return (
    <>
      <section className="stack" aria-label="This week in numbers">
        <Section
          title="Question one. DSA, target against actual"
          lede="Answered from the API. Write the sentence anyway, in the card below."
        >
          <StatGrid
            stats={[
              {
                value: `${int(s.dsa_solved)} of ${int(s.dsa_target)}`,
                label: 'solved against the target for 24 January 2027',
                sub: `${pct(s.dsa_solved, s.dsa_target)}% of the way`,
                hero: true,
              },
              {
                value: week ? `${int(week.dsa_target)} this week` : 'Outside the window',
                label: week
                  ? `week ${week.n}, cumulative target ${int(week.dsa_cumulative)}`
                  : 'no week owns today',
              },
              {
                value: last ? `${int(last.actual)} against ${int(last.plan)}` : 'No finished week',
                label: last ? `at the end of week ${last.week_n}` : 'nothing to compare yet',
                tone: last
                  ? Number(last.actual) >= Number(last.plan)
                    ? 'green'
                    : 'red'
                  : undefined,
              },
              {
                value: thisWeek ? minutesLabel(thisWeek.minutes) : '0 m',
                label: 'minutes in the DSA block this week',
                sub: dsaBlock ? `${int(dsaBlock.solved_today)} solved today` : '',
              },
            ]}
          />
          <p className="text-xs muted measure">
            The cumulative figure is the one that matters. A good Saturday does not cancel a week
            that fell three days behind.
          </p>
        </Section>

        <Section
          title="Question five. Money"
          lede="Answered from the API. Quotes are counted as deals quoted, because that is what the deals table records."
        >
          <StatGrid
            stats={[
              {
                value: rupees(money.total),
                label: `received of ${rupees(money.target)}`,
                sub: 'dated cash events only, never a deal ticked as paid',
                hero: true,
              },
              {
                value: int(money.touches.touches),
                label: 'touches logged in total',
                sub: money.touches.last_touch
                  ? `the last on ${shortDate(money.touches.last_touch)}`
                  : 'none yet',
              },
              {
                value: int(money.touches.replies),
                label: 'replies',
                sub: `${money.touches.reply_rate}% of touches`,
              },
              {
                value: `${money.deals.won} of ${money.deals.quoted}`,
                label: 'deals past the advance, of deals quoted',
                sub: `${money.deals.win_rate}% win rate`,
              },
            ]}
          />
          {money.touches.by_week?.length ? (
            <Table<ByWeekRow>
              caption="Touches and replies by week, so this week can be read against the last one"
              columns={byWeekColumns}
              rows={money.touches.by_week}
              rowKey={(r) => r.week_n}
              rowCurrent={(r) => Boolean(week) && r.week_n === week!.n}
            />
          ) : (
            <EmptyState
              title="No touches logged yet"
              body="A touch is one message to one lead, logged during the money hour. Until one exists there is nothing to review here."
            />
          )}
        </Section>

        <Section
          title="The rest of the week, in numbers"
          lede="Not one of the seven, but the numbers that make answering them honest."
        >
          <StatGrid
            stats={[
              {
                value: `${int(s.colours.green)} green`,
                label: 'days so far',
                sub: `${int(s.colours.amber)} amber, ${int(s.colours.red)} red`,
                tone: s.colours.red ? 'red' : 'green',
              },
              {
                value: `${int(s.streak.current)} d`,
                label: 'current streak',
                sub: `longest ${int(s.streak.longest)} days`,
              },
              {
                value: int(s.video.days_over_cap),
                label: `days over the ${s.video.cap} minute video cap`,
                tone: s.video.days_over_cap ? 'red' : 'green',
              },
              {
                value: gate ? `${int(gate.days_remaining)} d` : 'No gate ahead',
                label: gate
                  ? `to gate ${gate.no} on ${shortDate(gate.gate_date)}`
                  : 'every gate is behind you',
                tone: gate && gate.days_remaining <= 14 ? 'orange' : undefined,
              },
            ]}
          />
          {gate ? <p className="measure">{gate.condition_text}</p> : null}
          {buildBlock?.project ? (
            <p className="text-sm muted measure">
              {`The project this week belongs to is ${buildBlock.project.code} ${
                buildBlock.project.name
              }, currently ${buildBlock.project.status.replace(/_/g, ' ')}${
                buildBlock.project.live_url
                  ? ` at ${buildBlock.project.live_url}`
                  : ', with no live URL recorded'
              }.`}
            </p>
          ) : null}
          {t.failed_twice?.length ? (
            <p className="text-sm muted measure">
              {`${t.failed_twice.length} problems are sitting in failed twice. Question three is asking which of them are new since last Saturday, and that is for you to say.`}
            </p>
          ) : (
            <p className="text-sm muted measure">
              Nothing is in failed twice at the moment. Question three is still worth answering: an
              empty list on week nine usually means problems are being marked solved too generously.
            </p>
          )}
        </Section>
      </section>

      <section className="stack" aria-label="The seven questions">
        <Section
          title="The seven questions"
          lede="Twenty minutes, inside the BUILD block, on Saturday. Written, not thought about."
        >
          <div className="callout callout--orange">
            <div className="callout__body">
              <p className="callout__title">Nothing typed here is sent to the server</p>
              <p className="measure">
                There is no review endpoint in this application, so these boxes are a place to think
                on the page and nothing more. Copy the review when you are done and paste it into
                log.md, which is where Part 18 says the written record lives. If you reload before
                copying, the text is gone.
              </p>
            </div>
          </div>
          <p className="text-xs muted measure">
            The seven prompts are the text of Part 18.6 itself. The seeded review_questions table is
            not exposed by any API route, so they are not read from a response.
          </p>

          {QUESTIONS.map((q) => {
            const pointer = POINTERS[q.n];
            return (
              <div className="qcard" key={q.n}>
                <span className="qcard__n">{`Question ${q.n} of ${QUESTIONS.length}`}</span>
                <p className="qcard__q measure">{q.question}</p>
                {q.answerable ? (
                  <p className="text-xs muted">
                    The numbers for this one are above. Write what they mean, not what they are.
                  </p>
                ) : null}
                {pointer ? (
                  <Link className="btn btn--sm btn--ghost" href={pointer.href}>
                    {pointer.text}
                  </Link>
                ) : null}
                <textarea
                  className="textarea"
                  rows={q.n === 7 ? 2 : 4}
                  placeholder={
                    q.n === 7
                      ? 'One sentence. Yes or no, then what gets cut.'
                      : 'Write it. Not a bullet, a sentence.'
                  }
                  aria-label={`Answer to question ${q.n}`}
                  value={answers[q.n] ?? ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.n]: e.target.value }))}
                />
              </div>
            );
          })}

          <div className="between">
            <button type="button" className="btn btn--primary btn--sm" onClick={copyReview}>
              Copy the review, ready for log.md
            </button>
            <span className="text-sm muted">
              {`${answeredCount} of ${QUESTIONS.length} answered`}
            </span>
          </div>
        </Section>
      </section>
    </>
  );
}

export default ReviewScreen;
