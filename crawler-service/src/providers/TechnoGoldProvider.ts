import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface TechnoGoldPriceItem {
  key: string;
  title: string;
  price: number;
  change: string;
  low: number;
  high: number;
}

interface TechnoGoldCategory {
  category: string;
  items: TechnoGoldPriceItem[];
}

interface TechnoGoldResponse {
  succeed: boolean;
  message: string;
  results: TechnoGoldCategory[];
}

const KEY_TO_PRODUCT: Record<string, ProductId> = {
  // Gold category (prices per 10 grams in Rials)
  'Gold 750': '18k-gold',
  'Gold 740': '18k-gold',
  'Gold 999': '24k-gold',
  // Coin category (prices per unit in Rials)
  'Imam coin': 'emami-coin',
  'Half coin': 'half-coin',
  'Quarter coin': 'quarter-coin',
  'Whole coin': 'bahar-azadi',
  'Gram coin': 'gram-coin',
  // Other units
  Shekel: 'mesghal',
  Ounce: 'gold-ounce',
  // Silver category (prices per 10 grams in Rials)
  'Silver 999': 'silver-999',
};

// Keys that need division by 10 (prices are per 10 grams)
const PRICE_PER_10_GRAMS: Set<string> = new Set([
  'Gold 750',
  'Gold 740',
  'Gold 999',
  'Silver 999',
]);

// Keys that are per unit (coins) - no conversion needed
const PRICE_PER_UNIT: Set<string> = new Set([
  'Imam coin',
  'Half coin',
  'Quarter coin',
  'Whole coin',
  'Gram coin',
  'Shekel', // Mesghal is a unit
  'Ounce',  // Ounce is in USD - skip
]);

export class TechnoGoldProvider extends BaseProvider {
  readonly providerId = 'technogold';
  readonly name = 'TechnoGold';

  constructor() {
    super('technogold');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const response = await this.makeRequest<TechnoGoldResponse>(
      this.providerConfig.apiUrl,
      {
        method: 'GET',
        headers: {
          Origin: 'https://technogold.gold',
          Referer: 'https://technogold.gold/gold750',
        },
      },
      correlationId
    );

    if (!response.succeed) {
      throw new Error(`TechnoGold API error: ${response.message}`);
    }

    const prices: NormalizedPrice[] = [];

    for (const category of response.results) {
      // Process gold, coin, and silver categories
      if (category.category !== 'gold' && category.category !== 'coin' && category.category !== 'silver') {
        continue;
      }

      for (const item of category.items) {
        const productId = KEY_TO_PRODUCT[item.key];

        if (!productId) {
          this.logger.debug(`Unknown key: ${item.key}`, { correlationId });
          continue;
        }

        // Skip Ounce as it's in USD
        if (item.key === 'Ounce') {
          continue;
        }

        const changePercent = parseFloat(item.change) || 0;
        const direction: 'up' | 'down' | 'stable' =
          changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'stable';

        // Normalize prices to Rials per gram for gold items
        let price = item.price;
        let high = item.high;
        let low = item.low;

        if (PRICE_PER_10_GRAMS.has(item.key)) {
          // Gold prices are per 10 grams, divide by 10 for per gram
          price = price / 10;
          high = high / 10;
          low = low / 10;
        }
        // Coins and Mesghal are already priced per unit, no conversion needed

        prices.push(
          this.createNormalizedPrice({
            symbol: item.key.replace(/\s+/g, '_').toUpperCase(),
            productId,
            buyPrice: price,
            sellPrice: price,
            dailyHigh: high,
            dailyLow: low,
            priceChangePercent: changePercent,
            direction,
            correlationId,
          })
        );
      }
    }

    return prices;
  }
}
