/**
 * pushes.mjs | Part 18.4, the push tracker.
 *
 * The one signal a recruiter can verify without talking to you, so it is the one
 * that is worth being strict about:
 *   - the target is six push days a week
 *   - a red banner at 48 hours with no push on a study week
 *   - the streak is cancelled at 72 hours, stated with the timestamp
 *   - client repositories never count, and are kept in their own collapsed list
 *   - the kind of a repository is set on this screen, because the kind is what
 *     decides whether it counts and a misfiled client repo quietly inflates the target
 *   - empty, backdated and padded commits are not tracked and not welcome. A push
 *     of more than twenty commits with no file changes is flagged, not counted.
 */

import { api } from '../api.mjs';
import { toast, toastError } from '../toast.mjs';
import { el, emptyState, int, shortDate } from '../ui.mjs';
import { contributionGrid, errorCard, mount, section, statGrid, table } from '../render.mjs';

function hoursText(h) {
  if (h === null || h === undefined) return 'never';
  const n = Number(h);
  if (n < 1) return `${Math.round(n * 60)} minutes ago`;
  if (n < 48) return `${n.toFixed(1)} hours ago`;
  return `${Math.floor(n / 24)} days ago`;
}

/** Commit count to a heat level. Four levels, so the grid reads at a glance. */
function levelFor(info) {
  if (!info || !info.commits) return '';
  if (info.suspicious) return 'heatcell--flag';
  if (info.commits >= 10) return 'heatcell--l4';
  if (info.commits >= 5) return 'heatcell--l3';
  if (info.commits >= 2) return 'heatcell--l2';
  return 'heatcell--l1';
}

/* ------------------------------------------------------------------ banners */

function banners(d) {
  const out = [];

  if (d.streak_cancelled) {
    out.push(
      el('div', { class: 'callout callout--red' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'The streak is cancelled' }),
          el('p', {
            text: `72 hours have gone by with no push. The last push was ${
              d.last_push ? `to ${d.last_push.repo} at ${d.last_push.pushed_at}` : 'never recorded'
            }. Every other box being ticked does not change this.`,
          }),
        ]),
      ])
    );
  } else if (d.red_banner) {
    out.push(
      el('div', { class: 'callout callout--red' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: '48 hours with no push' }),
          el('p', {
            text: d.last_push
              ? `The last push was to ${d.last_push.repo}, ${hoursText(d.hours_since_last_push)}. At 72 hours the streak is cancelled.`
              : 'There is no push on record at all. At 72 hours the streak is cancelled.',
          }),
        ]),
      ])
    );
  }

  if (!d.github_user) {
    out.push(
      el('div', { class: 'callout callout--orange' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'No GitHub username is set' }),
          el('p', { text: 'Add it on Profile and the sync can run. Manual entry below works either way.' }),
        ]),
      ])
    );
  }

  if (d.flagged) {
    out.push(
      el('div', { class: 'callout callout--orange' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: `${d.flagged} push${d.flagged === 1 ? '' : 'es'} flagged, not counted` }),
          el('p', { text: d.honesty_line }),
        ]),
      ])
    );
  }

  if (d.week1?.applies) {
    const w1 = d.week1;
    out.push(
      el('div', { class: `callout ${w1.commits >= w1.target ? 'callout--green' : 'callout--blue'}` }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: `Week 1: ${int(w1.commits)} of ${w1.target} commits` }),
          el('p', { text: `On ${w1.repo}, over ${w1.window}. Week 1 is counted in commits, not in push days.` }),
        ]),
      ])
    );
  }

  return out.length ? out : [el('p', { class: 'text-sm muted', text: 'No push warnings. Keep it that way.' })];
}

/* ------------------------------------------------------------------- repos */

/**
 * The four kinds the API accepts, taken from the zod enum in
 * src/routes/api/github.mjs. counts_to_target is deliberately absent: the server
 * derives it from the kind, so it is never sent and only ever displayed.
 */
const REPO_KINDS = [
  { value: 'project', label: 'Project' },
  { value: 'tracker', label: 'Tracker' },
  { value: 'client', label: 'Client' },
  { value: 'other', label: 'Other' },
];

/**
 * Paints the consequence of the kind. Whether a repository counts is the
 * server's answer rather than this screen's guess, so this is only ever called
 * with a value that came out of the API.
 */
function paintCountsBadge(node, countsToTarget, commits) {
  node.className = `badge ${countsToTarget ? 'badge--green' : 'badge--outline'}`;
  node.textContent = `${int(commits)} commits, ${countsToTarget ? 'counts' : 'does not count'}`;
}

