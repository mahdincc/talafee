export enum CrawlErrorType {
  None = 'none',
  Network = 'network',
  Timeout = 'timeout',
  RateLimit = 'rate_limit',
  Auth = 'auth',
  Parse = 'parse',
  Validation = 'validation',
  Unknown = 'unknown',
}

export interface CrawlError {
  type: CrawlErrorType;
  message: string;
  code?: string | undefined;
  statusCode?: number | undefined;
  retryable: boolean;
  timestamp: Date;
}

export interface CrawlResult<T> {
  success: boolean;
  data?: T | undefined;
  error?: CrawlError | undefined;
  providerId: string;
  correlationId: string;
  fetchedAt: Date;
  durationMs: number;
  attemptCount: number;
}

export interface CrawlAttempt {
  attemptNumber: number;
  startedAt: Date;
  completedAt?: Date | undefined;
  error?: CrawlError | undefined;
  durationMs?: number | undefined;
}

export interface CrawlRunSummary {
  runId: string;
  startedAt: Date;
  completedAt: Date;
  totalProviders: number;
  successfulProviders: number;
  failedProviders: number;
  totalPricesCollected: number;
  providerResults: Map<string, ProviderRunResult>;
}

export interface ProviderRunResult {
  providerId: string;
  success: boolean;
  priceCount: number;
  durationMs: number;
  attempts: number;
  error?: CrawlError | undefined;
}
