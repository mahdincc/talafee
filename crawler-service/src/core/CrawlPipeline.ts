import { v4 as uuidv4 } from 'uuid';
import type { IProvider, IResultSink } from './interfaces/index.js';
import type {
  CrawlRunSummary,
  ProviderRunResult,
  ProviderHealth,
  SystemHealth,
} from './models/index.js';
import { HealthStatus, CrawlErrorType } from './models/index.js';
import { logger } from '../utils/index.js';

export class CrawlPipeline {
  private providers: IProvider[] = [];
  private sinks: IResultSink[] = [];
  private isRunning = false;
  private lastRunSummary?: CrawlRunSummary;
  private startedAt: Date;

  constructor() {
    this.startedAt = new Date();
  }

  registerProvider(provider: IProvider): void {
    if (provider.enabled) {
      this.providers.push(provider);
      logger.info(`Registered provider: ${provider.name}`);
    } else {
      logger.info(`Skipped disabled provider: ${provider.name}`);
    }
  }

  registerSink(sink: IResultSink): void {
    this.sinks.push(sink);
    logger.info(`Registered sink: ${sink.sinkName}`);
  }

  async initialize(): Promise<void> {
    logger.info(`Initializing crawl pipeline with ${this.providers.length} providers and ${this.sinks.length} sinks`);

    for (const sink of this.sinks) {
      await sink.initialize();
    }

    for (const provider of this.providers) {
      if (provider.initialize) {
        await provider.initialize();
      }
    }

    logger.info(`Crawl pipeline initialized successfully`);
  }

  async runCrawl(): Promise<CrawlRunSummary> {
    if (this.isRunning) {
      logger.warn(`Crawl already in progress, skipping`);
      return this.lastRunSummary!;
    }

    this.isRunning = true;
    const runId = uuidv4();
    const startedAt = new Date();
    const correlationId = runId;

    logger.info(`Starting crawl run`, { runId });

    const providerResults = new Map<string, ProviderRunResult>();
    let totalPricesCollected = 0;
    let successfulProviders = 0;
    let failedProviders = 0;

    const crawlPromises = this.providers.map(async (provider) => {
      const providerStartTime = Date.now();

      try {
        const result = await provider.fetchPrices(correlationId);

        if (result.success && result.data) {
          for (const sink of this.sinks) {
            await sink.onPricesFetched(provider.providerId, result.data, correlationId);
          }

          totalPricesCollected += result.data.length;
          successfulProviders++;

          providerResults.set(provider.providerId, {
            providerId: provider.providerId,
            success: true,
            priceCount: result.data.length,
            durationMs: Date.now() - providerStartTime,
            attempts: result.attemptCount,
          });
        } else {
          failedProviders++;

          providerResults.set(provider.providerId, {
            providerId: provider.providerId,
            success: false,
            priceCount: 0,
            durationMs: Date.now() - providerStartTime,
            attempts: result.attemptCount,
            error: result.error,
          });
        }
      } catch (error) {
        failedProviders++;

        providerResults.set(provider.providerId, {
          providerId: provider.providerId,
          success: false,
          priceCount: 0,
          durationMs: Date.now() - providerStartTime,
          attempts: 1,
          error: {
            type: CrawlErrorType.Unknown,
            message: error instanceof Error ? error.message : String(error),
            retryable: false,
            timestamp: new Date(),
          },
        });

        logger.error(`Unexpected error from provider`, {
          providerId: provider.providerId,
          correlationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.all(crawlPromises);

    const completedAt = new Date();
    const summary: CrawlRunSummary = {
      runId,
      startedAt,
      completedAt,
      totalProviders: this.providers.length,
      successfulProviders,
      failedProviders,
      totalPricesCollected,
      providerResults,
    };

    for (const sink of this.sinks) {
      await sink.onCrawlRunComplete(summary);
    }

    this.lastRunSummary = summary;
    this.isRunning = false;

    logger.info(`Crawl run completed`, {
      runId,
      durationMs: completedAt.getTime() - startedAt.getTime(),
      totalPrices: totalPricesCollected,
      successfulProviders,
      failedProviders,
    });

    return summary;
  }

  async getProviderHealth(): Promise<ProviderHealth[]> {
    const healthPromises = this.providers.map((provider) => provider.getHealth());
    return Promise.all(healthPromises);
  }

  async getSystemHealth(): Promise<SystemHealth> {
    const providerHealths = await this.getProviderHealth();

    const healthyCount = providerHealths.filter(
      (h) => h.status === HealthStatus.Healthy
    ).length;
    const unhealthyCount = providerHealths.filter(
      (h) => h.status === HealthStatus.Unhealthy
    ).length;

    let status: HealthStatus;
    if (unhealthyCount === this.providers.length) {
      status = HealthStatus.Unhealthy;
    } else if (unhealthyCount > 0 || healthyCount < this.providers.length / 2) {
      status = HealthStatus.Degraded;
    } else {
      status = HealthStatus.Healthy;
    }

    let totalPricesInCache = 0;
    for (const sink of this.sinks) {
      const prices = await sink.getCurrentPrices();
      for (const priceList of prices.values()) {
        totalPricesInCache += priceList.length;
      }
    }

    return {
      status,
      uptime: Date.now() - this.startedAt.getTime(),
      providers: providerHealths,
      lastCrawlAt: this.lastRunSummary?.completedAt,
      nextCrawlAt: undefined,
      totalPricesInCache,
      dbConnected: true,
    };
  }

  getLastRunSummary(): CrawlRunSummary | undefined {
    return this.lastRunSummary;
  }

  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  getProviders(): IProvider[] {
    return [...this.providers];
  }

  getSinks(): IResultSink[] {
    return [...this.sinks];
  }

  async shutdown(): Promise<void> {
    logger.info(`Shutting down crawl pipeline`);

    for (const provider of this.providers) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
    }

    for (const sink of this.sinks) {
      await sink.shutdown();
    }

    logger.info(`Crawl pipeline shut down successfully`);
  }
}
