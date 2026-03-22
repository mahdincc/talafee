import type { NormalizedPrice, CrawlResult, ProviderHealth } from '../models/index.js';

export interface IProvider {
  readonly providerId: string;
  readonly name: string;
  readonly enabled: boolean;

  fetchPrices(correlationId: string): Promise<CrawlResult<NormalizedPrice[]>>;

  getHealth(): Promise<ProviderHealth>;

  initialize?(): Promise<void>;

  shutdown?(): Promise<void>;
}
