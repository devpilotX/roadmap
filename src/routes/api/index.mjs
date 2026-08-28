/**
 * The /api surface.
 *
 * requireAuth sits on every route except /api/auth/*. Unauthenticated HTML
 * requests are redirected by the page router; API requests get a 401 envelope.
 */

import { requireAuth } from '../../middleware/requireAuth.mjs';
import authRouter from './auth.mjs';
import meRouter from './me.mjs';
import dailyRouter from './daily.mjs';
import planRouter from './plan.mjs';
import dsaRouter from './dsa.mjs';
import githubRouter from './github.mjs';
import moneyRouter from './money.mjs';
import careerRouter from './career.mjs';
import metaRouter from './meta.mjs';

export function registerApiRoutes(app) {
  app.use('/api/auth', authRouter);

  // Everything below this line requires a session.
  app.use('/api/me', requireAuth, meRouter);
  app.use('/api', requireAuth, dailyRouter);
  app.use('/api', requireAuth, planRouter);
  app.use('/api', requireAuth, dsaRouter);
  app.use('/api', requireAuth, githubRouter);
  app.use('/api', requireAuth, moneyRouter);
  app.use('/api', requireAuth, careerRouter);
  app.use('/api', requireAuth, metaRouter);
}
