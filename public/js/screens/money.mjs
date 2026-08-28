/**
 * money.mjs | the money hour, Part 17.
 *
 * The target is Rs 90,000 received by 24 January 2027. Received means a dated
 * cash event: an advance on its advance date, a balance on its balance date, a
 * care plan on the month it was invoiced. A deal that somebody ticked as paid
 * with no dates on it is not money, and it is not counted in any total here. The
 * server does that arithmetic in src/lib/money.mjs, so this screen only ever
 * displays what the API already worked out.
 *
 * The money hour is 17:00 to 18:00, six days a week, on top of the eight hours of
 * study. It never borrows from them. That is why the fifteen due touches are the
 * first list on the page: the hour has to be finishable inside the hour.
 *
 * Sources: GET /api/money/summary, /api/leads, /api/deals, /api/care-plans and
 * /api/money/scripts. Writes: POST /api/leads, POST /api/leads/import,
 * PATCH /api/leads/:id, POST /api/leads/:id/touch, POST /api/deals,
 * PATCH /api/deals/:id and PATCH /api/money-gates/:code/result.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { debounce, el, emptyState, int, optimistic, pct, rupees, shortDate } from '../ui.mjs';
import {
  barChart,
  chipFilter,
  errorCard,
  lineChart,
  meter,
  mount,
  searchBox,
  section,
  statGrid,
  table,
} from '../render.mjs';

/** The last day of the roadmap. Used to decide which weeks have a real actual. */
const LAST_DAY = '2027-01-24';

/** The lead statuses, in the order the pipeline actually moves. */
const LANES = [
  { value: 'new', label: 'New' },
  { value: 'touched', label: 'Touched' },
  { value: 'replied', label: 'Replied' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'dead', label: 'Dead' },
];

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'call', label: 'Call' },
  { value: 'walkin', label: 'Walk in' },
  { value: 'instagram', label: 'Instagram' },
];

const DEAL_STATUS = [
  { value: 'quoted', label: 'Quoted' },
  { value: 'advance_paid', label: 'Advance paid' },
  { value: 'in_delivery', label: 'In delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'paid', label: 'Paid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'dead', label: 'Dead' },
];

const DEAL_TONE = {
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
 * LEAD_COLUMNS constant of src/routes/api/money.mjs, which is where the server
 * defines them and which in turn takes them from the leads.csv sheet in Appendix
 * B of final.md. The constant is private to that module and no endpoint returns
 * it, so it is repeated here rather than fetched. If Appendix B ever changes,
 * both places have to change together.
 */
const LEAD_CSV_COLUMNS = [
  'name', 'category', 'area', 'phone', 'website', 'mobile broken', 'rating', 'reviews',
  'status', 'last touch date', 'next touch date', 'notes',
];

/** The importer's own limit, from the zod schema on POST /api/leads/import. */
const CSV_MAX_CHARS = 2_000_000;

/* ------------------------------------------------------------------- state */

/** The five payloads, kept so a single write can redraw one block, not the page. */
let summaryData = null;
let leadsData = null;
let dealsData = null;
let careData = null;
let scriptsData = null;

/** Board filters, sent to /api/leads as query parameters. */
const filters = { status: '', due: '', q: '' };

/* ------------------------------------------------------------------ pieces */

const cell = (value, label, sub = '', tone = '', hero = false) =>
  el('div', { class: `card stat ${tone ? `stat--${tone}` : ''}` }, [
    el('span', { class: `stat__value ${hero ? 'stat__value--hero' : ''}`, text: String(value) }),
    el('span', { class: 'stat__label', text: label }),
    sub ? el('span', { class: 'stat__sub', text: sub }) : null,
  ]);

const selectOf = (options, current, label, cls = 'select select--sm') =>
  el(
    'select',
    { class: cls, 'aria-label': label },
    options.map((o) => el('option', { value: o.value, text: o.label, selected: o.value === current }))
  );

const field = (label, control, hint = '') =>
  el('label', { class: 'field' }, [
    el('span', { class: 'field__label', text: label }),
    control,
    hint ? el('span', { class: 'field__hint', text: hint }) : null,
  ]);

const laneLabel = (value) => LANES.find((l) => l.value === value)?.label ?? value;
const dealLabel = (value) => DEAL_STATUS.find((s) => s.value === value)?.label ?? value;

/* ----------------------------------------------------------------- m-strip */

function drawStrip() {
  const s = summaryData.strip;
  const percent = pct(s.received_total, s.target_total);
  const monthBand = s.month_target
    ? `${rupees(s.month_target.low)} to ${rupees(s.month_target.high)} is the plan`
    : 'no month target in the plan for this month';

  const strip = el('div', { class: 'moneystrip' }, [
    cell(rupees(s.received_total), `received of ${rupees(s.target_total)}`, `${percent}% of the target`, percent >= 100 ? 'green' : '', true),
    cell(rupees(s.received_this_month), `received in ${s.month_label}`, monthBand),
    cell(
      `${s.care_plan_count} of ${s.care_plan_target}`,
      'care plans running',
      `${rupees(s.care_plan_monthly)} a month, the recurring floor`,
      s.care_plan_count >= s.care_plan_target ? 'green' : ''
    ),
    cell(
      s.days_since_last_touch === null ? 'Never' : `${int(s.days_since_last_touch)} d`,
      'since the last touch',
      s.days_since_last_touch === null ? 'no lead has ever been touched' : '',
      s.days_since_last_touch === null || s.days_since_last_touch > 2 ? 'red' : ''
    ),
    cell(
      s.days_since_last_rupee === null ? 'Never' : `${int(s.days_since_last_rupee)} d`,
      'since the last rupee arrived',
      s.days_since_last_rupee === null ? 'no cash event recorded yet' : '',
      s.days_since_last_rupee === null || s.days_since_last_rupee > 14 ? 'red' : ''
    ),
    cell(`${summaryData.deals.win_rate}%`, 'win rate on quoted deals', `${summaryData.deals.won} won of ${summaryData.deals.quoted} quoted`),
  ]);

  mount('#m-strip', [
    section(`Rs 90,000 received by 24 January 2027`, [
      strip,
      meter(percent, percent >= 100 ? 'green' : ''),
      el('p', {
        class: 'text-sm muted measure',
        text: 'Received is counted from dated cash events only: an advance on its advance date, a balance on its balance date, a care plan on the month it was invoiced. A deal ticked as paid with no dates on it is not money and is not in this total.',
      }),
      summaryData.week
        ? el('p', {
            class: 'text-xs muted',
            text: `Week ${summaryData.week.n}, ${summaryData.week.title}. ${summaryData.week.dates_label}.`,
          })
        : el('p', { class: 'text-xs muted', text: `${summaryData.today} is outside the 21 week window.` }),
    ]),
  ]);
}

/* ----------------------------------------------------------------- m-today */

/** One lead, with the full touch form folded away behind the quick button. */
function touchRow(lead, index) {
  const channel = selectOf(CHANNELS, 'whatsapp', `Channel for ${lead.name}`);
  const script = selectOf(
    [{ value: '', label: 'No script' }].concat(
      (summaryData.scripts ?? []).map((s) => ({ value: s.code, label: `${s.code} ${s.title}` }))
    ),
    '',
    `Script used for ${lead.name}`
  );
  const reply = el('input', { class: 'tick__box', type: 'checkbox' });
  const nextIn = el('input', { class: 'input input--num input--sm', type: 'number', min: '0', max: '60', step: '1', value: '2' });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What you said, and what came back.' });

  const quick = el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: 'Log a WhatsApp touch' });
  const full = el('button', { type: 'button', class: 'btn btn--sm', text: 'Log this touch' });

  async function write(body, button) {
    button.disabled = true;
    try {
      await api.post(`/api/leads/${lead.id}/touch`, body);
      toast(`Touch logged for ${lead.name}.`, 'ok');
      await reloadLeads();
      await reloadSummary();
    } catch (err) {
      toastError(err.message);
      button.disabled = false;
    }
  }

  quick.addEventListener('click', () => write({ channel: 'whatsapp' }, quick));
  full.addEventListener('click', () =>
    write(
      {
        channel: channel.value,
        script_code: script.value || null,
        reply: reply.checked,
        next_touch_in_days: Number(nextIn.value) || 0,
        notes: notes.value,
      },
      full
    )
  );

  const due = lead.next_touch_on
    ? lead.next_touch_on < leadsData.today
      ? el('span', { class: 'badge badge--red', text: `Overdue since ${shortDate(lead.next_touch_on)}` })
      : lead.next_touch_on === leadsData.today
        ? el('span', { class: 'badge badge--orange', text: 'Due today' })
        : el('span', { class: 'badge badge--outline', text: `Due ${shortDate(lead.next_touch_on)}` })
    : el('span', { class: 'badge badge--blue', text: 'Never touched' });

  const facts = [lead.category, lead.area, lead.rating ? `${lead.rating} stars` : null, lead.reviews ? `${lead.reviews} reviews` : null]
    .filter(Boolean)
    .join(', ');

  return el('div', { class: 'touchrow' }, [
    el('span', { class: 'badge badge--outline', text: String(index + 1) }),
    el('div', { class: 'stack-sm' }, [
      el('div', { class: 'row' }, [
        el('strong', { text: lead.name }),
        due,
        el('span', { class: 'badge badge--outline', text: laneLabel(lead.status) }),
        lead.mobile_broken ? el('span', { class: 'badge badge--orange', text: 'Broken on mobile' }) : null,
      ]),
      facts ? el('p', { class: 'text-xs muted', text: facts }) : null,
      el('div', { class: 'row' }, [
        lead.phone ? el('a', { class: 'btn btn--sm btn--ghost', href: `tel:${lead.phone}`, text: 'Call' }) : null,
        lead.phone
          ? el('a', {
              class: 'btn btn--sm btn--ghost',
              href: `https://wa.me/${String(lead.phone).replace(/\D/g, '')}`,
              text: 'WhatsApp',
              target: '_blank',
              rel: 'noopener noreferrer',
              'data-ext': '1',
            })
          : null,
        lead.website
          ? el('a', {
              class: 'btn btn--sm btn--ghost',
              href: lead.website,
              text: 'Open their site',
              target: '_blank',
              rel: 'noopener noreferrer',
              'data-ext': '1',
            })
          : null,
      ]),
      el('details', { class: 'acc' }, [
        el('summary', { class: 'acc__summary', text: 'Log it with the channel, the script and the reply' }),
        el('div', { class: 'acc__body stack-sm' }, [
          el('div', { class: 'grid grid--3' }, [
            field('Channel', channel),
            field('Script', script),
            field('Next touch in days', nextIn, 'Follow up one is 48 hours later, so two is the default.'),
          ]),
          el('label', { class: 'tick' }, [
            reply,
            el('span', { class: 'tick__body' }, [
              el('span', { class: 'tick__text', text: 'They replied' }),
              el('span', { class: 'tick__meta', text: 'A reply moves the lead to replied. Silence is not a reply.' }),
            ]),
          ]),
          field('Notes', notes),
          el('div', { class: 'row' }, [full]),
        ]),
      ]),
    ]),
    el('div', { class: 'right' }, [quick]),
  ]);
}

