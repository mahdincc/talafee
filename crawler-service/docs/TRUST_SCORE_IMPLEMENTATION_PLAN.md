# Provider Trust Score & Reviews System - Implementation Plan

## Overview

A comprehensive trust and reputation system for Talafee's 12 gold price providers, enabling users to make informed decisions about which providers to trust for their gold transactions.

## Research Summary

### Industry Best Practices (from online research)

1. **Trust Score Algorithms**
   - Multi-factor weighted scoring (price accuracy, uptime, user reviews)
   - Time-decay for older data (recent performance weighted more)
   - AI-powered anomaly detection for suspicious patterns

2. **Fake Review Detection**
   - NFS (Network Footprint Score) - identifies spammer groups
   - Behavioral analysis (review timing, sentiment patterns)
   - Verified purchase requirements

3. **Trust Badges & Verification**
   - Third-party verification badges
   - Transaction history verification
   - Security certification indicators

4. **Price Accuracy Tracking**
   - Deviation from market average
   - Spread analysis (buy/sell difference)
   - Latency monitoring (price update freshness)

---

## Architecture Integration

### Existing Talafee Components

```
Providers (12) → CrawlPipeline → Sinks (SQLite, Cache)
                                    ↓
                              API Routes → Frontend
```

### New Trust System Components

```
Providers (12) → CrawlPipeline → Sinks
                    ↓               ↓
            PriceAccuracyTracker → TrustScoreService → TrustSink (SQLite)
                                        ↓
                              API Routes (/api/v1/trust) → Frontend (trust.html)
                                        ↑
                              ReviewService ← User Reviews
```

---

## Database Schema

### New Tables (extend SqliteSink.ts)

```sql
-- Provider trust scores (calculated daily)
CREATE TABLE IF NOT EXISTS provider_trust_scores (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  overall_score REAL NOT NULL,           -- 0-100
  price_accuracy_score REAL NOT NULL,    -- 0-100
  uptime_score REAL NOT NULL,            -- 0-100
  review_score REAL NOT NULL,            -- 0-100
  freshness_score REAL NOT NULL,         -- 0-100 (price update latency)
  calculated_at DATETIME NOT NULL,
  factors_json TEXT,                     -- JSON with detailed breakdown
  UNIQUE(provider_id, calculated_at)
);

-- User reviews
CREATE TABLE IF NOT EXISTS provider_reviews (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  user_id TEXT,                          -- Optional (anonymous allowed)
  user_fingerprint TEXT NOT NULL,        -- Browser fingerprint for spam prevention
  rating INTEGER NOT NULL,               -- 1-5 stars
  title TEXT,
  content TEXT,
  pros TEXT,                             -- JSON array
  cons TEXT,                             -- JSON array
  transaction_verified BOOLEAN DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',          -- active, hidden, flagged
  created_at DATETIME NOT NULL,
  updated_at DATETIME
);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_votes (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL,
  user_fingerprint TEXT NOT NULL,
  vote_type TEXT NOT NULL,               -- helpful, not_helpful, report
  created_at DATETIME NOT NULL,
  UNIQUE(review_id, user_fingerprint)
);

-- Provider badges/certifications
CREATE TABLE IF NOT EXISTS provider_badges (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  badge_type TEXT NOT NULL,              -- verified, fast_delivery, best_price, etc.
  badge_label TEXT NOT NULL,
  badge_label_fa TEXT NOT NULL,          -- Persian label
  description TEXT,
  description_fa TEXT,
  awarded_at DATETIME NOT NULL,
  expires_at DATETIME,
  auto_generated BOOLEAN DEFAULT 1,      -- System-generated vs manual
  UNIQUE(provider_id, badge_type)
);

-- Price accuracy history (for tracking)
CREATE TABLE IF NOT EXISTS price_accuracy_log (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  provider_price REAL NOT NULL,
  market_average REAL NOT NULL,
  deviation_percent REAL NOT NULL,
  logged_at DATETIME NOT NULL
);

-- Provider warnings/alerts
CREATE TABLE IF NOT EXISTS provider_warnings (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  warning_type TEXT NOT NULL,            -- price_anomaly, extended_downtime, user_reports
  severity TEXT NOT NULL,                -- low, medium, high, critical
  message TEXT NOT NULL,
  message_fa TEXT NOT NULL,
  active BOOLEAN DEFAULT 1,
  created_at DATETIME NOT NULL,
  resolved_at DATETIME
);

-- Indexes for performance
CREATE INDEX idx_trust_scores_provider ON provider_trust_scores(provider_id);
CREATE INDEX idx_reviews_provider ON provider_reviews(provider_id);
CREATE INDEX idx_reviews_status ON provider_reviews(status);
CREATE INDEX idx_accuracy_provider_date ON price_accuracy_log(provider_id, logged_at);
CREATE INDEX idx_warnings_active ON provider_warnings(provider_id, active);
```

