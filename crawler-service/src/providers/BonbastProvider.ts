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
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'Referer': 'https://www.bonbast.com/',
    };

    // Bonbast embeds a rotating token in the homepage HTML inside the
    // `$.post('/json', {param: "<token>,<short>,<ts>"})` call, and the POST is
    // only accepted with the session cookie the homepage sets (otherwise /json
    // replies {"rest":"1"}). So scrape the token AND forward the cookie each
    // cycle — a hardcoded token gets rejected once it rotates.
    const home = await axios.get<string>('https://www.bonbast.com/', {
      headers,
      timeout: this.providerConfig.timeout,
      responseType: 'text',
    });

    const cookie = (home.headers['set-cookie'] ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');

    const match = /param:\s*"([^"]+)"/.exec(home.data);
    if (!match) {
      throw new Error('Bonbast token not found in homepage HTML');
    }
    const param = match[1];

    const response = await axios.post<BonbastResponse>(
      'https://www.bonbast.com/json',
      `param=${encodeURIComponent(param)}`,
      {
        headers: {
          ...headers,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'https://www.bonbast.com',
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        timeout: this.providerConfig.timeout,
      }
    );

    const data = response.data;
    const prices: NormalizedPrice[] = [];

    for (const config of BONBAST_PRODUCTS) {
      // xxx1 = dealer sell (higher) = our buyPrice; xxx2 = dealer buy (lower) = our sellPrice.
      const buyValue = data[config.key as keyof BonbastResponse];
      const sellValue = config.key2 ? data[config.key2 as keyof BonbastResponse] : buyValue;

      if (!buyValue) continue;

      const buyPrice = this.parsePrice(buyValue);
      const sellPrice = sellValue ? this.parsePrice(sellValue) : buyPrice;

      if (buyPrice <= 0) continue;

      // Bonbast quotes Tomans. Pass raw — BaseProvider's normalizer rescales
      // to Rials by magnitude (×10 here). Don't pre-multiply.
      prices.push(
        this.createNormalizedPrice({
          symbol: config.key.toUpperCase(),
          productId: config.productId,
          buyPrice,
          sellPrice,
          correlationId,
        })
      );
    }

    this.logger.info(`Fetched ${prices.length} prices from Bonbast`, { correlationId });
    return prices;
  }

  private parsePrice(value: string): number {
    if (!value) return 0;
    // Remove commas and parse as number
    const cleaned = String(value).replace(/,/g, '').trim();
    return parseInt(cleaned, 10) || 0;
  }
}
