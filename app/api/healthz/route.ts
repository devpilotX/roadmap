/**
 * GET /api/healthz
 *
 * The runbook's first question: is the database up, and what does the server
 * think the time is. Returns 503 when MySQL cannot be reached, so a load
 * balancer takes the instance out rather than serving broken pages.
 */

import { NextResponse } from 'next/server';
import { ping } from '@/lib/db/pool';
import { blockForNow, todayInTz } from '@/lib/dates';
import { config, configProblems } from '@/lib/config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(): Promise<NextResponse> {
  const dbUp = await ping();
  const b = blockForNow();
  return NextResponse.json(
    {
      ok: dbUp,
      data: {
        db: dbUp ? 'up' : 'down',
        today: todayInTz(),
        block: b.current ? b.current.code : null,
        nextBlock: b.next ? b.next.code : null,
        env: config.env,
        // The names of missing or malformed environment variables are useful while
        // setting the thing up and are nobody else's business once it is running.
        // This endpoint needs no session, so in production it says how many there
        // are and not which, and the detail goes to the log where it belongs.
        ...(config.isProd
          ? { config_problems: configProblems.length }
          : { config_problems: configProblems }),
      },
    },
    { status: dbUp ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