---

## Core Services

### 1. TrustScoreService (`src/services/TrustScoreService.ts`)

```typescript
interface TrustScoreConfig {
  weights: {
    priceAccuracy: number;    // 0.35 - Most important
    uptime: number;           // 0.25
    reviews: number;          // 0.20
    freshness: number;        // 0.20
  };
  thresholds: {
    excellentScore: number;   // 85+
    goodScore: number;        // 70+
    fairScore: number;        // 50+
    // Below 50 = poor
  };
  priceAccuracy: {
    tolerancePercent: number; // 2% deviation acceptable
    sampleSize: number;       // Last 100 price checks
  };
}

interface ProviderTrustScore {
  providerId: string;
  providerName: string;
  overallScore: number;
  tier: 'excellent' | 'good' | 'fair' | 'poor';
  breakdown: {
    priceAccuracy: { score: number; details: string };
    uptime: { score: number; details: string };
    reviews: { score: number; details: string };
    freshness: { score: number; details: string };
  };
  badges: Badge[];
  warnings: Warning[];
  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: Date;
}

class TrustScoreService {
  // Singleton pattern (like BubbleService)
  private static instance: TrustScoreService;

  // Core methods
  calculateProviderScore(providerId: string): Promise<ProviderTrustScore>;
  getAllProviderScores(): Promise<ProviderTrustScore[]>;
  getProviderRanking(): Promise<ProviderTrustScore[]>;
  updateAllScores(): Promise<void>;  // Called by scheduler

  // Score components
  private calculatePriceAccuracyScore(providerId: string): Promise<number>;
  private calculateUptimeScore(providerId: string): Promise<number>;
  private calculateReviewScore(providerId: string): Promise<number>;
  private calculateFreshnessScore(providerId: string): Promise<number>;

  // Badge management
  evaluateBadges(providerId: string): Promise<Badge[]>;
  private checkBestPriceBadge(providerId: string): Promise<boolean>;
  private checkFastUpdateBadge(providerId: string): Promise<boolean>;
  private checkHighRatedBadge(providerId: string): Promise<boolean>;
}
```

### 2. ReviewService (`src/services/ReviewService.ts`)

```typescript
interface ReviewSubmission {
  providerId: string;
  rating: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  userFingerprint: string;
}

interface ReviewFilters {
  rating?: number;
  sortBy?: 'recent' | 'helpful' | 'rating_high' | 'rating_low';
  verified?: boolean;
}

class ReviewService {
  // Singleton pattern
  private static instance: ReviewService;

  // CRUD
  submitReview(review: ReviewSubmission): Promise<Review>;
  getProviderReviews(providerId: string, filters?: ReviewFilters): Promise<Review[]>;
  voteReview(reviewId: string, fingerprint: string, type: 'helpful' | 'report'): Promise<void>;

  // Spam detection
  private validateReview(review: ReviewSubmission): ValidationResult;
  private checkSpamPatterns(content: string): boolean;
  private checkRateLimiting(fingerprint: string): boolean;

  // Stats
  getProviderReviewStats(providerId: string): Promise<ReviewStats>;
}
```

