/**
 * projects.mjs | Part 5, the four projects.
 *
 * One problem taken three times, then a second problem.
 *
 * The README checklist is the part that gets skipped, so it is nine real
 * checkboxes here rather than a line of advice, and the percentage on each card
 * is the README, not a feeling about how the project is going.
 *
 * "Live" requires a URL. The API enforces it and this screen refuses to send the
 * status without one, because a project nobody can open is not evidence.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, int } from '../ui.mjs';
import { errorCard, meter, mount, section, statGrid } from '../render.mjs';

const STATUS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'live', label: 'Live' },
];

const TONE = {
  not_started: 'badge--outline',
  in_progress: 'badge--blue',
  shipped: 'badge--orange',
  live: 'badge--green',
};

const statusBadge = (status) =>
  el('span', {
    class: `badge ${TONE[status] ?? 'badge--outline'}`,
    text: STATUS.find((s) => s.value === status)?.label ?? status,
  });

/** The nine README sections from Part 5, as real ticks. */
function readmeList(project, sections, onCount) {
  const done = new Set(project.readme_done.map(Number));
  const list = el('ul', { class: 'readmelist' });

  for (const s of sections) {
    const box = el('input', { class: 'tick__box', type: 'checkbox', checked: done.has(Number(s.id)) });
    const label = el('label', { class: 'tick' }, [
      box,
      el('span', { class: 'tick__body' }, [el('span', { class: 'tick__text', text: s.title })]),
    ]);

    box.addEventListener('change', async () => {
      const want = box.checked;
      const next = new Set(done);
      if (want) next.add(Number(s.id));
      else next.delete(Number(s.id));
      box.disabled = true;
      try {
        await api.patch(`/api/projects/${project.id}/progress`, { readme_done: [...next] });
        if (want) done.add(Number(s.id));
        else done.delete(Number(s.id));
        onCount(done.size);
      } catch (err) {
        box.checked = !want;
        toastError(err.message);
      } finally {
        box.disabled = false;
      }
    });
    list.appendChild(el('li', {}, [label]));
  }
  return list;
}

