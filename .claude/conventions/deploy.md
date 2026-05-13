# Deploy procedure (deploy chat only)

> Only the **deploy chat** runs this. Feature chats commit and hand off — see [`commit.md`](commit.md). Read [`../../CLAUDE.md`](../../CLAUDE.md) §2 for the policy.

## When the user hands you a commit

User says something like *"push and deploy commit `abc123`"* or *"deploy the latest"*. Procedure:

### Step 1 — verify local matches the handed hash

```bash
cd D:/Games/V_Ware/codex/FinTech/talafee
git status                # must be clean
git rev-parse master      # must equal the handed hash (short or full)
git log -1 --oneline      # sanity-check the subject matches what the user described
```

If `git rev-parse master` doesn't match the handed hash, **stop**. Either:
- A feature chat committed on a worktree branch; fast-forward `master` to it: `git merge --ff-only <branch>` (refuse if it's not a fast-forward — ask the user).
- Or the hash is wrong; ask the user to re-check.

Never `git reset --hard` or `git push --force` without explicit user confirmation.

### Step 2 — push to GitHub

```bash
git push origin master
git rev-parse origin/master   # must now equal master
```

If push is rejected (non-fast-forward), someone pushed in parallel. **Stop and ask** — do not force-push.

### Step 3 — deploy to VPS

The deploy ships the working tree as a tarball, builds the crawler-service in place, and restarts the systemd unit. **One command** (the proven recipe from memory):

```bash
PEM="D:/Games/V_Ware/codex/FinTech/talafee/ar-tlafeesshkey-privatekey.pem"
cd "D:/Games/V_Ware/codex/FinTech/talafee"
tar -czf - \
  --exclude=node_modules --exclude=.git --exclude=.claude \
  --exclude='*.pem' --exclude=dist --exclude='data/*.db*' --exclude='*.har' \
  ./ | ssh -i "$PEM" -o StrictHostKeyChecking=no root@185.231.182.111 \
  'tar -xzf - -C /opt/talafee/ \
   && cd /opt/talafee/crawler-service \
   && npm ci \
   && npm run build \
   && systemctl restart talafee-crawler \
   && systemctl reload nginx'
```

The `--exclude=.claude` is important — the worktree state and local conventions don't belong on the VPS.

### Step 4 — verify

```bash
# 4a. Service health
ssh -i "$PEM" root@185.231.182.111 'systemctl is-active talafee-crawler nginx'
# expect: active\nactive

# 4b. API responds, all providers healthy
curl -s --max-time 10 http://185.231.182.111/api/v1/health | jq '{success, status, providersOK: ([.providers[] | select(.status=="healthy")] | length), providersTotal: (.providers | length)}'
# expect: success: true, providersOK == providersTotal

# 4c. No drift — file hashes match local
LOCAL_HASH=$(md5sum index.html | cut -d' ' -f1)
SERVER_HASH=$(ssh -i "$PEM" root@185.231.182.111 'md5sum /opt/talafee/index.html | cut -d" " -f1')
[ "$LOCAL_HASH" = "$SERVER_HASH" ] && echo "index.html OK" || echo "DRIFT on index.html"

# 4d. (optional) Watch one crawl cycle in the journal
ssh -i "$PEM" root@185.231.182.111 'journalctl -u talafee-crawler.service -n 50 --no-pager' | grep -E 'Crawl run completed|failedProviders'
# expect: failedProviders: 0
```

If any of these fail, the deploy is **not done**. Don't tell the user "deployed" until all four checks pass.

### Step 5 — report back to user

Use this format:

```
✅ Deployed <short-sha>
  • origin/master = master = <sha>
  • talafee-crawler: active   nginx: active
  • /api/v1/health: 11/11 providers healthy
  • Drift check: index.html OK, package.json OK
```

## Drift triage (when the post-deploy hash check fails)

If a VPS file hash doesn't match local, the cause is almost always one of:

1. **`.gitignore`'d file expected on server but missing locally** — e.g. someone hand-edited a config on the VPS. Pull it down (`scp`) and decide whether to commit it or revert the server.
2. **Tar excludes ate something** — re-check the exclude list against what actually changed in the commit (`git diff --name-only HEAD~1 HEAD`). If the changed path matched an exclude, fix the exclude or copy that file separately.
3. **Build artifact** — `dist/` is excluded from the tar; `npm run build` on the server regenerates it. If you skipped the build step, that's the cause.

Never "fix" drift by deleting files on the VPS. Investigate first.

## Things that look like deploy but aren't

- **Adding a new provider** doesn't require a separate deploy step. Once the code is committed and pushed, the standard deploy (above) rebuilds the crawler-service and the new provider boots on next `systemctl restart`.
- **Frontend-only HTML/CSS/JS changes** don't need the npm steps strictly, but the recipe above is idempotent and cheap (`npm ci` is fast when lockfile is unchanged). Don't optimise prematurely.
- **DB schema changes** (rare, in `SqliteSink`) — these run on first request after restart. Don't `rm` the DB on the server; existing prices/reviews/trust data is the production state.

## Rollback

```bash
cd D:/Games/V_Ware/codex/FinTech/talafee
git log --oneline -10                    # find the last-known-good sha
git push origin <good-sha>:master --force-with-lease   # ASK USER FIRST
# Then run the standard deploy (Step 3) so VPS matches.
```

Force-push to master needs explicit user confirmation, every time.