### 3. PriceAccuracyTracker (`src/services/PriceAccuracyTracker.ts`)

```typescript
class PriceAccuracyTracker {
  // Integrated into ApiCacheSink.onPricesFetched()

  trackPriceDeviation(
    providerId: string,
    productId: string,
    price: number,
    marketAverage: number
  ): Promise<void>;

  getProviderAccuracyHistory(
    providerId: string,
    days: number
  ): Promise<AccuracyRecord[]>;

  getAverageDeviation(providerId: string): Promise<number>;

  detectPriceAnomalies(providerId: string): Promise<Anomaly[]>;
}
```

---

## API Endpoints

### New Routes (`src/api/routes/trust.ts`)

```typescript
// Trust scores
GET  /api/v1/trust/scores                  // All provider scores
GET  /api/v1/trust/scores/:providerId      // Single provider score
GET  /api/v1/trust/ranking                 // Providers ranked by score
GET  /api/v1/trust/comparison              // Side-by-side comparison

// Reviews
GET  /api/v1/trust/reviews/:providerId     // Provider reviews
POST /api/v1/trust/reviews                 // Submit review
POST /api/v1/trust/reviews/:reviewId/vote  // Vote helpful/report

// Badges & Warnings
GET  /api/v1/trust/badges/:providerId      // Provider badges
GET  /api/v1/trust/warnings                // Active warnings (all)
GET  /api/v1/trust/warnings/:providerId    // Provider warnings

// Price accuracy
GET  /api/v1/trust/accuracy/:providerId    // Price accuracy history
GET  /api/v1/trust/accuracy/summary        // All providers accuracy summary
```

### Response Examples

```json
// GET /api/v1/trust/scores/taline
{
  "success": true,
  "data": {
    "providerId": "taline",
    "providerName": "Taline",
    "overallScore": 87.5,
    "tier": "excellent",
    "breakdown": {
      "priceAccuracy": {
        "score": 92,
        "details": "Averages 0.8% deviation from market"
      },
      "uptime": {
        "score": 95,
        "details": "99.2% uptime in last 30 days"
      },
      "reviews": {
        "score": 78,
        "details": "4.2/5 from 156 reviews"
      },
      "freshness": {
        "score": 85,
        "details": "Updates every 15 seconds avg"
      }
    },
    "badges": [
      {
        "type": "verified",
        "label": "Verified Provider",
        "labelFa": "ارائه‌دهنده تایید شده"
      },
      {
        "type": "best_accuracy",
        "label": "Best Price Accuracy",
        "labelFa": "دقیق‌ترین قیمت"
      }
    ],
    "warnings": [],
    "trend": "stable",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}

// GET /api/v1/trust/reviews/taline
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "rev_123",
        "rating": 5,
        "title": "Excellent service",
        "content": "Fast updates and accurate prices...",
        "pros": ["Fast updates", "Accurate prices"],
        "cons": ["Limited product range"],
        "verified": true,
        "helpfulCount": 24,
        "createdAt": "2024-01-10T15:00:00Z"
      }
    ],
    "stats": {
      "totalReviews": 156,
      "averageRating": 4.2,
      "distribution": {
        "5": 78,
        "4": 45,
        "3": 20,
        "2": 8,
        "1": 5
      }
    },
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 156
    }
  }
}
```

---

## Frontend Components

### New Page: `trust.html`

