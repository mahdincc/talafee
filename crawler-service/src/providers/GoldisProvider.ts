import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface GoldisProductConfig {
  pattern: RegExp;
  productId: ProductId;
}

// Persian digit mapping
const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

// Patterns to extract prices from Goldis
const GOLDIS_PRODUCTS: GoldisProductConfig[] = [
  {
    pattern: /طلای?\s*۱۸\s*عیار[\s\S]*?([۰-۹\d,،]+)/i,
    productId: '18k-gold',
  },
  {
    pattern: /طلای?\s*۲۴\s*عیار[\s\S]*?([۰-۹\d,،]+)/i,
    productId: '24k-gold',
  },
];

export class GoldisProvider extends BaseProvider {
  readonly providerId = 'goldis';
  readonly name = 'Goldis';

  constructor() {
    super('goldis');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      const response = await axios.get('https://goldis.ir/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        },
        timeout: this.providerConfig.timeout,
      });

      const html = response.data as string;

      // Try to extract from Next.js/React data
      const scriptPattern = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let scriptMatch;
      while ((scriptMatch = scriptPattern.exec(html)) !== null) {
        const scriptContent = scriptMatch[1];
        if (scriptContent && (scriptContent.includes('price') || scriptContent.includes('gold'))) {
          const extractedPrices = this.extractFromScript(scriptContent, correlationId);
          if (extractedPrices.length > 0) {
            prices.push(...extractedPrices);
            break;
          }
        }
      }

      // Fallback to HTML pattern extraction
      if (prices.length === 0) {
        for (const config of GOLDIS_PRODUCTS) {
          try {
            const price = this.extractFromHtml(html, config, correlationId);
            if (price) {
              prices.push(price);
            }
          } catch (err) {
            this.logger.debug(`Failed to extract ${config.productId} from Goldis`, {
              correlationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      this.logger.info(`Fetched ${prices.length} prices from Goldis`, { correlationId });
    } catch (error) {
      this.logger.warn('Failed to fetch Goldis prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractFromScript(script: string, correlationId: string): NormalizedPrice[] {
    const prices: NormalizedPrice[] = [];

    try {
      // Try to find JSON data in script
      const jsonPatterns = [
        /"(?:gold18|geram18|18k)":\s*(\d+)/gi,
        /"(?:gold24|geram24|24k)":\s*(\d+)/gi,
        /"(?:buyPrice|sellPrice|price)":\s*(\d+)/gi,
      ];

      // Look for gold18 price
      const gold18Match = script.match(/"(?:gold18|geram18)":\s*(\d+)/i);
      if (gold18Match && gold18Match[1]) {
        const price = parseInt(gold18Match[1], 10);
        if (price > 0) {
          prices.push(this.createNormalizedPrice({
            symbol: 'GOLD18',
            productId: '18k-gold',
            buyPrice: price,
            sellPrice: price,
            correlationId,
          }));
        }
      }

      // Look for gold24 price
      const gold24Match = script.match(/"(?:gold24|geram24)":\s*(\d+)/i);
      if (gold24Match && gold24Match[1]) {
        const price = parseInt(gold24Match[1], 10);
        if (price > 0) {
          prices.push(this.createNormalizedPrice({
            symbol: 'GOLD24',
            productId: '24k-gold',
            buyPrice: price,
            sellPrice: price,
            correlationId,
          }));
        }
      }
    } catch (error) {
      this.logger.debug('Error extracting from Goldis script', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractFromHtml(
    html: string,
    config: GoldisProductConfig,
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

    // Goldis prices are in Tomans, convert to Rials (* 10)
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
