/**
 * weeks.mjs | the 21 week grid, in six phase colour groups.
 */

import { api } from '../api.mjs';
import { el, int, qs, svgIcon } from '../ui.mjs';
import { errorCard, meter, mount, statGrid } from '../render.mjs';

const PHASE_VAR = { A: '--phase-a', B: '--phase-b', C: '--phase-c', D: '--phase-d', E: '--phase-e', F: '--phase-f' };

function weekCard(w) {
  const card = el('a', {
    class: `weekcard ${w.is_current ? 'weekcard--current' : ''}`,
    href: `/weeks/${w.n}`,
  }, [
    el('span', { class: 'weekcard__top' }, [
      el('span', { class: 'weekcard__n', text: `W${String(w.n).padStart(2, '0')}` }),
      w.gate_no ? el('span', { class: 'badge badge--orange', text: `Gate ${w.gate_no}` }) : null,
    ]),
    el('span', { class: 'weekcard__dates', text: w.dates_label }),
    el('span', { class: 'weekcard__title', text: w.title }),
    meter(w.progress.percent, w.progress.complete ? 'green' : ''),
    el('span', { class: 'weekcard__foot' }, [
      el('span', { text: `${w.progress.percent}% done` }),
      el('span', { text: `DSA ${int(w.dsa_cumulative)}` }),
    ]),
  ]);
  card.style.setProperty('--phase', `var(${PHASE_VAR[w.phase_code]})`);
  return card;
}

async function main() {
  try {
    const d = await api.get('/api/weeks');
    const complete = d.weeks.filter((w) => w.progress.complete).length;
    const current = d.weeks.find((w) => w.is_current);
    const totalTicks = d.weeks.reduce((a, w) => a + w.progress.learn_done + w.progress.build_done, 0);

    mount('#w-summary', [
      statGrid([
        { value: `${complete} of 21`, label: 'weeks finished in full', tone: complete ? 'green' : '' },
        { value: current ? `W${String(current.n).padStart(2, '0')}` : 'None', label: current ? current.title : 'outside the window', sub: current ? current.dates_label : '' },
        { value: `${totalTicks} of 252`, label: 'day ticks, six learn and six build a week' },
        { value: d.gates.length, label: 'gates', sub: d.gates.map((g) => `Gate ${g.no} on ${g.gate_date}`).join(', ') },
      ]),
    ]);

    const groups = d.phases.map((p) => {
      const weeks = d.weeks.filter((w) => w.phase_code === p.code);
      const head = el('div', { class: 'phasegroup__head' }, [
        el('span', { class: 'phasegroup__code', text: p.code }),
        el('div', {}, [
          el('h2', { class: 'card__title', text: `${p.name}, weeks ${p.week_from} to ${p.week_to}` }),
          el('p', { class: 'text-sm muted', text: p.blurb }),
        ]),
      ]);
      head.querySelector('.phasegroup__code').style.setProperty('background', `var(${PHASE_VAR[p.code]})`);
      return el('div', { class: 'phasegroup' }, [
        head,
        el('div', { class: 'grid grid--3' }, weeks.map(weekCard)),
      ]);
    });
    mount('#w-phases', groups);
  } catch (err) {
    mount('#w-summary', errorCard(err.message));
  }
}

await main();
