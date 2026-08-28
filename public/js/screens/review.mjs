/**
 * review.mjs | the Saturday review, Part 18.6.
 *
 * Twenty minutes inside the BUILD block, seven questions, written rather than
 * thought about. The seven come from Part 18.6 of final.md and they split cleanly
 * in two. Some are arithmetic and are answered here from the API, which is what
 * rv-numbers is for. The rest are judgements no script can make, so rv-questions
 * gives each one a card and room to write.
 *
 * There is no review endpoint. src/routes/api holds no GET /review and no route
 * exposes the seeded review_questions table, so the seven prompts below are the
 * text of Part 18.6 itself rather than a field from a response. That is stated on
 * the screen as well as here, because a screen that quietly hardcodes plan content
 * is the sort of drift this application is meant to prevent.
 *
 * There is likewise no endpoint that stores a written answer. Nothing typed on
 * this screen is sent anywhere, and the page says so plainly rather than showing
 * a save button that does nothing. The answers belong in log.md, so there is a
 * button that puts the whole review on the clipboard ready to paste.
 *
 * Sources: GET /api/today and GET /api/stats.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, int, minutesLabel, pct, rupees, shortDate } from '../ui.mjs';
import { errorCard, mount, section, statGrid, table } from '../render.mjs';

/**
 * The seven questions, verbatim from Part 18.6. `answerable` marks the ones the
 * numbers above can answer, so the card can point at them instead of pretending
 * the number is not already known.
 */
const QUESTIONS = [
  { n: 1, question: 'DSA: target versus actual, and the running cumulative against Part 3.', answerable: true },
  { n: 2, question: 'What shipped this week that a stranger can open in a browser.', answerable: false },
  { n: 3, question: 'What is in failed-twice.md that was not there last Saturday.', answerable: false },
  { n: 4, question: 'Pushes this week, by repository.', answerable: false },
  { n: 5, question: 'Money: touches, replies, quotes, rupees received.', answerable: true },
  { n: 6, question: 'Which single thing cost the most time for the least return.', answerable: false },
  {
    n: 7,
    question:
      'One sentence: is the next gate still reachable, yes or no. If no, what gets cut on Wednesday.',
    answerable: false,
  },
];

/** Where the evidence for each question actually lives, when it is not on this page. */
const POINTERS = {
  2: { text: 'The live URL is on the projects screen. A screenshot is not a shipped project.', href: '/projects' },
  3: { text: 'Every failed twice problem, with the mechanism you wrote down.', href: '/dsa' },
  4: { text: 'Pushes by repository, by day. This screen has no per repository figure, so it comes from there.', href: '/pushes' },
  6: { text: 'Hours by block, by week, if you want to check your answer against the minutes.', href: '/stats' },
  7: { text: 'The gate, its date and its condition, unedited.', href: '/gates' },
};

const answers = new Map();

/* -------------------------------------------------------------- rv-numbers */

