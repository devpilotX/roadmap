/**
 * Page routes.
 *
 * Every screen is a server rendered HTML shell plus a vanilla ES module that
 * fetches JSON. The shell carries the page title, the sidebar and the first
 * paint, so nothing renders as a blank panel while data loads.
 */

import { requireAnon, requirePage } from '../../middleware/requireAuth.mjs';
import { requireSignupOpen, signupState } from '../../middleware/signup.mjs';
import { loadSettings } from '../api/me.mjs';
import { getVerificationLog } from '../../db/reference.mjs';
import { blockForNow, longDate, todayInTz } from '../../lib/dates.mjs';
import { MIN_PASSWORD_LENGTH } from '../../lib/passwords.mjs';
import { config } from '../../config.mjs';
import { warningsFor } from '../../db/warnings.mjs';
import { renderMarkdown } from '../../lib/markdown.mjs';

/** Every authenticated screen: [path, view, title, styles, scripts, options] */
const SCREENS = [
  ['/', 'today', 'Today', ['today'], ['today'], { wide: false }],
  ['/calendar', 'calendar', 'Calendar', ['calendar'], ['calendar'], { wide: true }],
  ['/weeks', 'weeks', 'The 21 weeks', ['weeks'], ['weeks'], { wide: true }],
  ['/weeks/:n', 'week-detail', 'Week', ['weeks'], ['week-detail'], { wide: false }],
  ['/dsa', 'dsa', 'DSA tracker', ['dsa'], ['dsa'], { wide: true }],
  ['/library', 'library', 'Resource library', ['library'], ['library'], { wide: true }],
  ['/projects', 'projects', 'Projects', ['projects'], ['projects'], { wide: true }],
  ['/gates', 'gates', 'Gates', ['gates'], ['gates'], { wide: true }],
  ['/sundays', 'sundays', 'Sundays', ['sundays'], ['sundays'], { wide: false }],
  ['/pushes', 'pushes', 'GitHub pushes', ['pushes'], ['pushes'], { wide: true }],
  ['/money', 'money', 'Money hour', ['money'], ['money'], { wide: true }],
  ['/applications', 'applications', 'Applications', ['applications'], ['applications'], { wide: true }],
  ['/ladder', 'ladder', 'Unlock ladder', ['ladder'], ['ladder'], { wide: false }],
  ['/roles', 'roles', 'The seven roles', ['roles'], ['roles'], { wide: true }],
  ['/eligibility', 'eligibility', 'Eligibility', ['eligibility'], ['eligibility'], { wide: true }],
  ['/after', 'after', 'After January 2027', ['after'], ['after'], { wide: false }],
  ['/newzealand', 'newzealand', 'New Zealand', ['newzealand'], ['newzealand'], { wide: true }],
  ['/everything', 'everything', 'Everything A to Z', ['everything'], ['everything'], { wide: true }],
  ['/stats', 'stats', 'Stats', ['stats'], ['stats'], { wide: true }],
  ['/profile', 'profile', 'Profile', ['profile'], ['profile'], { wide: false }],
  ['/review', 'review', 'Saturday review', ['review'], ['review'], { wide: false }],
];

export function registerPageRoutes(app) {
  /* ------------------------------------------------------------- auth pages */

  app.get('/login', requireAnon, async (req, res) => {
    // The link to /signup is only offered when signup is actually open, so the
    // page never invites a visitor through a door that will refuse them.
    const signup = await signupState();
    res.render('screens/login', {
      title: 'Sign in',
      page: 'auth',
      styles: ['auth'],
      scripts: ['auth'],
      next: typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/',
      minPasswordLength: MIN_PASSWORD_LENGTH,
      signupOpen: signup.open,
    });
  });

  app.get('/signup', requireAnon, requireSignupOpen, (req, res) => {
    res.render('screens/signup', {
      title: 'Create your account',
      page: 'auth',
      styles: ['auth'],
      scripts: ['auth'],
      next: '/',
      minPasswordLength: MIN_PASSWORD_LENGTH,
    });
  });

  /* -------------------------------------------------- shared page context */

  async function pageContext(req) {
    const settings = await loadSettings(req.user.id);
    let warningCount = 0;
    try {
      const { warnings } = await warningsFor(req.user.id);
      warningCount = warnings.length;
    } catch {
      warningCount = 0;
    }
    return {
      theme: settings.theme,
      calendarView: settings.calendar_view,
      lastSyncedAt: settings.last_synced_at ?? '',
      warningCount,
    };
  }

  /* ------------------------------------------------------------- screens */

  for (const [path, view, title, styles, scripts, options] of SCREENS) {
    app.get(path, requirePage, async (req, res, next) => {
      try {
        const ctx = await pageContext(req);
        const clock = blockForNow();
        const extra = {};

        if (view === 'week-detail') {
          const n = Number(req.params.n);
          if (!Number.isInteger(n) || n < 1 || n > 21) {
            return res.status(404).render('screens/error', {
              title: 'Not found',
              status: 404,
              heading: `There is no week ${req.params.n}`,
              message: 'The roadmap has 21 weeks, numbered 1 to 21.',
            });
          }
          extra.weekNumber = n;
          extra.topbarTitle = `Week ${n}`;
        }

        if (view === 'newzealand') {
          const log = await getVerificationLog();
          extra.verificationLog = log.markdown;
        }

        return res.render(`screens/${view}`, {
          title,
          page: view,
          styles,
          scripts,
          wide: Boolean(options.wide),
          today: todayInTz(),
          todayLong: longDate(todayInTz()),
          clock: {
            time: clock.now.time,
            current: clock.current?.code ?? null,
            currentLabel: clock.current?.label ?? null,
            next: clock.next?.code ?? null,
            nextLabel: clock.next?.label ?? null,
          },
          roadmap: config.roadmap,
          ...ctx,
          ...extra,
        });
      } catch (err) {
        return next(err);
      }
    });
  }

  /* ------------------------------------------------ reference, with Appendix G */

  app.get('/reference', requirePage, async (req, res, next) => {
    try {
      const ctx = await pageContext(req);
      const log = await getVerificationLog();
      return res.render('screens/reference', {
        title: 'Reference',
        page: 'reference',
        styles: ['reference'],
        scripts: ['reference'],
        wide: true,
        // Appendix G is rendered read only, straight from data/final.md. It is
        // never parsed into rows and never seeded, because final.md says so.
        verificationLogHtml: renderMarkdown(log.markdown),
        verificationLogFound: log.found,
        ...ctx,
      });
    } catch (err) {
      return next(err);
    }
  });

  /* --------------------------------------------- the printable week sheet */

  app.get('/print/week', requirePage, async (req, res, next) => {
    try {
      const ctx = await pageContext(req);
      return res.render('screens/print-week', {
        title: 'Printable week sheet',
        page: 'print-week',
        styles: ['print-week'],
        scripts: ['print-week'],
        wide: true,
        weekNumber: Number(req.query.week) || null,
        ...ctx,
      });
    } catch (err) {
      return next(err);
    }
  });
}
