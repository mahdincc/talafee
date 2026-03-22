import type { NormalizedPrice } from '../core/models/index.js';
import { logger } from '../utils/logger.js';
import { getBubbleService } from './BubbleService.js';

// Signal strength levels
export type SignalStrength = 'strong' | 'moderate' | 'weak' | 'neutral';
export type SignalDirection = 'buy' | 'sell' | 'hold';
export type MarketTrend = 'bullish' | 'bearish' | 'sideways';
export type RiskLevel = 'low' | 'medium' | 'high' | 'very-high';

export interface TechnicalIndicators {
  // Price momentum
  priceChange24h: number;          // % change in last 24h
  priceChange7d: number;           // % change in last 7 days
  priceChange30d: number;          // % change in last 30 days

  // Volatility
  volatility: number;              // Price volatility %

  // Simulated RSI (0-100)
  rsi: number;
  rsiSignal: 'overbought' | 'oversold' | 'neutral';

  // Simulated MACD
  macdSignal: 'bullish' | 'bearish' | 'neutral';

  // Moving average trend
  maTrend: MarketTrend;
}

export interface InvestmentSignal {
  direction: SignalDirection;
  strength: SignalStrength;
  confidence: number;              // 0-100%
  reasons: string[];
  timestamp: Date;
}

export interface MarketSentiment {
  overall: 'positive' | 'negative' | 'neutral';
  score: number;                   // -100 to +100
  factors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    weight: number;
  }[];
}

export interface InvestmentTip {
  id: string;
  category: 'beginner' | 'timing' | 'risk' | 'strategy';
  title: string;
  titleFa: string;
  content: string;
  contentFa: string;
  priority: number;
}

export interface GoldInvestmentGuide {
  // Current market state
  currentPrice18k: number;
  currentPrice24k: number;
  priceUnit: string;

  // Technical analysis
  technicalIndicators: TechnicalIndicators;

  // Investment signals
  buySignal: InvestmentSignal;
  sellSignal: InvestmentSignal;
  overallRecommendation: SignalDirection;

  // Market context
  marketSentiment: MarketSentiment;
  bubblePercent: number;
  riskLevel: RiskLevel;

  // Educational content
  tips: InvestmentTip[];

  // Meta
  lastUpdated: Date;
  dataSource: string;
}

