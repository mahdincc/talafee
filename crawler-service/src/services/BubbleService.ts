import type { NormalizedPrice } from '../core/models/index.js';
import { logger } from '../utils/logger.js';

// Gold constants
const GRAMS_PER_OUNCE = 31.1035;
const PURITY_18K = 0.750;
const PURITY_24K = 0.999;

export interface WorldPriceData {
  goldOunceUSD: number;       // World gold ounce price in USD
  usdToIRR: number;           // USD to IRR exchange rate
  source: string;             // Data source (e.g., 'tgju', 'bonbast')
  updatedAt: Date;            // When data was fetched
}

export interface BubbleData {
  // World price data
  worldGoldOunceUSD: number;
  usdToIRR: number;

  // Theoretical prices (calculated from world price)
  theoretical18kPerGram: number;  // Theoretical 18k gold price per gram in Rials
  theoretical24kPerGram: number;  // Theoretical 24k gold price per gram in Rials

  // Average market prices (from Iranian providers)
  market18kPerGram: number;       // Average 18k gold price from providers
  market24kPerGram: number;       // Average 24k gold price from providers

  // Bubble percentages
  bubble18k: number;              // Bubble % for 18k gold
  bubble24k: number;              // Bubble % for 24k gold

  // Additional data
  providerCount18k: number;       // Number of providers with 18k prices
  providerCount24k: number;       // Number of providers with 24k prices
  priceRange18k: { min: number; max: number };  // Min/max 18k prices
  priceRange24k: { min: number; max: number };  // Min/max 24k prices

  // Meta
  calculatedAt: Date;
  dataSource: string;
}

export class BubbleService {
  private worldPriceData: WorldPriceData | null = null;
  private latestPrices: NormalizedPrice[] = [];

  /**
   * Update world price data (gold ounce and USD rate)
   */
  updateWorldPriceData(data: WorldPriceData): void {
    this.worldPriceData = data;
    logger.info('World price data updated', {
      goldOunceUSD: data.goldOunceUSD,
      usdToIRR: data.usdToIRR,
      source: data.source,
    });
  }

  /**
   * Update latest price data from providers
   */
  updateLatestPrices(prices: NormalizedPrice[]): void {
    this.latestPrices = prices;
  }

  /**
   * Calculate theoretical gold price per gram in Rials
   * Formula: (goldOunceUSD × usdToIRR × purity) / gramsPerOunce
   */
  calculateTheoreticalPrice(purity: number): number | null {
    if (!this.worldPriceData) {
      return null;
    }

    const { goldOunceUSD, usdToIRR } = this.worldPriceData;
    return (goldOunceUSD * usdToIRR * purity) / GRAMS_PER_OUNCE;
  }

  /**
   * Get average market price for a product from providers
   * Filters out obviously invalid prices (< 100,000 Rials per gram for gold)
   */
  getAverageMarketPrice(productId: string): { average: number; count: number; min: number; max: number } | null {
    // Minimum price thresholds in Rials
    const MIN_PRICE_THRESHOLDS: Record<string, number> = {
      '18k-gold': 1000000,     // 18k gold should be at least 100,000 Tomans/gram
      '24k-gold': 1500000,     // 24k gold should be at least 150,000 Tomans/gram
      'mesghal': 5000000,      // Mesghal should be at least 500,000 Tomans
      'emami-coin': 300000000, // Emami coin should be at least 30,000,000 Tomans
      'bahar-azadi': 300000000,
      'half-coin': 150000000,
      'quarter-coin': 80000000,
      'gram-coin': 30000000,
    };

    const minPrice = MIN_PRICE_THRESHOLDS[productId] || 100000;

    const productPrices = this.latestPrices
      .filter(p => p.productId === productId)
      .filter(p => p.buyPrice >= minPrice); // Filter out obviously invalid prices

    if (productPrices.length === 0) {
      return null;
    }

    const prices = productPrices.map(p => p.buyPrice);
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = sum / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return {
      average,
      count: prices.length,
      min,
      max,
    };
  }

  /**
   * Calculate bubble percentage
   * Formula: ((marketPrice - theoreticalPrice) / theoreticalPrice) × 100
   */
  calculateBubblePercent(marketPrice: number, theoreticalPrice: number): number {
    if (theoreticalPrice <= 0) {
      return 0;
    }
    return ((marketPrice - theoreticalPrice) / theoreticalPrice) * 100;
  }

  /**
   * Calculate complete bubble data
   */
  calculateBubble(): BubbleData | null {
    if (!this.worldPriceData) {
      logger.warn('Cannot calculate bubble: no world price data');
      return null;
    }

    const { goldOunceUSD, usdToIRR, source } = this.worldPriceData;

    // Calculate theoretical prices
    const theoretical18k = this.calculateTheoreticalPrice(PURITY_18K);
    const theoretical24k = this.calculateTheoreticalPrice(PURITY_24K);

    if (!theoretical18k || !theoretical24k) {
      logger.warn('Cannot calculate theoretical prices');
      return null;
    }

    // Get market prices
    const market18k = this.getAverageMarketPrice('18k-gold');
    const market24k = this.getAverageMarketPrice('24k-gold');

    // Calculate bubble percentages
    const bubble18k = market18k
      ? this.calculateBubblePercent(market18k.average, theoretical18k)
      : 0;
    const bubble24k = market24k
      ? this.calculateBubblePercent(market24k.average, theoretical24k)
      : 0;

    const result: BubbleData = {
      worldGoldOunceUSD: goldOunceUSD,
      usdToIRR: usdToIRR,

      theoretical18kPerGram: theoretical18k,
      theoretical24kPerGram: theoretical24k,

      market18kPerGram: market18k?.average || 0,
      market24kPerGram: market24k?.average || 0,

      bubble18k: Math.round(bubble18k * 100) / 100,  // Round to 2 decimals
      bubble24k: Math.round(bubble24k * 100) / 100,

      providerCount18k: market18k?.count || 0,
      providerCount24k: market24k?.count || 0,

      priceRange18k: { min: market18k?.min || 0, max: market18k?.max || 0 },
      priceRange24k: { min: market24k?.min || 0, max: market24k?.max || 0 },

      calculatedAt: new Date(),
      dataSource: source,
    };

    logger.info('Bubble calculated', {
      bubble18k: result.bubble18k,
      bubble24k: result.bubble24k,
      theoretical18k: result.theoretical18kPerGram,
      market18k: result.market18kPerGram,
    });

    return result;
  }

  /**
   * Get current world price data
   */
  getWorldPriceData(): WorldPriceData | null {
    return this.worldPriceData;
  }

  /**
   * Check if bubble calculation is available
   */
  isAvailable(): boolean {
    return this.worldPriceData !== null && this.latestPrices.length > 0;
  }
}

// Singleton instance
let bubbleService: BubbleService | null = null;

export function getBubbleService(): BubbleService {
  if (!bubbleService) {
    bubbleService = new BubbleService();
  }
  return bubbleService;
}
