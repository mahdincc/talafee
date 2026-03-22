import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface TalinePriceItem {
  symbol: string;
  title: string;
  status: 'enabled' | 'disabled';
  price: {
    sell: number;
    buy: number;
    date_time: string;
  };
  max_price?: {
    buy: number;
    date_time: string;
  };
  min_price?: {
    buy: number;
    date_time: string;
  };
  direction?: 'up' | 'down';
}

interface TalinePriceResponse {
  prices: TalinePriceItem[][] | TalinePriceItem[];
}

const SYMBOL_TO_PRODUCT: Record<string, ProductId> = {
  GOLD18: '18k-gold',
  GOLD_MITHQAL17: 'mesghal',
  SEKEH_E: 'emami-coin',
  SEKEH_NIM: 'half-coin',
  SEKEH_ROB: 'quarter-coin',
  GOLD24: '24k-gold',
  GOLD_BAR: 'gold-bar',
  ONS: 'gold-ounce',
};

export class TalineProvider extends BaseProvider {
  readonly providerId = 'taline';
  readonly name = 'Taline';

  constructor() {
    super('taline');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const data = await this.makeRequest<TalinePriceResponse>(
      this.providerConfig.apiUrl,
      {
        method: 'GET',
        headers: {
          Origin: 'https://taline.ir',
          Referer: 'https://taline.ir/',
        },
      },
      correlationId
    );

    const prices: NormalizedPrice[] = [];
    const priceItems = this.flattenPrices(data.prices);

    for (const item of priceItems) {
      if (item.status !== 'enabled') continue;

      const productId = SYMBOL_TO_PRODUCT[item.symbol];
      if (!productId) {
        this.logger.debug(`Unknown symbol: ${item.symbol}`, { correlationId });
        continue;
      }

      const providerUpdatedAt = new Date(item.price.date_time);

      // Taline prices are in Tomans per gram (* 1000 to get full Tomans, then * 10 for Rials)
      // e.g., 15004 = 15,004 Tomans * 10 = 150,040 Rials per gram
      // But looking at actual API: values like 176831 are already in Tomans per gram
      // Multiply by 10 to convert to Rials per gram
      const buyPricePerGram = item.price.buy * 10;
      const sellPricePerGram = item.price.sell * 10;
      const dailyHighPerGram = item.max_price?.buy ? item.max_price.buy * 10 : undefined;
      const dailyLowPerGram = item.min_price?.buy ? item.min_price.buy * 10 : undefined;

      prices.push(
        this.createNormalizedPrice({
          symbol: item.symbol,
          productId,
          buyPrice: buyPricePerGram,
          sellPrice: sellPricePerGram,
          dailyHigh: dailyHighPerGram,
          dailyLow: dailyLowPerGram,
          direction: item.direction,
          providerUpdatedAt,
          correlationId,
        })
      );
    }

    return prices;
  }

  private flattenPrices(prices: TalinePriceItem[][] | TalinePriceItem[]): TalinePriceItem[] {
    if (prices.length === 0) return [];

    // Check if first element is an array
    if (Array.isArray(prices[0])) {
      return (prices as TalinePriceItem[][]).flat();
    }

    return prices as TalinePriceItem[];
  }
}
