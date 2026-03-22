import type { RetryConfig } from '../../config/crawler.config.js';
import { CrawlErrorType, type CrawlError } from '../core/models/index.js';
import { logger } from './logger.js';

export interface RetryOptions extends RetryConfig {
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export function classifyError(error: unknown): CrawlError {
  const timestamp = new Date();

  if (error instanceof Error) {
    const axiosError = error as { code?: string; response?: { status?: number } };

    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return {
        type: CrawlErrorType.Timeout,
        message: error.message,
        code: axiosError.code,
        retryable: true,
        timestamp,
      };
    }

    if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
      return {
        type: CrawlErrorType.Network,
        message: error.message,
        code: axiosError.code,
        retryable: true,
        timestamp,
      };
    }

    if (axiosError.response?.status) {
      const status = axiosError.response.status;

      if (status === 429 || status === 503) {
        return {
          type: CrawlErrorType.RateLimit,
          message: error.message,
          statusCode: status,
          retryable: true,
          timestamp,
        };
      }

      if (status === 401 || status === 403) {
        return {
          type: CrawlErrorType.Auth,
          message: error.message,
          statusCode: status,
          retryable: false,
          timestamp,
        };
      }

      if (status >= 400 && status < 500) {
        return {
          type: CrawlErrorType.Validation,
          message: error.message,
          statusCode: status,
          retryable: false,
          timestamp,
        };
      }

      if (status >= 500) {
        return {
          type: CrawlErrorType.Network,
          message: error.message,
          statusCode: status,
          retryable: true,
          timestamp,
        };
      }
    }

    if (error.name === 'SyntaxError' || error.message.includes('JSON')) {
      return {
        type: CrawlErrorType.Parse,
        message: error.message,
        retryable: false,
        timestamp,
      };
    }

    return {
      type: CrawlErrorType.Unknown,
      message: error.message,
      retryable: true,
      timestamp,
    };
  }

  return {
    type: CrawlErrorType.Unknown,
    message: String(error),
    retryable: true,
    timestamp,
  };
}

export function calculateDelay(
  attempt: number,
  options: RetryConfig
): number {
  const exponential = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt - 1);
  const delay = Math.min(options.maxDelayMs, exponential);
  const jitter = Math.floor(Math.random() * (options.jitterMs + 1));
  return delay + jitter;
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
  correlationId: string
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const crawlError = classifyError(error);

      if (attempt >= options.maxAttempts || !crawlError.retryable) {
        logger.error(`Retry exhausted or non-retryable error`, {
          correlationId,
          attempt,
          maxAttempts: options.maxAttempts,
          errorType: crawlError.type,
          retryable: crawlError.retryable,
          message: crawlError.message,
        });
        throw error;
      }

      const delayMs = calculateDelay(attempt, options);

      logger.warn(`Retry attempt ${attempt} failed, backing off ${delayMs}ms`, {
        correlationId,
        attempt,
        delayMs,
        errorType: crawlError.type,
        message: crawlError.message,
      });

      options.onRetry?.(attempt, lastError, delayMs);

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError ?? new Error('Retry exhausted with no error captured');
}
