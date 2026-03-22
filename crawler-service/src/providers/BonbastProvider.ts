import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface BonbastResponse {
  gol18?: string;
  mithqal?: string;
  ounce?: string;
  azadi1?: string;
  azadi12?: string;
  emami1?: string;
  emami12?: string;
  azadi1_2?: string;
  azadi1_22?: string;
  azadi1_4?: string;
  azadi1_42?: string;
  azadi1g?: string;
  azadi1g2?: string;
  last_modified?: string;
}

interface BonbastProductConfig {
  key: string;
  key2?: string; // Secondary key for sell price
  productId: ProductId;
  isPerUnit: boolean;
}

// Map Bonbast keys to our product IDs
const BONBAST_PRODUCTS: BonbastProductConfig[] = [
  { key: 'gol18', productId: '18k-gold', isPerUnit: false },
  { key: 'mithqal', productId: 'mesghal', isPerUnit: false },
  { key: 'emami1', key2: 'emami12', productId: 'emami-coin', isPerUnit: true },
  { key: 'azadi1', key2: 'azadi12', productId: 'bahar-azadi', isPerUnit: true },
  { key: 'azadi1_2', key2: 'azadi1_22', productId: 'half-coin', isPerUnit: true },
  { key: 'azadi1_4', key2: 'azadi1_42', productId: 'quarter-coin', isPerUnit: true },
  { key: 'azadi1g', key2: 'azadi1g2', productId: 'gram-coin', isPerUnit: true },
];

export class BonbastProvider extends BaseProvider {
  readonly providerId = 'bonbast';
  readonly name = 'Bonbast';

  constructor() {
    super('bonbast');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      // Generate param with token and timestamp
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

      // Token appears to be static or session-based
      const token = 'c3ee236f13ebf015e4edd57426087531';
      const param = `${token},DaiZz,${timestamp}`;

      const response = await axios.post<BonbastResponse>(
        'https://www.bonbast.com/json',
        `param=${encodeURIComponent(param)}`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
            'Referer': 'https://www.bonbast.com/',
            'Origin': 'https://www.bonbast.com',
          },
          timeout: this.providerConfig.timeout,
        }
      );

      const data = response.data;

      for (const config of BONBAST_PRODUCTS) {
        const buyValue = data[config.key as keyof BonbastResponse];
        const sellValue = config.key2
          ? data[config.key2 as keyof BonbastResponse]
          : buyValue;

        if (!buyValue) continue;

        // Parse price (remove commas if present)
        const buyPrice = this.parsePrice(buyValue);
        const sellPrice = sellValue ? this.parsePrice(sellValue) : buyPrice;

        if (buyPrice <= 0) continue;

        // Bonbast prices are in Tomans, convert to Rials (* 10)
        const buyPriceRials = buyPrice * 10;
        const sellPriceRials = sellPrice * 10;

        prices.push(
          this.createNormalizedPrice({
            symbol: config.key.toUpperCase(),
            productId: config.productId,
            buyPrice: buyPriceRials,
            sellPrice: sellPriceRials,
            correlationId,
          })
        );
      }

      this.logger.info(`Fetched ${prices.length} prices from Bonbast`, { correlationId });
    } catch (error) {
      this.logger.warn('Failed to fetch Bonbast prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  private parsePrice(value: string): number {
    if (!value) return 0;
    // Remove commas and parse as number
    const cleaned = String(value).replace(/,/g, '').trim();
    return parseInt(cleaned, 10) || 0;
  }
}
