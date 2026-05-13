# Talafee — Project rules for Claude Code

> This file is **auto-loaded by Claude Code in every chat** inside this repo.
> It exists so that any new chat (feature work, bug fix, debugging, page creation, refactor) knows the rules **before** touching code.
>
> Detailed checklists live in [`.claude/conventions/`](.claude/conventions/). Read the relevant one before starting non-trivial work.

---

## 1. Architecture in one paragraph

Talafee is a static frontend (vanilla HTML/CSS/JS, no build) plus a TypeScript backend (`crawler-service/`) that polls 11+ Iranian gold providers every 30s, normalises prices to Rial/gram, exposes a JSON API on port 3001, and persists snapshots + trust/review data in SQLite. In production, nginx serves the static site at port 80 and proxies `/api/` → `127.0.0.1:3001`. The frontend auto-detects the API base URL per host (same-origin in prod, `http://localhost:3001` in local dev).

Three environments must stay byte-identical for tracked files:

```
local repo  ⇄  origin/master (GitHub: mahdincc/talafee)  ⇄  /opt/talafee on VPS
```

Drift between any of these three is a bug.

---

## 2. The deploy-chat policy (READ THIS FIRST)

There are **two kinds of chats** in this project:

| Kind | Allowed to | Not allowed to |
|---|---|---|
| **Feature / bugfix / refactor chats** | Edit files, run local checks, **`git commit`** on `master` in the main repo | `git push`, SSH to VPS, redeploy |
| **Deploy chat** (this one) | All of the above **plus** `git push origin master`, SSH, redeploy, drift verification | — |

After committing, a feature chat must end with this exact line so the user can hand it off:

```
✅ Committed <short-sha> on master: <subject>. Ready to push & deploy — tell the deploy chat.
```

The deploy chat, when handed a hash, runs the procedure in [`.claude/conventions/deploy.md`](.claude/conventions/deploy.md) — never anything else. If the local HEAD doesn't match the hash the user gave, **stop and ask**; do not guess what to push.

**Why this matters:** the user got burned in the past when multiple chats both pushed and the VPS ended up on a different commit than `origin/master`. Centralising push+deploy in one chat keeps the three environments aligned.

---

## 3. Mandatory rules for every chat

Before writing code:

1. **Find out where you are.** If `pwd` is inside `.claude/worktrees/…`, you're in a Claude worktree and **commits there land on a worktree branch, not master**. Either:
   - `cd` into the main repo at `D:\Games\V_Ware\codex\FinTech\talafee` and work on `master`, **or**
   - Stay in the worktree but tell the user at handoff that the deploy chat must fast-forward `master` from the worktree branch before pushing.
2. **Read the relevant convention file** from `.claude/conventions/` — they are short and specific:
   - Touching a provider or adding one → [`add-provider.md`](.claude/conventions/add-provider.md)
   - Creating a new HTML page → [`add-page.md`](.claude/conventions/add-page.md)
   - Editing TypeScript / frontend code → at minimum [`commit.md`](.claude/conventions/commit.md)
   - Investigating a bug / regression → [`debug.md`](.claude/conventions/debug.md)
3. **Never commit** `*.pem`, `*.key`, `*.har`, `data/*.db`, `.env*`, `node_modules/`, `dist/`. `.gitignore` already covers these — don't `git add -A` blindly; add specific paths.

Before declaring a task done:

4. **Backend changes** → `cd crawler-service && npm run build` must succeed (zero TS errors). If you can run the service locally, hit `http://localhost:3001/api/v1/health` and confirm `success: true`.
5. **Frontend changes** → open the affected HTML file in a browser (the user has `npm run dev` available) and verify the change works. **Type-checking is not feature-checking** — if you can't open it, say so in handoff; don't claim success.
6. **Provider changes** → confirm the new/edited provider appears in the `/api/v1/health` `providers[]` array with `status: "healthy"` before handoff.

---

## 4. Code conventions (terse)