function drawToday() {
  const target = summaryData.touch_target_today;
  const task = summaryData.money_task_today;
  const fifteen = leadsData.next_15 ?? [];
  const touchedToday = (leadsData.leads ?? []).filter((l) => l.last_touch_on === leadsData.today).length;

  mount('#m-today', [
    section(
      'The money hour, 17:00 to 18:00',
      [
        el('p', { class: 'measure', text: task ?? 'There is no money task on the calendar for today.' }),
        statGrid([
          {
            value: target ? `${touchedToday} of ${target}` : String(touchedToday),
            label: target ? 'leads touched today, against the target Appendix C states' : 'leads touched today',
            tone: target && touchedToday >= target ? 'green' : target ? 'red' : '',
            hero: true,
          },
          { value: int(summaryData.touches.touches), label: 'touches logged in total' },
          { value: `${summaryData.touches.reply_rate}%`, label: 'reply rate', sub: `${int(summaryData.touches.replies)} replies` },
          {
            value: summaryData.touches.last_touch ? shortDate(summaryData.touches.last_touch) : 'Never',
            label: 'the last touch you logged',
          },
        ]),
        el('p', {
          class: 'text-xs muted measure',
          text: 'Touched today is counted from the last touch date on each lead, so it is the number of leads reached today rather than the number of messages sent.',
        }),
        fifteen.length
          ? el('div', { class: 'card card--flush' }, fifteen.map((lead, i) => touchRow(lead, i)))
          : emptyState(
              'No leads are waiting',
              'The fifteen due touches are drawn from leads that are not won, lost or dead, soonest follow up first. Add a lead below, or import the sixty from a CSV, and this list fills itself.'
            ),
      ],
      { lede: 'Six days a week, on top of the eight hours of study. It never borrows from them.' }
    ),
  ]);
}

/* ----------------------------------------------------------------- m-board */

