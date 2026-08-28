/**
 * server.mjs | application bootstrap
 *
 * Order matters and is deliberate:
 *   1. proxy trust, so req.ip is the real client address behind nginx
 *   2. security headers, including a CSP with no unsafe-inline
 *   3. body parsers with small limits
 *   4. cookies, then session, then CSRF issue
 *   5. user loading
 *   6. static files
 *   7. routes
 *   8. 404, then the single error handler
 */

import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import MySQLStoreFactory from 'express-mysql-session';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ROOT, config } from './config.mjs';
import { closePool, ping } from './db/pool.mjs';
import { cookies, csrfGuard, csrfIssue } from './middleware/csrf.mjs';
import { loadUser } from './middleware/requireAuth.mjs';
import { generalApiLimiter } from './middleware/rateLimit.mjs';
import { AppError, fail, translateDbError } from './lib/errors.mjs';
import { blockForNow, longDate, todayInTz } from './lib/dates.mjs';
import { registerPageRoutes } from './routes/pages/index.mjs';
import { registerApiRoutes } from './routes/api/index.mjs';
import { NAV } from './lib/nav.mjs';

const app = express();

/* -------------------------------------------------------------- 1. proxy */

// Hostinger and nginx both sit in front. Without this req.ip is the proxy and
// the rate limiter would treat every visitor as the same person.
app.set('trust proxy', config.trustProxy);
app.set('x-powered-by', false);
app.set('etag', 'strong');

/* ----------------------------------------------------- 2. security headers */

const CSP = {
  useDefaults: false,
  directives: {
    'default-src': ["'self'"],
    // Every script is an external .mjs file. There is no inline script anywhere,
    // which is why 'unsafe-inline' is absent and must stay absent.
    'script-src': ["'self'"],
    'script-src-attr': ["'none'"],
    // Every style is an external .css file. Dynamic values arrive as data
    // attributes and are applied by script through setProperty, never as a
    // style attribute in the markup.
    'style-src': ["'self'"],
    'style-src-attr': ["'none'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    'connect-src': ["'self'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
    'media-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'frame-src': ["'none'"],
    ...(config.isProd ? { 'upgrade-insecure-requests': [] } : {}),
  },
};

app.use(
  helmet({
    contentSecurityPolicy: CSP,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: config.isProd ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    xFrameOptions: { action: 'deny' },
    xContentTypeOptions: true,
    xDnsPrefetchControl: { allow: false },
    xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },
    originAgentCluster: true,
  })
);

app.use((_req, res, next) => {
  // Not covered by helmet. Nothing in this app needs a device sensor.
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
  );
  next();
});

/* ------------------------------------------------------- 3. body parsers */

app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

/* -------------------------------------------- 4. cookies, session, CSRF */

app.use(cookies);

const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  createDatabaseTable: false,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 30 * 24 * 60 * 60 * 1000,
  charset: 'utf8mb4_general_ci',
  schema: {
    tableName: 'sessions',
    columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
  },
});

app.use(
  session({
    name: 'roadmap.sid',
    secret: config.sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // rolling 30 days
    proxy: config.trustProxy > 0,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.isProd,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    },
  })
);

app.use(csrfIssue);

/* --------------------------------------------------------- 5. the user */

app.use(loadUser);

// Values every template can rely on.
app.use((req, res, next) => {
  const today = todayInTz();
  res.locals.user = req.user;
  res.locals.nav = NAV;
  res.locals.today = today;
  res.locals.todayLong = longDate(today);
  res.locals.currentPath = req.path;
  res.locals.isFakeClock = Boolean(config.fakeToday || config.fakeTime);
  res.locals.publicOrigin = config.publicOrigin;
  next();
});

/* ---------------------------------------------------------- 6. static */

const oneYear = 365 * 24 * 60 * 60 * 1000;
app.use(
  '/css',
  express.static(join(ROOT, 'public', 'css'), {
    maxAge: config.isProd ? oneYear : 0,
    immutable: config.isProd,
    fallthrough: false,
  })
);
app.use(
  '/js',
  express.static(join(ROOT, 'public', 'js'), {
    maxAge: config.isProd ? oneYear : 0,
    immutable: config.isProd,
    fallthrough: false,
  })
);
app.use('/img', express.static(join(ROOT, 'public', 'img'), { maxAge: config.isProd ? oneYear : 0 }));
app.use('/uploads', express.static(join(ROOT, 'public', 'uploads'), { maxAge: 0, index: false }));

