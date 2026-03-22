# Talafee Affiliate System Documentation

> Revenue Model & Technical Implementation Guide

---

## Revenue Model Overview

### How Price Comparison Affiliate Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AFFILIATE FLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   User visits      User clicks       User redirected      User makes    │
│   Talafee     →    "Buy" button  →   to Provider with →   purchase      │
│                                      affiliate params                    │
│                                                                          │
│        ↓                ↓                   ↓                  ↓        │
│   [Compare]        [Track Click]      [Cookie Set]      [Commission]    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Commission Models for Gold Platforms

| Model | Description | Typical Rate | Best For |
|-------|-------------|--------------|----------|
| **CPS (Cost Per Sale)** | % of transaction value | 0.5% - 2% | High-volume platforms |
| **CPA (Cost Per Action)** | Flat fee per signup/trade | $5 - $50 | New user acquisition |
| **Revenue Share** | % of platform's commission | 15% - 25% | Long-term partnerships |
| **Hybrid** | CPA + Revenue Share | $10 + 0.5% | Premium partnerships |

### Estimated Revenue Potential

Based on industry benchmarks:

```
Monthly Visitors: 100,000
Click-through Rate: 5% = 5,000 clicks
Conversion Rate: 2% = 100 purchases
Average Order Value: 150,000,000 IRR (~$3,000 USD)
Commission Rate: 1%

Monthly Revenue: 100 × $3,000 × 1% = $3,000/month
```

---

## Technical Implementation

### 1. Affiliate Link Structure

#### Standard UTM Parameters

```
https://provider.com/buy?
  utm_source=talafee
  &utm_medium=affiliate
  &utm_campaign=gold_comparison
  &utm_content=buy_button
  &utm_term=18k_gold
  &ref=TALAFEE_PARTNER_ID
```

#### Parameter Definitions

| Parameter | Purpose | Example Value |
|-----------|---------|---------------|
| `utm_source` | Identifies Talafee as traffic source | `talafee` |
| `utm_medium` | Marketing channel type | `affiliate` |
| `utm_campaign` | Campaign identifier | `gold_comparison_2026` |
| `utm_content` | UI element clicked | `buy_button`, `card_click`, `table_row` |
| `utm_term` | Product type | `18k_gold`, `emami_coin` |
| `ref` | Partner/Affiliate ID | `TALAFEE001` |
| `click_id` | Unique click identifier | `uuid-v4` |

### 2. Provider Affiliate Configuration

```javascript
const AFFILIATE_CONFIG = {
  providers: {
    taline: {
      baseUrl: 'https://my.tlyn.ir',
      affiliateParam: 'ref',
      affiliateId: 'TALAFEE_TALINE_001',
      commission: { type: 'revenue_share', rate: 0.25 }, // 25% of their commission
      cookieDuration: 30, // days
      deepLinkSupport: true,
      buyPath: '/buy/gold-18k'
    },
    technogold: {
      baseUrl: 'https://app.technogold.gold',
      affiliateParam: 'partner',
      affiliateId: 'TALAFEE_TG_001',
      commission: { type: 'cps', rate: 0.01 }, // 1% of sale
      cookieDuration: 60,
      deepLinkSupport: true,
      buyPath: '/trade/buy'
    },
    zargold: {
      baseUrl: 'https://zargold.ir',
      affiliateParam: 'aff',
      affiliateId: 'TLF_ZG',
      commission: { type: 'cpa', amount: 500000 }, // 500,000 IRR per signup
      cookieDuration: 14,
      deepLinkSupport: false,
      buyPath: '/register'
    },
    // ... other providers
  }
};
```

### 3. Click Tracking System

#### Client-Side Tracking

```javascript
class AffiliateTracker {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.clicks = [];
  }

  generateClickId() {
    return 'clk_' + crypto.randomUUID();
  }

  generateSessionId() {
    return 'ses_' + crypto.randomUUID();
  }

  trackClick(provider, product, element) {
    const clickData = {
      clickId: this.generateClickId(),
      sessionId: this.sessionId,
      provider: provider,
      product: product,
      element: element, // 'buy_button', 'card', 'table_row'
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      page: window.location.pathname
    };

    this.clicks.push(clickData);
    this.sendToAnalytics(clickData);
    this.storeLocally(clickData);

    return clickData.clickId;
  }

  buildAffiliateUrl(provider, clickId) {
    const config = AFFILIATE_CONFIG.providers[provider.id];
    const url = new URL(config.baseUrl + config.buyPath);

    // Add UTM parameters
    url.searchParams.set('utm_source', 'talafee');
    url.searchParams.set('utm_medium', 'affiliate');
    url.searchParams.set('utm_campaign', 'gold_comparison_2026');
    url.searchParams.set('utm_content', 'buy_button');
    url.searchParams.set('utm_term', '18k_gold');

    // Add affiliate ID
    url.searchParams.set(config.affiliateParam, config.affiliateId);

    // Add click tracking
    url.searchParams.set('click_id', clickId);
    url.searchParams.set('timestamp', Date.now());

    return url.toString();
  }

  sendToAnalytics(data) {
    // Send to your analytics backend
    fetch('/api/analytics/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).catch(console.error);

    // Also send to Google Analytics 4
    if (window.gtag) {
      gtag('event', 'affiliate_click', {
        provider: data.provider,
        product: data.product,
        click_id: data.clickId
      });
    }
  }

  storeLocally(data) {
    const stored = JSON.parse(localStorage.getItem('talafee_clicks') || '[]');
    stored.push(data);
    // Keep only last 100 clicks
    if (stored.length > 100) stored.shift();
    localStorage.setItem('talafee_clicks', JSON.stringify(stored));
  }
}
```