```
+------------------------------------------------------------------+
|  TALAFEE - Provider Trust & Reviews                              |
+------------------------------------------------------------------+
|                                                                  |
|  [Provider Rankings]                                             |
|  +------------------------------------------------------------+  |
|  | Rank | Provider    | Score | Badges        | Reviews       |  |
|  |------------------------------------------------------------|  |
|  | 1    | Taline      | 87.5  | [V] [A] [F]   | ★★★★☆ (156)   |  |
|  | 2    | TechnoGold  | 85.2  | [V] [A]       | ★★★★☆ (89)    |  |
|  | 3    | DigiGold    | 82.1  | [V]           | ★★★★☆ (234)   |  |
|  | ...  |             |       |               |                |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  [Provider Detail Panel] (click to expand)                       |
|  +------------------------------------------------------------+  |
|  | TALINE                                    Overall: 87.5/100|  |
|  |------------------------------------------------------------|  |
|  | Trust Score Breakdown:                                      |  |
|  | [====Price Accuracy: 92%====]                              |  |
|  | [======Uptime: 95%=========]                               |  |
|  | [====Reviews: 78%====]                                     |  |
|  | [=====Freshness: 85%======]                                |  |
|  |                                                             |  |
|  | Badges: [✓ Verified] [🎯 Best Accuracy] [⚡ Fast Updates]  |  |
|  |                                                             |  |
|  | Price Accuracy Trend:                                       |  |
|  | [Chart showing deviation over time]                         |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  [Reviews Section]                                               |
|  +------------------------------------------------------------+  |
|  | Reviews for Taline                    [Write a Review]     |  |
|  |------------------------------------------------------------|  |
|  | ★★★★★  "Excellent service"                     24 helpful  |  |
|  | Fast updates and accurate prices. I've been using...       |  |
|  | ✓ Verified  |  2 days ago                                  |  |
|  |------------------------------------------------------------|  |
|  | ★★★★☆  "Good but limited products"             12 helpful  |  |
|  | Great for gold prices but wish they had more...            |  |
|  | 5 days ago                                                  |  |
|  +------------------------------------------------------------+  |
|                                                                  |
+------------------------------------------------------------------+
```

### JavaScript Module: `trust-client.js`

```javascript
class TrustClient {
  constructor(apiBase) {
    this.apiBase = apiBase;
  }

  // Fetch methods
  async getProviderScores() { }
  async getProviderScore(providerId) { }
  async getProviderReviews(providerId, filters) { }
  async submitReview(review) { }
  async voteReview(reviewId, type) { }

  // UI helpers
  renderScoreGauge(score, containerId) { }
  renderBadges(badges, containerId) { }
  renderReviewStars(rating) { }
  renderTrend(trend) { }
}
```

---

## Badge Types

| Badge Type | Criteria | Icon | Label (EN) | Label (FA) |
|------------|----------|------|------------|------------|
| verified | Manual verification | ✓ | Verified Provider | ارائه‌دهنده تایید شده |
| best_accuracy | Top 3 price accuracy | 🎯 | Best Accuracy | دقیق‌ترین قیمت |
| fast_updates | < 20s avg update time | ⚡ | Fast Updates | به‌روزرسانی سریع |
| high_rated | 4.5+ avg rating | ⭐ | Highly Rated | امتیاز بالا |
| reliable | 99%+ uptime (30 days) | 🛡️ | Reliable | قابل اعتماد |
| best_spread | Lowest buy/sell spread | 💰 | Best Spread | کمترین اختلاف قیمت |

---

## Warning Types

| Warning Type | Trigger | Severity | Action |
|--------------|---------|----------|--------|
| price_anomaly | >5% deviation from average | medium | Alert users |
| extended_downtime | >1 hour offline | high | Show warning |
| user_reports | >10 spam reports | high | Review required |
| stale_prices | No update >10 min | low | Show indicator |
| negative_trend | Score dropped >10 pts | medium | Monitor |

---

## Integration Points

### 1. Scheduler Integration (`src/core/Scheduler.ts`)

```typescript
// Add daily trust score calculation job
this.jobs.push({
  name: 'trust-score-calculation',
  cron: '0 0 * * *',  // Daily at midnight
  handler: () => getTrustScoreService().updateAllScores()
});
```