// The service worker must be served from the root to control the whole scope.
app.get('/sw.js', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(join(ROOT, 'public', 'js', 'sw.js'));
});
app.get('/manifest.webmanifest', (_req, res) => {
  res.type('application/manifest+json');
  res.sendFile(join(ROOT, 'public', 'manifest.webmanifest'));
});
app.get('/robots.txt', (_req, res) => {
  // A personal tracker has no business in a search index.
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

/* ----------------------------------------------------------- 7. views */

app.set('view engine', 'ejs');
app.set('views', join(ROOT, 'views'));

/* ---------------------------------------------------------- 8. routes */

app.get('/healthz', async (_req, res) => {
  const dbUp = await ping();
  const b = blockForNow();
  res.status(dbUp ? 200 : 503).json({
    ok: dbUp,
    data: {
      db: dbUp ? 'up' : 'down',
      today: todayInTz(),
      block: b.current ? b.current.code : null,
      nextBlock: b.next ? b.next.code : null,
      env: config.env,
    },
  });
});

app.use('/api', generalApiLimiter, csrfGuard);
registerApiRoutes(app);
registerPageRoutes(app);

/* ------------------------------------------------------------ 9. 404 */

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return fail(res, 404, 'NOT_FOUND', 'No such endpoint.');
  }
  return res.status(404).render('screens/error', {
    title: 'Not found',
    status: 404,
    heading: 'That page does not exist',
    message: 'Every screen in this app is in the sidebar. Pick one and carry on.',
  });
});

/* -------------------------------------------------- 10. error handler */

app.use((err, req, res, _next) => {
  const translated = translateDbError(err);
  const e = translated ?? err;
  const status = e instanceof AppError ? e.status : 500;

  if (status >= 500) {
    // The stack goes to the log, never to the client.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    console.error(e.stack ?? e);
  }

  if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
    const code = e instanceof AppError ? e.code : 'SERVER_ERROR';
    const message =
      e instanceof AppError ? e.message : 'Something broke on the server. Nothing was saved.';
    return fail(res, status, code, message, e instanceof AppError ? e.details : null);
  }

  return res.status(status).render('screens/error', {
    title: status === 404 ? 'Not found' : 'Something broke',
    status,
    heading: status >= 500 ? 'Something broke on the server' : 'That did not work',
    message:
      e instanceof AppError
        ? e.message
        : 'Nothing was saved. The error is in the server log with a timestamp.',
  });
});

/* ------------------------------------------------------------- listen */

let server = null;

async function start() {
  if (!(await ping())) {
    console.error(
      `Cannot reach MySQL at ${config.db.host}:${config.db.port}/${config.db.database}.\n` +
        'Check .env, then run: npm run migrate && npm run verify'
    );
    process.exit(1);
  }

  // Warn loudly rather than starting a tracker whose numbers cannot be trusted.
  try {
    const { readSeedHealth } = await import('./db/reference.mjs');
    const health = await readSeedHealth();
    if (!health.ok) {
      console.warn('\nSEED WARNING');
      for (const line of health.problems) console.warn(`  ${line}`);
      console.warn('  Run: npm run verify\n');
    }
  } catch {
    // reference.mjs is optional at this stage of the build.
  }

  server = app.listen(config.port, config.host, () => {
    console.log(`The Roadmap Tracker is listening on http://${config.host}:${config.port}`);
    console.log(`  env      ${config.env}`);
    console.log(`  database ${config.db.user}@${config.db.host}:${config.db.port}/${config.db.database}`);
    console.log(`  today    ${todayInTz()} in ${config.timezone}`);
    if (config.fakeToday || config.fakeTime) {
      console.log(`  CLOCK IS FAKED: FAKE_TODAY=${config.fakeToday ?? '-'} FAKE_TIME=${config.fakeTime ?? '-'}`);
    }
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

async function shutdown(signal) {
  console.log(`\n${signal} received, shutting down.`);
  if (server) await new Promise((r) => server.close(r));
  try {
    await new Promise((r) => sessionStore.close(r));
  } catch {
    // Closing a store that never opened is not an error worth reporting.
  }
  await closePool();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

await start();

export { app };