function projectCard(p, sections) {
  const total = sections.length || 1;
  const countText = el('span', { class: 'text-sm muted', text: `README ${p.readme_done.length} of ${sections.length}` });
  const bar = meter(p.readme_percent, p.readme_percent === 100 ? 'green' : '');

  const onCount = (n) => {
    const percent = Math.round((n / total) * 100);
    countText.textContent = `README ${n} of ${sections.length}`;
    const fill = bar.querySelector('.meter__fill');
    fill.dataset.fill = String(percent);
    fill.style.setProperty('width', `${percent}%`);
    bar.classList.toggle('meter--green', percent === 100);
  };

  const badgeHost = el('span', {}, [statusBadge(p.status)]);
  const select = el(
    'select',
    { class: 'select select--sm', 'aria-label': `Status of ${p.name}` },
    STATUS.map((s) => el('option', { value: s.value, text: s.label, selected: s.value === p.status }))
  );

  const live = el('input', { class: 'input', type: 'url', value: p.live_url ?? '', placeholder: 'https://the-live-site' });
  const repo = el('input', { class: 'input', type: 'url', value: p.repo_url ?? '', placeholder: `https://github.com/you/${p.repo}` });
  const note = el('textarea', { class: 'textarea', rows: 2, placeholder: 'What is actually blocking it.' });
  note.value = p.notes ?? '';

  const save = el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Save' });

  async function write(patch) {
    save.disabled = true;
    select.disabled = true;
    try {
      await api.patch(`/api/projects/${p.id}/progress`, patch);
      toast('Saved.');
      return true;
    } catch (err) {
      toastError(err.message);
      return false;
    } finally {
      save.disabled = false;
      select.disabled = false;
    }
  }

  select.addEventListener('change', async () => {
    const want = select.value;
    if ((want === 'live' || want === 'shipped') && !live.value.trim()) {
      toastError('Shipped and live both need a URL. Put the address in and save it first.');
      select.value = p.status;
      return;
    }
    if (await write({ status: want })) {
      p.status = want;
      badgeHost.replaceChildren(statusBadge(want));
    } else {
      select.value = p.status;
    }
  });

  save.addEventListener('click', async () => {
    if (await write({ live_url: live.value.trim(), repo_url: repo.value.trim(), notes: note.value })) {
      p.live_url = live.value.trim() || null;
      p.repo_url = repo.value.trim() || null;
    }
  });

  const head = el('div', { class: 'projcard__head' }, [
    el('div', { class: 'row' }, [
      el('span', { class: 'projcard__code', text: p.code }),
      el('h2', { class: 'card__title', text: p.name }),
    ]),
    el('div', { class: 'row' }, [
      badgeHost,
      el('span', { class: 'badge badge--outline', text: `Weeks ${p.week_from} to ${p.week_to}` }),
      p.is_active ? el('span', { class: 'badge badge--blue', text: 'Current' }) : null,
    ]),
  ]);

  const openLinks = [
    p.live_url
      ? el('a', { class: 'btn btn--sm btn--ghost', href: p.live_url, text: 'Open the live site', target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' })
      : null,
    p.repo_url
      ? el('a', { class: 'btn btn--sm btn--ghost', href: p.repo_url, text: 'Open the repository', target: '_blank', rel: 'noopener noreferrer', 'data-ext': '1' })
      : null,
  ].filter(Boolean);

  return el('div', { class: `projcard ${p.is_active ? 'projcard--active' : ''}` }, [
    head,
    el('p', { class: 'measure', text: p.description }),
    el('div', { class: 'row' }, [
      el('span', { class: 'text-sm muted', text: `Repository ${p.repo}` }),
      el('span', { class: 'text-sm muted', text: `${int(p.pushes_this_week)} pushes and ${int(p.commits_this_week)} commits this week` }),
    ]),
    el('div', { class: 'stack-sm' }, [countText, bar]),
    el('details', { class: 'acc' }, [
      el('summary', { class: 'acc__summary', text: `The ${sections.length} README sections a stranger reads first` }),
      el('div', { class: 'acc__body' }, [readmeList(p, sections, onCount)]),
    ]),
    el('div', { class: 'grid grid--3' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Status' }), select]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Live URL' }), live]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Repository URL' }), repo]),
    ]),
    el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Notes' }), note]),
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [save, ...openLinks]),
      el('span', { class: 'text-xs muted', text: 'A screenshot is not a shipped project. A URL is.' }),
    ]),
  ]);
}

async function main() {
  try {
    const d = await api.get('/api/projects');
    const sections = d.readme_sections ?? [];
    const projects = d.projects ?? [];

    const live = projects.filter((p) => p.status === 'live').length;
    const shipped = projects.filter((p) => p.status === 'shipped' || p.status === 'live').length;
    const readmeDone = projects.filter((p) => p.readme_percent === 100).length;
    const active = projects.find((p) => p.is_active);

    mount('#p-summary', [
      statGrid([
        {
          value: `${live} of ${projects.length}`,
          label: 'live, at a URL a stranger can open',
          tone: live ? 'green' : 'red',
          hero: true,
        },
        { value: `${shipped} of ${projects.length}`, label: 'shipped or live' },
        { value: `${readmeDone} of ${projects.length}`, label: `READMEs finished, all ${sections.length} sections` },
        {
          value: active ? active.code : '-',
          label: active
            ? 'the project this week belongs to'
            : d.current_week
              ? 'no project owns this week'
              : 'outside the roadmap window',
          sub: active ? active.name : '',
        },
      ]),
      el('p', {
        class: 'text-sm muted measure',
        text: 'One problem taken three times, then a second problem. The README is what a stranger reads before they read a line of your code, so it is a checklist here and not a suggestion.',
      }),
    ]);

    mount(
      '#p-list',
      projects.length
        ? projects.map((p) => projectCard(p, sections))
        : emptyState('No projects yet', 'The four projects come from Part 5 of final.md. Run npm run setup.')
    );
  } catch (err) {
    mount('#p-summary', errorCard(err.message));
    mount('#p-list', []);
  }
}

await main();
