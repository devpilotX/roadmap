/**
 * POST /api/money/scripts/:code/version
 *
 * A new version. The original from Part 17.7 stays exactly where it is.
 */

import { one, run } from '@/lib/db/pool';
import { getMoneyScripts } from '@/lib/db/reference';
import { notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ code: z.string().regex(/^S[1-8]$/) });

const scriptVersionBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
});

export const POST = authedRoute<{ code: string }>(async ({ request, params, user }) => {
  const { code } = parseParams(params, paramsSchema);
  const body = await parseBody(request, scriptVersionBody);

  const scripts = await getMoneyScripts();
  const script = scripts.find((s) => s.code === code);
  if (!script) throw notFound('No such script.');

  const latest = await one(
    'SELECT COALESCE(MAX(version), 1) AS v FROM money_script_versions WHERE user_id = ? AND script_code = ?',
    [user.id, script.code]
  );
  const version = Number(latest?.v ?? 1) + 1;

  await run(
    'INSERT INTO money_script_versions (user_id, script_code, version, title, body) VALUES (?, ?, ?, ?, ?)',
    [user.id, script.code, version, body.title, body.body]
  );
  return jsonOk({ code: script.code, version, original_preserved: true }, 201);
});
