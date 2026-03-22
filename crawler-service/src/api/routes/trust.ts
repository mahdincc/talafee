import { Router, type Request, type Response } from 'express';
import { getTrustScoreService } from '../../services/TrustScoreService.js';
import { getReviewService } from '../../services/ReviewService.js';
import { getPriceAccuracyTracker } from '../../services/PriceAccuracyTracker.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ==================== Trust Score Endpoints ====================

/**
 * GET /api/v1/trust/scores
 * Get trust scores for all providers
 */
router.get('/scores', (_req: Request, res: Response) => {
  try {
    const trustService = getTrustScoreService();
    const summary = trustService.getSummary();

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error('Error getting trust scores', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get trust scores',
    });
  }
});

/**
 * GET /api/v1/trust/scores/:providerId
 * Get trust score for a specific provider
 */
router.get('/scores/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const trustService = getTrustScoreService();
    const score = trustService.getProviderScore(providerId);

    if (!score) {
      res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
      return;
    }

    res.json({
      success: true,
      data: score,
    });
  } catch (error) {
    logger.error('Error getting provider trust score', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get trust score',
    });
  }
});

/**
 * GET /api/v1/trust/ranking
 * Get providers ranked by trust score
 */
router.get('/ranking', (_req: Request, res: Response) => {
  try {
    const trustService = getTrustScoreService();
    const ranking = trustService.getProviderRanking();

    res.json({
      success: true,
      data: {
        ranking: ranking.map((score, index) => ({
          rank: index + 1,
          ...score,
        })),
        totalProviders: ranking.length,
        lastUpdated: ranking[0]?.lastUpdated || new Date(),
      },
    });
  } catch (error) {
    logger.error('Error getting trust ranking', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get trust ranking',
    });
  }
});

/**
 * GET /api/v1/trust/badges/:providerId
 * Get badges for a specific provider
 */
router.get('/badges/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const trustService = getTrustScoreService();
    const score = trustService.getProviderScore(providerId);

    if (!score) {
      res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        providerId,
        badges: score.badges,
      },
    });
  } catch (error) {
    logger.error('Error getting provider badges', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get badges',
    });
  }
});

/**
 * GET /api/v1/trust/warnings
 * Get all active warnings
 */
router.get('/warnings', (_req: Request, res: Response) => {
  try {
    const trustService = getTrustScoreService();
    const warnings = trustService.getActiveWarnings();

    res.json({
      success: true,
      data: {
        warnings,
        totalWarnings: warnings.length,
      },
    });
  } catch (error) {
    logger.error('Error getting warnings', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get warnings',
    });
  }
});

/**
 * GET /api/v1/trust/warnings/:providerId
 * Get warnings for a specific provider
 */
router.get('/warnings/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const trustService = getTrustScoreService();
    const score = trustService.getProviderScore(providerId);

    if (!score) {
      res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        providerId,
        warnings: score.warnings,
      },
    });
  } catch (error) {
    logger.error('Error getting provider warnings', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get warnings',
    });
  }
});

// ==================== Price Accuracy Endpoints ====================

/**
 * GET /api/v1/trust/accuracy/:providerId
 * Get price accuracy history for a provider
 */
router.get('/accuracy/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const days = parseInt(req.query['days'] as string) || 7;

    const tracker = getPriceAccuracyTracker();
    const accuracy = tracker.getProviderAccuracy(providerId, days);

    res.json({
      success: true,
      data: {
        providerId,
        days,
        accuracy,
      },
    });
  } catch (error) {
    logger.error('Error getting price accuracy', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get accuracy data',
    });
  }
});

/**
 * GET /api/v1/trust/accuracy/summary
 * Get accuracy summary for all providers
 */
router.get('/accuracy/summary', (_req: Request, res: Response) => {
  try {
    const tracker = getPriceAccuracyTracker();
    const reports = tracker.getAllProvidersAccuracy();

    res.json({
      success: true,
      data: {
        reports,
        totalProviders: reports.length,
      },
    });
  } catch (error) {
    logger.error('Error getting accuracy summary', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get accuracy summary',
    });
  }
});

// ==================== Review Endpoints ====================

/**
 * GET /api/v1/trust/reviews/:providerId
 * Get reviews for a provider
 */
