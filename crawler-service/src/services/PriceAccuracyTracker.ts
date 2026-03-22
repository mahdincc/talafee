import type { SqliteSink, PriceAccuracyStats } from '../sinks/SqliteSink.js';
import type { NormalizedPrice } from '../core/models/index.js';
import { logger } from '../utils/logger.js';
import { getTrustScoreService } from './TrustScoreService.js';

// Minimum prices thresholds to filter invalid data
const MIN_PRICE_THRESHOLDS: Record<string, number> = {
  '18k-gold': 1000000,
  '24k-gold': 1500000,
  'mesghal': 5000000,
  'emami-coin': 300000000,
  'bahar-azadi': 300000000,
  'half-coin': 150000000,
  'quarter-coin': 80000000,
  'gram-coin': 30000000,
};

// Price anomaly thresholds
const ANOMALY_THRESHOLD_PERCENT = 5; // > 5% deviation triggers warning
const CRITICAL_ANOMALY_THRESHOLD = 10; // > 10% is critical

export interface PriceAnomaly {
  providerId: string;
  productId: string;
  providerPrice: number;
  marketAverage: number;
  deviationPercent: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
}

export interface AccuracyReport {
  providerId: string;
  stats: PriceAccuracyStats | null;
  anomalies: PriceAnomaly[];
  rank: number;
  totalProviders: number;
}

export class PriceAccuracyTracker {
  private dbSink: SqliteSink | null = null;
  private currentPrices: Map<string, Map<string, number>> = new Map(); // providerId -> (productId -> price)

  /**
   * Initialize with database sink
   */
  initialize(dbSink: SqliteSink): void {
    this.dbSink = dbSink;
    logger.info('PriceAccuracyTracker initialized');
  }

  /**
   * Track price deviation from market average
   * Called when new prices are fetched
   */
  trackPrices(providerId: string, prices: NormalizedPrice[]): void {
    if (!this.dbSink) return;

    // Update current prices cache
    const providerPrices = new Map<string, number>();
    for (const price of prices) {
      providerPrices.set(price.productId, price.avgPrice);
    }
    this.currentPrices.set(providerId, providerPrices);

    // Calculate market averages and log deviations
    for (const price of prices) {
      const marketAvg = this.calculateMarketAverage(price.productId, providerId);
      if (marketAvg !== null && marketAvg > 0) {
        this.dbSink.logPriceAccuracy(
          providerId,
          price.productId,
          price.avgPrice,
          marketAvg
        );

        // Check for anomalies
        this.checkForAnomaly(providerId, price.productId, price.avgPrice, marketAvg);
      }
    }

    // Update TrustScoreService with last fetch time
    getTrustScoreService().updateLastFetchTime(providerId);
  }

  /**
   * Calculate market average for a product (excluding current provider)
   */
  private calculateMarketAverage(productId: string, excludeProviderId: string): number | null {
    const minPrice = MIN_PRICE_THRESHOLDS[productId] || 100000;
    const prices: number[] = [];

    for (const [providerId, providerPrices] of this.currentPrices) {
      if (providerId === excludeProviderId) continue;

      const price = providerPrices.get(productId);
      if (price && price >= minPrice) {
        prices.push(price);
      }
    }

    if (prices.length < 2) {
      return null; // Need at least 2 other providers for meaningful average
    }

    return prices.reduce((a, b) => a + b, 0) / prices.length;
  }

  /**
   * Check if price deviation constitutes an anomaly
   */
  private checkForAnomaly(
    providerId: string,
    productId: string,
    providerPrice: number,
    marketAverage: number
  ): void {
    const deviationPercent = Math.abs(((providerPrice - marketAverage) / marketAverage) * 100);

    if (deviationPercent >= ANOMALY_THRESHOLD_PERCENT) {
      const severity = this.getSeverity(deviationPercent);

      // Create warning in trust system
      const trustService = getTrustScoreService();
      trustService.createWarning(
        providerId,
        'price_anomaly',
        severity,
        `Price for ${productId} deviates ${deviationPercent.toFixed(1)}% from market average`,
        `قیمت ${productId} ${deviationPercent.toFixed(1)}٪ با میانگین بازار اختلاف دارد`
      );

      logger.warn('Price anomaly detected', {
        providerId,
        productId,
        deviationPercent: deviationPercent.toFixed(1),
        severity,
      });
    }
  }

  /**
   * Get severity level from deviation percentage
   */
  private getSeverity(deviationPercent: number): 'low' | 'medium' | 'high' | 'critical' {
    if (deviationPercent >= CRITICAL_ANOMALY_THRESHOLD) return 'critical';
    if (deviationPercent >= 7.5) return 'high';
    if (deviationPercent >= ANOMALY_THRESHOLD_PERCENT) return 'medium';
    return 'low';
  }

  /**
   * Get accuracy statistics for a provider
   */
  getProviderAccuracy(providerId: string, days: number = 7): PriceAccuracyStats | null {
    if (!this.dbSink) return null;
    return this.dbSink.getPriceAccuracyStats(providerId, days) ?? null;
  }

  /**
   * Get accuracy report for all providers
   */
  getAllProvidersAccuracy(days: number = 7): AccuracyReport[] {
    if (!this.dbSink) return [];

    const providerIds = Array.from(this.currentPrices.keys());
    const reports: AccuracyReport[] = [];

    for (const providerId of providerIds) {
      const stats = this.getProviderAccuracy(providerId, days);
      reports.push({
        providerId,
        stats,
        anomalies: [], // TODO: Get from warnings
        rank: 0,
        totalProviders: providerIds.length,
      });
    }

    // Sort by absolute deviation (lower is better)
    reports.sort((a, b) => {
      if (!a.stats) return 1;
      if (!b.stats) return -1;
      return a.stats.avgAbsDeviation - b.stats.avgAbsDeviation;
    });

    // Assign ranks
    reports.forEach((report, index) => {
      report.rank = index + 1;
    });

    return reports;
  }

  /**
   * Get current price comparison for a product
   */
  getPriceComparison(productId: string): Array<{
    providerId: string;
    price: number;
    deviationFromAvg: number;
  }> {
    const minPrice = MIN_PRICE_THRESHOLDS[productId] || 100000;
    const prices: Array<{ providerId: string; price: number }> = [];

    for (const [providerId, providerPrices] of this.currentPrices) {
      const price = providerPrices.get(productId);
      if (price && price >= minPrice) {
        prices.push({ providerId, price });
      }
    }

    if (prices.length === 0) return [];

    // Calculate average
    const avg = prices.reduce((sum, p) => sum + p.price, 0) / prices.length;

    // Return with deviation
    return prices.map(p => ({
      providerId: p.providerId,
      price: p.price,
      deviationFromAvg: ((p.price - avg) / avg) * 100,
    })).sort((a, b) => a.price - b.price);
  }

  /**
   * Clear cached prices (e.g., on provider failure)
   */
  clearProviderPrices(providerId: string): void {
    this.currentPrices.delete(providerId);
  }

  /**
   * Get number of active providers
   */
  getActiveProviderCount(): number {
    return this.currentPrices.size;
  }
}

// Singleton instance
let priceAccuracyTracker: PriceAccuracyTracker | null = null;

export function getPriceAccuracyTracker(): PriceAccuracyTracker {
  if (!priceAccuracyTracker) {
    priceAccuracyTracker = new PriceAccuracyTracker();
  }
  return priceAccuracyTracker;
}
