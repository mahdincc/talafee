import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface TGJUProductConfig {
  selector: string;
  pattern: RegExp;
  productId: ProductId;
  priceType: 'gold' | 'coin' | 'currency' | 'world';
}

// Products to extract from TGJU
const TGJU_PRODUCTS: TGJUProductConfig[] = [
  // Iranian gold prices
  {
    selector: 'geram18',
    pattern: /data-market-row="geram18"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: '18k-gold',
    priceType: 'gold',
  },
  {
    selector: 'geram24',
    pattern: /data-market-row="geram24"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: '24k-gold',
    priceType: 'gold',
  },
  {
    selector: 'mesghal',
    pattern: /data-market-row="mesghal"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'mesghal',
    priceType: 'gold',
  },
  // Coins
  {
    selector: 'sekee',
    pattern: /data-market-row="sekee"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'emami-coin',
    priceType: 'coin',
  },
  {
    selector: 'sekeb',
    pattern: /data-market-row="sekeb"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'bahar-azadi',
    priceType: 'coin',
  },
  {
    selector: 'nim',
    pattern: /data-market-row="nim"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'half-coin',
    priceType: 'coin',
  },
  {
    selector: 'rob',
    pattern: /data-market-row="rob"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'quarter-coin',
    priceType: 'coin',
  },
  {
    selector: 'gerami',
    pattern: /data-market-row="gerami"[\s\S]*?<td[^>]*>[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'gram-coin',
    priceType: 'coin',
  },
];

// Special prices for bubble calculation
interface WorldPriceData {
  goldOunceUSD: number;  // World gold ounce price in USD
  usdToIRR: number;      // USD to IRR rate
}

// Persian digit mapping
const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export class TGJUProvider extends BaseProvider {
  readonly providerId = 'tgju';
  readonly name = 'TGJU';

  // Store world price data for bubble calculation
  private worldPriceData: WorldPriceData | null = null;

  constructor() {
    super('tgju');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      // Fetch main page for gold and coin prices
      const mainResponse = await axios.get('https://www.tgju.org/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        },
        timeout: this.providerConfig.timeout,
      });

      const html = mainResponse.data as string;

      // Extract gold and coin prices
      for (const config of TGJU_PRODUCTS) {
        try {
          const price = this.extractPrice(html, config, correlationId);
          if (price) {
            prices.push(price);
          }
        } catch (err) {
          this.logger.debug(`Failed to extract ${config.productId} from TGJU`, {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Extract world gold ounce and USD rate for bubble calculation.
      // The USD rate is fetched from its dedicated profile page (more
      // reliable than scraping the busy main page); main-page regex is
      // used as a fallback only.
      await this.extractWorldPrices(html, correlationId);
      await this.refreshUsdRateFromProfile(correlationId);

      this.logger.info(`Fetched ${prices.length} prices from TGJU`, {
        correlationId,
        worldData: this.worldPriceData,
      });
    } catch (error) {
      this.logger.warn('Failed to fetch TGJU prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractPrice(
    html: string,
    config: TGJUProductConfig,
    correlationId: string
  ): NormalizedPrice | null {
    // Try to find price using data attribute pattern
    const dataPattern = new RegExp(
      `data-market-row="${config.selector}"[^>]*>[\\s\\S]*?<td[^>]*class="[^"]*nf[^"]*"[^>]*>([۰-۹\\d,،.]+)`,
      'i'
    );

    let match = html.match(dataPattern);
    if (!match) {
      // Fallback pattern
      match = html.match(config.pattern);
    }

    if (!match || !match[1]) {
      return null;
    }

    const priceStr = this.normalizePersianNumber(match[1]);
    const price = parseFloat(priceStr.replace(/[,،]/g, ''));

    if (isNaN(price) || price <= 0) {
      return null;
    }

    // TGJU prices are in Rials for gold/coins
    return this.createNormalizedPrice({
      symbol: config.selector.toUpperCase(),
      productId: config.productId,
      buyPrice: price,
      sellPrice: price,
      correlationId,
    });
  }

  private async extractWorldPrices(html: string, correlationId: string): Promise<void> {
    try {
      let goldOunceUSD = 0;
      let usdToIRR = 0;

      // Pattern 1: Look for /profile/ons followed by price in table
      // Format: href="/profile/ons"...انس طلا...<td>4,491.15</td>
      const ouncePatterns = [
        /href="[^"]*\/profile\/ons"[^>]*>[^<]*<\/a>[\s\S]*?<td[^>]*>([۰-۹\d,،.]+)/i,
        /انس طلا[\s\S]*?<td[^>]*>([۰-۹\d,،.]+)/,
        /اونس طلا[\s\S]*?([۰-۹\d,،.]+)/,
        /ons[^>]*>[\s\S]*?([۰-۹\d,،.]+)/i,
      ];

      for (const pattern of ouncePatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const val = this.normalizePersianNumber(match[1]);
          const parsed = parseFloat(val.replace(/[,،]/g, ''));
          // Gold ounce should be roughly 1000-10000 USD
          if (parsed > 1000 && parsed < 10000) {
            goldOunceUSD = parsed;
            break;
          }
        }
      }

      // Pattern 2: Look for /profile/price_dollar_rl followed by price in table
      // Format: href="/profile/price_dollar_rl"...دلار...<td>1,592,800</td>
      const usdPatterns = [
        /href="[^"]*\/profile\/price_dollar_rl"[^>]*>[^<]*<\/a>[\s\S]*?<td[^>]*>([۰-۹\d,،.]+)/i,
        /دلار[\s\S]*?<td[^>]*>([۰-۹\d,،.]+)/,
        /price_dollar_rl[^>]*>[\s\S]*?([۰-۹\d,،.]+)/i,
      ];

      for (const pattern of usdPatterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          const val = this.normalizePersianNumber(match[1]);
          const parsed = parseFloat(val.replace(/[,،]/g, ''));
          // USD/IRR should be roughly 500,000 - 10,000,000
          if (parsed > 500000 && parsed < 10000000) {
            usdToIRR = parsed;
            break;
          }
        }
      }

      if (goldOunceUSD > 0 && usdToIRR > 0) {
        this.worldPriceData = {
          goldOunceUSD,
          usdToIRR,
        };
        this.logger.info('Extracted world prices from TGJU', {
          correlationId,
          goldOunceUSD,
          usdToIRR,
        });
      } else {
        this.logger.warn('Could not extract world prices from TGJU', {
          correlationId,
          goldOunceUSD,
          usdToIRR,
        });
      }
    } catch (error) {
      this.logger.warn('Failed to extract world prices from TGJU', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Fetch the USD/IRR rate from its dedicated TGJU profile page.
   *
   * The profile page exposes the current rate via a stable, machine-
   * targetable selector:
   *   <span class="price" data-col="info.last_trade.PDrCotVal">1,560,000</span>
   *
   * This is far more reliable than the main-page regex, which has been
   * known to grab whatever number landed near the word "دلار" (e.g.
   * change-percentage cells, sidebar widgets, related-row prices).
   */
  private async refreshUsdRateFromProfile(correlationId: string): Promise<void> {
    try {
      const response = await axios.get(
        'https://www.tgju.org/profile/price_dollar_rl',
        {
          headers: {
            Accept: 'text/html,application/xhtml+xml',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
            'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
          },
          timeout: this.providerConfig.timeout,
        }
      );

      const html = response.data as string;

      // Primary selector: the structured data-col attribute used by TGJU's
      // own JS to bind the live price.
      const primary = html.match(
        /data-col="info\.last_trade\.PDrCotVal"[^>]*>\s*([۰-۹\d,،.]+)/
      );

      let rawMatch = primary && primary[1] ? primary[1] : null;

      if (!rawMatch) {
        // Fallback: any <span class="price">…</span> on the page.
        const fallback = html.match(
          /<span[^>]*class="[^"]*\bprice\b[^"]*"[^>]*>\s*([۰-۹\d,،.]+)/
        );
        rawMatch = fallback && fallback[1] ? fallback[1] : null;
      }

      if (!rawMatch) {
        this.logger.warn('USD profile page returned no parseable rate', {
          correlationId,
        });
        return;
      }

      const cleaned = this.normalizePersianNumber(rawMatch).replace(/[,،]/g, '');
      const usdToIRR = parseFloat(cleaned);

      // Sanity range: USD/IRR in Rials. Below 500k is impossibly low,
      // above 10M is implausibly high. Anything outside means we
      // captured the wrong field.
      if (!Number.isFinite(usdToIRR) || usdToIRR < 500_000 || usdToIRR > 10_000_000) {
        this.logger.warn('USD profile rate out of expected range', {
          correlationId,
          rawMatch,
          parsed: usdToIRR,
        });
        return;
      }

      // Preserve goldOunceUSD if it was already extracted from main page.
      const goldOunceUSD = this.worldPriceData?.goldOunceUSD ?? 0;
      this.worldPriceData = { goldOunceUSD, usdToIRR };

      this.logger.info('Refreshed USD/IRR from dedicated TGJU profile page', {
        correlationId,
        usdToIRR,
        source: 'profile/price_dollar_rl',
      });
    } catch (error) {
      this.logger.warn('Failed to fetch USD profile page', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get world price data for bubble calculation
   */
  getWorldPriceData(): WorldPriceData | null {
    return this.worldPriceData;
  }

  /**
   * Calculate theoretical gold price per gram in IRR
   * Based on world gold ounce price and USD rate
   * @param purity Gold purity (e.g., 0.750 for 18k, 0.999 for 24k)
   */
  calculateTheoreticalPrice(purity: number = 0.750): number | null {
    if (!this.worldPriceData) {
      return null;
    }

    const { goldOunceUSD, usdToIRR } = this.worldPriceData;
    const GRAMS_PER_OUNCE = 31.1035;

    // Calculate: (gold ounce USD × USD/IRR × purity) / grams per ounce
    return (goldOunceUSD * usdToIRR * purity) / GRAMS_PER_OUNCE;
  }

  private normalizePersianNumber(str: string): string {
    let result = str;
    for (const [persian, western] of Object.entries(PERSIAN_DIGITS)) {
      result = result.replace(new RegExp(persian, 'g'), western);
    }
    return result;
  }
}