/** A lead card that can be moved between lanes. The move is optimistic. */
function leadCard(lead, columns, recount) {
  const status = selectOf(LANES, lead.status, `Status of ${lead.name}`);
  const card = el('div', { class: 'kancard stack-sm' }, [
    el('strong', { text: lead.name }),
    el('span', {
      class: 'text-xs muted',
      text: [lead.category, lead.area].filter(Boolean).join(', ') || 'No category recorded',
    }),
    el('span', {
      class: 'text-xs muted',
      text: lead.next_touch_on ? `Next touch ${shortDate(lead.next_touch_on)}` : 'No follow up date',
    }),
    el('span', { class: 'text-xs muted', text: `${int(lead.touch_count ?? 0)} touches so far` }),
    status,
  ]);

  status.addEventListener('change', async () => {
    const want = status.value;
    const previous = lead.status;
    if (want === previous) return;
    status.disabled = true;
    try {
      await optimistic({
        apply: () => {
          lead.status = want;
          columns.get(want)?.list.appendChild(card);
          recount();
        },
        revert: () => {
          lead.status = previous;
          status.value = previous;
          columns.get(previous)?.list.appendChild(card);
          recount();
        },
        write: () => api.patch(`/api/leads/${lead.id}`, { status: want }),
        onError: (err) => toastError(err.message),
      });
      toast(`${lead.name} moved to ${laneLabel(want)}.`, 'ok');
    } catch {
      // optimistic has already put the card back and shown the reason.
    } finally {
      status.disabled = false;
    }
  });

  return card;
}

function kanban() {
  const leads = leadsData.leads ?? [];
  const board = el('div', { class: 'kanban' });
  const columns = new Map();

  for (const lane of LANES) {
    const count = el('span', { class: 'kancol__count', text: '0' });
    const list = el('div', { class: 'kancol__list' });
    const col = el('div', { class: 'kancol' }, [
      el('div', { class: 'kancol__head' }, [el('span', { class: 'kancol__title', text: lane.label }), count]),
      list,
    ]);
    columns.set(lane.value, { list, count });
    board.appendChild(col);
  }

  const recount = () => {
    for (const lane of LANES) {
      const n = leads.filter((l) => l.status === lane.value).length;
      columns.get(lane.value).count.textContent = String(n);
    }
  };

  for (const lead of leads) {
    const target = columns.get(lead.status) ?? columns.get('new');
    target.list.appendChild(leadCard(lead, columns, recount));
  }
  recount();

  if (!leads.length) {
    return emptyState(
      'No leads match',
      'Either the list is empty or the filters exclude everything. Clear the filters, or add the first lead with the form above. Part 17.6 asks for sixty leads a week built during the money hour, never during study.'
    );
  }
  return board;
}

/** The add lead form. Only the name is required, which is how a real list grows. */
function addLeadForm() {
  const name = el('input', { class: 'input', type: 'text', placeholder: 'The business name', maxlength: '200' });
  const category = el('input', { class: 'input', type: 'text', placeholder: 'Dentist, gym, cafe', maxlength: '120' });
  const area = el('input', { class: 'input', type: 'text', placeholder: 'The area', maxlength: '120' });
  const phone = el('input', { class: 'input', type: 'tel', placeholder: 'Phone', maxlength: '32' });
  const website = el('input', { class: 'input', type: 'url', placeholder: 'https://their-site' });
  const broken = el('input', { class: 'tick__box', type: 'checkbox' });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'Why they are worth a message.' });
  const add = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Add the lead' });

  add.addEventListener('click', async () => {
    if (!name.value.trim()) {
      toastError('A lead needs a name. Everything else can wait.');
      name.focus();
      return;
    }
    add.disabled = true;
    try {
      await api.post('/api/leads', {
        name: name.value.trim(),
        category: category.value.trim() || null,
        area: area.value.trim() || null,
        phone: phone.value.trim() || null,
        website: website.value.trim() || null,
        mobile_broken: broken.checked,
        notes: notes.value.trim() || null,
      });
      toast(`${name.value.trim()} added.`, 'ok');
      for (const input of [name, category, area, phone, website, notes]) input.value = '';
      broken.checked = false;
      await reloadLeads();
      await reloadSummary();
    } catch (err) {
      toastError(err.message);
    } finally {
      add.disabled = false;
    }
  });

  return el('details', { class: 'acc' }, [
    el('summary', { class: 'acc__summary', text: 'Add a lead' }),
    el('div', { class: 'acc__body stack-sm' }, [
      el('div', { class: 'grid grid--3' }, [field('Name', name), field('Category', category), field('Area', area)]),
      el('div', { class: 'grid grid--2' }, [field('Phone', phone), field('Website', website)]),
      el('label', { class: 'tick' }, [
        broken,
        el('span', { class: 'tick__body' }, [
          el('span', { class: 'tick__text', text: 'Their site is broken on mobile' }),
          el('span', { class: 'tick__meta', text: 'That is the opening line, so it is worth recording.' }),
        ]),
      ]),
      field('Notes', notes),
      el('div', { class: 'row' }, [add]),
    ]),
  ]);
}

/**
 * Reads a chosen file as text. Blob.text() is used where the browser has it and
 * FileReader where it does not, because not every phone this runs on is current
 * and a file that will not open is ten minutes of the money hour lost.
 */
function readChosenFile(file) {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('That file could not be read. Open it and paste the rows instead.'));
    reader.readAsText(file);
  });
}

/**
 * The report the importer sends back, drawn from the field names the handler
 * actually returns: read, written, skipped and problems on both runs, plus
 * would_write and sample on a dry run only. Nothing else is available, so
 * unknown columns are not counted here: the server ignores a column it does not
 * recognise and says nothing about it.
 */
function importReport(report) {
  const dry = report.dry_run === true;
  const problems = report.problems ?? [];
  const written = Number(report.written ?? 0);
  const wouldWrite = Number(report.would_write ?? 0);
  const skipped = Number(report.skipped ?? 0);
  const sample = report.sample ?? [];

  return [
    statGrid([
      { value: Number(report.read ?? 0), label: 'rows read, the header not counted', hero: true },
      dry
        ? { value: wouldWrite, label: 'rows that would be written', tone: wouldWrite ? 'blue' : '' }
        : { value: written, label: 'rows written', tone: written ? 'green' : '' },
      { value: skipped, label: 'rows skipped, a duplicate or no name', tone: skipped ? 'orange' : '' },
      { value: problems.length, label: 'rows the importer had something to say about' },
    ]),
    dry
      ? el('p', {
          class: 'text-xs muted measure',
          text: 'Nothing was written. A dry run only spots names repeated inside the file, because the check against the leads already on your list happens during the real import, so the number above can still fall when you import.',
        })
      : null,
    dry && sample.length
      ? el('p', { class: 'text-xs muted measure', text: `The first names it read: ${sample.join(', ')}.` })
      : null,
    problems.length
      ? table({
          caption:
            problems.length > 20
              ? `The first 20 of ${int(problems.length)} rows the importer skipped, each with its reason`
              : `${int(problems.length)} skipped row${problems.length === 1 ? '' : 's'}, each with its reason`,
          columns: [{ key: 'reason', label: 'What the importer skipped, and why' }],
          rows: problems.slice(0, 20).map((reason) => ({ reason: String(reason) })),
        })
      : emptyState(
          'No row was refused',
          'Every row had a name and no name appeared twice, so the importer found nothing to skip.'
        ),
  ];
}

