import type { SqliteSink, ReviewRecord, ReviewStats } from '../sinks/SqliteSink.js';
import { logger } from '../utils/logger.js';

// Rate limiting configuration
const RATE_LIMIT = {
  maxReviewsPerDay: 5,          // Max reviews per fingerprint per day
  maxReviewsPerProviderPerWeek: 1, // Max 1 review per provider per week
  minContentLength: 10,          // Minimum review content length
  maxContentLength: 2000,        // Maximum review content length
};

// Spam detection patterns
const SPAM_PATTERNS = [
  /(.)\1{5,}/i,                  // Repeated characters (aaaaa)
  /https?:\/\//i,                // URLs
  /\b(buy|sell|click|visit|discount)\b.*\b(now|here|link)\b/i, // Promotional
  /[\u0600-\u06FF]{1,3}[\s]*[\u0600-\u06FF]{1,3}[\s]*[\u0600-\u06FF]{1,3}/i, // Very short Persian spam
];

// Suspicious rating patterns
const SUSPICIOUS_PATTERNS = {
  allFiveStars: 0.9,            // If > 90% are 5-star from same fingerprint prefix
  rapidSubmission: 60000,       // Reviews submitted within 1 minute = suspicious
};

export interface ReviewSubmission {
  providerId: string;
  rating: number;
  title?: string;
  content?: string;
  pros?: string[];
  cons?: string[];
  userFingerprint: string;
  userId?: string;
}

export interface ReviewValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReviewResponse {
  success: boolean;
  review?: ReviewRecord;
  error?: string;
  errorFa?: string;
}

export interface ReviewListResponse {
  reviews: ReviewRecord[];
  stats: ReviewStats | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface ReviewFilters {
  rating?: number;
  sortBy?: 'recent' | 'helpful' | 'rating_high' | 'rating_low';
  page?: number;
  limit?: number;
}

export class ReviewService {
  private dbSink: SqliteSink | null = null;
  private recentSubmissions: Map<string, number[]> = new Map(); // fingerprint -> timestamps

  /**
   * Initialize with database sink
   */
  initialize(dbSink: SqliteSink): void {
    this.dbSink = dbSink;
    logger.info('ReviewService initialized');
  }

  /**
   * Submit a new review
   */
  async submitReview(submission: ReviewSubmission): Promise<ReviewResponse> {
    if (!this.dbSink) {
      return {
        success: false,
        error: 'Service not initialized',
        errorFa: 'سرویس راه‌اندازی نشده است',
      };
    }

    // Validate the submission
    const validation = this.validateReview(submission);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.errors.join('; '),
        errorFa: 'اطلاعات ارسالی معتبر نیست',
      };
    }

    // Check rate limiting
    const rateLimitCheck = this.checkRateLimits(submission);
    if (!rateLimitCheck.valid) {
      return {
        success: false,
        error: rateLimitCheck.errors.join('; '),
        errorFa: 'شما به حد مجاز ارسال نظر رسیده‌اید',
      };
    }

    // Check for spam
    const spamCheck = this.detectSpam(submission);
    if (spamCheck.isSpam) {
      logger.warn('Spam review detected', {
        providerId: submission.providerId,
        fingerprint: submission.userFingerprint.substring(0, 8),
        reason: spamCheck.reason,
      });
      return {
        success: false,
        error: 'Review flagged as spam',
        errorFa: 'نظر شما به عنوان اسپم شناسایی شد',
      };
    }

