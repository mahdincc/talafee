import type { IResultSink } from '../core/interfaces/index.js';
import type { NormalizedPrice, CrawlRunSummary } from '../core/models/index.js';
import { logger } from '../utils/index.js';
import type { BubbleService } from '../services/BubbleService.js';
import type { TGJUProvider } from '../providers/TGJUProvider.js';
import { getInvestmentGuideService } from '../services/InvestmentGuideService.js';
import { getPriceAccuracyTracker } from '../services/PriceAccuracyTracker.js';
import { getTrustScoreService } from '../services/TrustScoreService.js';

interface CacheEntry {
  prices: NormalizedPrice[];
  fetchedAt: Date;
}

export class ApiCacheSink implements IResultSink {
  readonly sinkName = 'ApiCacheSink';

  private cache: Map<string, CacheEntry> = new Map();
  private productCache: Map<string, NormalizedPrice[]> = new Map();
  private lastRunSummary?: CrawlRunSummary;
  private priceHistory: Map<string, NormalizedPrice[]> = new Map();
  private maxHistorySize = 1000;
  private bubbleService: BubbleService | null = null;
  private tgjuProvider: TGJUProvider | null = null;

  async initialize(): Promise<void> {
    logger.info(`Initializing API cache sink`);
  }

  /**
   * Set up integration with BubbleService to update world prices and market prices
   */
  setBubbleServiceIntegration(bubbleService: BubbleService, tgjuProvider: TGJUProvider | null): void {
    this.bubbleService = bubbleService;
    this.tgjuProvider = tgjuProvider;
    logger.info('BubbleService integration configured');
  }

  async onPricesFetched(
    providerId: string,
    prices: NormalizedPrice[],
    correlationId: string
  ): Promise<void> {
    this.cache.set(providerId, {
      prices,
      fetchedAt: new Date(),
    });

    for (const price of prices) {
      const existing = this.productCache.get(price.productId) ?? [];
      const filtered = existing.filter((p) => p.providerId !== providerId);
      filtered.push(price);
      this.productCache.set(price.productId, filtered);

      const historyKey = `${providerId}:${price.productId}`;
      const history = this.priceHistory.get(historyKey) ?? [];
      history.push(price);
      if (history.length > this.maxHistorySize) {
        history.shift();
      }
      this.priceHistory.set(historyKey, history);
    }

    // Track price accuracy for trust system
    const accuracyTracker = getPriceAccuracyTracker();
    accuracyTracker.trackPrices(providerId, prices);

    // Track price spreads for best_spread badge
    const trustService = getTrustScoreService();
    for (const price of prices) {
      if (price.buyPrice > 0 && price.sellPrice > 0) {
        trustService.trackPriceSpread(providerId, price.buyPrice, price.sellPrice);
      }
    }

    logger.debug(`Cached ${prices.length} prices`, {
      providerId,
      correlationId,
    });
  }

  async onCrawlRunComplete(summary: CrawlRunSummary): Promise<void> {
    this.lastRunSummary = summary;

    // Collect all prices
    const allPrices: NormalizedPrice[] = [];
    for (const entry of this.cache.values()) {
      allPrices.push(...entry.prices);
    }

    // Update BubbleService with latest data
    if (this.bubbleService) {
      this.bubbleService.updateLatestPrices(allPrices);

      // Get world price data from TGJU provider
      if (this.tgjuProvider) {
        const worldData = this.tgjuProvider.getWorldPriceData();
        if (worldData) {
          this.bubbleService.updateWorldPriceData({
            goldOunceUSD: worldData.goldOunceUSD,
            usdToIRR: worldData.usdToIRR,
            source: 'tgju',
            updatedAt: new Date(),
          });
        }
      }
    }

    // Update InvestmentGuideService with price history
    const guideService = getInvestmentGuideService();
    guideService.updatePrices(allPrices);
  }

  async getCurrentPrices(): Promise<Map<string, NormalizedPrice[]>> {
    const result = new Map<string, NormalizedPrice[]>();

    for (const [providerId, entry] of this.cache) {
      result.set(providerId, entry.prices);
    }

    return result;
  }

  async getLatestPriceForProduct(productId: string): Promise<NormalizedPrice | undefined> {
    const prices = this.productCache.get(productId);
    if (!prices || prices.length === 0) return undefined;

    return prices.reduce((best, current) =>
      current.fetchedAt > best.fetchedAt ? current : best
    );
  }

  async getPriceHistory(
    providerId: string,
    productId: string,
    hoursBack: number
  ): Promise<NormalizedPrice[]> {
    const historyKey = `${providerId}:${productId}`;
    const history = this.priceHistory.get(historyKey) ?? [];

    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    return history.filter((price) => price.fetchedAt >= cutoff);
  }

  async shutdown(): Promise<void> {
    this.cache.clear();
    this.productCache.clear();
    this.priceHistory.clear();
    logger.info(`API cache sink shut down`);
  }

  getAllPricesForProduct(productId: string): NormalizedPrice[] {
    return this.productCache.get(productId) ?? [];
  }

  getPricesByProvider(providerId: string): NormalizedPrice[] {
    return this.cache.get(providerId)?.prices ?? [];
  }

  getLastRunSummary(): CrawlRunSummary | undefined {
    return this.lastRunSummary;
  }

  getAllProducts(): string[] {
    return Array.from(this.productCache.keys());
  }

  getAllProviders(): string[] {
    return Array.from(this.cache.keys());
  }

  getTotalPriceCount(): number {
    let count = 0;
    for (const entry of this.cache.values()) {
      count += entry.prices.length;
    }
    return count;
  }

  getProviderCacheAge(providerId: string): number | undefined {
    const entry = this.cache.get(providerId);
    if (!entry) return undefined;
    return Date.now() - entry.fetchedAt.getTime();
  }

  isProviderStale(providerId: string, maxAgeMs: number): boolean {
    const age = this.getProviderCacheAge(providerId);
    return age === undefined || age > maxAgeMs;
  }
}
