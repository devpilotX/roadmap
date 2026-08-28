/**
 * gates.mjs | the four gates and the four money gates.
 *
 * A gate is not a checkpoint you hope to reach. It is answered yes or no, and a
 * yes needs an evidence URL, because a screenshot is not evidence.
 *
 * A money gate that has passed unmet shows what final.md says happens next. That
 * text is not softened and it is not hidden.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, rupees, shortDate } from '../ui.mjs';
import { errorCard, mount, section, statGrid } from '../render.mjs';

function toneFor(g) {
  if (g.passed) return 'gatecard--passed';
  if (g.is_past) return 'gatecard--overdue';
  if (g.days_remaining <= 14) return 'gatecard--soon';
  return '';
}

function countdown(g) {
  if (g.passed) return { big: 'Passed', small: g.passed_at ? `on ${shortDate(String(g.passed_at).slice(0, 10))}` : '' };
  if (g.days_remaining === 0) return { big: 'Today', small: 'answer it today' };
  if (g.days_remaining < 0) return { big: `${Math.abs(g.days_remaining)}d`, small: 'overdue, and not passed' };
  return { big: `${g.days_remaining}d`, small: 'to go' };
}

/* ------------------------------------------------------------- the four gates */

function gateCard(g) {
  const c = countdown(g);

  const evidence = el('input', {
    class: 'input',
    type: 'url',
    value: g.evidence_url ?? '',
    placeholder: 'https://the-thing-that-proves-it',
  });
  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What actually happened.' });
  notes.value = g.notes ?? '';

  const box = el('input', { class: 'tick__box', type: 'checkbox', checked: g.passed });
  const tick = el('label', { class: 'tick' }, [
    box,
    el('span', { class: 'tick__body' }, [
      el('span', { class: 'tick__text', text: 'Passed' }),
      el('span', { class: 'tick__meta', text: 'A yes needs the evidence URL below. A screenshot is not evidence.' }),
    ]),
  ]);

  const save = el('button', { type: 'button', class: 'btn btn--sm', text: 'Save notes and evidence' });

  async function write(patch, revert) {
    box.disabled = true;
    save.disabled = true;
    try {
      await api.patch(`/api/gates/${g.no}/result`, patch);
      toast(`Gate ${g.no} saved.`);
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
    if (want && !evidence.value.trim()) {
      toastError('A gate is passed only with an evidence URL. Put the address in first.');
      box.checked = false;
      return;
    }
    const ok = await write(
      { passed: want, evidence_url: evidence.value.trim() || null, notes: notes.value },
      () => {
        box.checked = !want;
      }
    );
    if (ok) g.passed = want;
  });

  save.addEventListener('click', () =>
    write({ passed: g.passed, evidence_url: evidence.value.trim() || null, notes: notes.value })
  );

  return el('div', { class: `gatecard ${toneFor(g)}` }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'gatecard__no', text: `Gate ${g.no}` }),
        el('span', { class: 'badge badge--outline', text: shortDate(g.gate_date) }),
        el('span', { class: 'badge badge--outline', text: `Week ${g.week_n}` }),
      ]),
      el('div', { class: 'right' }, [
        el('div', { class: 'gatecard__days', text: c.big }),
        el('div', { class: 'text-xs muted', text: c.small }),
      ]),
    ]),
    g.week_title ? el('p', { class: 'text-sm muted', text: g.week_title }) : null,
    el('p', { class: 'measure', text: g.condition_text }),
    tick,
    el('div', { class: 'grid grid--2' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Evidence URL' }), evidence]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Notes' }), notes]),
    ]),
    el('div', { class: 'row' }, [
      save,
      g.evidence_url
        ? el('a', { class: 'btn btn--sm btn--ghost', href: g.evidence_url, text: 'Open the evidence', target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' })
        : null,
    ]),
    !g.passed && g.is_past
      ? el('div', { class: 'callout callout--red' }, [
          el('div', { class: 'callout__body' }, [
            el('p', { class: 'callout__title', text: 'This gate has passed and it is not marked passed' }),
            el('p', { text: 'Answer it honestly. A gate left blank is a gate not passed, and the next one is already closer.' }),
          ]),
        ])
      : null,
  ]);
}

