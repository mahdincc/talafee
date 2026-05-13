# Talafee Trading Guide — KPI Framework

The guide page (`guide.html`) renders a 7-indicator dashboard that condenses
global gold-research best practice into one composite **buy / hold / sell**
recommendation, with each KPI also visible on its own card so the user can see
*why* the signal lit up.

This document records: the research that drives the choice of indicators, the
buy/hold/sell thresholds, the composite weighting, and how to feed live data
into the macro KPIs that aren't derivable from local provider prices.

---

## 1. Research foundation

| Source | Contribution |
|---|---|
| **World Gold Council** (Gold Outlook, GRAM, Qaurum) | Decomposes monthly gold returns into *Economic Expansion, Risk & Uncertainty, Opportunity Cost, Momentum*. Anchors our use of real yields, DXY, and trend filters. |
| **McKinsey Precious Metals Insights** | Frames gold around central-bank de-dollarization, ETF flows, EM jewelry demand; emphasizes macro + supply-curve drivers. |
| **Goldman Sachs / JP Morgan commodity research** | Quantified sensitivities (e.g. ~60 t ETF demand per 25 bp Fed cut; >350 t/quarter central-bank demand needed for upward price moves). |
| **Incrementum — In Gold We Trust 2025 ("The Big Long")** | Long-horizon valuation framework citing M2, debt/GDP, central-bank reserves. Validates the macro-overlay approach. |
| **LBMA Alchemist** | Empirical sensitivities: +100 bp 10y TIPS ≈ −$173 gold; +1 pt DXY ≈ −$10 gold; gold/DXY correlation ≈ −0.75. |
| **CFTC Commitments of Traders (COT)** | Weekly managed-money positioning, used as a contrarian sentiment gauge. |
| **Alanchand / Euronews Iran coverage** | Local "حباب" (bubble) calculation methodology for Bahar Azadi / Emami coins. |

Bibliography (live URLs as of build):
- https://www.gold.org/goldhub/research/gold-outlook-2026
- https://www.gold.org/goldhub/research/gold-demand-trends/gold-demand-trends-full-year-2025
- https://www.mckinsey.com/featured-insights/week-in-charts/precious-metals-rally-amid-market-volatility
- https://www.jpmorgan.com/insights/global-research/commodities/gold-prices
- https://ingoldwetrust.report/wp-content/uploads/2025/05/In-Gold-We-Trust-Report-2025-Compact-Version-english.pdf
- https://www.lbma.org.uk/alchemist/issue-90/an-update-on-gold-real-interest-rates-and-the-dollar
- https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- https://alanchand.com/en/how_to_calculate_gold_bubble

---

## 2. The 7 KPIs

| # | KPI (FA / EN) | What it measures | Buy / Hold / Sell | Weight | Data source |
|---|---|---|---|---|---|
| 1 | **حباب سکه** (Coin Bubble %) | Premium of local price over (XAU × USD/IRR × purity) | ≤3 / 3–10 / ≥10 | **25%** | `BubbleService` (live) |
| 2 | **مومنتوم دلار (۳۰ روزه)** | 30-day % change in USD/IRR | ≥+5 / ±5 / ≤−5 | **20%** | TGJU / Bonbast (TBD) |
| 3 | **روند طلای جهانی** | XAU/USD vs 50/200-DMA (golden-cross filter) | golden-cross / sideways / death-cross | **15%** | LBMA / WGC (TBD) |
| 4 | **RSI-14** | Momentum oscillator on local 18k history | <30 / 30–70 / >70 | **10%** | Talafee price history (live) |
| 5 | **بازده حقیقی ۱۰ ساله آمریکا** (TIPS) | Opportunity cost of holding gold | <0.5% / 0.5–1.5% / >1.5% | **10%** | FRED `DFII10` (TBD) |
| 6 | **DXY** | US Dollar Index — inverse driver | <100 / 100–105 / >105 | **10%** | ICE / TradingView (TBD) |
| 7 | **COT Net-Long (managed money)** | Sentiment / crowded-trade gauge | <30th pct / 30–90 / >90 (contrarian) | **10%** | CFTC weekly COT (TBD) |

