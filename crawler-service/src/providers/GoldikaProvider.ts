import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface GoldikaProductConfig {
  pattern: RegExp;
  productId: ProductId;
}

// Persian digit mapping
const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

// Patterns to extract prices from Goldika HTML/JSON
const GOLDIKA_PRODUCTS: GoldikaProductConfig[] = [
  {
    pattern: /طلای?\s*۱۸\s*عیار[\s\S]*?([۰-۹\d,،]+)/i,
    productId: '18k-gold',
  },
  {
    pattern: /طلای?\s*۲۴\s*عیار[\s\S]*?([۰-۹\d,،]+)/i,
    productId: '24k-gold',
  },
];

export class GoldikaProvider extends BaseProvider {
  readonly providerId = 'goldika';
  readonly name = 'Goldika';

  constructor() {
    super('goldika');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      // Try to fetch the gold price page
      const response = await axios.get('https://goldika.ir/gold', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        },
        timeout: this.providerConfig.timeout,
      });

      const html = response.data as string;

      // Try to find JSON data in script tags
      const jsonPattern = /__NEXT_DATA__[\s\S]*?<script[^>]*>([\s\S]*?)<\/script>/i;
      const jsonMatch = html.match(jsonPattern);

      if (jsonMatch) {
        // Parse Next.js data if available
        try {
          const nextDataPattern = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i;
          const nextMatch = html.match(nextDataPattern);
          if (nextMatch && nextMatch[1]) {
            const data = JSON.parse(nextMatch[1]);
            const extractedPrices = this.extractFromNextData(data, correlationId);
            prices.push(...extractedPrices);
          }
        } catch (e) {
          this.logger.debug('Failed to parse Next.js data', { correlationId });
        }
      }

      // Fallback: Extract from HTML patterns
      if (prices.length === 0) {
        for (const config of GOLDIKA_PRODUCTS) {
          try {
            const price = this.extractFromHtml(html, config, correlationId);
            if (price) {
              prices.push(price);
            }
          } catch (err) {
            this.logger.debug(`Failed to extract ${config.productId} from Goldika`, {
              correlationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      this.logger.info(`Fetched ${prices.length} prices from Goldika`, { correlationId });
    } catch (error) {
      this.logger.warn('Failed to fetch Goldika prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractFromNextData(data: unknown, correlationId: string): NormalizedPrice[] {
    const prices: NormalizedPrice[] = [];

    try {
      // Navigate through Next.js data structure to find prices
      const dataObj = data as Record<string, unknown>;
      const props = dataObj?.['props'] as Record<string, unknown> | undefined;
      const pageProps = props?.['pageProps'] as Record<string, unknown> | undefined;

      if (pageProps && typeof pageProps === 'object') {
        // Look for price data in various possible locations
        const priceData = (pageProps['prices'] || pageProps['goldPrice'] || pageProps['data']) as Record<string, unknown> | undefined;

        if (priceData && typeof priceData === 'object') {
          // Extract 18k gold price
          const gold18 = priceData['gold18'] || priceData['18k'];
          if (gold18 && typeof gold18 === 'number') {
            prices.push(this.createNormalizedPrice({
              symbol: 'GOLD18',
              productId: '18k-gold',
              buyPrice: gold18,
              sellPrice: gold18,
              correlationId,
            }));
          }

          // Extract 24k gold price
          const gold24 = priceData['gold24'] || priceData['24k'];
          if (gold24 && typeof gold24 === 'number') {
            prices.push(this.createNormalizedPrice({
              symbol: 'GOLD24',
              productId: '24k-gold',
              buyPrice: gold24,
              sellPrice: gold24,
              correlationId,
            }));
          }
        }
      }
    } catch (error) {
      this.logger.debug('Error extracting from Next.js data', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractFromHtml(
    html: string,
    config: GoldikaProductConfig,
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

    // Goldika prices are in Tomans, convert to Rials (* 10)
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