// Educational tips for beginners
const INVESTMENT_TIPS: InvestmentTip[] = [
  {
    id: 'tip-1',
    category: 'beginner',
    title: 'Start Small',
    titleFa: 'از مقدار کم شروع کنید',
    content: 'Begin with a small investment (1-5% of savings) to learn the market without significant risk.',
    contentFa: 'با سرمایه‌گذاری کوچک (۱-۵٪ از پس‌انداز) شروع کنید تا بدون ریسک زیاد با بازار آشنا شوید.',
    priority: 1,
  },
  {
    id: 'tip-2',
    category: 'beginner',
    title: 'Understand the Bubble',
    titleFa: 'حباب قیمت را بفهمید',
    content: 'When bubble % is high (>20%), prices are inflated compared to global rates. Consider waiting for correction.',
    contentFa: 'وقتی درصد حباب بالاست (بیش از ۲۰٪)، قیمت‌ها نسبت به نرخ جهانی متورم است. صبر برای اصلاح را در نظر بگیرید.',
    priority: 2,
  },
  {
    id: 'tip-3',
    category: 'timing',
    title: 'Best Time to Buy',
    titleFa: 'بهترین زمان خرید',
    content: 'Buy when RSI is below 30 (oversold) and bubble is low. Avoid buying when RSI is above 70.',
    contentFa: 'زمانی بخرید که RSI زیر ۳۰ (فروش بیش از حد) و حباب کم است. از خرید در RSI بالای ۷۰ اجتناب کنید.',
    priority: 1,
  },
  {
    id: 'tip-4',
    category: 'timing',
    title: 'Best Time to Sell',
    titleFa: 'بهترین زمان فروش',
    content: 'Consider selling when RSI exceeds 70 (overbought) or when bubble reaches extreme levels (>30%).',
    contentFa: 'زمانی که RSI از ۷۰ فراتر رفت (خرید بیش از حد) یا حباب به سطوح شدید رسید (بیش از ۳۰٪) فروش را در نظر بگیرید.',
    priority: 1,
  },
  {
    id: 'tip-5',
    category: 'risk',
    title: 'Dollar Cost Averaging',
    titleFa: 'میانگین‌گیری هزینه',
    content: 'Instead of buying all at once, spread purchases over time to reduce timing risk.',
    contentFa: 'به جای خرید یکجا، خریدها را در طول زمان پخش کنید تا ریسک زمان‌بندی کاهش یابد.',
    priority: 2,
  },
  {
    id: 'tip-6',
    category: 'risk',
    title: 'Set Stop-Loss',
    titleFa: 'حد ضرر تعیین کنید',
    content: 'Decide in advance the maximum loss you can accept (e.g., 10%) and sell if price drops to that level.',
    contentFa: 'از قبل حداکثر ضرری که می‌توانید بپذیرید (مثلاً ۱۰٪) را تعیین کنید و اگر قیمت به آن سطح رسید بفروشید.',
    priority: 3,
  },
  {
    id: 'tip-7',
    category: 'strategy',
    title: 'Follow the Trend',
    titleFa: 'روند را دنبال کنید',
    content: 'In bullish markets, buy on dips. In bearish markets, be cautious or wait on the sidelines.',
    contentFa: 'در بازارهای صعودی، در افت‌ها بخرید. در بازارهای نزولی، محتاط باشید یا در کنار بمانید.',
    priority: 2,
  },
  {
    id: 'tip-8',
    category: 'strategy',
    title: 'Watch USD/IRR Rate',
    titleFa: 'نرخ دلار را زیر نظر داشته باشید',
    content: 'Gold prices in Iran heavily depend on USD/IRR rate. A rising dollar often means rising gold prices.',
    contentFa: 'قیمت طلا در ایران به شدت به نرخ دلار وابسته است. دلار صعودی معمولاً به معنای افزایش قیمت طلاست.',
    priority: 1,
  },
];

export class InvestmentGuideService {
  private priceHistory: Map<string, { price: number; timestamp: Date }[]> = new Map();
  private latestPrices: NormalizedPrice[] = [];

  /**
   * Update price history for trend analysis
   */
  updatePrices(prices: NormalizedPrice[]): void {
    this.latestPrices = prices;

    for (const price of prices) {
      const key = `${price.providerId}:${price.productId}`;
      const history = this.priceHistory.get(key) || [];

      history.push({
        price: price.buyPrice,
        timestamp: price.fetchedAt,
      });

      // Keep last 1000 data points
      if (history.length > 1000) {
        history.shift();
      }

      this.priceHistory.set(key, history);
    }
  }

  /**
   * Calculate technical indicators based on price history
   */
  calculateTechnicalIndicators(productId: string): TechnicalIndicators {
    const prices = this.getProductPriceHistory(productId);

    if (prices.length < 2) {
      return this.getDefaultIndicators();
    }

    const currentPrice = prices[prices.length - 1].price;
    const oldestPrice = prices[0].price;

    // Calculate price changes
    const priceChange24h = this.calculatePriceChange(prices, 24);
    const priceChange7d = this.calculatePriceChange(prices, 24 * 7);
    const priceChange30d = this.calculatePriceChange(prices, 24 * 30);

    // Calculate volatility
    const volatility = this.calculateVolatility(prices);

    // Calculate simulated RSI
    const rsi = this.calculateRSI(prices);
    const rsiSignal = rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral';

    // Calculate simulated MACD signal
    const macdSignal = this.calculateMACDSignal(prices);

    // Determine moving average trend
    const maTrend = this.calculateMATrend(prices);

    return {
      priceChange24h,
      priceChange7d,
      priceChange30d,
      volatility,
      rsi,
      rsiSignal,
      macdSignal,
      maTrend,
    };
  }