/**
 * The CSV importer. Part 17.13 gives the first ten minutes of the money hour to
 * filling thirty rows, and the empty state on the touch list above already tells
 * the reader to import the sixty from a CSV, so the list is built in a
 * spreadsheet and pasted or uploaded here rather than typed in one lead at a
 * time. The check is offered first because an import that guesses wrong leaves
 * rows on the list that then have to be found and deleted by hand.
 */
function importLeadsForm() {
  const csv = el('textarea', {
    class: 'textarea',
    rows: 8,
    placeholder: 'Paste the whole sheet here, the header row first.',
  });
  const file = el('input', { class: 'input', type: 'file', accept: '.csv,text/csv' });
  const count = el('span', { class: 'field__hint', text: '' });

  const check = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Check it first' });
  const write = el('button', { type: 'button', class: 'btn btn--sm', text: 'Import for real' });

  const reportHost = el('div', { class: 'stack-sm' }, [
    emptyState(
      'Nothing checked yet',
      'Paste the rows or choose a file, then use Check it first. That reads the whole file and reports what it would do without writing a single lead.'
    ),
  ]);

  /** Too long is refused here rather than at the server, which only sees a 400. */
  const tooLong = (text) => {
    if (text.length <= CSV_MAX_CHARS) return false;
    toastError(
      `That is ${int(text.length)} characters and the importer takes ${int(CSV_MAX_CHARS)}. Split the sheet and import it in two halves.`
    );
    return true;
  };

  const showLength = () => {
    const n = csv.value.length;
    count.textContent = n ? `${int(n)} characters of the ${int(CSV_MAX_CHARS)} the importer takes.` : '';
  };
  csv.addEventListener('input', showLength);

  file.addEventListener('change', async () => {
    const chosen = file.files?.[0];
    if (!chosen) return;
    try {
      const text = await readChosenFile(chosen);
      if (tooLong(text)) return;
      csv.value = text;
      showLength();
      toast(`${chosen.name} is in the box below. Check it before you import it.`, 'ok');
    } catch (err) {
      toastError(err.message);
    }
  });

  async function run(dryRun, button) {
    const text = csv.value.trim();
    if (!text) {
      toastError('There is nothing to import. Paste the rows or choose a file first.');
      csv.focus();
      return;
    }
    if (tooLong(text)) return;

    check.disabled = true;
    write.disabled = true;
    button.disabled = true;
    try {
      // queueable is turned off on purpose. The whole point of this call is the
      // report that comes back, which a queued replay would throw away, and a
      // dry run parked in the queue would return as a real write later on.
      const report = await api.post('/api/leads/import', { csv: text, dry_run: dryRun }, { queueable: false });
      reportHost.replaceChildren(...importReport(report).filter(Boolean));
      if (dryRun) {
        toast(`Checked. ${int(report.would_write ?? 0)} of ${int(report.read ?? 0)} rows would be written.`, 'ok');
      } else {
        toast(`${int(report.written ?? 0)} leads imported.`, 'ok');
        // The rows have to appear at once, so the leads and the strip are
        // re-fetched through the paths the rest of the screen already uses.
        await reloadLeads();
        await reloadSummary();
      }
    } catch (err) {
      reportHost.replaceChildren(errorCard(err.message));
      toastError(err.message);
    } finally {
      check.disabled = false;
      write.disabled = false;
      button.disabled = false;
    }
  }

  check.addEventListener('click', () => run(true, check));
  write.addEventListener('click', () => run(false, write));

  return el('details', { class: 'acc' }, [
    el('summary', { class: 'acc__summary', text: 'Import leads from a CSV' }),
    el('div', { class: 'acc__body stack-sm' }, [
      el('p', {
        class: 'text-sm measure',
        text: 'Part 17.13 gives the first ten minutes of the hour to thirty rows, which is faster from a sheet than from this page one lead at a time.',
      }),
      el('div', { class: 'card stack-sm' }, [
        el('p', { class: 'card__label', text: 'The header row the importer expects' }),
        el('p', { class: 'text-xs mono measure', text: LEAD_CSV_COLUMNS.join(',') }),
        el('p', {
          class: 'text-xs muted measure',
          text: 'Only name is required and a row without one is skipped. Capitals and underscores are fine, because the header is lowercased and an underscore is read as a space. A column the importer does not know is ignored, so an export with extra columns still works.',
        }),
        el('p', {
          class: 'text-xs muted measure',
          text: 'Mobile broken takes y, yes, true or 1. A status outside new, touched, replied, quoted, won, lost and dead is stored as new. The two dates have to be in the year-month-day form, as in 2026-08-28, or they are left empty. A rating outside 0 to 5 is left empty.',
        }),
      ]),
      field('Choose a CSV file', file, 'The file is read on this device and dropped into the box below, where you can still edit it before importing.'),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Or paste the rows' }), csv, count]),
      el('div', { class: 'row' }, [check, write]),
      el('p', {
        class: 'text-xs muted measure',
        text: 'Check it first writes nothing. Import for real adds every row it accepts and skips any name already on your list.',
      }),
      reportHost,
    ]),
  ]);
}

/** A stable host, so re-fetching the leads does not steal focus from the search box. */
const boardHost = el('div', { class: 'stack' });

function drawKanban() {
  boardHost.replaceChildren(kanban());
}

function drawBoard() {
  const reload = debounce(() => {
    reloadLeads().catch((err) => toastError(err.message));
  }, 250);

  drawKanban();

  mount('#m-board', [
    section(
      'The pipeline',
      [
        addLeadForm(),
        importLeadsForm(),
        el('div', { class: 'filters' }, [
          searchBox('Search a name, a category or an area', (v) => {
            filters.q = v;
            reload();
          }),
          chipFilter(
            [{ value: '', label: 'Any status' }].concat(
              LANES.map((l) => ({ value: l.value, label: l.label, count: summaryData.pipeline[l.value] ?? 0 }))
            ),
            filters.status,
            (v) => {
              filters.status = v;
              reload();
            }
          ),
          chipFilter(
            [
              { value: '', label: 'Any follow up' },
              { value: 'today', label: 'Due today' },
              { value: 'overdue', label: 'Overdue' },
              { value: 'never', label: 'Never touched' },
            ],
            filters.due,
            (v) => {
              filters.due = v;
              reload();
            }
          ),
        ]),
        boardHost,
      ],
      {
        lede: 'Move a lead with the select on its card. The move is written straight away and put back if the server refuses it.',
      }
    ),
  ]);
}

/* ----------------------------------------------------------------- m-deals */