### 4. Conversion Tracking

#### Postback URL (Server-to-Server)

Providers call this URL when a conversion happens:

```
GET https://api.talafee.ir/affiliate/postback?
  click_id={click_id}
  &transaction_id={provider_txn_id}
  &amount={sale_amount}
  &commission={commission_amount}
  &status={approved|pending|rejected}
  &timestamp={unix_timestamp}
  &signature={hmac_signature}
```

#### Conversion Verification

```javascript
// Server-side verification
function verifyPostback(params, secret) {
  const { click_id, transaction_id, amount, commission, status, timestamp, signature } = params;

  // Verify signature
  const payload = `${click_id}:${transaction_id}:${amount}:${timestamp}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  if (signature !== expectedSig) {
    throw new Error('Invalid signature');
  }

  // Verify click exists
  const click = await db.clicks.findOne({ clickId: click_id });
  if (!click) {
    throw new Error('Click not found');
  }

  // Record conversion
  await db.conversions.insert({
    clickId: click_id,
    transactionId: transaction_id,
    amount: parseFloat(amount),
    commission: parseFloat(commission),
    status: status,
    provider: click.provider,
    convertedAt: new Date(timestamp * 1000)
  });

  return { success: true };
}
```

---

## Database Schema

### Clicks Table

```sql
CREATE TABLE affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id VARCHAR(50) UNIQUE NOT NULL,
  session_id VARCHAR(50) NOT NULL,
  provider_id VARCHAR(50) NOT NULL,
  product_type VARCHAR(50),
  element_clicked VARCHAR(50),
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  page_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  INDEX idx_click_id (click_id),
  INDEX idx_provider (provider_id),
  INDEX idx_created_at (created_at)
);
```

### Conversions Table

```sql
CREATE TABLE affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  click_id VARCHAR(50) REFERENCES affiliate_clicks(click_id),
  provider_id VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(100),
  sale_amount DECIMAL(20, 2),
  commission_amount DECIMAL(20, 2),
  currency VARCHAR(3) DEFAULT 'IRR',
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  INDEX idx_click_id (click_id),
  INDEX idx_status (status),
  INDEX idx_converted_at (converted_at)
);
```

### Provider Partners Table

```sql
CREATE TABLE affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id VARCHAR(50) UNIQUE NOT NULL,
  provider_name VARCHAR(100) NOT NULL,
  affiliate_id VARCHAR(100),
  commission_type VARCHAR(20), -- cps, cpa, revenue_share, hybrid
  commission_rate DECIMAL(5, 4),
  commission_flat DECIMAL(20, 2),
  cookie_duration_days INTEGER DEFAULT 30,
  postback_url TEXT,
  api_key VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Analytics Dashboard Metrics

### Key Performance Indicators (KPIs)

| Metric | Formula | Target |
|--------|---------|--------|
| **CTR** | Clicks / Impressions × 100 | > 5% |
| **Conversion Rate** | Conversions / Clicks × 100 | > 2% |
| **EPC** | Total Commission / Clicks | > $0.50 |
| **RPM** | Revenue / 1000 Visitors | > $150 |
| **AOV** | Total Sales / Conversions | Platform dependent |

### Revenue Attribution

```
By Provider:
├── Taline:      35% of revenue
├── Technogold:  25% of revenue
├── ZarGold:     15% of revenue
└── Others:      25% of revenue

By Product:
├── 18K Gold:    60% of revenue
├── Coins:       30% of revenue
└── Other:       10% of revenue

By Element:
├── Buy Button:  70% of clicks
├── Card Click:  20% of clicks
└── Table Row:   10% of clicks
```

---

## Legal & Compliance

### Required Disclosures

```html
<!-- Footer disclosure -->
<p class="affiliate-disclosure">
  این وبسایت از لینک‌های همکاری در فروش استفاده می‌کند.
  در صورت خرید از طریق این لینک‌ها، ما کمیسیون دریافت می‌کنیم.
  این امر تأثیری بر قیمت شما ندارد.
</p>

<!-- English version -->
<p class="affiliate-disclosure">
  This website uses affiliate links. We may earn a commission
  if you make a purchase through these links at no extra cost to you.
</p>
```

### Data Privacy (GDPR/Local Laws)

- Obtain consent before tracking
- Allow users to opt-out
- Don't store PII without consent
- Anonymize IP addresses
- Provide data deletion on request

---

## Integration Checklist

### Per-Provider Setup

- [ ] Sign affiliate agreement
- [ ] Obtain affiliate/partner ID
- [ ] Get API credentials (if available)
- [ ] Configure postback URL
- [ ] Test tracking end-to-end
- [ ] Verify commission calculations
- [ ] Set up payment method

### Technical Setup

- [ ] Implement click tracking
- [ ] Set up analytics events
- [ ] Configure UTM parameters
- [ ] Create postback endpoint
- [ ] Set up conversion database
- [ ] Build reporting dashboard
- [ ] Test in staging environment
- [ ] Deploy to production

---

## Revenue Optimization Tips

1. **A/B Test Button Copy**: "خرید" vs "خرید فوری" vs "بهترین قیمت"
2. **Highlight Best Deal**: Users convert 40% more on highlighted providers
3. **Add Urgency**: "قیمت ۵ دقیقه پیش" creates FOMO
4. **Mobile Optimization**: 50%+ traffic is mobile
5. **Trust Signals**: Show provider ratings and reviews
6. **Price Alerts**: Users who set alerts convert 3x more

---

*Affiliate System Documentation v1.0 - Talafee*