- **No comments unless the *why* is non-obvious.** Names should explain *what*. Never add narration like `// fetch the prices` or `// added for task X`.
- **No speculative abstractions.** Three similar lines is fine; don't extract a helper "in case we need it later".
- **Don't add error handling for impossible cases.** Trust framework guarantees; validate only at system boundaries (provider HTTP responses, user input).
- **No backwards-compat shims** unless the user explicitly asks. If something is unused, delete it — don't leave `// removed` comments or rename to `_unused`.
- **Persian + English are both fine in conversation.** Code, identifiers, file names, commit messages stay in English. User-facing strings in HTML are bilingual (`fa` is the default `dir="rtl"`).
- **Numbers are stored in Rials in the database/API.** Convert to Toman only at the display layer (`formatPriceToman` in `assets/js/api-client.js`).
- **Provider IDs are the join key.** The `id` in `config/providers.json`, the `providerId` field on `BaseProvider` subclasses, the `id` in `crawler.config.ts` providers, and the directory name for logos under `assets/images/providers/` must all match exactly.

---

## 5. Commit messages

Conventional Commits, short subject (< 70 chars), imperative mood:

```
<type>(<scope>): <subject>

[optional body explaining WHY, not what]
```

Types in use here: `feat`, `fix`, `refactor`, `chore`, `docs`, `perf`. Scope is usually `crawler`, `frontend`, `<provider-id>`, `trust`, `config`, or omitted.

Examples from this repo's history (follow this style):

```
feat: add WallGold (wallgold.ir) provider
fix(crawler): consistent per-gram pricing across providers
fix: auto-detect API baseUrl per environment
feat(frontend): stat cards rewrite, line chart removal, rename to طلاین
chore: gitignore secrets/workspace + add KPI and trust-score docs
```

Co-author trailer: include `Co-Authored-By: Claude <noreply@anthropic.com>` only when the user asks for it; default is no trailer.

Don't amend commits that are already pushed. Make a new commit.

---

## 6. Where things live

```
talafee/
├── CLAUDE.md                      ← this file (auto-loaded)
├── .claude/conventions/           ← detailed checklists per task type
├── *.html                         ← pages, self-contained (inline CSS + inline JS at bottom)
├── assets/
│   ├── css/design-tokens.css      ← CSS custom properties (single source for colours/spacing)
│   ├── css/trust.css              ← shared styles for trust UI
│   ├── js/api-client.js           ← TalafeeAPI (vanilla, IIFE, exposed globally)
│   ├── js/trust-client.js         ← TalafeeTrustAPI
│   └── images/providers/<id>.svg  ← provider logos (must match the provider id)
├── config/
│   ├── providers.json             ← frontend-facing provider metadata + products
│   └── app.json                   ← feature flags, intervals, currency
├── crawler-service/
│   ├── config/crawler.config.ts   ← backend per-provider config (timeouts, rate limits)
│   ├── src/core/BaseProvider.ts   ← abstract base, all providers extend this
│   ├── src/providers/             ← one file per provider; register in providers/index.ts
│   ├── src/api/server.ts          ← Express setup, CORS, helmet
│   ├── src/api/routes/            ← one router per resource (prices, history, trust, …)
│   ├── src/services/              ← TrustScoreService, ReviewService, BubbleService, etc.
│   ├── src/sinks/                 ← SqliteSink (persist), ApiCacheSink (in-memory hot path)
│   └── src/utils/priceNormalizer.ts ← normalizePriceToRials (centralised rescaling)
└── docs/                          ← long-form design docs (KPI, API spec, theme, trust plan)
```

Reading order for orientation: `docs/API.md` → `crawler-service/src/core/BaseProvider.ts` → one example provider (e.g. `TalineProvider.ts`) → `src/api/server.ts`.

---

## 7. Server / deployment quick facts

- **VPS:** `185.231.182.111` (ArvanCloud, Ubuntu 24.04). Full deploy procedure in [`.claude/conventions/deploy.md`](.claude/conventions/deploy.md).
- **Code on server:** `/opt/talafee/`
- **Services:** `nginx` (port 80, static + `/api/` proxy) and `talafee-crawler.service` (systemd, port 3001).
- **Logs:** `journalctl -u talafee-crawler.service -f`
- **DB:** `/opt/talafee/crawler-service/data/prices.db` (SQLite, **never** copied from local — server owns this state).
- **SSH key:** local-only at `D:\Games\V_Ware\codex\FinTech\talafee\ar-tlafeesshkey-privatekey.pem` (gitignored). Connect: `ssh -i "<key>" root@185.231.182.111`.

---

## 8. Drift = bug. Before declaring "deployed":

The deploy chat must verify, **every time**, that these three are equal:

1. `git rev-parse origin/master` (after push)
2. `git rev-parse master` (local)
3. The state of `/opt/talafee/` matches the working tree of that commit (spot-check by hashing a couple of tracked files — see `deploy.md`).

If any of the three differs, the deploy is **not done**.