### 2. ApiCacheSink Integration (`src/sinks/ApiCacheSink.ts`)

```typescript
async onPricesFetched(providerId: string, prices: NormalizedPrice[], correlationId: string): Promise<void> {
  // Existing cache logic...

  // Track price accuracy
  const tracker = getPriceAccuracyTracker();
  for (const price of prices) {
    const marketAvg = this.calculateMarketAverage(price.productId);
    await tracker.trackPriceDeviation(providerId, price.productId, price.avgPrice, marketAvg);
  }
}
```

### 3. Server Routes (`src/api/server.ts`)

```typescript
import { trustRouter } from './routes/trust.js';

// Add to route registration
app.use('/api/v1/trust', trustRouter);
```

### 4. Index.html Integration

```html
<!-- Add trust indicator to provider cards -->
<div class="provider-trust-badge">
  <span class="trust-score">87.5</span>
  <span class="trust-tier excellent">Excellent</span>
</div>
```

---

## Implementation Phases

### Phase 1: Database & Core Service (Week 1)
- [ ] Extend SqliteSink with new tables
- [ ] Create TrustScoreService skeleton
- [ ] Implement PriceAccuracyTracker
- [ ] Add basic uptime tracking

### Phase 2: Trust Score Calculation (Week 2)
- [ ] Implement price accuracy scoring
- [ ] Implement uptime scoring
- [ ] Implement freshness scoring
- [ ] Add badge evaluation logic
- [ ] Create scheduler job for daily updates

### Phase 3: Review System (Week 2-3)
- [ ] Create ReviewService
- [ ] Implement spam detection
- [ ] Add review API endpoints
- [ ] Build review submission form

### Phase 4: API & Frontend (Week 3-4)
- [ ] Create trust API routes
- [ ] Build trust.html page
- [ ] Create trust-client.js
- [ ] Integrate badges into index.html
- [ ] Add warning indicators

### Phase 5: Polish & Testing (Week 4)
- [ ] Add comprehensive tests
- [ ] Performance optimization
- [ ] Mobile responsive design
- [ ] Documentation

---

## File Changes Summary

### New Files
```
crawler-service/src/services/TrustScoreService.ts
crawler-service/src/services/ReviewService.ts
crawler-service/src/services/PriceAccuracyTracker.ts
crawler-service/src/api/routes/trust.ts
talafee/trust.html
talafee/assets/js/trust-client.js
talafee/assets/css/trust.css
```

### Modified Files
```
crawler-service/src/sinks/SqliteSink.ts      # Add new tables
crawler-service/src/sinks/ApiCacheSink.ts    # Price tracking integration
crawler-service/src/core/Scheduler.ts        # Add trust score job
crawler-service/src/api/server.ts            # Register trust routes
crawler-service/src/api/routes/index.ts      # Export trust router
talafee/index.html                           # Add trust badges to cards
talafee/assets/css/style.css                 # Trust badge styles
```

---

## Success Metrics

1. **Trust Score Accuracy**: Correlation between score and user satisfaction
2. **Review Engagement**: Reviews submitted per week
3. **Badge Distribution**: Fair distribution across providers
4. **User Trust**: Click-through rate on high-scored providers
5. **Spam Prevention**: Fake review detection rate

---

## Revenue Opportunities

1. **Featured Listings**: Providers pay for homepage visibility
2. **Verification Service**: Manual verification badge (paid)
3. **Analytics Dashboard**: Detailed trust metrics for providers
4. **API Access**: Premium API for trust data

---

## Security Considerations

1. **Rate Limiting**: Max 5 reviews per fingerprint per day
2. **Content Sanitization**: XSS prevention in review content
3. **Spam Detection**: ML-based spam classification
4. **Data Privacy**: No PII stored, fingerprints hashed
