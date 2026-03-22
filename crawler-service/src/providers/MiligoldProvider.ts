import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice } from '../core/models/index.js';
import { CustomHeadersStrategy } from '../auth/index.js';

// Actual API response format from milli.gold
interface MiligoldPriceResponse {
  code: number;
  message: string;
  data: {
    price18?: number;
    price24?: number;
    price?: number;
    buyPrice?: number;
    sellPrice?: number;
    date?: string;
    updatedAt?: string;
  };
}

export class MiligoldProvider extends BaseProvider {
  readonly providerId = 'miligold';
  readonly name = 'MiliGold';

  constructor() {
    super('miligold');
    this.setAuthStrategy(
      new CustomHeadersStrategy({
        headers: {
          'X-Channel': 'milli.gold',
          'X-Client-Version': '1.0.0',
          'X-Platform': 'PWA',
          'X-Release-Version': '4a126aed',
        },
      })
    );
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const response = await this.makeRequest<MiligoldPriceResponse>(
      this.providerConfig.apiUrl,
      {
        method: 'GET',
        headers: {
          Referer: 'https://milli.gold/app/home',
          Origin: 'https://milli.gold',
        },
      },
      correlationId
    );

    const prices: NormalizedPrice[] = [];

    // Check response code
    if (response.code !== 0) {
      this.logger.warn(`MiliGold API error: ${response.message}`, { correlationId });
      return prices;
    }

    const data = response.data;
    if (!data) {
      this.logger.warn(`MiliGold: No data in response`, { correlationId });
      return prices;
    }

    // Parse price18 (18k gold price per gram in Tomans, convert to Rials)
    if (data.price18) {
      // price18 is in Tomans, multiply by 10 for Rials
      const priceInRials = data.price18 * 10;

      prices.push(
        this.createNormalizedPrice({
          symbol: 'GOLD18',
          productId: '18k-gold',
          buyPrice: priceInRials,
          sellPrice: priceInRials,
          providerUpdatedAt: data.date ? new Date(data.date) : undefined,
          correlationId,
        })
      );
    }

    // Parse price24 if available
    if (data.price24) {
      const priceInRials = data.price24 * 10;

      prices.push(
        this.createNormalizedPrice({
          symbol: 'GOLD24',
          productId: '24k-gold',
          buyPrice: priceInRials,
          sellPrice: priceInRials,
          providerUpdatedAt: data.date ? new Date(data.date) : undefined,
          correlationId,
        })
      );
    }

    return prices;
  }
}
