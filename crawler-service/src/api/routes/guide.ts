import { Router, type Request, type Response } from 'express';
import { getInvestmentGuideService } from '../../services/InvestmentGuideService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/guide
 * Get complete investment guide with signals and tips
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const guideService = getInvestmentGuideService();
    const guide = guideService.getInvestmentGuide();

    if (!guide) {
      res.status(503).json({
        success: false,
        error: 'Investment guide not available',
        message: 'Waiting for market data to be collected',
      });
      return;
    }

    res.json({
      success: true,
      data: guide,
    });
  } catch (error) {
    logger.error('Error generating investment guide', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to generate investment guide',
    });
  }
});

/**
 * GET /api/v1/guide/signals
 * Get only buy/sell signals
 */
router.get('/signals', (_req: Request, res: Response) => {
  try {
    const guideService = getInvestmentGuideService();
    const guide = guideService.getInvestmentGuide();

    if (!guide) {
      res.status(503).json({
        success: false,
        error: 'Signals not available',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        buySignal: guide.buySignal,
        sellSignal: guide.sellSignal,
        overallRecommendation: guide.overallRecommendation,
        riskLevel: guide.riskLevel,
        lastUpdated: guide.lastUpdated,
      },
    });
  } catch (error) {
    logger.error('Error getting signals', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get signals',
    });
  }
});

/**
 * GET /api/v1/guide/indicators
 * Get technical indicators
 */
router.get('/indicators', (_req: Request, res: Response) => {
  try {
    const guideService = getInvestmentGuideService();
    const guide = guideService.getInvestmentGuide();

    if (!guide) {
      res.status(503).json({
        success: false,
        error: 'Indicators not available',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        technicalIndicators: guide.technicalIndicators,
        marketSentiment: guide.marketSentiment,
        bubblePercent: guide.bubblePercent,
        lastUpdated: guide.lastUpdated,
      },
    });
  } catch (error) {
    logger.error('Error getting indicators', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get indicators',
    });
  }
});

/**
 * GET /api/v1/guide/tips
 * Get educational tips
 */
router.get('/tips', (_req: Request, res: Response) => {
  try {
    const guideService = getInvestmentGuideService();
    const guide = guideService.getInvestmentGuide();

    if (!guide) {
      res.status(503).json({
        success: false,
        error: 'Tips not available',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        tips: guide.tips,
        riskLevel: guide.riskLevel,
        marketSentiment: guide.marketSentiment.overall,
      },
    });
  } catch (error) {
    logger.error('Error getting tips', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get tips',
    });
  }
});

/**
 * GET /api/v1/guide/summary
 * Get a simple summary for beginners
 */
router.get('/summary', (_req: Request, res: Response) => {
  try {
    const guideService = getInvestmentGuideService();
    const guide = guideService.getInvestmentGuide();

    if (!guide) {
      res.status(503).json({
        success: false,
        error: 'Summary not available',
      });
      return;
    }

    // Create a simple summary for beginners
    const summaryText = generateSummaryText(guide);
    const summaryTextFa = generateSummaryTextFa(guide);

    res.json({
      success: true,
      data: {
        recommendation: guide.overallRecommendation,
        recommendationText: getRecommendationText(guide.overallRecommendation),
        recommendationTextFa: getRecommendationTextFa(guide.overallRecommendation),
        summary: summaryText,
        summaryFa: summaryTextFa,
        sentiment: guide.marketSentiment.overall,
        riskLevel: guide.riskLevel,
        bubblePercent: guide.bubblePercent,
        currentPrice18k: guide.currentPrice18k,
        buyConfidence: guide.buySignal.confidence,
        sellConfidence: guide.sellSignal.confidence,
        topReasons: guide.overallRecommendation === 'buy'
          ? guide.buySignal.reasons.slice(0, 3)
          : guide.overallRecommendation === 'sell'
          ? guide.sellSignal.reasons.slice(0, 3)
          : ['Market is stable, consider holding your position'],
        lastUpdated: guide.lastUpdated,
      },
    });
  } catch (error) {
    logger.error('Error getting summary', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get summary',
    });
  }
});

// Helper functions

function getRecommendationText(recommendation: string): string {
  switch (recommendation) {
    case 'buy':
      return 'Consider Buying';
    case 'sell':
      return 'Consider Selling';
    default:
      return 'Hold / Wait';
  }
}

function getRecommendationTextFa(recommendation: string): string {
  switch (recommendation) {
    case 'buy':
      return 'خرید پیشنهاد می‌شود';
    case 'sell':
      return 'فروش پیشنهاد می‌شود';
    default:
      return 'صبر کنید / نگه دارید';
  }
}

function generateSummaryText(guide: ReturnType<typeof getInvestmentGuideService.prototype.getInvestmentGuide>): string {
  if (!guide) return '';

  const parts: string[] = [];

  // Market condition
  if (guide.marketSentiment.overall === 'positive') {
    parts.push('Market sentiment is positive.');
  } else if (guide.marketSentiment.overall === 'negative') {
    parts.push('Market sentiment is negative.');
  } else {
    parts.push('Market is stable.');
  }

  // Bubble analysis
  if (guide.bubblePercent > 25) {
    parts.push(`Prices are ${guide.bubblePercent.toFixed(1)}% above theoretical value - high bubble.`);
  } else if (guide.bubblePercent < 5) {
    parts.push('Prices are close to fair value.');
  }

  // RSI
  if (guide.technicalIndicators.rsiSignal === 'overbought') {
    parts.push('RSI indicates overbought conditions.');
  } else if (guide.technicalIndicators.rsiSignal === 'oversold') {
    parts.push('RSI indicates oversold conditions.');
  }

  // Risk
  if (guide.riskLevel === 'high' || guide.riskLevel === 'very-high') {
    parts.push('Risk level is elevated - trade with caution.');
  }

  return parts.join(' ');
}

function generateSummaryTextFa(guide: ReturnType<typeof getInvestmentGuideService.prototype.getInvestmentGuide>): string {
  if (!guide) return '';

  const parts: string[] = [];

  // Market condition
  if (guide.marketSentiment.overall === 'positive') {
    parts.push('احساسات بازار مثبت است.');
  } else if (guide.marketSentiment.overall === 'negative') {
    parts.push('احساسات بازار منفی است.');
  } else {
    parts.push('بازار باثبات است.');
  }

  // Bubble analysis
  if (guide.bubblePercent > 25) {
    parts.push(`قیمت‌ها ${guide.bubblePercent.toFixed(1)}٪ بالاتر از ارزش واقعی هستند - حباب بالا.`);
  } else if (guide.bubblePercent < 5) {
    parts.push('قیمت‌ها نزدیک به ارزش منصفانه هستند.');
  }

  // RSI
  if (guide.technicalIndicators.rsiSignal === 'overbought') {
    parts.push('RSI نشان‌دهنده خرید بیش از حد است.');
  } else if (guide.technicalIndicators.rsiSignal === 'oversold') {
    parts.push('RSI نشان‌دهنده فروش بیش از حد است.');
  }

  // Risk
  if (guide.riskLevel === 'high' || guide.riskLevel === 'very-high') {
    parts.push('سطح ریسک بالاست - با احتیاط معامله کنید.');
  }

  return parts.join(' ');
}

export { router as guideRouter };