/* ------------------------------------------------------- the four money gates */

function moneyGateCard(g) {
  const c = countdown(g);

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
  const tick = el('label', { class: 'tick' }, [
    box,
    el('span', { class: 'tick__body' }, [
      el('span', { class: 'tick__text', text: 'Met' }),
      el('span', { class: 'tick__meta', text: 'Money received, not money promised.' }),
    ]),
  ]);

  const save = el('button', { type: 'button', class: 'btn btn--sm', text: 'Save' });

  async function write(patch, revert) {
    box.disabled = true;
    save.disabled = true;
    try {
      await api.patch(`/api/money-gates/${g.code}/result`, patch);
      toast(`Money gate ${g.code} saved.`);
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

  const payload = () => ({
    passed: box.checked,
    amount_received: amount.value === '' ? null : Number(amount.value),
    notes: notes.value,
  });

  box.addEventListener('change', async () => {
    const want = box.checked;
    const ok = await write(payload(), () => {
      box.checked = !want;
    });
    if (ok) g.passed = want;
  });
  save.addEventListener('click', () => write(payload()));

  return el('div', { class: `gatecard ${toneFor(g)}` }, [
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'gatecard__no', text: g.code }),
        el('span', { class: 'badge badge--outline', text: shortDate(g.gate_date) }),
      ]),
      el('div', { class: 'right' }, [
        el('div', { class: 'gatecard__days', text: c.big }),
        el('div', { class: 'text-xs muted', text: c.small }),
      ]),
    ]),
    el('p', { class: 'measure', text: g.condition_text }),
    tick,
    el('div', { class: 'grid grid--2' }, [
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: 'Received so far' }),
        amount,
        el('span', { class: 'field__hint', text: g.amount_received ? rupees(g.amount_received) : 'Rupees actually in the account.' }),
      ]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Notes' }), notes]),
    ]),
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

/* --------------------------------------------------------------------- main */

async function main() {
  try {
    const d = await api.get('/api/gates');
    const gates = d.gates ?? [];
    const money = d.money_gates ?? [];

    const passed = gates.filter((g) => g.passed).length;
    const missed = gates.filter((g) => g.is_past && !g.passed).length;
    const next = gates.find((g) => !g.is_past && !g.passed) ?? null;
    const moneyPassed = money.filter((g) => g.passed).length;

    mount('#g-gates', [
      statGrid([
        { value: `${passed} of ${gates.length}`, label: 'gates passed, with evidence', tone: passed === gates.length && gates.length ? 'green' : '', hero: true },
        { value: `${moneyPassed} of ${money.length}`, label: 'money gates met' },
        {
          value: next ? `Gate ${next.no}` : missed ? 'Overdue' : 'All done',
          label: next ? `in ${next.days_remaining} days, on ${shortDate(next.gate_date)}` : missed ? 'a gate went past unanswered' : 'nothing outstanding',
          tone: next && next.days_remaining <= 14 ? 'orange' : missed ? 'red' : '',
        },
        { value: missed, label: 'gates that went past unpassed', tone: missed ? 'red' : '' },
      ]),
      el('p', {
        class: 'text-sm muted measure',
        text: 'A gate is not a checkpoint you hope to reach. It is a yes or a no on a fixed date, and a yes needs a URL that someone else can open.',
      }),
      ...(gates.length
        ? gates.map(gateCard)
        : [emptyState('No gates', 'The four gates come from final.md. Run npm run setup.')]),
    ]);

    mount('#g-money', [
      section(
        'The four money gates',
        [
          el('p', {
            class: 'text-sm muted measure',
            text: 'Part 17.12. These are counted from money received, never from money promised. A gate that was missed shows the consequence final.md states, unedited.',
          }),
          ...(money.length
            ? money.map(moneyGateCard)
            : [emptyState('No money gates', 'They come from Part 17.12 of final.md.')]),
        ],
        { id: 'g-money-section' }
      ),
    ]);
  } catch (err) {
    mount('#g-gates', errorCard(err.message));
    mount('#g-money', []);
  }
}

await main();