function dealRow(deal) {
  const status = selectOf(DEAL_STATUS, deal.status, `Status of the deal with ${deal.client_name}`);
  const badge = el('span', { class: `badge ${DEAL_TONE[deal.status] ?? 'badge--outline'}`, text: dealLabel(deal.status) });

  const advanceAmount = el('input', { class: 'input input--num input--sm', type: 'number', min: '0', step: '100', value: deal.advance_amount ?? '' });
  const advanceOn = el('input', { class: 'input input--sm', type: 'date', value: deal.advance_on ?? '' });
  const deliveryDue = el('input', { class: 'input input--sm', type: 'date', value: deal.delivery_due ?? '' });
  const deliveredOn = el('input', { class: 'input input--sm', type: 'date', value: deal.delivered_on ?? '' });
  const balanceAmount = el('input', { class: 'input input--num input--sm', type: 'number', min: '0', step: '100', value: deal.balance_amount ?? '' });
  const balanceOn = el('input', { class: 'input input--sm', type: 'date', value: deal.balance_on ?? '' });
  const referral = el('input', { class: 'tick__box', type: 'checkbox', checked: Number(deal.referral_asked) === 1 });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What was agreed.' });
  notes.value = deal.notes ?? '';

  const save = el('button', { type: 'button', class: 'btn btn--sm btn--primary', text: 'Save the dates' });

  async function write(patch, revert) {
    status.disabled = true;
    save.disabled = true;
    try {
      await api.patch(`/api/deals/${deal.id}`, patch);
      toast(`Deal with ${deal.client_name} saved.`, 'ok');
      await reloadDeals();
      await reloadSummary();
      return true;
    } catch (err) {
      if (revert) revert();
      toastError(err.message);
      return false;
    } finally {
      status.disabled = false;
      save.disabled = false;
    }
  }

  status.addEventListener('change', async () => {
    const want = status.value;
    const previous = deal.status;
    const ok = await write({ status: want }, () => {
      status.value = previous;
    });
    if (ok) {
      deal.status = want;
      badge.textContent = dealLabel(want);
      badge.className = `badge ${DEAL_TONE[want] ?? 'badge--outline'}`;
    }
  });

  save.addEventListener('click', () =>
    write({
      advance_amount: advanceAmount.value === '' ? null : Number(advanceAmount.value),
      advance_on: advanceOn.value || null,
      delivery_due: deliveryDue.value || null,
      delivered_on: deliveredOn.value || null,
      balance_amount: balanceAmount.value === '' ? null : Number(balanceAmount.value),
      balance_on: balanceOn.value || null,
      referral_asked: referral.checked,
      notes: notes.value,
    })
  );

  return el('div', { class: 'linkrow' }, [
    el('div', { class: 'linkrow__main' }, [
      el('div', { class: 'linkrow__title' }, [
        el('strong', { text: deal.client_name }),
        el('span', { class: 'badge badge--outline', text: `${deal.offer_code} ${deal.offer_name}` }),
        badge,
        el('span', { class: 'badge badge--outline', text: rupees(deal.price) }),
        deal.overdue ? el('span', { class: 'badge badge--red', text: 'Delivery overdue' }) : null,
        Number(deal.referral_asked) === 1 ? el('span', { class: 'badge badge--green', text: 'Referral asked' }) : null,
      ]),
      el('p', {
        class: 'linkrow__why',
        text: [
          deal.lead_name ? `From the lead ${deal.lead_name}` : 'Not linked to a lead',
          deal.advance_on ? `advance ${rupees(deal.advance_amount ?? 0)} on ${shortDate(deal.advance_on)}` : 'no advance recorded',
          deal.balance_on ? `balance ${rupees(deal.balance_amount ?? 0)} on ${shortDate(deal.balance_on)}` : 'no balance recorded',
          deal.delivery_due
            ? `delivery due ${shortDate(deal.delivery_due)}${deal.days_to_delivery === null ? '' : `, ${deal.days_to_delivery} days away`}`
            : 'no delivery date',
        ].join('. '),
      }),
      el('details', { class: 'acc' }, [
        el('summary', { class: 'acc__summary', text: 'The dates that make it money' }),
        el('div', { class: 'acc__body stack-sm' }, [
          el('p', {
            class: 'text-xs muted measure',
            text: 'Only these dates count towards the Rs 90,000. An advance counts on its advance date and a balance on its balance date. Fifty per cent advance before you start: no advance, no work.',
          }),
          el('div', { class: 'grid grid--3' }, [
            field('Advance amount', advanceAmount),
            field('Advance received on', advanceOn),
            field('Delivery due', deliveryDue),
          ]),
          el('div', { class: 'grid grid--3' }, [
            field('Delivered on', deliveredOn),
            field('Balance amount', balanceAmount),
            field('Balance received on', balanceOn),
          ]),
          el('label', { class: 'tick' }, [
            referral,
            el('span', { class: 'tick__body' }, [
              el('span', { class: 'tick__text', text: 'Referral asked' }),
              el('span', { class: 'tick__meta', text: 'Asked at delivery, while they are pleased, not a week later.' }),
            ]),
          ]),
          field('Notes', notes),
          el('div', { class: 'row' }, [save]),
        ]),
      ]),
    ]),
    el('div', { class: 'linkrow__actions' }, [status]),
  ]);
}

/** A new deal. The server refuses a price under the offer floor and a locked offer. */
function addDealForm() {
  const offers = summaryData.offers ?? [];
  const clientName = el('input', { class: 'input', type: 'text', placeholder: 'The client name', maxlength: '200' });
  const offer = selectOf(
    offers.map((o) => ({ value: o.code, label: `${o.code} ${o.name}, ${o.price_band_text}` })),
    offers[0]?.code ?? '',
    'The offer being sold'
  );
  const price = el('input', { class: 'input input--num', type: 'number', min: '0', step: '100', placeholder: '0' });
  const leadSelect = selectOf(
    [{ value: '', label: 'Not linked to a lead' }].concat(
      (leadsData.leads ?? []).map((l) => ({ value: String(l.id), label: l.name }))
    ),
    '',
    'The lead this came from'
  );
  const advanceAmount = el('input', { class: 'input input--num', type: 'number', min: '0', step: '100', placeholder: '0' });
  const advanceOn = el('input', { class: 'input', type: 'date' });
  const deliveryDue = el('input', { class: 'input', type: 'date' });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'The scope, in one line.' });
  const add = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Record the deal' });

  const floorHint = el('span', { class: 'field__hint', text: '' });
  const showFloor = () => {
    const o = offers.find((x) => x.code === offer.value);
    floorHint.textContent = o
      ? `${o.code} runs ${rupees(o.price_low)} to ${rupees(o.price_high)}. Quote at the top of the band, settle in the middle, never under the floor.`
      : '';
  };
  offer.addEventListener('change', showFloor);
  showFloor();

  add.addEventListener('click', async () => {
    if (!clientName.value.trim()) {
      toastError('A deal needs a client name.');
      clientName.focus();
      return;
    }
    add.disabled = true;
    try {
      await api.post('/api/deals', {
        client_name: clientName.value.trim(),
        offer_code: offer.value,
        price: Number(price.value) || 0,
        lead_id: leadSelect.value ? Number(leadSelect.value) : null,
        advance_amount: advanceAmount.value === '' ? null : Number(advanceAmount.value),
        advance_on: advanceOn.value || null,
        delivery_due: deliveryDue.value || null,
        notes: notes.value.trim() || null,
      });
      toast(`Deal with ${clientName.value.trim()} recorded.`, 'ok');
      clientName.value = '';
      price.value = '';
      advanceAmount.value = '';
      advanceOn.value = '';
      deliveryDue.value = '';
      notes.value = '';
      await reloadDeals();
      await reloadSummary();
    } catch (err) {
      toastError(err.message);
    } finally {
      add.disabled = false;
    }
  });

  return el('details', { class: 'acc' }, [
    el('summary', { class: 'acc__summary', text: 'Record a deal' }),
    el('div', { class: 'acc__body stack-sm' }, [
      el('div', { class: 'grid grid--3' }, [
        field('Client', clientName),
        el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Offer' }), offer, floorHint]),
        field('Price', price),
      ]),
      el('div', { class: 'grid grid--3' }, [
        field('From the lead', leadSelect),
        field('Advance amount', advanceAmount),
        field('Advance received on', advanceOn),
      ]),
      el('div', { class: 'grid grid--2' }, [field('Delivery due', deliveryDue), field('Notes', notes)]),
      el('div', { class: 'row' }, [add]),
    ]),
  ]);
}