function kindSelect(current, label) {
  return el(
    'select',
    { class: 'select select--sm', 'aria-label': label },
    REPO_KINDS.map((k) => el('option', { value: k.value, text: k.label, selected: k.value === current }))
  );
}

/**
 * One repository, with the kind editable in place.
 *
 * The select is the whole write: PATCH /api/repos/:id takes a kind and nothing
 * else. The badge beside it is not moved until the response arrives, because
 * counts_to_target is recomputed on the server and a badge that guessed would be
 * claiming an outcome this screen does not decide.
 */
function repoRow(r, onReclassified) {
  const counts = el('span', { class: 'badge' });
  paintCountsBadge(counts, r.counts_to_target, r.commits);

  const kind = kindSelect(r.kind, `Kind of repository ${r.full_name}`);

  kind.addEventListener('change', async () => {
    const before = r.kind;
    const beforeCounts = r.counts_to_target;
    const want = kind.value;
    kind.disabled = true;
    try {
      const fresh = await api.patch(`/api/repos/${r.id}`, { kind: want });
      r.kind = fresh.kind;
      r.counts_to_target = Number(fresh.counts_to_target) === 1;
      paintCountsBadge(counts, r.counts_to_target, r.commits);
      toast(
        `${fresh.full_name} is now ${fresh.kind}, so it ${
          r.counts_to_target ? 'counts' : 'does not count'
        } towards the push target. Every day in the window was recomputed.`
      );
      // The handler recomputes the whole 150 day window, so the grid and the week
      // counter above are stale the moment this lands. They are redrawn from the
      // server rather than patched by hand.
      await onReclassified();
    } catch (err) {
      // Explicit revert. The select is the only thing that moved, so putting it
      // back is enough to stop the row looking reclassified when it is not.
      kind.value = before;
      r.kind = before;
      r.counts_to_target = beforeCounts;
      paintCountsBadge(counts, beforeCounts, r.commits);
      toastError(err.message);
    } finally {
      kind.disabled = false;
    }
  });

  return el('div', { class: `repolist__row ${r.kind === 'client' ? 'repolist__row--client' : ''}` }, [
    el('div', { class: 'stack-sm' }, [
      el('span', { class: 'mono', text: r.full_name }),
      el('span', { class: 'text-xs muted', text: r.last_push ? `last push ${r.last_push}` : 'no push recorded' }),
    ]),
    kind,
    el('span', { class: 'num text-sm', text: `${int(r.pushes)} pushes` }),
    counts,
  ]);
}

/**
 * The registry from GET /api/repos joined to the push counts from GET /api/pushes.
 *
 * Both read github_repos, but only /api/repos runs ensureRepos, which registers
 * the four project repositories and the tracker repository named in Part 18.4.
 * Reading the summary alone leaves a new account with an empty list until the
 * first sync, which is why the registry is the base and the counts are joined on.
 */