function drawNumbers(today, stats) {
  const week = today.header.week;
  const curve = stats.dsa_curve ?? [];
  const thisWeek = week ? curve.find((c) => c.week_n === week.n) ?? null : null;
  const finished = curve.filter((c) => c.actual !== null);
  const last = finished[finished.length - 1] ?? null;

  const dsaBlock = today.blocks.find((b) => b.code === 'DSA') ?? null;
  const buildBlock = today.blocks.find((b) => b.code === 'BUILD') ?? null;
  const money = stats.money;
  const gate = today.header.next_gate;

  const cards = [
    section(
      'Question one. DSA, target against actual',
      [
        statGrid([
          {
            value: `${int(stats.dsa_solved)} of ${int(stats.dsa_target)}`,
            label: 'solved against the target for 24 January 2027',
            sub: `${pct(stats.dsa_solved, stats.dsa_target)}% of the way`,
            hero: true,
          },
          {
            value: week ? `${int(week.dsa_target)} this week` : 'Outside the window',
            label: week ? `week ${week.n}, cumulative target ${int(week.dsa_cumulative)}` : 'no week owns today',
          },
          {
            value: last ? `${int(last.actual)} against ${int(last.plan)}` : 'No finished week',
            label: last ? `at the end of week ${last.week_n}` : 'nothing to compare yet',
            tone: last ? (Number(last.actual) >= Number(last.plan) ? 'green' : 'red') : '',
          },
          {
            value: thisWeek ? minutesLabel(thisWeek.minutes) : '0 m',
            label: 'minutes in the DSA block this week',
            sub: dsaBlock ? `${int(dsaBlock.solved_today)} solved today` : '',
          },
        ]),
        el('p', {
          class: 'text-xs muted measure',
          text: 'The cumulative figure is the one that matters. A good Saturday does not cancel a week that fell three days behind.',
        }),
      ],
      { lede: 'Answered from the API. Write the sentence anyway, in the card below.' }
    ),
    section(
      'Question five. Money',
      [
        statGrid([
          {
            value: rupees(money.total),
            label: `received of ${rupees(money.target)}`,
            sub: 'dated cash events only, never a deal ticked as paid',
            hero: true,
          },
          { value: int(money.touches.touches), label: 'touches logged in total', sub: money.touches.last_touch ? `the last on ${shortDate(money.touches.last_touch)}` : 'none yet' },
          { value: int(money.touches.replies), label: 'replies', sub: `${money.touches.reply_rate}% of touches` },
          { value: `${money.deals.won} of ${money.deals.quoted}`, label: 'deals past the advance, of deals quoted', sub: `${money.deals.win_rate}% win rate` },
        ]),
        money.touches.by_week?.length
          ? table({
              caption: 'Touches and replies by week, so this week can be read against the last one',
              columns: [
                { key: 'week_n', label: 'Week', num: true, render: (r) => `W${String(r.week_n).padStart(2, '0')}` },
                { key: 'touches', label: 'Touches', num: true, render: (r) => int(r.touches) },
                { key: 'replies', label: 'Replies', num: true, render: (r) => int(r.replies) },
              ],
              rows: money.touches.by_week,
              rowCurrent: (r) => Boolean(week) && r.week_n === week.n,
            })
          : emptyState('No touches logged yet', 'A touch is one message to one lead, logged during the money hour. Until one exists there is nothing to review here.'),
      ],
      { lede: 'Answered from the API. Quotes are counted as deals quoted, because that is what the deals table records.' }
    ),
    section(
      'The rest of the week, in numbers',
      [
        statGrid([
          {
            value: `${int(stats.colours.green)} green`,
            label: 'days so far',
            sub: `${int(stats.colours.amber)} amber, ${int(stats.colours.red)} red`,
            tone: stats.colours.red ? 'red' : 'green',
          },
          {
            value: `${int(stats.streak.current)} d`,
            label: 'current streak',
            sub: `longest ${int(stats.streak.longest)} days`,
          },
          {
            value: int(stats.video.days_over_cap),
            label: `days over the ${stats.video.cap} minute video cap`,
            tone: stats.video.days_over_cap ? 'red' : 'green',
          },
          {
            value: gate ? `${int(gate.days_remaining)} d` : 'No gate ahead',
            label: gate ? `to gate ${gate.no} on ${shortDate(gate.gate_date)}` : 'every gate is behind you',
            tone: gate && gate.days_remaining <= 14 ? 'orange' : '',
          },
        ]),
        gate ? el('p', { class: 'measure', text: gate.condition_text }) : null,
        buildBlock?.project
          ? el('p', {
              class: 'text-sm muted measure',
              text: `The project this week belongs to is ${buildBlock.project.code} ${buildBlock.project.name}, currently ${buildBlock.project.status.replace(/_/g, ' ')}${
                buildBlock.project.live_url ? ` at ${buildBlock.project.live_url}` : ', with no live URL recorded'
              }.`,
            })
          : null,
        today.failed_twice?.length
          ? el('p', {
              class: 'text-sm muted measure',
              text: `${today.failed_twice.length} problems are sitting in failed twice. Question three is asking which of them are new since last Saturday, and that is for you to say.`,
            })
          : el('p', {
              class: 'text-sm muted measure',
              text: 'Nothing is in failed twice at the moment. Question three is still worth answering: an empty list on week nine usually means problems are being marked solved too generously.',
            }),
      ],
      { lede: 'Not one of the seven, but the numbers that make answering them honest.' }
    ),
  ];

  mount('#rv-numbers', cards);
}

