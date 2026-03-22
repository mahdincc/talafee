import type { NormalizedPrice, CrawlRunSummary } from '../models/index.js';

export interface IResultSink {
  readonly sinkName: string;

  initialize(): Promise<void>;

  onPricesFetched(
    providerId: string,
    prices: NormalizedPrice[],
    correlationId: string
  ): Promise<void>;

  onCrawlRunComplete(summary: CrawlRunSummary): Promise<void>;

  getCurrentPrices(): Promise<Map<string, NormalizedPrice[]>>;

  getLatestPriceForProduct(productId: string): Promise<NormalizedPrice | undefined>;

  getPriceHistory(
    providerId: string,
    productId: string,
    hoursBack: number
  ): Promise<NormalizedPrice[]>;

  shutdown(): Promise<void>;
}
