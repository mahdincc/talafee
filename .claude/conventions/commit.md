# Commit & push conventions

> Read [`../../CLAUDE.md`](../../CLAUDE.md) first if you haven't. The big rule: **feature chats commit, the deploy chat pushes.** Never `git push` from a non-deploy chat.

## 1. Where to commit

Commits must land on `master` so they're directly pushable by the deploy chat.

- **Main repo dir** (`D:\Games\V_Ware\codex\FinTech\talafee`): `master` is checked out here. Commit straight onto it.
- **Claude worktree** (`.claude/worktrees/<name>`): you're on a branch like `claude/<name>-<id>` based off `master`. Commit there, then at handoff explicitly tell the user the branch name so the deploy chat can `git push origin <branch>:master` (a fast-forward push, since the worktree branch is `master + your commit`).

If something has landed on `origin/master` in the meantime, `git fetch && git rebase origin/master` before handoff so the push is still a fast-forward.

## 2. Subject line

Conventional Commits. Imperative mood, present tense, no trailing period, ≤ 70 chars.

```
<type>(<scope>): <subject>
```

| Type | Use for |
|---|---|
| `feat` | New user-visible capability (new provider, new page, new endpoint, new metric) |
| `fix` | Bug fix |
| `refactor` | Internal restructuring with no behavior change |
| `perf` | Performance improvement |
| `chore` | Tooling, deps, gitignore, non-doc housekeeping |
| `docs` | Documentation only |

`<scope>` is one of: `crawler`, `frontend`, `<provider-id>` (e.g. `taline`, `wallgold`), `trust`, `config`, `api`, `deploy`, or omitted if truly cross-cutting.

Real examples from this repo:

```
feat: add WallGold (wallgold.ir) provider
fix(crawler): consistent per-gram pricing across providers
fix: auto-detect API baseUrl per environment
feat(frontend): stat cards rewrite, line chart removal, rename to طلاین
chore: gitignore secrets/workspace + add KPI and trust-score docs
```

## 3. Body (optional)

Explain **why**, not what. The diff already shows what. Wrap at ~72 cols. Reference incidents/issues only if they exist (don't invent ticket numbers).

Skip the body for trivial changes (typo fix, dep bump, single-line config tweak).

## 4. What never gets committed

`.gitignore` already covers these — don't override:

- `*.pem`, `*.key`, `id_rsa*` — SSH/TLS material
- `*.har` — browser network captures (likely contain auth tokens from provider sites)
- `node_modules/`, `dist/`, `*.tsbuildinfo` — build output
- `data/`, `*.db`, `*.sqlite*` — the SQLite DB is owned by the VPS, never the laptop
- `.env*` — secrets
- `.claude/settings.local.json`, `.local-backup-*/`, `.vps-snapshot/` — local-only workspaces
- `tasks.txt` — local scratch

Use `git add <specific-paths>` rather than `git add -A` or `git add .`. The blanket forms accidentally pick up new untracked junk.

## 5. Pre-commit local checks

Run these before `git commit`, fix anything that fails:

- **Backend changes (`crawler-service/**`):**
  ```bash
  cd crawler-service
  npm run build      # tsc — must produce zero errors
  ```
  If the service is running locally, also `curl -s http://localhost:3001/api/v1/health | jq .success` → must be `true`.

- **Frontend changes (`*.html`, `assets/**`):**
  - Open the affected page in a browser. The user can run `npm run dev` from the repo root.
  - Watch the devtools console — no new errors.
  - If the change touches `api-client.js` / `trust-client.js`, verify a network request to `/api/v1/...` succeeds.

- **Provider added/changed:**
  - Service running locally: trigger a manual crawl `curl -X POST http://localhost:3001/api/v1/health/crawl` and check the provider appears with `priceCount > 0` in the journal.
  - **Don't ship a provider that returns 0 prices or has consecutive failures > 0 at commit time.**

There are no automated tests in this repo currently. Don't claim "tests pass" — there are none to pass.

## 6. Handoff message (mandatory)

After commit, end the chat with **this exact one-liner** so the user can pass the hash to the deploy chat:

```
✅ Committed <short-sha> on master: <subject>. Ready to push & deploy — tell the deploy chat.
```

(If you committed on a worktree branch instead of `master`, say so explicitly and name the branch.)

## 7. Co-author trailer

Default: **no** trailer. Only add `Co-Authored-By: Claude <noreply@anthropic.com>` if the user asks for it.
