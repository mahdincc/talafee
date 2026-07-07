<div align="center">

<img src="assets/images/logo.svg" alt="Talafee" height="72">

# Talafee · طلافی

**Real-time gold-price transparency for the Iranian market — compare 12 providers in one place, normalized to a single Rial/gram, refreshed every 30 seconds.**

مقایسهٔ لحظه‌ای قیمت طلا و سکه از ۱۲ پلتفرم ایرانی، نرمال‌شده به ریال بر گرم، با به‌روزرسانی هر ۳۰ ثانیه.

[![CI](https://github.com/mahdincc/talafee/actions/workflows/ci.yml/badge.svg)](https://github.com/mahdincc/talafee/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-D4AF37.svg)](LICENSE)
![Backend: TypeScript](https://img.shields.io/badge/backend-TypeScript-3178C6.svg)
![Providers: 12 active](https://img.shields.io/badge/providers-12_active-blue.svg)
![REST endpoints: 47](https://img.shields.io/badge/REST_API-47_endpoints-blue.svg)
![Frontend: Vanilla JS](https://img.shields.io/badge/frontend-Vanilla_JS_%2B_HTML-E34F26.svg)

[**English**](#english) · [**فارسی**](#فارسی)

</div>

---

> **Status — runs locally.** The hosted production instance has been decommissioned, so the app is **not currently deployed** and there is **no public live demo**. Everything below runs from a clean clone in ~2 minutes ([setup](#run-it-locally-from-a-clean-clone)); the screenshots and numbers are from a local run.

<a name="english"></a>

## The problem

Iran has a dozen online platforms selling gold — DigiKala's DigiGold, Taline, TechnoGold, MiliGold and others — plus market-rate sources like TGJU and Bonbast. Each quotes prices in its **own format** (Tomans vs Rials, per-gram vs per-coin, different scales and update rhythms), so a buyer genuinely cannot tell, at a glance, **who is cheapest right now**. In a local run, the spread between the best and worst provider for a single gram of 18k gold was **~14%** — real money lost to opacity.

**Talafee closes that gap:** it aggregates every provider into one normalized, comparable view, and shows the best price, the spread, a market-premium ("bubble") signal, and trust scores — so the buyer decides with full information.

## What it is

A **two-tier system**:

- **A TypeScript data platform** (`crawler-service/`, ~12k LOC) that polls **12 providers every 30s**, normalizes every quote to a canonical **Rial/gram**, runs **cross-provider anomaly detection** and **trust scoring**, persists history to SQLite, and exposes a **47-endpoint REST API**.
- **A static, bilingual (FA/EN) frontend** (vanilla HTML/CSS/JS, no build) that reads that API and renders the comparison, an investment-signal dashboard, provider trust pages, and **Web-Push price alerts** via a service worker.

> Built solo, 0→1, using an **AI-native, spec-driven workflow** (Claude Code) — with the architecture, data-quality rules, and security boundaries owned by a human. See [How this was built](#how-this-was-built).

## Screenshots

> _Captured from a local run (production instance decommissioned — the project runs locally). See [`docs/screenshots/`](docs/screenshots/). The data platform is real and verifiable from a clean clone; the consumer/admin panels are high-fidelity **UI prototypes** (see [Features](#features))._

### Price comparison (`index.html`)
![Cross-provider comparison — best price, spread, and sorted providers](docs/screenshots/hero-compare.png)
*Best vs. worst price and spread across providers for 18k gold (local run).*

### Web-Push price alerts
![Set a price threshold and receive a browser notification](docs/screenshots/price-alert.gif)
*Set a high/low threshold on any product; a service worker delivers a browser notification when a provider crosses it — no account, no PII.*

### Investment guide — 7-KPI buy/hold/sell (`guide.html`)
![Composite buy/hold/sell signal from seven research-backed indicators](docs/screenshots/investment-guide.png)
*Seven research-backed indicators (coin premium, USD momentum, world-gold trend, RSI, real yields, DXY, COT) → one weighted signal.*

### User panel & admin dashboard (UI prototypes)
<p>
  <img src="docs/screenshots/user-panel.png" width="49%" alt="User panel prototype — wallet, alerts, connected accounts">
  <img src="docs/screenshots/admin-dashboard.png" width="49%" alt="Admin dashboard prototype">
</p>

## Features

Honest split between what is **backed by the live data platform** and what is a **front-end prototype** (designed UI, not yet wired to a backend):

| ✅ Data platform (backend-backed) | 🎨 UI prototype (front-end only) |
|---|---|
| Real-time comparison across **12 providers** | Login / registration |
| **Rial/gram normalization** of heterogeneous formats | Wallet (deposit / withdraw / buy-sell) |
| **Cross-provider price-anomaly detection** | Fast Buy / target-price orders |
| **Trust scoring** + reviews + provider warnings | Connected accounts (multi-platform balances) |
| **Web-Push price alerts** (service worker + VAPID) | Universal payment |
| Investment **KPI guide** (buy/hold/sell signal) | Admin dashboard |
| Market **premium/"bubble"** vs. world price\* | |
| 90 days of **price history** per provider/product | |
| Bilingual **FA (RTL) / EN**, light/dark themes | Bilingual, themes (shared) |

\* The premium panel depends on a world-gold (XAU/USD) feed; when that feed is unavailable the panel hides itself rather than showing empty values.

## Architecture

```
        12 LIVE PROVIDERS                 CRAWLER-SERVICE  (TypeScript · Node · Express · SQLite)          STATIC FRONTEND
  ───────────────────────────            ────────────────────────────────────────────────────────      ─────────────────────
  JSON APIs                              Scheduler (node-cron, every 30s)                                index.html   compare
   DigiGold  Taline  MiliGold            └▶ CrawlPipeline                                                guide.html   KPI signal
   TalaSea  TechnoGold  WallGold  ──────▶     └▶ Provider ⟶ extends BaseProvider                         trust.html   trust
   MelliGold  Bonbast                    │        · retry · throttle · pluggable auth strategy           user-panel   (prototype)
  HTML sources                           │        · doFetch() ⟶ normalizePriceToRials (Rial/gram)        admin-panel  (prototype)
   TGJU  Goldika  Daric  Goldis   ──────▶│     ├▶ ApiCacheSink   (hot in-memory read path)                      ▲
   (AlanChand — implemented, off)        │     └▶ SqliteSink     (history · trust · reviews · alerts)     assets/js/api-client.js
                                         ├▶ Services: TrustScore · Bubble · InvestmentGuide ·             assets/js/alerts-client.js
                                         │   Review · PriceAccuracyTracker                                sw.js  (Web-Push)
                                         └▶ REST API — 47 endpoints ───────────────────────────────▶ polls /api/v1 every 30s
                                              /prices /history /health /products
                                              /trust /bubble /guide /alerts
```

**Why these choices** (see [How this was built](#how-this-was-built) for the reasoning):

- A **separate crawler-service** (not serverless functions or in-browser fetches) so slow/flaky/rate-limited providers are polled, retried, throttled, cached, and persisted server-side — the frontend stays static and instant.
- A **`BaseProvider` abstraction with pluggable auth strategies** so each of 12 wildly-different integrations is one small `doFetch()` file; retry, throttling, normalization, and health live in the shared base.
- **Centralized `normalizePriceToRials`** so every price becomes comparable Rial/gram in exactly one place — the core data-quality problem, solved once.

## Data sources & refresh cadence

- **Price crawl:** every **30 seconds** (`*/30 * * * * *`) · **health check:** every 5 minutes · **history retention:** 90 days.
- **Normalization:** each provider's raw quote is rescaled to Rial/gram (observed factors include ×10, ×100, ×1000, ×100000) and validated; out-of-range values are dropped so a bad scrape can't poison the comparison.
- **Status** below is from a **local run** — `healthy` = parser returns data; `degraded (reachable, no data)` = endpoint responds but the parser currently extracts nothing (site/endpoint drift), reported honestly by `/api/v1/health`. Provider availability varies run-to-run:

| Provider | Source | Integration | Status (local run) |
|---|---|---|---|
| DigiGold (دیجی‌گلد) | digikala.com/gold | JSON API | ✅ healthy |
| Taline (طلاین) | my.tlyn.ir | JSON API | ✅ healthy |
| MiliGold (میلی‌گلد) | milli.gold | JSON API | ✅ healthy |
| TalaSea (طلاسی) | talasea.ir | JSON API | ✅ healthy |
| TechnoGold (تکنوگلد) | technogold.gold | JSON API | ✅ healthy |
| WallGold (وال‌گلد) | wallgold.ir | JSON API | ✅ healthy |
| Bonbast (بن‌بست) | bonbast.com | JSON (rotating token) | ✅ healthy |
| TGJU (طلا و ارز) | tgju.org | HTML | ✅ healthy |
| Goldika (گلدیکا) | goldika.ir | HTML | ✅ healthy |
| MelliGold (ملی‌گلد) | melligold.com | JSON API | ⚠️ reachable, no data |
| Daric (داریک) | daric.gold | HTML (SPA) | ⚠️ reachable, no data |
| Goldis (گلدیس) | goldis.ir | HTML (SPA) | ⚠️ reachable, no data |

_(AlanChand is implemented but disabled in config.)_

## Run it locally (from a clean clone)

**Prerequisites:** Node.js ≥ 18 and npm. (`crawler-service` uses `better-sqlite3`, a native module — on some systems it needs standard C++ build tools.)

```bash
git clone https://github.com/mahdincc/talafee.git
cd talafee
```

**1 — Start the data platform** (API on `:3001`, begins crawling immediately):

```bash
cd crawler-service
npm install
npm run build
npm start
# verify: curl http://localhost:3001/api/v1/health   → { "success": true, ... }
```

**2 — Start the frontend** (static site on `:3000`, in a second terminal from the repo root):

```bash
npm install        # optional — only for the live-server dev server
npm run dev        # → http://localhost:3000
```

The frontend auto-detects the API base URL per environment (same-origin when served behind a web server, `http://localhost:3001` in local dev), so with both running the comparison populates from the crawler immediately. You can also just open `index.html` directly.

**Handy endpoints:** `GET /api/v1/prices/compare/18k-gold` (best/worst/spread) · `GET /api/v1/health` (per-provider status) · `GET /api/v1/guide/summary` (buy/hold/sell).

## Tech stack

- **Backend:** TypeScript (strict) · Node.js · Express · `better-sqlite3` · Winston · node-cron · web-push · axios — compiled with `tsc`, ~12k LOC across 65 files.
- **Frontend:** Vanilla HTML5 / CSS3 (custom design-token system) / JavaScript — no framework, no build. Lucide icons, Vazirmatn/Outfit fonts.
- **Alerts:** Service Worker + Web Push (VAPID keys generated at runtime, stored in SQLite).
- **Testing:** Vitest. **Persistence:** SQLite (prices, history, trust, reviews, alerts).

## Project structure

```
talafee/
├── index.html · login.html · user-panel.html      # 6 self-contained pages
│   admin-panel.html · guide.html · trust.html      #   (inline CSS + JS)
├── sw.js                                           # Web-Push service worker
├── assets/
│   ├── css/design-tokens.css                       # single source for colors/spacing
│   └── js/{api-client,alerts-client,trust-client}.js
├── config/
│   ├── app.json                                    # feature flags, intervals
│   └── providers.json                              # 13 provider metadata + products
├── crawler-service/                                # the TypeScript data platform
│   ├── config/crawler.config.ts                    # per-provider timeouts/rate-limits
│   └── src/
│       ├── core/BaseProvider.ts                    # abstract base — all providers extend it
│       ├── providers/                              # one file per provider
│       ├── api/                                    # Express server + routers
│       ├── services/                               # TrustScore, Bubble, Guide, Review …
│       ├── sinks/                                  # SqliteSink (persist), ApiCacheSink (hot)
│       └── utils/priceNormalizer.ts                # normalizePriceToRials
├── docs/                                           # design & product docs (see below)
└── .claude/conventions/                            # the spec→build checklists (see below)
```

<a name="how-this-was-built"></a>

## How this was built

This repo is an exercise in **agentic engineering, not vibe coding**: a fallible AI agent (Claude Code) executes tightly-scoped specs while a human owns architecture, data-quality rules, and security boundaries.

**The AI-native, spec-driven loop.** Recurring work follows checklists checked into [`.claude/conventions/`](.claude/conventions/) — [`add-provider.md`](.claude/conventions/add-provider.md), [`add-page.md`](.claude/conventions/add-page.md), [`commit.md`](.claude/conventions/commit.md), [`debug.md`](.claude/conventions/debug.md). Each new provider or page is a **vertical slice** (one integration → verify against `/health` → commit), so the agent's output is continuously grounded against a real success signal instead of imagined behavior.

**Human architecture decisions** (the parts a spec can't outsource):

- **Separate the crawler from the frontend.** Providers are slow, rate-limited, and occasionally geo-quirky. A persistent service can schedule, retry, throttle, cache, and persist history; the frontend then just reads a fast cached API and stays a deployable-anywhere static site. Coupling them would have made both worse.
- **A provider abstraction, not 12 bespoke scripts.** `BaseProvider` owns retry/throttle/normalization/health/stats; each provider implements only `doFetch()` and picks an auth strategy (`NoAuth`, `CustomHeaders`, `Signature`, `JwtCsrf`). Adding a provider is one file — and the abstraction is what makes 12 sources maintainable by one person.
- **Normalize once, centrally.** Rial-vs-Toman, per-gram-vs-per-coin, and magnitude drift are the real problem in this domain. `normalizePriceToRials` rescales and validates in a single place, and anomalous quotes are flagged against the cross-provider average — so "best price" is trustworthy, not just "lowest number scraped."
- **Web-Push over accounts.** Price alerts use a service worker + VAPID keys (stored server-side), with **no user accounts and no PII** — a deliberate privacy/cost trade-off, at the price of requiring a browser permission.
- **Static vanilla frontend.** The consumer surface is mostly read-only price display; plain HTML/CSS/JS loads instantly, needs no build, and is trivially editable page-by-page by an agent.

**What's real vs. prototype** is stated plainly (see [Features](#features)): the data platform is real and runs locally from a clean clone; the wallet/payment/admin surfaces are high-fidelity UI prototypes.

## Product thinking

Two design docs capture the product/business reasoning behind the code:

- **[`docs/KPI_FRAMEWORK.md`](docs/KPI_FRAMEWORK.md)** — the investment-guide's seven indicators, drawn from World Gold Council, McKinsey, Goldman/JPMorgan, LBMA, and CFTC COT research, with explicit weights, buy/hold/sell thresholds, and honest `isStale` handling for feeds not yet wired.
- **[`docs/AFFILIATE-SYSTEM.md`](docs/AFFILIATE-SYSTEM.md)** — a **proposed** monetization model (affiliate/CPS/CPA/revenue-share) with funnel KPIs (CTR, conversion, EPC, RPM), attribution, A/B ideas, and GDPR disclosure. _Clearly labeled illustrative — planning figures, not actual revenue._

Additional design docs: [`API.md`](docs/API.md), [`UI-DESIGN-SPEC.md`](docs/UI-DESIGN-SPEC.md), [`talafee-theme.md`](docs/talafee-theme.md).

## Roadmap

- Recover the three drifted parsers (MelliGold, Daric, Goldis) and add further providers (e.g. ZarGold, GoldIran, GoldPlus — currently metadata only).
- Wire a world-gold (XAU/USD) feed to re-enable the premium/"bubble" panel end-to-end.
- Back the wallet/accounts prototype surfaces with real services.
- CI (lint + test) and a GitHub Pages demo with clearly-labeled sample data.

---

<a name="فارسی"></a>

## فارسی

### مشکل

در ایران بیش از ده پلتفرم آنلاین فروش طلا وجود دارد (دیجی‌گلد، طلاین، تکنوگلد، میلی‌گلد و…) به‌همراه منابع نرخ بازار مانند TGJU و بن‌بست. هر کدام قیمت را در **قالب خودشان** اعلام می‌کنند (تومان یا ریال، هر گرم یا هر سکه، با مقیاس‌ها و ریتم‌های متفاوت)، بنابراین کاربر عملاً نمی‌تواند در یک نگاه بفهمد **همین حالا کجا ارزان‌تر است**. در یک اجرای واقعی، اختلاف بین بهترین و بدترین قیمت برای یک گرم طلای ۱۸ عیار حدود **۱۴٪** بود — پولی که به‌خاطر نبود شفافیت از دست می‌رود.

**طلافی این شکاف را می‌بندد:** همهٔ پلتفرم‌ها را در یک نمای نرمال‌شده، قابل‌مقایسه و همیشه به‌روز گرد می‌آورد و بهترین قیمت، اختلاف قیمت، شاخص حباب و امتیاز اعتماد را نشان می‌دهد.

### این پروژه چیست

یک سامانهٔ **دولایه**:

- **یک پلتفرم دادهٔ TypeScript** (`crawler-service/`، حدود ۱۲هزار خط) که هر ۳۰ ثانیه **۱۲ پلتفرم** را می‌خواند، همه را به **ریال بر گرم** نرمال می‌کند، **تشخیص ناهنجاری بین‌پلتفرمی** و **امتیازدهی اعتماد** انجام می‌دهد، تاریخچه را در SQLite ذخیره می‌کند و یک **REST API با ۴۷ اندپوینت** ارائه می‌دهد.
- **یک فرانت‌اند ایستا و دوزبانه (فارسی/انگلیسی)** با HTML/CSS/JS خالص (بدون build) که این API را می‌خواند و مقایسهٔ قیمت‌ها، داشبورد سیگنال سرمایه‌گذاری، صفحات اعتماد و **هشدارهای قیمت Web-Push** را نمایش می‌دهد.

> ساخته‌شده به‌صورت انفرادی و ۰→۱ با **رویکرد AI-native و اسپک‌محور** (Claude Code) — درحالی‌که معماری، قواعد کیفیت داده و مرزهای امنیتی توسط یک انسان تعیین شده‌اند.

### امکانات (تفکیک صادقانه)

**پلتفرم داده (پشتیبانی‌شده توسط بک‌اند):** مقایسهٔ ۱۲ پلتفرم · نرمال‌سازی ریال/گرم · تشخیص ناهنجاری قیمت · امتیاز اعتماد و نظرات · هشدار قیمت Web-Push · راهنمای سرمایه‌گذاری (سیگنال خرید/نگه‌داری/فروش) · شاخص حباب · تاریخچهٔ ۹۰ روزه.

**پروتوتایپ رابط کاربری (فقط فرانت‌اند):** ورود/ثبت‌نام · کیف پول · خرید سریع · حساب‌های متصل · پرداخت جهانی · داشبورد ادمین.

### اجرای محلی

```bash
git clone https://github.com/mahdincc/talafee.git
cd talafee/crawler-service && npm install && npm run build && npm start   # API روی :3001
# در ترمینال دیگر، از ریشهٔ مخزن:
npm install && npm run dev                                                # فرانت‌اند روی :3000
```

فرانت‌اند به‌طور خودکار آدرس API را تشخیص می‌دهد؛ با اجرای هم‌زمان هر دو، قیمت‌ها را بلافاصله می‌بینید.

> **وضعیت:** نمونهٔ production از سرویس خارج شده و پروژه در حال حاضر میزبانی نمی‌شود؛ همه‌چیز به‌صورت محلی از روی clone اجرا می‌شود و دموی عمومی زنده وجود ندارد.

### ساختار و مستندات

معماری، تصمیم‌های مهندسی و تفکر محصول در [`docs/`](docs/) و چک‌لیست‌های اسپک→ساخت در [`.claude/conventions/`](.claude/conventions/) مستند شده‌اند.

---

## License

[MIT](LICENSE) © Mahdi Aghakhani

## Contact

- **Repository:** [github.com/mahdincc/talafee](https://github.com/mahdincc/talafee)
- **Email:** aghaa.mahdi@gmail.com
- Run the frontend locally (steps above); a public GitHub Pages demo with sample data is planned.

<div align="center">
  <sub>Built for gold-price transparency in the Iranian market.</sub>
</div>
