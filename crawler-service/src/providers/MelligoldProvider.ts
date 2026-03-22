import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface MelligoldPriceResponse {
  symbol?: string;
  buy_price?: number;
  sell_price?: number;
  price?: number;
  timestamp?: string;
}

interface MelligoldSymbolConfig {
  symbol: string;
  productId: ProductId;
  isPerUnit: boolean; // true for coins, false for per-gram items
}

// All symbols supported by MelliGold API
const MELLIGOLD_SYMBOLS: MelligoldSymbolConfig[] = [
  { symbol: 'XAU18', productId: '18k-gold', isPerUnit: false },
  { symbol: 'XAU24', productId: '24k-gold', isPerUnit: false },
  { symbol: 'SEKEH_EMAMI', productId: 'emami-coin', isPerUnit: true },
  { symbol: 'SEKEH_NIM', productId: 'half-coin', isPerUnit: true },
  { symbol: 'SEKEH_ROB', productId: 'quarter-coin', isPerUnit: true },
  { symbol: 'SEKEH_BAHAR', productId: 'bahar-azadi', isPerUnit: true },
];

export class MelligoldProvider extends BaseProvider {
  readonly providerId = 'melligold';
  readonly name = 'MelliGold';
  private cookies: string = '';

  constructor() {
    super('melligold');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const allPrices: NormalizedPrice[] = [];

    // Fetch all symbols in parallel
    const fetchPromises = MELLIGOLD_SYMBOLS.map(async (config) => {
      try {
        const price = await this.fetchSymbol(config, correlationId);
        if (price) {
          return price;
        }
      } catch (error) {
        this.logger.debug(`Failed to fetch MelliGold ${config.symbol}`, {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    });

    const results = await Promise.all(fetchPromises);
    for (const price of results) {
      if (price) {
        allPrices.push(price);
      }
    }

    return allPrices;
  }

  private async fetchSymbol(
    config: MelligoldSymbolConfig,
    correlationId: string
  ): Promise<NormalizedPrice | null> {
    const url = `https://melligold.com/api/v1/exchange/buy-sell-price/?symbol=${config.symbol}&format=json`;

    const response = await axios.get<MelligoldPriceResponse>(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        Referer: 'https://melligold.com/',
        Origin: 'https://melligold.com',
        ...(this.cookies ? { Cookie: this.cookies } : {}),
      },
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      timeout: this.providerConfig.timeout,
    });

    // Store cookies for subsequent requests
    const setCookies = response.headers['set-cookie'];
    if (setCookies) {
      this.cookies = setCookies.map((c: string) => c.split(';')[0]).join('; ');
    }

    // Handle redirects
    if (response.status === 307 || response.status === 302) {
      const redirectUrl = response.headers['location'];
      if (redirectUrl) {
        const retryResponse = await axios.get<MelligoldPriceResponse>(redirectUrl, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Referer: 'https://melligold.com/',
            Cookie: this.cookies,
          },
          timeout: this.providerConfig.timeout,
        });
        return this.parseSymbolResponse(retryResponse.data, config, correlationId);
      }
    }

    return this.parseSymbolResponse(response.data, config, correlationId);
  }

  private parseSymbolResponse(
    data: MelligoldPriceResponse,
    config: MelligoldSymbolConfig,
    correlationId: string
  ): NormalizedPrice | null {
    let buyPrice = 0;
    let sellPrice = 0;

    if (data.buy_price && data.sell_price) {
      buyPrice = data.buy_price;
      sellPrice = data.sell_price;
    } else if (data.price) {
      buyPrice = data.price;
      sellPrice = data.price;
    }

    if (buyPrice <= 0 && sellPrice <= 0) {
      return null;
    }

    // MelliGold prices are in Tomans, convert to Rials (* 10)
    const buyPriceInRials = buyPrice * 10;
    const sellPriceInRials = sellPrice * 10;

    return this.createNormalizedPrice({
      symbol: config.symbol,
      productId: config.productId,
      buyPrice: buyPriceInRials,
      sellPrice: sellPriceInRials,
      providerUpdatedAt: data.timestamp ? new Date(data.timestamp) : undefined,
      correlationId,
    });
  }
}
