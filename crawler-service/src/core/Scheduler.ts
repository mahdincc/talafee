import cron from 'node-cron';
import type { CrawlPipeline } from './CrawlPipeline.js';
import { logger } from '../utils/index.js';
import config from '../../config/crawler.config.js';

export class Scheduler {
  private pipeline: CrawlPipeline;
  private priceUpdateTask?: cron.ScheduledTask;
  private healthCheckTask?: cron.ScheduledTask;
  private isRunning = false;
  private nextCrawlAt?: Date;

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

    this.isRunning = true;
    this.updateNextCrawlTime();

    logger.info(`Scheduler started successfully`);

    this.runInitialCrawl();
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn(`Scheduler not running`);
      return;
    }

    logger.info(`Stopping scheduler`);

    this.priceUpdateTask?.stop();
    this.healthCheckTask?.stop();
    this.isRunning = false;

    logger.info(`Scheduler stopped`);
  }

  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      nextCrawlAt: this.nextCrawlAt,
      lastCrawlAt: this.pipeline.getLastRunSummary()?.completedAt,
      isCrawling: this.pipeline.isCurrentlyRunning(),
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
}