function carePlanTable() {
  const plans = careData.care_plans ?? [];
  if (!plans.length) {
    return emptyState(
      'No care plans yet',
      `O8 is the only recurring offer and the target is ${careData.target} plans. They are the floor that stops January depending on one big job. The floor is Rs 1,200 a month and the server refuses anything under it.`
    );
  }
  return table({
    caption: `${careData.floor.count} active plans, ${rupees(careData.floor.monthly)} a month`,
    columns: [
      { key: 'client_name', label: 'Client' },
      { key: 'monthly_amount', label: 'A month', num: true, render: (r) => rupees(r.monthly_amount) },
      { key: 'started_on', label: 'Started', render: (r) => shortDate(r.started_on) },
      {
        key: 'last_invoice_on',
        label: 'Last invoiced',
        render: (r) => (r.last_invoice_on ? shortDate(r.last_invoice_on) : 'Never, so it counts nothing yet'),
      },
      {
        key: 'active',
        label: 'State',
        render: (r) =>
          Number(r.active) === 1
            ? el('span', { class: 'badge badge--green', text: 'Active' })
            : el('span', { class: 'badge badge--outline', text: 'Stopped' }),
      },
    ],
    rows: plans,
  });
}

function drawDeals() {
  const deals = dealsData.deals ?? [];
  const stats = dealsData.stats;

  mount('#m-deals', [
    section(
      'Deals',
      [
        statGrid([
          { value: stats.quoted, label: 'deals quoted' },
          { value: stats.won, label: 'deals taken past the advance', tone: stats.won ? 'green' : '' },
          { value: `${stats.win_rate}%`, label: 'win rate' },
          {
            value: deals.filter((d) => d.overdue).length,
            label: 'deliveries past their due date',
            tone: deals.filter((d) => d.overdue).length ? 'red' : '',
          },
        ]),
        addDealForm(),
        deals.length
          ? el('div', { class: 'card card--flush' }, deals.map(dealRow))
          : emptyState(
              'No deals yet',
              'A deal is recorded when a price has been quoted, not when the money arrives. Record it here and the advance and balance dates are what count towards the target.'
            ),
      ],
      { lede: 'Fifty per cent advance before you start. No advance, no work.' }
    ),
    section('Care plans, O8', [carePlanTable()], {
      lede: 'The recurring floor. Five plans is the target, and a plan only counts money from the month it was last invoiced.',
    }),
  ]);
}

/* ---------------------------------------------------------------- m-offers */

function offerCard(o) {
  return el('div', { class: `offercard ${o.locked ? 'offercard--locked' : ''}` }, [
    el('div', { class: 'row' }, [
      el('span', { class: 'offercard__code', text: o.code }),
      el('strong', { class: 'grow', text: o.name }),
      o.is_recurring ? el('span', { class: 'badge badge--green', text: 'Recurring' }) : null,
      o.locked ? el('span', { class: 'badge badge--red', text: `Locked until week ${o.unlocked_from_week}` }) : null,
    ]),
    el('span', { class: 'offercard__price', text: o.price_band_text }),
    el('p', { class: 'text-sm', text: o.scope }),
    el('p', { class: 'text-xs muted', text: `Delivery ${o.delivery}` }),
    o.locked ? el('p', { class: 'text-xs measure', text: o.reason }) : null,
  ]);
}

function drawOffers() {
  const offers = summaryData.offers ?? [];
  mount('#m-offers', [
    section(
      'The eight offers',
      [
        offers.length
          ? el('div', { class: 'grid grid--3' }, offers.map(offerCard))
          : emptyState('No offers', 'The eight offers come from Part 17.4 of final.md. Run npm run setup.'),
        el('p', {
          class: 'text-sm muted measure',
          text: 'Quote at the top of the band, settle in the middle, never go under the floor. A locked offer stays locked: selling retrieval before you have built it once in Project 4 costs a week of study time repaying the mistake.',
        }),
      ],
      { lede: 'Part 17.4. The price band is the price band.' }
    ),
  ]);
}

/* ------------------------------------------------------------------ m-plan */

function drawPlan() {
  const weekPlan = summaryData.week_plan ?? [];
  const monthPlan = summaryData.month_plan ?? [];

  const weekTable = weekPlan.length
    ? table({
        caption: 'Part 17.14, the money target for each of the 21 weeks',
        columns: [
          { key: 'week_n', label: 'Week', num: true, render: (r) => `W${String(r.week_n).padStart(2, '0')}` },
          { key: 'focus', label: 'Focus' },
          { key: 'target_text', label: 'Target' },
          {
            key: 'actual',
            label: 'Received by the end of it',
            num: true,
            render: (r) => rupees(r.actual),
          },
          {
            key: 'state',
            label: 'Against the floor',
            render: (r) => {
              if (!Number(r.target_low)) return el('span', { class: 'badge badge--outline', text: 'No floor set' });
              return Number(r.actual) >= Number(r.target_low)
                ? el('span', { class: 'badge badge--green', text: 'Met' })
                : el('span', { class: 'badge badge--outline', text: `${rupees(Number(r.target_low) - Number(r.actual))} short` });
            },
          },
        ],
        rows: weekPlan,
        rowCurrent: (r) => Boolean(r.is_current),
      })
    : emptyState('No weekly money plan', 'The 21 week money targets come from Part 17.14 of final.md. Run npm run setup.');

  const monthTable = monthPlan.length
    ? table({
        caption: 'The month by month plan, and the total',
        columns: [
          { key: 'month_label', label: 'Month' },
          { key: 'target_text', label: 'Target' },
          { key: 'what_produces_it', label: 'What produces it' },
          { key: 'actual', label: 'Received', num: true, render: (r) => rupees(r.actual) },
          {
            key: 'is_total',
            label: '',
            render: (r) => (Number(r.is_total) === 1 ? el('span', { class: 'badge badge--blue', text: 'Total' }) : null),
          },
        ],
        rows: monthPlan,
      })
    : emptyState('No monthly money plan', 'The monthly targets come from Part 17 of final.md. Run npm run setup.');

  mount('#m-plan', [
    section('The weekly plan', [weekTable], {
      lede: 'Received by the end of that week is cumulative from 28 August 2026, which is how the plan states it.',
    }),
    section('The monthly plan', [monthTable]),
  ]);
}

