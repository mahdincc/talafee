# Debugging guide

> When something's broken or behaving weirdly. Read [`../../CLAUDE.md`](../../CLAUDE.md) for context.

## First: where is the bug?

A symptom usually belongs to one of four layers. Identify the layer before fixing.

| Symptom | Layer | First place to look |
|---|---|---|
| "Page shows wrong/no prices" | Frontend rendering OR API | DevTools → Network → `/api/v1/prices` response |
| "API returns 0 prices for provider X" | Crawler provider | `journalctl -u talafee-crawler -f` filtered for `[X]` |
| "Price for X is 10× too high/low" | Price normaliser | `crawler-service/src/utils/priceNormalizer.ts` |
| "Service crashed / not responding" | Crawler service runtime | `systemctl status talafee-crawler` + journal |
| "nginx 502" | Reverse proxy | crawler-service is down on port 3001 |
| "Trust scores wrong" | TrustScoreService + SqliteSink | `data/prices.db` + service log |

## Local repro

Always reproduce locally before touching the VPS.

```bash
cd crawler-service
npm install           # only if you don't have node_modules
npm run dev           # tsx watch — restarts on file change
```

Service runs on `http://localhost:3001`. Endpoint catalogue: `http://localhost:3001/api/v1/`.

For frontend, open `npm run dev` from repo root (live-server on `http://localhost:3000`).

## Useful endpoints

```
GET  /api/v1/                  → endpoint catalogue
GET  /api/v1/health            → service + provider health, last crawl times
GET  /api/v1/prices            → all prices, latest snapshot
GET  /api/v1/prices/by-product → grouped by product
GET  /api/v1/prices/<product>  → comparison for one product
GET  /api/v1/history/<prov>/<prod>?hours=24
GET  /api/v1/trust/ranking
POST /api/v1/health/crawl      → trigger a manual crawl (returns immediately)
```

## Common bugs and where to look

### "Provider X returns 0 prices"

1. `journalctl -u talafee-crawler -n 200 --no-pager | grep '\[X\]'` (on VPS) or watch local `npm run dev` output.
2. If you see `Unknown symbol: <symbol>` debug lines → their API added a new product id; update `SYMBOL_TO_PRODUCT` in `crawler-service/src/providers/<X>Provider.ts`.
3. If you see HTTP errors (`timeout`, `403`, `429`) → they may have added auth, rate limiting, or changed the URL. Check the provider's site, update `apiUrl` in `crawler-service/config/crawler.config.ts`, or add/change the auth strategy.
4. If `priceCount > 0` in the journal but the API returns nothing → look at `ApiCacheSink` and `SqliteSink` filtering.

### "Price is wildly wrong (10× / 100× off)"

The normaliser couldn't fit it to an expected range. Look at the journal for `Rescaled price to expected magnitude` info logs — the `buyScale` / `sellScale` tell you what multiplier was applied. If you see a *warning* like `unexpected magnitude` → extend the expected ranges in `crawler-service/src/utils/priceNormalizer.ts`. Don't band-aid the provider.

### "Frontend shows old prices"

1. Hard refresh (Ctrl+Shift+R) — cache headers set 7d for static assets.
2. Check `/api/v1/health` → `scheduler.lastCrawlAt` should be within ~30s. If it's old, the scheduler hung — restart the service.
3. Check `cache.totalPrices` — if 0, the cache sink is empty (likely a fresh restart, will populate within 30s).

### "API connects in dev but not in prod"

Almost always a `baseUrl` mismatch. `assets/js/api-client.js` and `trust-client.js` auto-detect. If you broke the auto-detection, the symptom is requests going to `localhost:3001` from a production page. Don't override `baseUrl` in HTML; fix `resolveDefaultBaseUrl`.

### "CORS error in browser"

Server config in `crawler-service/src/api/server.ts` allows localhost + same-origin + `null` (file://). In production, requests come through nginx so origin is same-host; no CORS triggered. If you hit CORS in prod, you're talking to the API from a different host — that's a config decision, not a bug.

### "VPS service won't start after deploy"

1. `ssh root@185.231.182.111 'systemctl status talafee-crawler'` → look at the last error.
2. Common causes:
   - `npm run build` failed during deploy → check the deploy command output for TS errors.
   - `better-sqlite3` native binding mismatch → run `cd /opt/talafee/crawler-service && npm rebuild better-sqlite3`.
   - Port 3001 already taken → `lsof -i :3001` to find the holdout.

### "Trust scores or reviews missing"

These live in SQLite (`data/prices.db`), not in code. On a fresh DB, `TrustScoreService.seedDummyData()` runs once on startup. If you wiped the DB, expect dummy data on next boot. Don't delete the production DB to "reset" anything — it owns reviews and history.

## Where logs live

| Where | What | Command |
|---|---|---|
| Local dev | crawler-service stdout | the terminal where `npm run dev` runs |
| Local file | rotated logs | `crawler-service/logs/` (winston file transport) |
| VPS systemd | crawler-service | `ssh root@... 'journalctl -u talafee-crawler -f'` |
| VPS nginx | access + errors | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` |

## Don't

- **Don't `rm` the SQLite DB** on the VPS — it's the production store for history/reviews/trust scores.
- **Don't restart the service to "clear state"** without checking what state is at fault. The scheduler resumes from cron, the cache is in-memory and rebuilds in 30s; restart is rarely the answer.
- **Don't paper over a provider's flakiness** by raising its timeout to 30s+ — health metrics depend on honest timings. If they're slow, log a `failedProviders` increment and let the dashboard show it.
- **Don't add `try/catch` everywhere.** `BaseProvider` already wraps `doFetch` with retry + classification. Adding more swallows errors.
