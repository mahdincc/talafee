import { Router, type Request, type Response } from 'express';
import { getBubbleService } from '../../services/BubbleService.js';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * GET /api/v1/bubble
 * Get current bubble calculation data
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const bubbleService = getBubbleService();

    if (!bubbleService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Bubble calculation not available',
        message: 'Waiting for world price data and market prices',
      });
    }

    const bubbleData = bubbleService.calculateBubble();

    if (!bubbleData) {
      return res.status(503).json({
        success: false,
        error: 'Could not calculate bubble',
        message: 'Missing required price data',
      });
    }

    return res.json({
      success: true,
      data: bubbleData,
    });
  } catch (error) {
    logger.error('Error getting bubble data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/v1/bubble/world-price
 * Get current world gold price and USD rate
 */
router.get('/world-price', (_req: Request, res: Response) => {
  try {
    const bubbleService = getBubbleService();
    const worldPrice = bubbleService.getWorldPriceData();

    if (!worldPrice) {
      return res.status(503).json({
        success: false,
        error: 'World price data not available',
      });
    }

    // Calculate theoretical prices for different purities
    const theoretical18k = bubbleService.calculateTheoreticalPrice(0.750);
    const theoretical24k = bubbleService.calculateTheoreticalPrice(0.999);

    return res.json({
      success: true,
      data: {
        ...worldPrice,
        theoretical: {
          '18k': theoretical18k,
          '24k': theoretical24k,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting world price data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/v1/bubble/summary
 * Get a simple bubble summary for display
 */
router.get('/summary', (_req: Request, res: Response) => {
  try {
    const bubbleService = getBubbleService();

    if (!bubbleService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'Bubble calculation not available',
      });
    }

    const bubbleData = bubbleService.calculateBubble();

    if (!bubbleData) {
      return res.status(503).json({
        success: false,
        error: 'Could not calculate bubble',
      });
    }

    // Return simplified summary
    return res.json({
      success: true,
      data: {
        bubble18k: bubbleData.bubble18k,
        bubble24k: bubbleData.bubble24k,
        worldGoldOunceUSD: bubbleData.worldGoldOunceUSD,
        usdToIRR: bubbleData.usdToIRR,
        theoretical18kPerGram: bubbleData.theoretical18kPerGram,
        market18kPerGram: bubbleData.market18kPerGram,
        providerCount: bubbleData.providerCount18k,
        calculatedAt: bubbleData.calculatedAt,
        // Additional useful info
        bubbleStatus: getBubbleStatus(bubbleData.bubble18k),
        formattedBubble18k: formatBubblePercent(bubbleData.bubble18k),
      },
    });
  } catch (error) {
    logger.error('Error getting bubble summary', {
      error: error instanceof Error ? error.message : String(error),
    });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

function getBubbleStatus(bubble: number): 'low' | 'medium' | 'high' | 'extreme' {
  const absBubble = Math.abs(bubble);
  if (absBubble < 3) return 'low';
  if (absBubble < 7) return 'medium';
  if (absBubble < 15) return 'high';
  return 'extreme';
}

function formatBubblePercent(bubble: number): string {
  const sign = bubble >= 0 ? '+' : '';
  return `${sign}${bubble.toFixed(2)}%`;
}

export { router as bubbleRouter };
