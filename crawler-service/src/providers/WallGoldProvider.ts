import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice, ProductId } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

interface WallGoldEnvelope<T> {
  result: T;
  message: string;
  success: boolean;
}

interface WallGoldMarketCap {
  symbol: string;
  '24hVolume'?: string;
  '24hQuoteVolume'?: string;
  '24hHighPrice'?: string;
  '24hLowPrice'?: string;
  '24hChangePrice'?: string;
  lastPrice?: string;
  lastBuyPrice?: string;
  lastSellPrice?: string;
}

interface WallGoldMarket {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  faName?: string;
  enName?: string;
  buyStatus?: 'enable' | 'disable';
  sellStatus?: 'enable' | 'disable';
  IsEnableBuySide?: boolean;
  IsEnableSellSide?: boolean;
  marketCap?: WallGoldMarketCap;
}

interface WallGoldSidePrice {
  price: string;
  priceExpiresAt: string;
  currentTime: string;
  ttl: number;
}

// Wallgold currently lists only 18-karat gold (750 purity) priced in Toman per gram.
const SYMBOL_TO_PRODUCT: Record<string, ProductId> = {
  GLD_18C_750TMN: '18k-gold',
};

export class WallGoldProvider extends BaseProvider {
  readonly providerId = 'wallgold';
  readonly name = 'WallGold';

  private static readonly API_BASE = 'https://api.wallgold.ir/api/v1';
  private static readonly DEFAULT_HEADERS = {
    Origin: 'https://wallgold.ir',
    Referer: 'https://wallgold.ir/',
    'Accept-Encoding': 'gzip, deflate, br',
  };

  constructor() {
    super('wallgold');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const marketsResp = await this.makeRequest<WallGoldEnvelope<WallGoldMarket[]>>(
      `${WallGoldProvider.API_BASE}/markets`,
      { method: 'GET', headers: WallGoldProvider.DEFAULT_HEADERS },
      correlationId
    );

    if (!marketsResp?.success || !Array.isArray(marketsResp.result)) {
      throw new Error(`WallGold markets API error: ${marketsResp?.message ?? 'no result'}`);
    }

    const trackedMarkets = marketsResp.result.filter((m) => SYMBOL_TO_PRODUCT[m.symbol]);

    const quotes = await Promise.all(
      trackedMarkets.map((market) => this.buildPriceForMarket(market, correlationId))
    );

    return quotes.filter((p): p is NormalizedPrice => p !== null);
  }

  private async buildPriceForMarket(
    market: WallGoldMarket,
    correlationId: string
  ): Promise<NormalizedPrice | null> {
    const productId = SYMBOL_TO_PRODUCT[market.symbol];
    if (!productId) return null;

    let buyTmn: number | null = null;
    let sellTmn: number | null = null;

    try {
      const [buy, sell] = await Promise.all([
        this.fetchSidePrice(market.symbol, 'buy', correlationId),
        this.fetchSidePrice(market.symbol, 'sell', correlationId),
      ]);
      buyTmn = buy;
      sellTmn = sell;
    } catch (err) {
      this.logger.debug(`WallGold side price fetch failed for ${market.symbol}`, {
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const mc = market.marketCap;
    if (buyTmn === null) {
      buyTmn = parseNumber(mc?.lastBuyPrice) ?? parseNumber(mc?.lastPrice);
    }
    if (sellTmn === null) {
      sellTmn = parseNumber(mc?.lastSellPrice) ?? parseNumber(mc?.lastPrice);
    }

    if (buyTmn === null || sellTmn === null || buyTmn <= 0 || sellTmn <= 0) {
      this.logger.warn(`WallGold no usable price for ${market.symbol}`, { correlationId });
      return null;
    }

    // WallGold quotes are in Toman per gram; Talafee normalizes to Rial.
    const buyRial = buyTmn * 10;
    const sellRial = sellTmn * 10;

    const dailyHigh = toRial(parseNumber(mc?.['24hHighPrice']));
    const dailyLow = toRial(parseNumber(mc?.['24hLowPrice']));

    const rawChange = parseNumber(mc?.['24hChangePrice']);
    const priceChangePercent = rawChange !== null ? rawChange * 100 : undefined;
    const direction: 'up' | 'down' | 'stable' | undefined =
      priceChangePercent === undefined
        ? undefined
        : priceChangePercent > 0
          ? 'up'
          : priceChangePercent < 0
            ? 'down'
            : 'stable';

    return this.createNormalizedPrice({
      symbol: market.symbol,
      productId,
      buyPrice: buyRial,
      sellPrice: sellRial,
      dailyHigh,
      dailyLow,
      priceChangePercent,
      direction,
      correlationId,
    });
  }

  private async fetchSidePrice(
    symbol: string,
    side: 'buy' | 'sell',
    correlationId: string
  ): Promise<number | null> {
    const url = `${WallGoldProvider.API_BASE}/price?side=${side}&symbol=${encodeURIComponent(symbol)}`;
    const resp = await this.makeRequest<WallGoldEnvelope<WallGoldSidePrice>>(
      url,
      { method: 'GET', headers: WallGoldProvider.DEFAULT_HEADERS },
      correlationId
    );
    if (!resp?.success || !resp.result?.price) return null;
    return parseNumber(resp.result.price);
  }
}

function parseNumber(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function toRial(tmn: number | null | undefined): number | undefined {
  return tmn === null || tmn === undefined ? undefined : tmn * 10;
}