  /**
   * Generate buy signal based on indicators
   */
  generateBuySignal(indicators: TechnicalIndicators, bubblePercent: number): InvestmentSignal {
    const reasons: string[] = [];
    let score = 50; // Start neutral

    // RSI analysis
    if (indicators.rsiSignal === 'oversold') {
      score += 20;
      reasons.push('RSI indicates oversold conditions - potential buying opportunity');
    } else if (indicators.rsiSignal === 'overbought') {
      score -= 15;
      reasons.push('RSI indicates overbought conditions - caution advised');
    }

    // Bubble analysis
    if (bubblePercent < 5) {
      score += 15;
      reasons.push('Low bubble percentage - prices close to theoretical value');
    } else if (bubblePercent < 15) {
      score += 5;
      reasons.push('Moderate bubble - prices slightly elevated');
    } else if (bubblePercent > 25) {
      score -= 20;
      reasons.push('High bubble - prices significantly inflated');
    }

    // MACD analysis
    if (indicators.macdSignal === 'bullish') {
      score += 10;
      reasons.push('MACD shows bullish momentum');
    } else if (indicators.macdSignal === 'bearish') {
      score -= 10;
      reasons.push('MACD shows bearish momentum');
    }

    // Trend analysis
    if (indicators.maTrend === 'bullish' && indicators.priceChange24h < 0) {
      score += 10;
      reasons.push('Bullish trend with temporary dip - good entry point');
    }

    // Volatility consideration
    if (indicators.volatility > 5) {
      score -= 5;
      reasons.push('High volatility - increased risk');
    }

    const confidence = Math.min(100, Math.max(0, score));
    const direction: SignalDirection = confidence > 60 ? 'buy' : confidence < 40 ? 'hold' : 'hold';
    const strength: SignalStrength =
      confidence > 75 ? 'strong' :
      confidence > 60 ? 'moderate' :
      confidence > 45 ? 'weak' : 'neutral';

    return {
      direction,
      strength,
      confidence,
      reasons,
      timestamp: new Date(),
    };
  }

