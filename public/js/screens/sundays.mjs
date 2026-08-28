/**
 * sundays.mjs | the 21 Sundays.
 *
 * Ten working, four gate audits, seven rest. The rest Sundays are the ones that
 * get sacrificed first and they are the reason the other 143 days work, so this
 * screen will not let you tick one. The API refuses it too; the refusal is stated
 * here rather than discovered.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, shortDate } from '../ui.mjs';
import { errorCard, mount, statGrid } from '../render.mjs';

const KIND = {
  working: { label: 'Working', cls: 'badge--blue', row: '' },
  gate: { label: 'Gate audit', cls: 'badge--orange', row: 'sundayrow--gate' },
  rest: { label: 'Rest', cls: 'badge--outline', row: 'sundayrow--rest' },
};

function sundayRow(s) {
  const kind = KIND[s.kind] ?? KIND.working;
  const isRest = s.kind === 'rest';

  const notes = el('textarea', { class: 'textarea', rows: 2, placeholder: isRest ? 'A note, if you want one. Nothing else on a rest Sunday.' : 'What you actually did.' });
  notes.value = s.notes ?? '';

  const hours = el('input', {
    class: 'input input--num input--sm',
    type: 'number',
    min: '0',
    max: '24',
    step: '0.5',
    value: s.hours_logged || '',
    placeholder: '0',
    disabled: isRest,
  });

  const box = el('input', { class: 'tick__box', type: 'checkbox', checked: s.completed, disabled: isRest });
  const tick = el('label', { class: 'tick' }, [
    box,
    el('span', { class: 'tick__body' }, [
      el('span', { class: 'tick__text', text: isRest ? 'Nothing to tick' : 'Done' }),
      el('span', {
        class: 'tick__meta',
        text: isRest
          ? 'Rest Sunday. No code. No screens before noon. This is load bearing.'
          : `${s.hours} hours is what this Sunday asks for.`,
      }),
    ]),
  ]);

  const save = el('button', { type: 'button', class: 'btn btn--sm', text: 'Save' });

  async function write(patch, revert) {
    box.disabled = isRest;
    save.disabled = true;
    try {
      await api.patch(`/api/sundays/${s.week_n}/log`, patch);
      toast(`Sunday of week ${s.week_n} saved.`);
      return true;
    } catch (err) {
      if (revert) revert();
      toastError(err.message);
      return false;
    } finally {
      box.disabled = isRest;
      save.disabled = false;
    }
  }

  box.addEventListener('change', async () => {
    const want = box.checked;
    const ok = await write({ completed: want, hours: Number(hours.value) || 0, notes: notes.value }, () => {
      box.checked = !want;
    });
    if (ok) s.completed = want;
  });

  save.addEventListener('click', () =>
    write(
      isRest
        ? { notes: notes.value }
        : { completed: box.checked, hours: Number(hours.value) || 0, notes: notes.value }
    )
  );

  const detail = el('details', { class: 'acc' }, [
    el('summary', { class: 'acc__summary', text: isRest ? 'The note field' : 'Log this Sunday' }),
    el('div', { class: 'acc__body stack-sm' }, [
      tick,
      isRest
        ? null
        : el('label', { class: 'field' }, [
            el('span', { class: 'field__label', text: `Hours, against ${s.hours}` }),
            hours,
          ]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Notes' }), notes]),
      el('div', { class: 'row' }, [save]),
    ]),
  ]);

  const state = s.completed
    ? el('span', { class: 'badge badge--green', text: 'Done' })
    : isRest
      ? el('span', { class: 'badge badge--outline', text: 'Rest' })
      : s.is_past
        ? el('span', { class: 'badge badge--red', text: 'Missed' })
        : el('span', { class: 'badge badge--outline', text: 'Not yet' });

  return el('div', { class: `sundayrow ${kind.row} ${s.is_today ? 'card--now' : ''}` }, [
    el('span', { class: 'sundayrow__week', text: `W${String(s.week_n).padStart(2, '0')}` }),
    el('span', { class: 'badge ' + kind.cls, text: kind.label }),
    el('div', { class: 'stack-sm grow' }, [
      el('div', { class: 'row' }, [
        el('span', { class: 'text-sm', text: shortDate(s.sunday_date) }),
        s.is_today ? el('span', { class: 'badge badge--blue', text: 'Today' }) : null,
        el('span', { class: 'text-xs muted', text: s.type_text }),
      ]),
      el('p', { class: 'measure text-sm', text: s.topic }),
      s.week_title ? el('p', { class: 'text-xs muted', text: `Week ${s.week_n}: ${s.week_title}` }) : null,
      detail,
    ]),
    el('div', { class: 'right stack-sm' }, [
      state,
      isRest ? null : el('span', { class: 'text-xs muted', text: `${s.hours_logged || 0} of ${s.hours} h` }),
    ]),
  ]);
}

async function main() {
  try {
    const d = await api.get('/api/sundays');
    const sundays = d.sundays ?? [];
    const t = d.totals ?? { working: 0, gate: 0, rest: 0 };

    const workable = sundays.filter((s) => s.kind !== 'rest');
    const done = workable.filter((s) => s.completed).length;
    const missed = workable.filter((s) => s.is_past && !s.completed).length;
    const hours = sundays.reduce((a, s) => a + Number(s.hours_logged || 0), 0);
    const next = sundays.find((s) => !s.is_past);

    mount('#s-summary', [
      statGrid([
        { value: `${done} of ${workable.length}`, label: 'working and gate Sundays done', tone: done === workable.length && workable.length ? 'green' : '', hero: true },
        { value: `${t.working} · ${t.gate} · ${t.rest}`, label: 'working, gate audits, rest' },
        { value: `${hours} h`, label: 'hours logged on Sundays' },
        {
          value: next ? `W${next.week_n}` : 'Done',
          label: next ? `${KIND[next.kind]?.label ?? next.kind} on ${shortDate(next.sunday_date)}` : 'every Sunday is behind you',
          tone: missed ? 'red' : '',
          sub: missed ? `${missed} missed` : '',
        },
      ]),
      el('div', { class: 'callout callout--blue' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'The seven rest Sundays are not spare capacity' }),
          el('p', {
            class: 'measure',
            text: 'No code. No screens before noon. This is load bearing. They cannot be ticked here, and the server refuses them too, because the week after a sacrificed rest Sunday is the week the reds start.',
          }),
        ]),
      ]),
    ]);

    mount(
      '#s-list',
      sundays.length
        ? [el('div', { class: 'card card--flush' }, sundays.map(sundayRow))]
        : emptyState('No Sundays', 'The 21 Sundays come from Part 3 of final.md. Run npm run setup.')
    );
  } catch (err) {
    mount('#s-summary', errorCard(err.message));
    mount('#s-list', []);
  }
}

await main();