function mergeRepos(registry, summaryRepos) {
  const counted = new Map((summaryRepos ?? []).map((r) => [Number(r.id), r]));
  return (registry ?? [])
    .map((r) => {
      const c = counted.get(Number(r.id));
      return {
        ...r,
        counts_to_target: Number(r.counts_to_target) === 1,
        commits: Number(c?.commits ?? 0),
        pushes: Number(c?.pushes ?? 0),
        last_push: c?.last_push ?? null,
      };
    })
    .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

/**
 * Adding a repository, and the rule that makes the kind worth setting.
 *
 * Part 18.4 lists the repositories that count as "itc-reclaim, itc-reclaim-api,
 * itc-reclaim-ops, tender-fit, and the tracker repository", and client work
 * repositories as "Tracked separately, they never count towards the study
 * target". The kind carries that distinction, which is why it is the one field
 * on the form and the one field on every row.
 */
function repoAdmin(weeklyTarget, onDone) {
  const fullName = el('input', {
    class: 'input',
    type: 'text',
    maxLength: 200,
    placeholder: 'owner/name, or just the name',
    'aria-label': 'Repository full name',
  });
  const kind = kindSelect('project', 'Kind of the new repository');
  const submit = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Add the repository' });

  const form = el('form', { class: 'stack-sm' }, [
    el('div', { class: 'grid grid--2' }, [
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: 'Repository' }),
        fullName,
        // repoPath in src/lib/github.mjs prefixes a bare name with the GitHub
        // username from the profile, and uses anything containing a slash as written.
        el('span', {
          class: 'field__hint',
          text: 'A bare name is read as your own account. A name with a slash in it is used exactly as written.',
        }),
      ]),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', text: 'Kind' }),
        kind,
        el('span', { class: 'field__hint', text: 'Project and tracker count. Client and other do not.' }),
      ]),
    ]),
    el('div', { class: 'between' }, [
      submit,
      el('span', {
        class: 'text-xs muted',
        // POST /repos upserts on (user_id, full_name) and updates the kind, but
        // unlike PATCH it does not recompute the window, so the row control is
        // the honest way to reclassify something that already has pushes.
        text: 'A name already on the list has its kind changed rather than being added twice. To reclassify a repository that already has pushes, use the select on its row instead.',
      }),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = fullName.value.trim();
    if (!name) {
      toastError('A repository needs a name before it can be added.');
      fullName.focus();
      return;
    }
    submit.disabled = true;
    try {
      const row = await api.post('/api/repos', { full_name: name, kind: kind.value });
      toast(
        `${row.full_name} added as ${row.kind}, which ${
          Number(row.counts_to_target) === 1 ? 'counts' : 'does not count'
        } towards the push target.`
      );
      fullName.value = '';
      await onDone();
    } catch (err) {
      toastError(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  return section(
    'Add a repository',
    [
      form,
      el('div', { class: 'callout callout--blue' }, [
        el('div', { class: 'callout__body' }, [
          el('p', { class: 'callout__title', text: 'What the kind decides' }),
          el('p', {
            class: 'measure',
            text: `Project and tracker repositories count towards the ${weeklyTarget} push days a week. Client and other never do. Part 18.4 puts client work repositories under "Tracked separately, they never count towards the study target", and that is the whole reason this field exists. You set the kind and nothing else: whether a repository counts is worked out from the kind on the server and shown back to you as a consequence.`,
          }),
          el('p', {
            class: 'measure',
            // PATCH /repos/:id calls recomputeRange over config.roadmap.firstDay
            // to lastDay, so this is not a change confined to one row.
            text: 'Changing a kind recomputes every day in the 150 day window on the server. Day colours, the run and the streak can all move as a result, so the grid and the week counter above are redrawn as soon as the change lands.',
          }),
        ]),
      ]),
    ],
    { lede: 'The kind is the only field. Everything else about a repository is either synced or derived.' }
  );
}

/* ----------------------------------------------------------- manual entry */

function manualForm(repos, onDone) {
  const counting = repos.filter((r) => r.counts_to_target);
  const options = (counting.length ? counting : repos).map((r) =>
    el('option', { value: String(r.id), text: r.full_name })
  );

  const repo = el('select', { class: 'select', 'aria-label': 'Repository' }, options);
  const date = el('input', { class: 'input', type: 'date', value: new Date().toISOString().slice(0, 10) });
  const count = el('input', { class: 'input input--num', type: 'number', min: '1', max: '200', value: '1' });
  const message = el('input', { class: 'input', type: 'text', maxLength: 255, placeholder: 'One line about what it was.' });
  const submit = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Record the push' });

  const form = el('form', { class: 'stack-sm' }, [
    el('div', { class: 'grid grid--4' }, [
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Repository' }), repo]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Date' }), date]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Commits' }), count]),
      el('label', { class: 'field' }, [el('span', { class: 'field__label', text: 'Message' }), message]),
    ]),
    el('div', { class: 'between' }, [
      submit,
      el('span', { class: 'text-xs muted', text: 'Manual entry always exists, so a sync that cannot run is never a dead end.' }),
    ]),
  ]);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!repo.value) {
      toastError('There is no repository to record against yet. Run a sync first, or add one.');
      return;
    }
    submit.disabled = true;
    try {
      await api.post('/api/pushes', {
        repo_id: Number(repo.value),
        push_date: date.value,
        commit_count: Number(count.value) || 1,
        message_head: message.value,
      });
      toast('Push recorded.');
      message.value = '';
      onDone();
    } catch (err) {
      toastError(err.message);
    } finally {
      submit.disabled = false;
    }
  });

  return form;
}

/* --------------------------------------------------------------------- main */

