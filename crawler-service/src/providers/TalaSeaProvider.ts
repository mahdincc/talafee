import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice } from '../core/models/index.js';
import { CustomHeadersStrategy } from '../auth/index.js';

// Actual API response format from talasea.ir
interface TalaSeaResponse {
  price: string;
  minOrderValue?: number;
  minSellOrderValue?: number;
  maxOrderValue?: number;
  fee?: number;
  change24h?: string;
  minDeposit?: number;
  maxDeposit?: number;
}

export class TalaSeaProvider extends BaseProvider {
  readonly providerId = 'talasea';
  readonly name = 'TalaSea';

  constructor() {
    super('talasea');
    this.setAuthStrategy(
      new CustomHeadersStrategy({
        headers: {
          Authorization: 'Bearer public',
          Platform: 'web',
        },
      })
    );
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const response = await this.makeRequest<TalaSeaResponse>(
      this.providerConfig.apiUrl,
      {
        method: 'GET',
        headers: {
          Origin: 'https://talasea.ir',
          Referer: 'https://talasea.ir/',
        },
      },
      correlationId
    );

    const prices: NormalizedPrice[] = [];

    // Parse the price (in Tomans, need to convert to Rials)
    const priceInTomans = parseFloat(response.price);

    if (isNaN(priceInTomans) || priceInTomans <= 0) {
      this.logger.warn(`TalaSea: Invalid price value: ${response.price}`, { correlationId });
      return prices;
    }

    // Convert Tomans to Rials (multiply by 10)
    const priceInRials = priceInTomans * 10;

    // Parse change percentage
    const changePercent = response.change24h ? parseFloat(response.change24h) : undefined;
    const direction: 'up' | 'down' | 'stable' | undefined = changePercent
      ? changePercent > 0
        ? 'up'
        : changePercent < 0
          ? 'down'
          : 'stable'
      : undefined;

    prices.push(
      this.createNormalizedPrice({
        symbol: 'GOLD18',
        productId: '18k-gold',
        buyPrice: priceInRials,
        sellPrice: priceInRials,
        priceChangePercent: changePercent,
        direction,
        correlationId,
      })
    );

    return prices;
  }
}