/* ------------------------------------------------------------ rv-questions */

function questionCard(q) {
  const box = el('textarea', {
    class: 'textarea',
    rows: q.n === 7 ? 2 : 4,
    placeholder: q.n === 7 ? 'One sentence. Yes or no, then what gets cut.' : 'Write it. Not a bullet, a sentence.',
    'aria-label': `Answer to question ${q.n}`,
  });
  box.addEventListener('input', () => answers.set(q.n, box.value));

  const pointer = POINTERS[q.n];

  return el('div', { class: 'qcard' }, [
    el('span', { class: 'qcard__n', text: `Question ${q.n} of ${QUESTIONS.length}` }),
    el('p', { class: 'qcard__q measure', text: q.question }),
    q.answerable
      ? el('p', { class: 'text-xs muted', text: 'The numbers for this one are above. Write what they mean, not what they are.' })
      : null,
    pointer
      ? el('a', { class: 'btn btn--sm btn--ghost', href: pointer.href, text: pointer.text })
      : null,
    box,
  ]);
}

function drawQuestions(today) {
  const cards = QUESTIONS.map(questionCard);

  const copy = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Copy the review, ready for log.md' });
  copy.addEventListener('click', async () => {
    const lines = [`Saturday review, ${today.header.date_long}`, ''];
    for (const q of QUESTIONS) {
      lines.push(`${q.n}. ${q.question}`);
      lines.push((answers.get(q.n) ?? '').trim() || '(not answered)');
      lines.push('');
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('The review is on the clipboard. Paste it into log.md.', 'ok');
    } catch {
      toastError('This browser would not let the page write to the clipboard. Select the text and copy it by hand.');
    }
  });

  const answered = () => QUESTIONS.filter((q) => (answers.get(q.n) ?? '').trim()).length;
  const count = el('span', { class: 'text-sm muted', text: `0 of ${QUESTIONS.length} answered` });
  for (const card of cards) {
    const box = card.querySelector('textarea');
    box.addEventListener('input', () => {
      count.textContent = `${answered()} of ${QUESTIONS.length} answered`;
    });
  }

  mount('#rv-questions', [
    section(
      'The seven questions',
      [
        el('div', { class: 'callout callout--orange' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'Nothing typed here is sent to the server' }),
            el('p', {
              class: 'measure',
              text: 'There is no review endpoint in this application, so these boxes are a place to think on the page and nothing more. Copy the review when you are done and paste it into log.md, which is where Part 18 says the written record lives. If you reload before copying, the text is gone.',
            }),
          ]),
        ]),
        el('p', {
          class: 'text-xs muted measure',
          text: 'The seven prompts are the text of Part 18.6 itself. The seeded review_questions table is not exposed by any API route, so they are not read from a response.',
        }),
        ...cards,
        el('div', { class: 'between' }, [copy, count]),
      ],
      { lede: 'Twenty minutes, inside the BUILD block, on Saturday. Written, not thought about.' }
    ),
  ]);
}

/* -------------------------------------------------------------------- main */

async function main() {
  try {
    const [today, stats] = await Promise.all([api.get('/api/today'), api.get('/api/stats')]);
    drawNumbers(today, stats);
    drawQuestions(today);
  } catch (err) {
    mount('#rv-numbers', errorCard(err.message));
    mount('#rv-questions', []);
  }
}

await main();