KPIs marked **(TBD)** fall back to neutral "hold" with an `isStale: true` flag
on the card until a feed is wired up. The UI shows a "داده در انتظار" badge so
the user knows that signal is not contributing real information.

---

## 3. Composite scoring

Each KPI emits a discrete score: **−1** (sell) · **0** (hold) · **+1** (buy).

```
composite = Σ(weight_i × score_i),  Σ weight_i = 1.0
```

Mapping to the headline badge:

| Composite range | Badge |
|---|---|
| `composite ≥ +0.4` | **خرید (BUY)** — green |
| `−0.4 < composite < +0.4` | **نگهداری (HOLD)** — amber |
| `composite ≤ −0.4` | **فروش (SELL)** — red |

`confidence = round(|composite| × 100)`, capped at 100.

The bands are deliberately wide. With seven KPIs each carrying ≤25% weight,
crossing ±0.4 means a clear majority of signals (and at least one of the two
heavyweight indicators — bubble or USD/IRR momentum) are aligned. This avoids
flip-flopping on small day-to-day moves.

---

## 4. Feeding the macro KPIs

Until live feeds are integrated, an admin/cron can post macro values to:

```
PUT /api/v1/guide/macro
Content-Type: application/json

{
  "globalGoldOuncePrice50dma": 2640,
  "globalGoldOuncePrice200dma": 2510,
  "realUsYield10y": 1.85,
  "dxy": 103.2,
  "cotNetLongPercentile": 78,
  "usdIrrMomentum30d": 4.3,
  "source": "manual-2026-04-27"
}
```

All fields are optional partial-updates. Values are held in memory on the
`InvestmentGuideService` singleton. A future task: wire these to scheduled
crawlers (FRED, ICE, CFTC, TGJU).

---

## 5. API contract

### `GET /api/v1/guide/kpi-dashboard`

```ts
{
  recommendation: 'buy' | 'hold' | 'sell',
  recommendationFa: string,
  compositeScore: number,    // -1..+1
  confidence: number,         // 0..100
  headline: string,           // Persian one-liner
  headlineEn: string,
  kpis: KpiCard[],            // 7 cards (see InvestmentGuideService.ts)
  lastUpdated: ISO date,
}
```

Each `KpiCard` carries: `id`, `title` (FA/EN), `value`, `display`, `unit`,
`signal`, `signalLabel` (FA/EN), `thresholds`, `visualRange`, `weight`,
`rationale` (FA/EN), `source`, `isStale`. The frontend uses `visualRange` and
`thresholds` to position the gauge marker and color the band edges.

---

## 6. Why these KPIs (and not others)

- **Why not just RSI/MACD?** Pure technicals on local rial-denominated prices
  drift with FX moves, not real gold demand. The bubble + USD/IRR momentum
  pair captures local price action far more honestly.
- **Why include DXY *and* real yields?** They're correlated but not redundant:
  real yields are the cleanest "opportunity cost" reading; DXY captures FX
  flow regimes (carry trade, EM stress) that yields don't.
- **Why COT instead of ETF flows?** ETF flows are a strong signal for WGC, but
  CFTC COT is published weekly (vs. monthly demand reports) and is free —
  better cadence/cost trade-off for a retail dashboard.
- **Why a 25% bubble weight (vs. WGC ~30% on bubble equivalents)?** Iranian
  retail users care about the local arbitrage opportunity above all else. The
  bubble is the single most actionable signal — but capping it at 25% prevents
  a single noisy reading from dominating the recommendation.

---

## 7. Operational notes

- The composite is recomputed every page load and the UI polls every 60 s.
- Backend caches the bubble/RSI computation; macro values live in memory.
- Do **not** treat the composite as a trading signal in the regulated sense —
  it is an educational summary. The disclaimer on the page reflects this.