/* ----------------------------------------------------------------- m-gates */

function moneyGateCard(g) {
  const amount = el('input', {
    class: 'input input--num',
    type: 'number',
    min: '0',
    step: '100',
    value: g.amount_received ?? '',
    placeholder: '0',
  });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What came in, and from whom.' });
  notes.value = g.notes ?? '';

  const box = el('input', { class: 'tick__box', type: 'checkbox', checked: g.passed });
  const save = el('button', { type: 'button', class: 'btn btn--sm', text: 'Save' });

  const payload = () => ({
    passed: box.checked,
    amount_received: amount.value === '' ? null : Number(amount.value),
    notes: notes.value,
  });

  async function write(revert) {
    box.disabled = true;
    save.disabled = true;
    try {
      await api.patch(`/api/money-gates/${g.code}/result`, payload());
      toast(`Money gate ${g.code} saved.`, 'ok');
      return true;
    } catch (err) {
      if (revert) revert();
      toastError(err.message);
      return false;
    } finally {
      box.disabled = false;
      save.disabled = false;
    }
  }

  box.addEventListener('change', async () => {
    const want = box.checked;
    const ok = await write(() => {
      box.checked = !want;
    });
    if (ok) g.passed = want;
  });
  save.addEventListener('click', () => write(null));

  return el('div', { class: 'card stack-sm' }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [
        el('strong', { text: g.code }),
        el('span', { class: 'badge badge--outline', text: shortDate(g.gate_date) }),
        g.passed
          ? el('span', { class: 'badge badge--green', text: 'Met' })
          : g.is_past
            ? el('span', { class: 'badge badge--red', text: 'Missed' })
            : el('span', { class: 'badge badge--outline', text: 'Not yet' }),
      ]),
      g.amount_received !== null ? el('span', { class: 'text-sm muted', text: rupees(g.amount_received) }) : null,
    ]),
    el('p', { class: 'measure', text: g.condition_text }),
    el('label', { class: 'tick' }, [
      box,
      el('span', { class: 'tick__body' }, [
        el('span', { class: 'tick__text', text: 'Met' }),
        el('span', { class: 'tick__meta', text: 'Money received, not money promised.' }),
      ]),
    ]),
    el('div', { class: 'grid grid--2' }, [field('Received so far', amount), field('Notes', notes)]),
    el('div', { class: 'row' }, [save]),
    g.show_if_it_fails
      ? el('div', { class: 'callout callout--red' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'This gate was missed. Here is what final.md says happens now.' }),
            el('p', { class: 'measure', text: g.if_it_fails }),
          ]),
        ])
      : el('details', { class: 'acc' }, [
          el('summary', { class: 'acc__summary', text: 'If it fails' }),
          el('div', { class: 'acc__body' }, [el('p', { class: 'measure', text: g.if_it_fails })]),
        ]),
  ]);
}

function drawGates() {
  const gates = summaryData.money_gates ?? [];
  mount('#m-gates', [
    section(
      'The four money gates',
      gates.length
        ? gates.map(moneyGateCard)
        : [emptyState('No money gates', 'The four money gates come from Part 17.12 of final.md. Run npm run setup.')],
      { lede: 'Part 17.12. Counted from money received, never from money promised.' }
    ),
  ]);
}

/* ---------------------------------------------------------------- m-charts */

function drawCharts() {
  const weekPlan = summaryData.week_plan ?? [];
  const currentWeek = summaryData.week?.n ?? (summaryData.today > LAST_DAY ? 21 : 0);

  const points = weekPlan.map((t) => ({
    label: `W${t.week_n}`,
    plan: Number(t.target_low ?? 0),
    actual: t.week_n <= currentWeek ? Number(t.actual ?? 0) : null,
  }));

  const months = summaryData.received_by_month ?? [];
  const byWeek = summaryData.touches.by_week ?? [];

  mount('#m-charts', [
    section(
      'Plan against actual',
      [
        points.length
          ? lineChart({
              points,
              yLabel: 'rupees, cumulative',
              summary: `The floor from Part 17.14 against what has actually arrived, cumulative from 28 August 2026. ${
                currentWeek ? `The actual line stops at week ${currentWeek}, because later weeks have not happened.` : 'No week has happened yet, so there is no actual line.'
              }`,
            })
          : emptyState('No weekly targets', 'The money plan comes from Part 17.14 of final.md. Run npm run setup.'),
      ],
      { lede: 'The plan line is the weekly floor. The actual line is dated cash events only.' }
    ),
    section(
      'Received by month',
      [
        months.length
          ? barChart(
              months.map((m) => ({ label: m.label.slice(0, 3), value: m.amount })),
              { summary: `${rupees(summaryData.strip.received_total)} in total across ${months.length} months with money in them.` }
            )
          : emptyState('No money received yet', 'A bar appears here the first time an advance, a balance or a care plan invoice has a date on it.'),
      ]
    ),
    section(
      'Touches by week',
      [
        byWeek.length
          ? barChart(
              byWeek.map((w) => ({ label: `W${w.week_n}`, value: w.touches })),
              { summary: `${int(summaryData.touches.touches)} touches, ${int(summaryData.touches.replies)} replies, a reply rate of ${summaryData.touches.reply_rate}%.` }
            )
          : emptyState('No touches logged yet', 'Every touch you log from the list above appears here, grouped into the week it happened in.'),
      ]
    ),
  ]);
}

/* --------------------------------------------------------------- m-scripts */

function scriptCard(script, versions) {
  const mine = versions.filter((v) => v.script_code === script.code).sort((a, b) => b.version - a.version);
  const latest = mine[0] ?? null;
  const body = latest ? latest.body : script.body;

  const copy = el('button', { type: 'button', class: 'btn btn--sm', text: 'Copy' });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast(`${script.code} copied.`, 'ok');
    } catch {
      toastError('This browser would not let the page write to the clipboard. Select the text and copy it by hand.');
    }
  });

  return el('details', { class: 'scriptcard' }, [
    el('summary', { class: 'scriptcard__head' }, [
      el('span', { class: 'offercard__code', text: script.code }),
      el('strong', { class: 'grow', text: latest ? latest.title : script.title }),
      el('span', { class: 'badge badge--outline', text: script.channel }),
      latest
        ? el('span', { class: 'badge badge--blue', text: `Your version ${latest.version}` })
        : el('span', { class: 'badge badge--outline', text: 'The original' }),
    ]),
    el('div', { class: 'scriptcard__body stack-sm' }, [
      el('pre', { class: 'scriptbody', text: body }),
      el('div', { class: 'row' }, [copy]),
      latest
        ? el('details', { class: 'acc' }, [
            el('summary', { class: 'acc__summary', text: 'The original from Part 17.7, kept unchanged' }),
            el('div', { class: 'acc__body' }, [el('pre', { class: 'scriptbody', text: script.body })]),
          ])
        : null,
    ]),
  ]);
}

