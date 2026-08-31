# How to undo any of this

Written for whoever needs it at 23:00. Two commands per situation, no thinking.

---

## Put the local repository back exactly as it was

Your original branch is **main**, untouched, at commit `83c7e6c`.

```bash
cd C:\Dev\apps\roadmap-web\roadmap-tracker
git switch main
```

That is all. Every change made by this run lives on the branch
`agent/perfect-and-deploy-20260831-065856` and on the tag
`checkpoint/000-baseline`, which points at your original commit.

To throw the work away entirely:

```bash
git branch -D agent/perfect-and-deploy-20260831-065856
```

---

## Roll back one step at a time

```bash
git tag -l 'checkpoint/*'                    # list the restore points
git diff checkpoint/002-db-hardening --stat   # what changed since one of them
git reset --hard checkpoint/002-db-hardening  # rewind to it
git restore --source=checkpoint/002-db-hardening -- path/to/one/file
```

Restore points, in order:

| Tag | State |
|---|---|
| `checkpoint/000-baseline` | your original commit, before anything |
| `checkpoint/001-pre-fixes` | agent notes added, no code changed yet |
| `checkpoint/002-db-hardening` | migration 005 applied and proven |
| `checkpoint/003-code-fixes` | session, atomicity, service worker, mobile menu |
| `checkpoint/004-all-gates-green` | everything verified, before deployment work |

---

## Recover from a destroyed repository

Full history, off-repo, verified complete:

```bash
git clone C:\Dev\apps\.agent-backups\roadmap-deploy.bundle recovered
```

Also present: `roadmap-tracker-20260831-065856.bundle` (the state at run start) and
`roadmap-tracker-ignored-20260831-065856.zip`, which holds your `.env` and the
`backups/` directory — the two things git does not protect.

**Never delete anything in `.agent-backups`.**

---

## Take the live site down

```bash
ssh -i ~/.ssh/vps_albertdipanshu opc@168.138.15.182     # from WSL, not PowerShell
sudo systemctl stop roadmap-tracker
```

Caddy will then answer 502 for the domain. To remove it from Caddy entirely:

```bash
sudo rm /etc/caddy/conf.d/roadmap.caddy
sudo systemctl reload caddy
```

The other site on that host (`mcp-albert.devpilotx.com`) is in the main
`/etc/caddy/Caddyfile` and is unaffected either way. Timestamped backups of that
file are in `/etc/caddy/Caddyfile.bak.*`.

---

## Roll the live site back to the previous version

`deploy/release.sh` does this automatically if a deploy fails its health check. By
hand:

```bash
sudo git -C /opt/roadmap-tracker log --oneline -10
sudo git -C /opt/roadmap-tracker reset --hard <commit>
sudo bash /opt/roadmap-tracker/deploy/release.sh
```

---

## Restore the live database

```bash
ls -lh /opt/roadmap-tracker/backups/*.sql.gz
gzip -t /opt/roadmap-tracker/backups/<file>.sql.gz && echo 'archive ok'
```

Then follow `docs/RUNBOOK.md` section 1, which restores into a scratch database and
verifies it before touching the live one.

---

## Remove everything from the server

```bash
sudo systemctl disable --now roadmap-tracker
sudo rm -f /etc/systemd/system/roadmap-tracker.service /etc/cron.d/roadmap-tracker
sudo rm -f /etc/caddy/conf.d/roadmap.caddy && sudo systemctl reload caddy
sudo rm -rf /opt/roadmap-tracker /etc/roadmap-tracker
sudo mysql -e "DROP DATABASE roadmap_tracker; DROP USER 'roadmap'@'localhost';"
sudo userdel roadmap
```

MySQL itself, Caddy, and the other site stay. `/etc/my.cnf.d/roadmap.cnf` tunes
MySQL for this machine's memory and is worth keeping regardless.
