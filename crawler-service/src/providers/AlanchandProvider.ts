import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface AlanchandProductConfig {
  pattern: RegExp;
  productId: ProductId;
  isPerUnit: boolean;
}

// Patterns to extract prices from HTML
const ALANCHAND_PRODUCTS: AlanchandProductConfig[] = [
  {
    pattern: /گرم طلای 18 عیار[\s\S]*?([۰-۹\d,،]+)/,
    productId: '18k-gold',
    isPerUnit: false,
  },
  {
    pattern: /سکه امامی[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'emami-coin',
    isPerUnit: true,
  },
  {
    pattern: /آبشده.*?مثقال[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'mesghal',
    isPerUnit: false,
  },
  {
    pattern: /نیم سکه[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'half-coin',
    isPerUnit: true,
  },
  {
    pattern: /ربع سکه[\s\S]*?([۰-۹\d,،]+)/,
    productId: 'quarter-coin',
    isPerUnit: true,
  },
];

// Persian digit mapping
const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export class AlanchandProvider extends BaseProvider {
  readonly providerId = 'alanchand';
  readonly name = 'AlanChand';

  constructor() {
    super('alanchand');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      const response = await axios.get('https://alanchand.com/', {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        },
        timeout: this.providerConfig.timeout,
      });

      const html = response.data as string;

      for (const config of ALANCHAND_PRODUCTS) {
        try {
          const price = this.extractPrice(html, config);
          if (price) {
            prices.push(price);
          }
        } catch (err) {
          this.logger.debug(`Failed to extract ${config.productId} from Alanchand`, {
            correlationId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      this.logger.info(`Fetched ${prices.length} prices from Alanchand`, { correlationId });
    } catch (error) {
      this.logger.warn('Failed to fetch Alanchand prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private extractPrice(
    html: string,
    config: AlanchandProductConfig
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

    // Alanchand prices are in Tomans, convert to Rials (* 10)
    const priceInRials = price * 10;

    // Validate price range - gold prices in Iran should be at least 100,000 Rials
    // Filter out obviously wrong prices
    if (priceInRials < 100000) {
      return null;
    }

    return this.createNormalizedPrice({
      symbol: config.productId.toUpperCase(),
      productId: config.productId,
      buyPrice: priceInRials,
      sellPrice: priceInRials,
      correlationId: '',
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
