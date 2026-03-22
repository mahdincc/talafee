import cron from 'node-cron';
import type { CrawlPipeline } from './CrawlPipeline.js';
import { logger } from '../utils/index.js';
import config from '../../config/crawler.config.js';
import { getTrustScoreService } from '../services/TrustScoreService.js';

export class Scheduler {
  private pipeline: CrawlPipeline;
  private priceUpdateTask?: cron.ScheduledTask;
  private healthCheckTask?: cron.ScheduledTask;
  private trustScoreTask?: cron.ScheduledTask;
  private isRunning = false;
  private nextCrawlAt?: Date;
  private lastTrustScoreUpdate?: Date;

  constructor(pipeline: CrawlPipeline) {
    this.pipeline = pipeline;
  }

  start(): void {
    if (this.isRunning) {
      logger.warn(`Scheduler already running`);
      return;
    }

    logger.info(`Starting scheduler`, {
      priceUpdateCron: config.schedule.priceUpdateCron,
      healthCheckCron: config.schedule.healthCheckCron,
    });

    this.priceUpdateTask = cron.schedule(
      config.schedule.priceUpdateCron,
      async () => {
        try {
          await this.pipeline.runCrawl();
          this.updateNextCrawlTime();
        } catch (error) {
          logger.error(`Scheduled crawl failed`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Tehran',
      }
    );

    this.healthCheckTask = cron.schedule(
      config.schedule.healthCheckCron,
      async () => {
        try {
          const health = await this.pipeline.getSystemHealth();
          logger.info(`Health check completed`, {
            status: health.status,
            healthyProviders: health.providers.filter((p) => p.status === 'healthy').length,
            totalProviders: health.providers.length,
          });
        } catch (error) {
          logger.error(`Health check failed`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Tehran',
      }
    );

    // Trust score calculation - runs every hour
    this.trustScoreTask = cron.schedule(
      '0 * * * *', // Every hour at minute 0
      async () => {
        try {
          await this.calculateTrustScores();
        } catch (error) {
          logger.error(`Trust score calculation failed`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      {
        scheduled: true,
        timezone: 'Asia/Tehran',
      }
    );

    this.isRunning = true;
    this.updateNextCrawlTime();

    logger.info(`Scheduler started successfully`);

    this.runInitialCrawl();
  }

  /**
   * Calculate trust scores for all providers
   */
  async calculateTrustScores(): Promise<void> {
    logger.info('Calculating trust scores for all providers');
    const trustService = getTrustScoreService();
    const scores = trustService.calculateAllScores();
    this.lastTrustScoreUpdate = new Date();

    logger.info('Trust scores calculated', {
      providerCount: scores.length,
      avgScore: scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length * 10) / 10
        : 0,
    });
  }

  /**
   * Manually trigger trust score calculation
   */
  async triggerTrustScoreUpdate(): Promise<void> {
    logger.info('Manual trust score update triggered');
    await this.calculateTrustScores();
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn(`Scheduler not running`);
      return;
    }

    logger.info(`Stopping scheduler`);

    this.priceUpdateTask?.stop();
    this.healthCheckTask?.stop();
    this.trustScoreTask?.stop();
    this.isRunning = false;

    logger.info(`Scheduler stopped`);
  }

  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      nextCrawlAt: this.nextCrawlAt,
      lastCrawlAt: this.pipeline.getLastRunSummary()?.completedAt,
      isCrawling: this.pipeline.isCurrentlyRunning(),
      lastTrustScoreUpdate: this.lastTrustScoreUpdate,
    };
  }

  async triggerManualCrawl(): Promise<void> {
    logger.info(`Manual crawl triggered`);
    await this.pipeline.runCrawl();
    this.updateNextCrawlTime();
  }

  private async runInitialCrawl(): Promise<void> {
    logger.info(`Running initial crawl on startup`);
    try {
      await this.pipeline.runCrawl();
      this.updateNextCrawlTime();
    } catch (error) {
      logger.error(`Initial crawl failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private updateNextCrawlTime(): void {
    this.nextCrawlAt = new Date(Date.now() + config.schedule.priceUpdateIntervalMs);
  }
}

export interface SchedulerStatus {
  isRunning: boolean;
  nextCrawlAt?: Date;
  lastCrawlAt?: Date;
  isCrawling: boolean;
  lastTrustScoreUpdate?: Date;
}