  /**
   * Generate sell signal based on indicators
   */
  generateSellSignal(indicators: TechnicalIndicators, bubblePercent: number): InvestmentSignal {
    const reasons: string[] = [];
    let score = 50;

    // RSI analysis
    if (indicators.rsiSignal === 'overbought') {
      score += 20;
      reasons.push('RSI indicates overbought conditions - consider taking profits');
    } else if (indicators.rsiSignal === 'oversold') {
      score -= 15;
      reasons.push('RSI indicates oversold - not ideal time to sell');
    }

    // Bubble analysis
    if (bubblePercent > 30) {
      score += 20;
      reasons.push('Very high bubble - prices extremely inflated, good time to sell');
    } else if (bubblePercent > 20) {
      score += 10;
      reasons.push('High bubble - consider partial profit taking');
    } else if (bubblePercent < 10) {
      score -= 10;
      reasons.push('Low bubble - prices reasonable, no urgency to sell');
    }

    // MACD analysis
    if (indicators.macdSignal === 'bearish') {
      score += 10;
      reasons.push('MACD shows bearish momentum - downtrend starting');
    } else if (indicators.macdSignal === 'bullish') {
      score -= 10;
      reasons.push('MACD shows bullish momentum - may continue rising');
    }

    // Price momentum
    if (indicators.priceChange7d > 10) {
      score += 10;
      reasons.push('Strong recent gains - consider locking in profits');
    }

    const confidence = Math.min(100, Math.max(0, score));
    const direction: SignalDirection = confidence > 60 ? 'sell' : 'hold';
    const strength: SignalStrength =
      confidence > 75 ? 'strong' :
      confidence > 60 ? 'moderate' :
      confidence > 45 ? 'weak' : 'neutral';

    return {
      direction,
      strength,
      confidence,
      reasons,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate market sentiment
   */
  calculateMarketSentiment(indicators: TechnicalIndicators, bubblePercent: number): MarketSentiment {
    const factors: MarketSentiment['factors'] = [];
    let totalScore = 0;

    // Trend factor
    const trendImpact = indicators.maTrend === 'bullish' ? 'positive' :
                        indicators.maTrend === 'bearish' ? 'negative' : 'neutral';
    factors.push({ factor: 'Market Trend', impact: trendImpact, weight: 25 });
    totalScore += trendImpact === 'positive' ? 25 : trendImpact === 'negative' ? -25 : 0;

    // RSI factor
    const rsiImpact = indicators.rsi > 60 ? 'positive' : indicators.rsi < 40 ? 'negative' : 'neutral';
    factors.push({ factor: 'RSI Momentum', impact: rsiImpact, weight: 20 });
    totalScore += rsiImpact === 'positive' ? 20 : rsiImpact === 'negative' ? -20 : 0;

    // Bubble factor (inverted - high bubble is negative)
    const bubbleImpact = bubblePercent < 10 ? 'positive' : bubblePercent > 25 ? 'negative' : 'neutral';
    factors.push({ factor: 'Price Bubble', impact: bubbleImpact, weight: 30 });
    totalScore += bubbleImpact === 'positive' ? 30 : bubbleImpact === 'negative' ? -30 : 0;

    // Recent performance
    const perfImpact = indicators.priceChange7d > 0 ? 'positive' :
                       indicators.priceChange7d < -5 ? 'negative' : 'neutral';
    factors.push({ factor: 'Recent Performance', impact: perfImpact, weight: 25 });
    totalScore += perfImpact === 'positive' ? 25 : perfImpact === 'negative' ? -25 : 0;

    const overall = totalScore > 20 ? 'positive' : totalScore < -20 ? 'negative' : 'neutral';

    return {
      overall,
      score: totalScore,
      factors,
    };
  }

  /**
   * Determine risk level
   */
  calculateRiskLevel(indicators: TechnicalIndicators, bubblePercent: number): RiskLevel {
    let riskScore = 0;

    // High volatility = higher risk
    if (indicators.volatility > 5) riskScore += 2;
    else if (indicators.volatility > 3) riskScore += 1;

    // High bubble = higher risk
    if (bubblePercent > 30) riskScore += 3;
    else if (bubblePercent > 20) riskScore += 2;
    else if (bubblePercent > 10) riskScore += 1;

    // Overbought = higher risk for buyers
    if (indicators.rsiSignal === 'overbought') riskScore += 1;

    // Bearish trend = higher risk
    if (indicators.maTrend === 'bearish') riskScore += 1;

    if (riskScore >= 5) return 'very-high';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  /**
   * Get complete investment guide
   */
  getInvestmentGuide(): GoldInvestmentGuide | null {
    const bubbleService = getBubbleService();
    const bubbleData = bubbleService.calculateBubble();

    if (!bubbleData) {
      logger.warn('Cannot generate investment guide: bubble data not available');
      return null;
    }

    const indicators = this.calculateTechnicalIndicators('18k-gold');
    const bubblePercent = bubbleData.bubble18k;

    const buySignal = this.generateBuySignal(indicators, bubblePercent);
    const sellSignal = this.generateSellSignal(indicators, bubblePercent);
    const sentiment = this.calculateMarketSentiment(indicators, bubblePercent);
    const riskLevel = this.calculateRiskLevel(indicators, bubblePercent);

    // Determine overall recommendation
    let overallRecommendation: SignalDirection = 'hold';
    if (buySignal.confidence > 65 && sellSignal.confidence < 50) {
      overallRecommendation = 'buy';
    } else if (sellSignal.confidence > 65 && buySignal.confidence < 50) {
      overallRecommendation = 'sell';
    }

    // Select relevant tips based on market conditions
    const tips = this.selectRelevantTips(indicators, bubblePercent, riskLevel);

    return {
      currentPrice18k: bubbleData.market18kPerGram,
      currentPrice24k: bubbleData.market24kPerGram,
      priceUnit: 'IRR',
      technicalIndicators: indicators,
      buySignal,
      sellSignal,
      overallRecommendation,
      marketSentiment: sentiment,
      bubblePercent,
      riskLevel,
      tips,
      lastUpdated: new Date(),
      dataSource: bubbleData.dataSource,
    };
  }

  // Helper methods

  private getProductPriceHistory(productId: string): { price: number; timestamp: Date }[] {
    const allPrices: { price: number; timestamp: Date }[] = [];

    for (const [key, history] of this.priceHistory) {
      if (key.endsWith(`:${productId}`)) {
        allPrices.push(...history);
      }
    }

    return allPrices.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculatePriceChange(prices: { price: number; timestamp: Date }[], hoursBack: number): number {
    if (prices.length < 2) return 0;

    const now = new Date();
    const cutoff = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

    const oldPrices = prices.filter(p => p.timestamp <= cutoff);
    if (oldPrices.length === 0) return 0;

    const oldPrice = oldPrices[oldPrices.length - 1].price;
    const currentPrice = prices[prices.length - 1].price;

    return ((currentPrice - oldPrice) / oldPrice) * 100;
  }

  private calculateVolatility(prices: { price: number; timestamp: Date }[]): number {
    if (prices.length < 10) return 0;

    const recentPrices = prices.slice(-50).map(p => p.price);
    const mean = recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;

    const squaredDiffs = recentPrices.map(p => Math.pow(p - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);

    return (stdDev / mean) * 100;
  }

  private calculateRSI(prices: { price: number; timestamp: Date }[]): number {
    if (prices.length < 15) return 50;

    const recentPrices = prices.slice(-15).map(p => p.price);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    if (losses === 0) return 100;

    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    const rs = avgGain / avgLoss;

    return 100 - (100 / (1 + rs));
  }

  private calculateMACDSignal(prices: { price: number; timestamp: Date }[]): 'bullish' | 'bearish' | 'neutral' {
    if (prices.length < 26) return 'neutral';

    const recentPrices = prices.slice(-30).map(p => p.price);

    // Simple moving averages as approximation
    const shortMA = recentPrices.slice(-12).reduce((a, b) => a + b, 0) / 12;
    const longMA = recentPrices.slice(-26).reduce((a, b) => a + b, 0) / 26;

    const macd = shortMA - longMA;
    const prevShortMA = recentPrices.slice(-13, -1).reduce((a, b) => a + b, 0) / 12;
    const prevLongMA = recentPrices.slice(-27, -1).reduce((a, b) => a + b, 0) / 26;
    const prevMACD = prevShortMA - prevLongMA;

    if (macd > 0 && prevMACD <= 0) return 'bullish';
    if (macd < 0 && prevMACD >= 0) return 'bearish';
    if (macd > prevMACD) return 'bullish';
    if (macd < prevMACD) return 'bearish';

    return 'neutral';
  }

  private calculateMATrend(prices: { price: number; timestamp: Date }[]): MarketTrend {
    if (prices.length < 20) return 'sideways';

    const recentPrices = prices.slice(-30).map(p => p.price);

    const shortMA = recentPrices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longMA = recentPrices.slice(-20).reduce((a, b) => a + b, 0) / 20;

    const diff = ((shortMA - longMA) / longMA) * 100;

    if (diff > 2) return 'bullish';
    if (diff < -2) return 'bearish';
    return 'sideways';
  }

  private selectRelevantTips(
    indicators: TechnicalIndicators,
    bubblePercent: number,
    riskLevel: RiskLevel
  ): InvestmentTip[] {
    const selectedTips: InvestmentTip[] = [];

    // Always include beginner tips
    selectedTips.push(...INVESTMENT_TIPS.filter(t => t.category === 'beginner').slice(0, 2));

    // Add timing tips based on market conditions
    if (indicators.rsiSignal === 'oversold' || bubblePercent < 10) {
      selectedTips.push(INVESTMENT_TIPS.find(t => t.id === 'tip-3')!);
    }
    if (indicators.rsiSignal === 'overbought' || bubblePercent > 25) {
      selectedTips.push(INVESTMENT_TIPS.find(t => t.id === 'tip-4')!);
    }

    // Add risk tips for high-risk conditions
    if (riskLevel === 'high' || riskLevel === 'very-high') {
      selectedTips.push(...INVESTMENT_TIPS.filter(t => t.category === 'risk').slice(0, 2));
    }

    // Add strategy tips
    selectedTips.push(INVESTMENT_TIPS.find(t => t.id === 'tip-8')!);

    return selectedTips.filter(Boolean).slice(0, 5);
  }

  private getDefaultIndicators(): TechnicalIndicators {
    return {
      priceChange24h: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      volatility: 0,
      rsi: 50,
      rsiSignal: 'neutral',
      macdSignal: 'neutral',
      maTrend: 'sideways',
    };
  }
}

// Singleton instance
let investmentGuideService: InvestmentGuideService | null = null;

export function getInvestmentGuideService(): InvestmentGuideService {
  if (!investmentGuideService) {
    investmentGuideService = new InvestmentGuideService();
  }
  return investmentGuideService;
}