    // Create review record
    const review: ReviewRecord = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      providerId: submission.providerId,
      userId: submission.userId,
      userFingerprint: submission.userFingerprint,
      rating: submission.rating,
      title: submission.title,
      content: submission.content,
      pros: submission.pros ? JSON.stringify(submission.pros) : undefined,
      cons: submission.cons ? JSON.stringify(submission.cons) : undefined,
      transactionVerified: false,
      helpfulCount: 0,
      reportCount: 0,
      status: spamCheck.suspicious ? 'flagged' : 'active',
      createdAt: new Date().toISOString(),
    };

    // Save to database
    try {
      this.dbSink.saveReview(review);
      this.trackSubmission(submission.userFingerprint);

      logger.info('Review submitted', {
        reviewId: review.id,
        providerId: submission.providerId,
        rating: submission.rating,
        status: review.status,
      });

      return {
        success: true,
        review,
      };
    } catch (error) {
      logger.error('Failed to save review', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: 'Failed to save review',
        errorFa: 'خطا در ذخیره نظر',
      };
    }
  }

  /**
   * Get reviews for a provider
   */
  getProviderReviews(providerId: string, filters: ReviewFilters = {}): ReviewListResponse {
    if (!this.dbSink) {
      return {
        reviews: [],
        stats: null,
        pagination: { page: 1, limit: 10, total: 0, hasMore: false },
      };
    }

    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 10, 50);
    const offset = (page - 1) * limit;

    // Get reviews from database
    let reviews = this.dbSink.getProviderReviews(providerId, limit + 1, offset);

    // Check if there are more
    const hasMore = reviews.length > limit;
    if (hasMore) {
      reviews = reviews.slice(0, limit);
    }

    // Sort based on filter
    if (filters.sortBy === 'rating_high') {
      reviews.sort((a, b) => b.rating - a.rating);
    } else if (filters.sortBy === 'rating_low') {
      reviews.sort((a, b) => a.rating - b.rating);
    }
    // 'recent' and 'helpful' are already handled by the DB query

    // Filter by rating if specified
    if (filters.rating !== undefined) {
      reviews = reviews.filter(r => r.rating === filters.rating);
    }

    // Get stats
    const stats = this.dbSink.getReviewStats(providerId) ?? null;

    return {
      reviews,
      stats,
      pagination: {
        page,
        limit,
        total: stats?.totalReviews ?? 0,
        hasMore,
      },
    };
  }

  /**
   * Vote on a review (helpful or report)
   */
  voteReview(
    reviewId: string,
    fingerprint: string,
    voteType: 'helpful' | 'report'
  ): { success: boolean; error?: string } {
    if (!this.dbSink) {
      return { success: false, error: 'Service not initialized' };
    }

    // Try to save the vote (will fail if duplicate)
    const saved = this.dbSink.saveReviewVote(reviewId, fingerprint, voteType);
    if (!saved) {
      return { success: false, error: 'Already voted on this review' };
    }

    // Update the review counts
    if (voteType === 'helpful') {
      this.dbSink.incrementReviewHelpful(reviewId);
    } else {
      this.dbSink.incrementReviewReport(reviewId);
      // Check if review should be flagged
      this.checkReportThreshold(reviewId);
    }

    return { success: true };
  }

  /**
   * Get review statistics for a provider
   */
  getReviewStats(providerId: string): ReviewStats | null {
    if (!this.dbSink) return null;
    return this.dbSink.getReviewStats(providerId) ?? null;
  }

  /**
   * Validate review submission
   */
  private validateReview(submission: ReviewSubmission): ReviewValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!submission.providerId) {
      errors.push('Provider ID is required');
    }

    if (!submission.userFingerprint) {
      errors.push('User fingerprint is required');
    }

    // Rating validation
    if (!Number.isInteger(submission.rating) || submission.rating < 1 || submission.rating > 5) {
      errors.push('Rating must be between 1 and 5');
    }

    // Content length validation
    if (submission.content) {
      if (submission.content.length < RATE_LIMIT.minContentLength) {
        errors.push(`Review content must be at least ${RATE_LIMIT.minContentLength} characters`);
      }
      if (submission.content.length > RATE_LIMIT.maxContentLength) {
        errors.push(`Review content must not exceed ${RATE_LIMIT.maxContentLength} characters`);
      }
    }

    // Title validation
    if (submission.title && submission.title.length > 100) {
      errors.push('Title must not exceed 100 characters');
    }

    // Pros/cons validation
    if (submission.pros && submission.pros.length > 5) {
      errors.push('Maximum 5 pros allowed');
    }
    if (submission.cons && submission.cons.length > 5) {
      errors.push('Maximum 5 cons allowed');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check rate limits for a submission
   */
  private checkRateLimits(submission: ReviewSubmission): ReviewValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!this.dbSink) {
      return { valid: true, errors, warnings };
    }

    // Check daily limit
    const dailyCount = this.dbSink.checkReviewRateLimit(submission.userFingerprint, 24);
    if (dailyCount >= RATE_LIMIT.maxReviewsPerDay) {
      errors.push(`Maximum ${RATE_LIMIT.maxReviewsPerDay} reviews per day allowed`);
    }

    // Check if already reviewed this provider recently
    const weeklyProviderCount = this.dbSink.checkReviewRateLimit(
      `${submission.userFingerprint}_${submission.providerId}`,
      168 // 7 days
    );
    // This is a simplified check - would need a more sophisticated query in production

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect spam in review submission
   */
  private detectSpam(submission: ReviewSubmission): { isSpam: boolean; suspicious: boolean; reason?: string } {
    // Check content against spam patterns
    if (submission.content) {
      for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(submission.content)) {
          return { isSpam: true, suspicious: true, reason: 'Spam pattern detected in content' };
        }
      }
    }

    // Check title against spam patterns
    if (submission.title) {
      for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(submission.title)) {
          return { isSpam: true, suspicious: true, reason: 'Spam pattern detected in title' };
        }
      }
    }

    // Check for rapid submission (within 1 minute)
    const recentTimes = this.recentSubmissions.get(submission.userFingerprint) ?? [];
    const now = Date.now();
    const veryRecent = recentTimes.filter(t => now - t < SUSPICIOUS_PATTERNS.rapidSubmission);
    if (veryRecent.length > 0) {
      return { isSpam: false, suspicious: true, reason: 'Rapid submission detected' };
    }

    // Check for very short content with extreme rating
    if (submission.content && submission.content.length < 20 && (submission.rating === 1 || submission.rating === 5)) {
      return { isSpam: false, suspicious: true, reason: 'Short extreme review' };
    }

    return { isSpam: false, suspicious: false };
  }

  /**
   * Track submission for rate limiting
   */
  private trackSubmission(fingerprint: string): void {
    const times = this.recentSubmissions.get(fingerprint) ?? [];
    times.push(Date.now());

    // Keep only last hour of submissions
    const hourAgo = Date.now() - 3600000;
    const filtered = times.filter(t => t > hourAgo);
    this.recentSubmissions.set(fingerprint, filtered);
  }

  /**
   * Check if a review has too many reports and should be flagged
   */
  private checkReportThreshold(reviewId: string): void {
    // In production, would query the review and check report count
    // For now, this is a placeholder
    logger.debug('Checking report threshold', { reviewId });
  }

  /**
   * Safely parse JSON string
   */
  private safeJsonParse(str: string): string[] | undefined {
    try {
      return JSON.parse(str);
    } catch {
      return undefined;
    }
  }

  /**
   * Get all reviews (admin function)
   */
  getAllReviews(status?: 'active' | 'flagged' | 'hidden'): ReviewRecord[] {
    if (!this.dbSink) return [];
    // This would need a new method in SqliteSink
    return [];
  }

  /**
   * Moderate a review (admin function)
   */
  moderateReview(reviewId: string, action: 'approve' | 'hide' | 'delete'): boolean {
    if (!this.dbSink) return false;
    // This would need new methods in SqliteSink
    logger.info('Review moderated', { reviewId, action });
    return true;
  }
}

// Singleton instance
let reviewService: ReviewService | null = null;

export function getReviewService(): ReviewService {
  if (!reviewService) {
    reviewService = new ReviewService();
  }
  return reviewService;
}
