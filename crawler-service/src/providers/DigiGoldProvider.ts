import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface DigiGoldPriceResponse {
  gold18?: { price: number; ttl: number };
  silver999?: { price: number; ttl: number };
}

export class DigiGoldProvider extends BaseProvider {
  readonly providerId = 'digigold';
  readonly name = 'DigiGold';

  constructor() {
    super('digigold');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const data = await this.makeRequest<DigiGoldPriceResponse>(
      this.providerConfig.apiUrl,
      { method: 'GET' },
      correlationId
    );

    const prices: NormalizedPrice[] = [];

    if (data.gold18) {
      // DigiGold prices are in Tomans per gram (e.g., 175619 Tomans)
      // Multiply by 10 to convert to Rials per gram
      const pricePerGram = data.gold18.price * 10;

      prices.push(
        this.createNormalizedPrice({
          symbol: 'GOLD18',
          productId: '18k-gold',
          buyPrice: pricePerGram,
          sellPrice: pricePerGram,
          correlationId,
        })
      );
    }

    if (data.silver999) {
      // Silver price in Tomans per gram
      const pricePerGram = data.silver999.price * 10;

      prices.push(
        this.createNormalizedPrice({
          symbol: 'SILVER999',
          productId: 'silver-999',
          buyPrice: pricePerGram,
          sellPrice: pricePerGram,
          correlationId,
        })
      );
    }

    return prices;
  }
}
