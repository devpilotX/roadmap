/**
 * POST /api/money/scripts/:code/version
 *
 * A new version. The original from Part 17.7 stays exactly where it is.
 */

import { one, run } from '@/lib/db/pool';
import { getMoneyScripts } from '@/lib/db/reference';
import { conflict, notFound } from '@/lib/errors';
import { authedRoute, jsonOk } from '@/lib/server/route';
import { parseBody, parseParams, z } from '@/lib/server/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const paramsSchema = z.object({ code: z.string().regex(/^S[1-8]$/) });

const scriptVersionBody = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(8000),
});

/**
 * How many times a version number is re-derived after a collision.
 *
 * Three, because each retry is one round trip and the only thing that can force
 * one is another save landing in the same instant. A person editing their own
 * scripts cannot produce a third simultaneous write, so a fourth attempt would
 * only be there to hide a bug rather than to survive a race.
 */
const MAX_ATTEMPTS = 3;

/**
 * Writes the next version of one script and returns the number it was given.
 *
 * The number used to be read by a separate SELECT MAX(version) + 1 and then
 * inserted, which is a race. Two saves a moment apart both read the same
 * maximum, and the second one hit uq_script_version (user_id, script_code,
 * version), so an ordinary edit came back as "That already exists". The unique
 * key did its job; the arithmetic was in the wrong place.
 *
 * Now the maximum is read inside the INSERT, under the same statement and so the
 * same lock as the write. The retry stays because a lock is not a proof: if two
 * inserts ever do settle on the same number, the right response is to look again
 * and take the next one, not to hand the collision to the person saving a script.
 *
 * COALESCE(MAX(version), 1) + 1 is deliberate rather than COALESCE(..., 0) + 1.
 * Version 1 is the original in money_scripts, which is never overwritten, so the
 * first edit a person makes is version 2.
 */
async function insertNextVersion(
  userId: number,
  scriptCode: string,
  title: string,
  text: string
): Promise<number> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const inserted = await run(
        `INSERT INTO money_script_versions (user_id, script_code, version, title, body)
         SELECT ?, ?, COALESCE(MAX(version), 1) + 1, ?, ?
           FROM money_script_versions
          WHERE user_id = ? AND script_code = ?`,
        [userId, scriptCode, title, text, userId, scriptCode]
      );
      const row = await one('SELECT version FROM money_script_versions WHERE id = ?', [
        inserted.insertId,
      ]);
      return Number(row?.version ?? 0);
    } catch (err) {
      // 1062 is ER_DUP_ENTRY, which here means only that another save took the
      // number first. Anything else is a real failure and belongs to the caller.
      if ((err as { errno?: number }).errno !== 1062 || attempt === MAX_ATTEMPTS) throw err;
    }
  }
  // Unreachable: the loop returns on success and rethrows on the last attempt.
  throw conflict('That script could not be versioned. Save it again.');
}

export const POST = authedRoute<{ code: string }>(async ({ request, params, user }) => {
  const { code } = parseParams(params, paramsSchema);
  const body = await parseBody(request, scriptVersionBody);

  const scripts = await getMoneyScripts();
  const script = scripts.find((s) => s.code === code);
  if (!script) throw notFound('No such script.');

  const version = await insertNextVersion(user.id, script.code, body.title, body.body);
  return jsonOk({ code: script.code, version, original_preserved: true }, 201);
});