async function render() {
  // Two reads, because they answer two different questions: /pushes has the
  // window and the counts, /repos is the registry and is the only one that
  // registers the repositories Part 18.4 names before a sync has ever run.
  const [d, registry] = await Promise.all([api.get('/api/pushes'), api.get('/api/repos')]);

  const byDate = new Map((d.grid ?? []).map((g) => [g.date, g]));
  const repos = mergeRepos(registry.repos, d.repos);
  const counting = repos.filter((r) => r.counts_to_target);
  const clients = repos.filter((r) => !r.counts_to_target);

  /* ---- banners ---- */
  mount('#gh-banner', banners(d));

  /* ---- summary ---- */
  const sync = el('button', { type: 'button', class: 'btn btn--primary' }, ['Sync now']);
  sync.addEventListener('click', async () => {
    sync.disabled = true;
    sync.textContent = 'Syncing.';
    try {
      const report = await api.post('/api/pushes/sync', {});
      const bits = [
        `${report.repos_checked} repositories checked`,
        `${report.pushes_written} pushes stored`,
        report.not_modified ? `${report.not_modified} unchanged and free` : null,
        report.flagged ? `${report.flagged} flagged` : null,
      ].filter(Boolean);
      toast(bits.join(', ') + '.');
      if (report.rate_limited) toastError('GitHub rate limited the sync. It backed off rather than hammering.');
      for (const e of report.errors ?? []) toastError(e);
      await render();
    } catch (err) {
      toastError(err.message);
    } finally {
      sync.disabled = false;
      sync.textContent = 'Sync now';
    }
  });

  mount('#gh-summary', [
    statGrid([
      {
        value: `${d.week.push_days} of ${d.week.target}`,
        label: 'push days this week',
        tone: d.week.push_days >= d.week.target ? 'green' : d.week.push_days >= d.week.target - 2 ? 'orange' : 'red',
        hero: true,
        sub: `${d.week.monday} to ${d.week.sunday}, ${int(d.week.commits)} commits`,
      },
      { value: d.current_run, label: 'day run, current', tone: d.current_run ? 'green' : 'red', sub: `longest ${d.longest_run}` },
      {
        value: hoursText(d.hours_since_last_push),
        label: 'since the last push that counts',
        tone: d.streak_cancelled ? 'red' : d.red_banner ? 'orange' : 'green',
        sub: d.last_push ? d.last_push.repo : 'nothing on record',
      },
      { value: d.mode, label: 'sync mode', sub: d.mode_cost },
    ]),
    el('div', { class: 'between' }, [
      el('div', { class: 'row' }, [
        sync,
        el('span', { class: 'text-sm muted', text: d.github_user ? `as ${d.github_user}` : 'no username set' }),
      ]),
      el('span', { class: 'text-xs muted measure', text: d.honesty_line }),
    ]),
  ]);

  /* ---- the 150 day grid ---- */
  const totalCommits = (d.grid ?? []).reduce((a, g) => a + g.commits, 0);
  const pushDays = (d.grid ?? []).length;
  mount('#gh-grid', [
    section(
      'The 150 days',
      [
        contributionGrid({
          from: d.from,
          to: d.to,
          byDate,
          today: d.today,
          colourFor: (info) => levelFor(info),
        }),
        el('div', { class: 'legend' }, [
          el('span', { class: 'legend__key', text: 'Quiet' }),
          el('span', { class: 'legend__key' }, [el('span', { class: 'legend__swatch' }), '1 commit']),
          el('span', { class: 'legend__key' }, [el('span', { class: 'legend__swatch' }), '10 or more']),
          el('span', { class: 'legend__key' }, [el('span', { class: 'legend__swatch' }), 'Flagged']),
        ]),
        el('p', {
          class: 'text-sm muted',
          text: `${pushDays} of 150 days carry a push on a repository that counts, ${int(totalCommits)} commits in total. Today is outlined.`,
        }),
      ],
      { lede: 'Only repositories that count towards the target are drawn here.' }
    ),
  ]);

  /* ---- repositories ---- */
  mount('#gh-repos', [
    section(
      `Repositories that count, ${counting.length}`,
      [
        counting.length
          ? el('div', { class: 'repolist' }, counting.map((r) => repoRow(r, render)))
          : emptyState('No repositories count yet', 'The four project repositories and the tracker repository are registered the moment this screen loads. If this list is empty, every repository on file has been set to client or other. Add one below, or change a kind on its row.'),
        clients.length
          ? el('details', { class: 'acc' }, [
              el('summary', { class: 'acc__summary', text: `Client and other repositories, ${clients.length}. These never count towards the target.` }),
              el('div', { class: 'acc__body' }, [
                el('div', { class: 'repolist' }, clients.map((r) => repoRow(r, render))),
              ]),
            ])
          : null,
      ],
      { lede: 'Client work is real work and it is not roadmap evidence. It is kept apart on purpose.' }
    ),
    repoAdmin(d.week.target, render),
  ]);

  /* ---- manual entry and the rules ---- */
  mount('#gh-manual', [
    section('Record a push by hand', [manualForm(repos, render)]),
    (d.rules ?? []).length
      ? section(
          'The rules from Part 18.4',
          [
            table({
              columns: [
                { key: 'rule', label: 'Rule' },
                { key: 'value', label: 'What it means' },
              ],
              rows: d.rules,
            }),
          ]
        )
      : null,
  ]);
}

async function main() {
  try {
    await render();
  } catch (err) {
    mount('#gh-banner', errorCard(err.message));
    for (const id of ['#gh-summary', '#gh-grid', '#gh-repos', '#gh-manual']) mount(id, []);
  }
}

await main();
