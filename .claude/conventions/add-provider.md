# Adding a new gold provider

> Use when adding a new Iranian gold trading platform (e.g. `someprovider.ir`) to the crawler. Read [`../../CLAUDE.md`](../../CLAUDE.md) and [`commit.md`](commit.md) first.

A provider ships in **four** places that all share the same `id` string (e.g. `wallgold`, `taline`). Get the id right once; everything else keys off it.

## Step 0 — pick the id

Lowercase, no spaces/hyphens unless the existing pattern has them (`tala-bazar`, `zar-exchange` use hyphens because they were named that way; new providers should prefer the single-word form). Avoid camelCase.

The id must match across:

1. `config/providers.json` → `providers.<id>.id`
2. `crawler-service/config/crawler.config.ts` → `providers.<id>.id`
3. `crawler-service/src/providers/<ClassName>Provider.ts` → `providerId = '<id>'`
4. `assets/images/providers/<id>.svg` → the logo file name

## Step 1 — capture the upstream API

Either the provider has a public JSON endpoint (`https://api.foo.ir/v1/prices`), or you'll need to inspect their frontend.

- If JSON: hit it with `curl` once and save the response shape mentally. Note: do they price per gram, per mesghal, in Rials, in Tomans?
- If they ship HTML or a non-standard format: still doable, but extra scraping logic goes in the provider's `doFetch`.
- If they require auth (JWT/CSRF/signed headers): use one of the existing strategies in `crawler-service/src/auth/` (`NoAuthStrategy`, `CustomHeadersStrategy`, `JwtCsrfStrategy`, `SignatureStrategy`) or add a new one if none fits.

**Don't commit `.har` files** from devtools captures — they often contain bearer tokens.

## Step 2 — add backend config

`crawler-service/config/crawler.config.ts`, in `providers`:

```ts
'<id>': {
  id: '<id>',
  name: '<DisplayName>',
  enabled: true,
  apiUrl: 'https://api.<provider>.ir/...',
  timeout: 10000,
  rateLimit: { maxConcurrent: 1, minDelayMs: 1000 },
},
```

Bump `timeout` only if the provider is verifiably slow (> 8s p95). Aggressive timeouts mask their flakiness in our health metrics, which is good.

## Step 3 — create the provider class

`crawler-service/src/providers/<ClassName>Provider.ts`:

```ts
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

const SYMBOL_TO_PRODUCT: Record<string, ProductId> = {
  // map their internal symbol → our canonical product id
  GOLD18: '18k-gold',
  // ...
};

export class FooProvider extends BaseProvider {
  readonly providerId = 'foo';
  readonly name = 'Foo';

  constructor() {
    super('foo');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const data = await this.makeRequest<TheirResponseType>(
      this.providerConfig.apiUrl,
      { method: 'GET', headers: { /* if needed */ } },
      correlationId,
    );

    const prices: NormalizedPrice[] = [];
    for (const item of data.items) {
      const productId = SYMBOL_TO_PRODUCT[item.symbol];
      if (!productId) continue;

      // Pass raw numbers in. BaseProvider's createNormalizedPrice runs them
      // through normalizePriceToRials, which rescales to Rials based on the
      // expected per-product magnitude. Don't pre-multiply by 10 / 1000.
      prices.push(this.createNormalizedPrice({
        productId,
        rawBuy: item.buy,
        rawSell: item.sell,
        providerUpdatedAt: new Date(item.timestamp),
      }));
    }

    return prices;
  }
}
```

### Critical: pricing & scale

This is the single most common bug. **Every Iranian gold API uses a different convention** — some return Rials per gram, some Tomans per gram, some Tomans per mesghal, some Rials × 10. `normalizePriceToRials` in `crawler-service/src/utils/priceNormalizer.ts` handles the rescaling by checking the magnitude against an expected range per product. **Always pass the raw API number in** — do not multiply, do not divide. If the rescaler doesn't recognise the magnitude it'll log a warning and you'll need to extend the expected ranges, not hack the provider.

### Critical: per-gram vs per-piece

Coins (`emami-coin`, `half-coin`, `quarter-coin`, `bahar-azadi`, `gram-coin`) are **per piece**. Gold (`18k-gold`, `24k-gold`, `gold-bar`) is **per gram**. `mesghal` is per mesghal (4.6083 g). The normaliser handles the unit assumption per product id — don't try to "convert to grams" yourself.

## Step 4 — register the provider

`crawler-service/src/providers/index.ts`: add the export, import, and two case lines in `createAllProviders()` and `createProviderById()`. Both lists must include it.

## Step 5 — add frontend metadata

`config/providers.json`, in `providers`:

```json
"foo": {
  "id": "foo",
  "name": { "fa": "<نام فارسی>", "en": "Foo" },
  "shortName": "FO",
  "url": "https://foo.ir",
  "apiUrl": "https://api.foo.ir/...",
  "logo": "/assets/images/providers/foo.svg",
  "color": "#XXXXXX",
  "features": ["instant-buy", "wallet"],
  "tradingHours": { "start": "09:00", "end": "22:00", "timezone": "Asia/Tehran" },
  "affiliate": { "enabled": false },
  "products": ["18k-gold", "emami-coin"]
}
```

Only list `products` the provider actually returns prices for — don't aspirational-list.

## Step 6 — add the logo

`assets/images/providers/<id>.svg` — vector, square, brand colours. The existing `wallgold.svg` is a small reference. If you don't have one yet, copy `wallgold.svg` to a placeholder; the user will replace it.

## Step 7 — local verification

```bash
cd crawler-service
npm run build           # zero TS errors
npm start &             # or `npm run dev` for watch mode
sleep 35                # let one crawl cycle run
curl -s http://localhost:3001/api/v1/health | jq '.providers[] | select(.id=="foo")'
```

Expected:
- `status: "healthy"`
- `consecutiveFailures: 0`
- `successRate24h` close to 100%

If `priceCount` is 0 in the journal, your symbol mapping is wrong. If the rescaler logs `Rescaled price to expected magnitude {... buyScale: 10}` you're fine — that's the normaliser doing its job. If it logs a *warning* about an unexpected magnitude, fix the rescaler ranges, not the provider.

## Step 8 — commit

```
feat: add Foo (foo.ir) provider
```

See [`commit.md`](commit.md) for the full message rules.

## Step 9 — handoff

Tell the user the short SHA. The deploy chat will push + redeploy. After redeploy, hit `http://185.231.182.111/api/v1/health` and confirm the new provider appears.
