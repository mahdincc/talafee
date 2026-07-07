import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type { IProvider, IAuthStrategy } from './interfaces/index.js';
import {
  type NormalizedPrice,
  type CrawlResult,
  type ProviderHealth,
  CrawlErrorType,
  HealthStatus,
} from './models/index.js';
import {
  withRetry,
  classifyError,
  globalThrottle,
  createChildLogger,
  normalizePriceToRials,
} from '../utils/index.js';
import config, { type ProviderConfig } from '../../config/crawler.config.js';

function rescaleOptional(
  productId: string,
  raw: number | undefined
): number | undefined {
  if (raw === undefined) return undefined;
  const result = normalizePriceToRials(productId, raw);
  return result.rials ?? undefined;
}

export interface ProviderStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTimeMs: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastError?: string;
  consecutiveFailures: number;
  consecutiveEmptyFetches: number;
  lastPriceCount?: number;
}

// A provider whose endpoint is reachable but yields no usable prices for this
// many consecutive crawls is reported `degraded` — "reachable, no data" is not
// the same as "healthy".
const EMPTY_FETCH_DEGRADE_THRESHOLD = 2;

export abstract class BaseProvider implements IProvider {
  protected readonly httpClient: AxiosInstance;
  protected readonly logger;
  protected readonly providerConfig: ProviderConfig;
  protected authStrategy?: IAuthStrategy;
  protected stats: ProviderStats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTimeMs: 0,
    consecutiveFailures: 0,
    consecutiveEmptyFetches: 0,
  };

  abstract readonly providerId: string;
  abstract readonly name: string;

  get enabled(): boolean {
    return this.providerConfig.enabled;
  }

  constructor(providerId: string) {
    this.providerConfig = config.providers[providerId] ?? {
      id: providerId,
      name: providerId,
      enabled: false,
      apiUrl: '',
      timeout: 10000,
      rateLimit: { maxConcurrent: 1, minDelayMs: 1000 },
    };

    this.logger = createChildLogger(providerId);

    this.httpClient = axios.create({
      timeout: this.providerConfig.timeout,
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9,fa;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      },
    });
  }

  setAuthStrategy(strategy: IAuthStrategy): void {
    this.authStrategy = strategy;
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing provider: ${this.name}`);
  }

  async shutdown(): Promise<void> {
    this.logger.info(`Shutting down provider: ${this.name}`);
  }

  async fetchPrices(correlationId: string): Promise<CrawlResult<NormalizedPrice[]>> {
    const startTime = Date.now();
    let attemptCount = 0;

    this.stats.totalRequests++;

    try {
      const lease = await globalThrottle.acquire(this.providerId, {
        maxConcurrent: this.providerConfig.rateLimit.maxConcurrent,
        minDelayMs: this.providerConfig.rateLimit.minDelayMs,
      });

      try {
        const rawPrices = await withRetry(
          async (attempt) => {
            attemptCount = attempt;
            return this.doFetch(correlationId);
          },
          {
            ...config.retry,
            onRetry: (attempt, error, delayMs) => {
              this.logger.warn(`Retry attempt ${attempt}`, {
                correlationId,
                error: error.message,
                delayMs,
              });
            },
          },
          correlationId
        );

        // Drop prices that the normalizer in createNormalizedPrice flagged
        // as unrecoverable (sellPrice/buyPrice zeroed out).
        const prices = rawPrices.filter(
          (p) => p.sellPrice > 0 && p.buyPrice > 0
        );
        const droppedCount = rawPrices.length - prices.length;

        const durationMs = Date.now() - startTime;
        this.recordSuccess(durationMs, prices.length);

        this.logger.info(`Successfully fetched ${prices.length} prices`, {
          correlationId,
          priceCount: prices.length,
          droppedCount,
          durationMs,
          attempts: attemptCount,
        });

        return {
          success: true,
          data: prices,
          providerId: this.providerId,
          correlationId,
          fetchedAt: new Date(),
          durationMs,
          attemptCount,
        };
      } finally {
        lease.release();
      }
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const crawlError = classifyError(error);
      this.recordFailure(crawlError.message);

      this.logger.error(`Failed to fetch prices`, {
        correlationId,
        errorType: crawlError.type,
        message: crawlError.message,
        durationMs,
        attempts: attemptCount,
      });

      return {
        success: false,
        error: crawlError,
        providerId: this.providerId,
        correlationId,
        fetchedAt: new Date(),
        durationMs,
        attemptCount,
      };
    }
  }

  protected abstract doFetch(correlationId: string): Promise<NormalizedPrice[]>;

  protected async makeRequest<T>(
    url: string,
    options: AxiosRequestConfig = {},
    correlationId: string
  ): Promise<T> {
    let requestConfig: AxiosRequestConfig = {
      ...options,
      url,
      headers: {
        ...options.headers,
        'X-Correlation-Id': correlationId,
      },
    };

    if (this.authStrategy) {
      requestConfig = await this.authStrategy.applyAuth(requestConfig, {
        providerId: this.providerId,
        correlationId,
      });
    }

    this.logger.debug(`Making request`, {
      correlationId,
      method: requestConfig.method ?? 'GET',
      url,
    });

    const response = await this.httpClient.request<T>(requestConfig);
    return response.data;
  }

  protected createNormalizedPrice(params: {
    symbol: string;
    productId: string;
    buyPrice: number;
    sellPrice: number;
    dailyHigh?: number;
    dailyLow?: number;
    priceChange24h?: number;
    priceChangePercent?: number;
    direction?: 'up' | 'down' | 'stable';
    buyWage?: number;
    sellWage?: number;
    providerUpdatedAt?: Date;
    correlationId: string;
  }): NormalizedPrice {
    const buy = normalizePriceToRials(params.productId, params.buyPrice);
    const sell = normalizePriceToRials(params.productId, params.sellPrice);

    // If either side can't be brought into the expected range, mark the
    // price as invalid (zeroed) so the central filter in fetchPrices drops
    // it. This keeps `* 10` mistakes and partial regex matches from
    // poisoning the comparison UI.
    if (buy.rials === null || sell.rials === null) {
      this.logger.warn('Dropping out-of-range price', {
        productId: params.productId,
        symbol: params.symbol,
        rawBuy: params.buyPrice,
        rawSell: params.sellPrice,
        correlationId: params.correlationId,
      });
      return {
        id: uuidv4(),
        providerId: this.providerId,
        productId: params.productId,
        symbol: params.symbol,
        buyPrice: 0,
        sellPrice: 0,
        avgPrice: 0,
        providerUpdatedAt: params.providerUpdatedAt ?? new Date(),
        fetchedAt: new Date(),
        correlationId: params.correlationId,
      };
    }

    if (buy.scaleFactor !== 1 || sell.scaleFactor !== 1) {
      this.logger.info('Rescaled price to expected magnitude', {
        productId: params.productId,
        symbol: params.symbol,
        buyScale: buy.scaleFactor,
        sellScale: sell.scaleFactor,
        rawBuy: params.buyPrice,
        rawSell: params.sellPrice,
        correlationId: params.correlationId,
      });
    }

    const buyPrice = buy.rials;
    const sellPrice = sell.rials;
    const avgPrice = (buyPrice + sellPrice) / 2;

    // Optional fields: rescale by the same factor used for sell, but only
    // if the result lands in range. Otherwise drop the field rather than
    // emitting a misleading high/low.
    const dailyHigh = rescaleOptional(params.productId, params.dailyHigh);
    const dailyLow = rescaleOptional(params.productId, params.dailyLow);

    return {
      id: uuidv4(),
      providerId: this.providerId,
      productId: params.productId,
      symbol: params.symbol,
      buyPrice,
      sellPrice,
      avgPrice,
      buyWage: params.buyWage,
      sellWage: params.sellWage,
      dailyHigh,
      dailyLow,
      priceChange24h: params.priceChange24h,
      priceChangePercent: params.priceChangePercent,
      direction: params.direction,
      providerUpdatedAt: params.providerUpdatedAt ?? new Date(),
      fetchedAt: new Date(),
      correlationId: params.correlationId,
    };
  }

  async getHealth(): Promise<ProviderHealth> {
    const totalRequests = this.stats.totalRequests || 1;
    const successRate = (this.stats.successfulRequests / totalRequests) * 100;
    const avgResponseTime =
      this.stats.successfulRequests > 0
        ? this.stats.totalResponseTimeMs / this.stats.successfulRequests
        : 0;

    let status: HealthStatus;
    let statusReason: string | undefined;
    if (this.stats.totalRequests === 0) {
      status = HealthStatus.Unknown;
    } else if (this.stats.consecutiveFailures >= 5) {
      status = HealthStatus.Unhealthy;
    } else if (this.stats.consecutiveFailures >= 2 || successRate < 80) {
      status = HealthStatus.Degraded;
    } else if (this.stats.consecutiveEmptyFetches >= EMPTY_FETCH_DEGRADE_THRESHOLD) {
      status = HealthStatus.Degraded;
      statusReason = 'Reachable but returning no price data';
    } else {
      status = HealthStatus.Healthy;
    }

    return {
      providerId: this.providerId,
      name: this.name,
      status,
      lastSuccessAt: this.stats.lastSuccessAt,
      lastFailureAt: this.stats.lastFailureAt,
      lastError: this.stats.lastError,
      consecutiveFailures: this.stats.consecutiveFailures,
      successRate24h: successRate,
      avgResponseTimeMs: avgResponseTime,
      lastCheckAt: new Date(),
      lastPriceCount: this.stats.lastPriceCount,
      statusReason,
    };
  }

  private recordSuccess(durationMs: number, priceCount: number): void {
    this.stats.successfulRequests++;
    this.stats.totalResponseTimeMs += durationMs;
    this.stats.lastSuccessAt = new Date();
    this.stats.consecutiveFailures = 0;
    this.stats.lastPriceCount = priceCount;
    this.stats.consecutiveEmptyFetches =
      priceCount > 0 ? 0 : this.stats.consecutiveEmptyFetches + 1;
  }

  private recordFailure(errorMessage: string): void {
    this.stats.failedRequests++;
    this.stats.lastFailureAt = new Date();
    this.stats.lastError = errorMessage;
    this.stats.consecutiveFailures++;
  }
}
