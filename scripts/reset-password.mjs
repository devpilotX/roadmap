/**
 * reset-password.mjs | set an account's password from the command line.
 *
 * For the one case the interface cannot help with: you are locked out, so you
 * cannot reach /profile to change it the normal way.
 *
 * The old hash is written to backups/ before anything is changed, so the previous
 * password can be put back. Every other session for that account is ended, which
 * is what POST /api/me/password does, because a password change that leaves old
 * sessions alive has not really changed anything.
 *
 *   npx tsx scripts/reset-password.mjs --email=you@example.com --password='...'
 *   npx tsx scripts/reset-password.mjs --email=you@example.com --restore=backups/pw-....json
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { one, run, closePool } from '../lib/db/pool.ts';
import { checkPassword, hashPassword } from '../lib/passwords.ts';
import { ROOT } from '../lib/config.ts';
import { banner, bad, good, info, parseArgv, runScript, step } from './lib/cli.mjs';

const { values } = parseArgv(process.argv.slice(2), ['email', 'password', 'restore']);

async function main() {
  banner('Reset a password');

  const email = String(values.get('email') ?? '').trim().toLowerCase();
  if (!email) {
    bad('Pass --email=you@example.com');
    return 2;
  }

  const user = await one(
    'SELECT id, email, display_name, password_hash FROM users WHERE email = ?',
    [email]
  );
  if (!user) {
    bad(`No account with the email ${email}.`);
    return 2;
  }
  info(`account ${user.id}, ${user.email}, ${user.display_name}`);

  /* ------------------------------------------------------------- restoring */

  const restore = values.get('restore');
  if (restore) {
    step('Restoring the previous hash');
    const saved = JSON.parse(await readFile(restore, 'utf8'));
    if (Number(saved.user_id) !== Number(user.id)) {
      bad(`That backup is for user ${saved.user_id}, not ${user.id}.`);
      return 1;
    }
    await run('UPDATE users SET password_hash = ? WHERE id = ?', [saved.password_hash, user.id]);
    good('The previous password works again.');
    return 0;
  }

  /* -------------------------------------------------------------- setting */

  const password = values.get('password');
  if (!password) {
    bad("Pass --password='the new one'. Quote it, so the shell does not eat a symbol.");
    return 2;
  }

  // The same rules the API applies, so a password set here is one the app would
  // have accepted. Nothing is weakened by going round the interface.
  const check = checkPassword(password, { email: user.email, displayName: user.display_name });
  if (!check.ok) {
    bad(check.reason);
    return 1;
  }

  step('Backing up the current hash');
  const dir = join(ROOT, 'backups');
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = join(dir, `pw-${user.id}-${stamp}.json`);
  await writeFile(
    file,
    JSON.stringify(
      { user_id: user.id, email: user.email, password_hash: user.password_hash, saved_at: new Date().toISOString() },
      null,
      2
    )
  );
  good(`saved to ${file.replace(ROOT, '.')}`);

  step('Setting the new password');
  const hash = await hashPassword(password);
  await run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, user.id]);
  good('password set, hashed with Argon2id at m=19456 t=2 p=1');

  step('Ending every session for this account');
  // All of them, not all but one: this is not being run from a browser, so there
  // is no current session worth keeping.
  const gone = await run('DELETE FROM sessions WHERE data LIKE ?', [`%"userId":${user.id}%`]);
  good(`${gone.affectedRows ?? 0} session${gone.affectedRows === 1 ? '' : 's'} ended`);

  await run(
    `INSERT INTO audit_log (user_id, table_name, row_pk, action, after_json)
     VALUES (?, 'users', ?, 'update', CAST(? AS JSON))`,
    [user.id, String(user.id), JSON.stringify({ password_changed: true, via: 'scripts/reset-password.mjs' })]
  );

  info('Sign in, then change it again on /profile if it has been seen by anyone.');
  return 0;
}

await runScript('reset-password', main, { closePool });