function drawScripts() {
  const scripts = scriptsData.scripts ?? [];
  const versions = scriptsData.versions ?? [];
  const subs = Object.entries(scriptsData.substitutions ?? {});

  mount('#m-scripts', [
    section(
      'The eight scripts',
      [
        scripts.length
          ? el('div', {}, scripts.map((s) => scriptCard(s, versions)))
          : emptyState('No scripts', 'The eight scripts come from Part 17.7 of final.md. Run npm run setup.'),
        subs.length
          ? el('div', { class: 'card' }, [
              el('p', { class: 'card__label', text: 'What to replace before you send it' }),
              el(
                'ul',
                { class: 'measure' },
                subs.map(([token, meaning]) => el('li', { text: `${token} is ${meaning}` }))
              ),
            ])
          : null,
        scriptsData.note ? el('p', { class: 'text-sm muted measure', text: scriptsData.note }) : null,
      ],
      { lede: 'Read them out loud once before the first message of the hour.' }
    ),
  ]);
}

/* ----------------------------------------------------------------- m-rules */

function simpleList(title, rows, key, body) {
  return section(
    title,
    [
      rows.length
        ? el(
            'ol',
            { class: 'measure' },
            rows.map((r) => el('li', { text: String(r[key]) }))
          )
        : emptyState(`No ${title.toLowerCase()}`, body),
    ]
  );
}

function drawRules() {
  const rules = summaryData.rules ?? [];
  const lanes = summaryData.lanes ?? [];
  const shape = summaryData.hour_shape ?? [];
  const sources = summaryData.lead_sources ?? [];

  const byGroup = new Map();
  for (const r of rules) {
    if (!byGroup.has(r.group_key)) byGroup.set(r.group_key, []);
    byGroup.get(r.group_key).push(r);
  }

  const ruleBlocks = [...byGroup.entries()].map(([group, rows]) =>
    el('details', { class: 'acc', open: byGroup.size <= 3 }, [
      el('summary', { class: 'acc__summary', text: `${group.replace(/_/g, ' ')}, ${rows.length} rules` }),
      el('div', { class: 'acc__body' }, [
        el('ol', { class: 'measure' }, rows.map((r) => el('li', { text: r.rule }))),
      ]),
    ])
  );

  mount('#m-rules', [
    el('div', { class: 'callout callout--blue' }, [
      el('div', { class: 'callout__body' }, [
        el('p', { class: 'callout__title', text: 'The money hour is 17:00 to 18:00 and it never borrows from study' }),
        el('p', {
          class: 'measure',
          text: 'Six days a week, on top of the eight hours. If the hour is lost, it is lost: it is not taken back out of the DSA block, the LEARN block or the BUILD block the next morning. That rule is the reason the money and the degree can both survive to January.',
        }),
      ]),
    ]),
    section(
      'The rules',
      ruleBlocks.length
        ? ruleBlocks
        : [emptyState('No money rules', 'They come from Part 17 of final.md. Run npm run setup.')]
    ),
    section(
      'The shape of the hour',
      [
        shape.length
          ? table({
              caption: 'Part 17.5, what the first forty minutes and the last twenty are for',
              columns: [
                { key: 'day_name', label: 'Day' },
                { key: 'first_forty', label: 'First forty minutes' },
                { key: 'last_twenty', label: 'Last twenty minutes' },
              ],
              rows: shape,
            })
          : emptyState('No shape for the hour', 'Part 17.5 of final.md defines it. Run npm run setup.'),
      ]
    ),
    section(
      'The lanes',
      [
        lanes.length
          ? table({
              caption: 'Part 17.2, the ways money can arrive and what each one is worth',
              columns: [
                { key: 'lane', label: 'Lane' },
                { key: 'what_it_is', label: 'What it is' },
                { key: 'time_to_first_rupee', label: 'Time to the first rupee' },
                { key: 'ceiling', label: 'Ceiling' },
                { key: 'use_it_for', label: 'Use it for' },
              ],
              rows: lanes,
            })
          : emptyState('No lanes', 'Part 17.2 of final.md defines them. Run npm run setup.'),
      ]
    ),
    simpleList('The first hour, step by step', summaryData.first_hour ?? [], 'step', 'Part 17 of final.md lists them. Run npm run setup.'),
    simpleList('What to refuse', summaryData.refuse ?? [], 'item', 'Part 17 of final.md lists them. Run npm run setup.'),
    simpleList('What to buy back with the money', summaryData.buyback ?? [], 'item', 'Part 17 of final.md lists them. Run npm run setup.'),
    section(
      'Where the leads come from',
      [
        sources.length
          ? el('ul', { class: 'measure' }, sources.map((s) => el('li', { text: s.source })))
          : emptyState('No lead sources', 'Part 17.6 of final.md lists them. Run npm run setup.'),
      ],
      { lede: 'Sixty leads a week, built inside the money hour and never inside a study block.' }
    ),
  ]);
}

/* ------------------------------------------------------------------ reload */

const leadsPath = () => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const q = params.toString();
  return q ? `/api/leads?${q}` : '/api/leads';
};

async function reloadLeads() {
  leadsData = await api.get(leadsPath());
  drawToday();
  drawKanban();
}

async function reloadSummary() {
  summaryData = await api.get('/api/money/summary');
  drawStrip();
  drawPlan();
  drawGates();
  drawCharts();
  drawOffers();
}

async function reloadDeals() {
  dealsData = await api.get('/api/deals');
  careData = await api.get('/api/care-plans');
  drawDeals();
}

/* -------------------------------------------------------------------- main */

async function main() {
  try {
    [summaryData, leadsData, dealsData, careData, scriptsData] = await Promise.all([
      api.get('/api/money/summary'),
      api.get(leadsPath()),
      api.get('/api/deals'),
      api.get('/api/care-plans'),
      api.get('/api/money/scripts'),
    ]);

    drawStrip();
    drawToday();
    drawBoard();
    drawDeals();
    drawOffers();
    drawPlan();
    drawGates();
    drawCharts();
    drawScripts();
    drawRules();
  } catch (err) {
    mount('#m-strip', errorCard(err.message));
    for (const id of ['#m-today', '#m-board', '#m-deals', '#m-offers', '#m-plan', '#m-gates', '#m-charts', '#m-scripts', '#m-rules']) {
      mount(id, []);
    }
  }
}

await main();
