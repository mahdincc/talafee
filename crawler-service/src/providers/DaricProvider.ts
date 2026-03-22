import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface DaricProductConfig {
  pattern: RegExp;
  productId: ProductId;
}

// Persian digit mapping
const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

// Patterns to extract prices from Daric
const DARIC_PRODUCTS: DaricProductConfig[] = [
  {
    pattern: /طلای?\s*(?:آبشده|آب شده)?\s*۱۸\s*عیار[\s\S]*?([۰-۹\d,،]+)/i,
    productId: '18k-gold',
  },
  {
    pattern: /طلای?\s*(?:آبشده|آب شده)?\s*۲۴\s*عیار[\s\S]*?([۰-۹\d,،]+)/i,
    productId: '24k-gold',
  },
  {
    pattern: /سکه\s*امامی[\s\S]*?([۰-۹\d,،]+)/i,
    productId: 'emami-coin',
  },
  {
    pattern: /نیم\s*سکه[\s\S]*?([۰-۹\d,،]+)/i,
    productId: 'half-coin',
  },
  {
    pattern: /ربع\s*سکه[\s\S]*?([۰-۹\d,،]+)/i,
    productId: 'quarter-coin',
  },
];

export class DaricProvider extends BaseProvider {
  readonly providerId = 'daric';
  readonly name = 'Daric';

  constructor() {
    super('daric');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      // Fetch main page
      const response = await axios.get('https://daric.gold/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        },
        timeout: this.providerConfig.timeout,
      });

      const html = response.data as string;

      // Try to extract from Next.js data first
      const nextDataPattern = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;
      const nextMatch = html.match(nextDataPattern);

      if (nextMatch && nextMatch[1]) {
        try {
          const data = JSON.parse(nextMatch[1]);
          const extractedPrices = this.extractFromNextData(data, correlationId);
          prices.push(...extractedPrices);
        } catch (e) {
          this.logger.debug('Failed to parse Next.js data from Daric', { correlationId });
        }
      }

      // Fallback to HTML pattern extraction
      if (prices.length === 0) {
        for (const config of DARIC_PRODUCTS) {
          try {
            const price = this.extractFromHtml(html, config, correlationId);
            if (price) {
              prices.push(price);
            }
          } catch (err) {
            this.logger.debug(`Failed to extract ${config.productId} from Daric`, {
              correlationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      this.logger.info(`Fetched ${prices.length} prices from Daric`, { correlationId });
    } catch (error) {
      this.logger.warn('Failed to fetch Daric prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractFromNextData(data: unknown, correlationId: string): NormalizedPrice[] {
    const prices: NormalizedPrice[] = [];

    try {
      const dataObj = data as Record<string, unknown>;
      const props = dataObj?.['props'] as Record<string, unknown> | undefined;
      const pageProps = props?.['pageProps'] as Record<string, unknown> | undefined;

      if (pageProps && typeof pageProps === 'object') {
        // Look for price data
        const priceData = (pageProps['prices'] || pageProps['goldPrices'] || pageProps['data']) as Record<string, unknown> | undefined;

        if (priceData && typeof priceData === 'object') {
          // Try to extract gold prices
          const mappings: Array<{ keys: string[]; productId: ProductId; symbol: string }> = [
            { keys: ['gold18', '18k', 'geram18'], productId: '18k-gold', symbol: 'GOLD18' },
            { keys: ['gold24', '24k', 'geram24'], productId: '24k-gold', symbol: 'GOLD24' },
            { keys: ['emami', 'sekee', 'coin'], productId: 'emami-coin', symbol: 'EMAMI' },
            { keys: ['nim', 'half'], productId: 'half-coin', symbol: 'HALF' },
            { keys: ['rob', 'quarter'], productId: 'quarter-coin', symbol: 'QUARTER' },
          ];

          for (const mapping of mappings) {
            for (const key of mapping.keys) {
              const value = priceData[key];
              if (value && typeof value === 'number' && value > 0) {
                prices.push(this.createNormalizedPrice({
                  symbol: mapping.symbol,
                  productId: mapping.productId,
                  buyPrice: value,
                  sellPrice: value,
                  correlationId,
                }));
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.debug('Error extracting from Daric Next.js data', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractFromHtml(
    html: string,
    config: DaricProductConfig,
    correlationId: string
  ): NormalizedPrice | null {
    const match = html.match(config.pattern);
    if (!match || !match[1]) {
      return null;
    }

    const priceStr = this.normalizePersianNumber(match[1]);
    const price = parseInt(priceStr.replace(/[,،]/g, ''), 10);

    if (isNaN(price) || price <= 0) {
      return null;
    }

    // Daric prices are in Tomans, convert to Rials (* 10)
    const priceInRials = price * 10;

    return this.createNormalizedPrice({
      symbol: config.productId.toUpperCase().replace('-', '_'),
      productId: config.productId,
      buyPrice: priceInRials,
      sellPrice: priceInRials,
      correlationId,
    });
  }

  private normalizePersianNumber(str: string): string {
    let result = str;
    for (const [persian, western] of Object.entries(PERSIAN_DIGITS)) {
      result = result.replace(new RegExp(persian, 'g'), western);
    }
    return result;
  }
}