router.get('/reviews/:providerId', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 10;
    const rating = req.query['rating'] ? parseInt(req.query['rating'] as string) : undefined;
    const sortBy = req.query['sortBy'] as 'recent' | 'helpful' | 'rating_high' | 'rating_low' || 'helpful';

    const reviewService = getReviewService();
    const result = reviewService.getProviderReviews(providerId, {
      page,
      limit,
      rating,
      sortBy,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error getting reviews', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews',
    });
  }
});

/**
 * POST /api/v1/trust/reviews
 * Submit a new review
 */
router.post('/reviews', async (req: Request, res: Response) => {
  try {
    const {
      providerId,
      rating,
      title,
      content,
      pros,
      cons,
      userFingerprint,
      userId,
    } = req.body;

    // Validate required fields
    if (!providerId || !rating || !userFingerprint) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: providerId, rating, userFingerprint',
        errorFa: 'فیلدهای ضروری وارد نشده‌اند',
      });
      return;
    }

    const reviewService = getReviewService();
    const result = await reviewService.submitReview({
      providerId,
      rating: parseInt(rating),
      title,
      content,
      pros: Array.isArray(pros) ? pros : undefined,
      cons: Array.isArray(cons) ? cons : undefined,
      userFingerprint,
      userId,
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        data: result.review,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        errorFa: result.errorFa,
      });
    }
  } catch (error) {
    logger.error('Error submitting review', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to submit review',
      errorFa: 'خطا در ثبت نظر',
    });
  }
});

/**
 * POST /api/v1/trust/reviews/:reviewId/vote
 * Vote on a review (helpful or report)
 */
router.post('/reviews/:reviewId/vote', (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { voteType, userFingerprint } = req.body;

    // Validate
    if (!voteType || !userFingerprint) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: voteType, userFingerprint',
      });
      return;
    }

    if (voteType !== 'helpful' && voteType !== 'report') {
      res.status(400).json({
        success: false,
        error: 'voteType must be "helpful" or "report"',
      });
      return;
    }

    const reviewService = getReviewService();
    const result = reviewService.voteReview(reviewId, userFingerprint, voteType);

    if (result.success) {
      res.json({
        success: true,
        message: voteType === 'helpful' ? 'Marked as helpful' : 'Reported',
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error voting on review', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to vote on review',
    });
  }
});

/**
 * GET /api/v1/trust/reviews/:providerId/stats
 * Get review statistics for a provider
 */
router.get('/reviews/:providerId/stats', (req: Request, res: Response) => {
  try {
    const { providerId } = req.params;
    const reviewService = getReviewService();
    const stats = reviewService.getReviewStats(providerId);

    res.json({
      success: true,
      data: {
        providerId,
        stats,
      },
    });
  } catch (error) {
    logger.error('Error getting review stats', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get review stats',
    });
  }
});

// ==================== Comparison Endpoint ====================

/**
 * GET /api/v1/trust/comparison
 * Get side-by-side comparison of provider trust scores
 */
router.get('/comparison', (req: Request, res: Response) => {
  try {
    const providerIds = req.query['providers'] as string;

    const trustService = getTrustScoreService();
    const ranking = trustService.getProviderRanking();

    // Filter to specific providers if requested
    let providers = ranking;
    if (providerIds) {
      const ids = providerIds.split(',').map(id => id.trim());
      providers = ranking.filter(p => ids.includes(p.providerId));
    }

    // Create comparison matrix
    const comparison = providers.map(provider => ({
      providerId: provider.providerId,
      providerName: provider.providerName,
      overallScore: provider.overallScore,
      tier: provider.tier,
      scores: {
        priceAccuracy: provider.breakdown.priceAccuracy.score,
        uptime: provider.breakdown.uptime.score,
        reviews: provider.breakdown.reviews.score,
        freshness: provider.breakdown.freshness.score,
      },
      badgeCount: provider.badges.length,
      warningCount: provider.warnings.length,
      trend: provider.trend,
    }));

    res.json({
      success: true,
      data: {
        comparison,
        totalProviders: comparison.length,
        categories: ['priceAccuracy', 'uptime', 'reviews', 'freshness'],
      },
    });
  } catch (error) {
    logger.error('Error getting comparison', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get comparison',
    });
  }
});

export { router as trustRouter };
