import { CrawlPipeline, Scheduler } from './core/index.js';
import { createAllProviders, TGJUProvider } from './providers/index.js';
import { SqliteSink, ApiCacheSink } from './sinks/index.js';
import { startServer } from './api/server.js';
import { logger } from './utils/index.js';
import { getBubbleService } from './services/BubbleService.js';
import { getTrustScoreService } from './services/TrustScoreService.js';
import { getPriceAccuracyTracker } from './services/PriceAccuracyTracker.js';
import { getReviewService } from './services/ReviewService.js';

async function main(): Promise<void> {
  logger.info('Starting Talafee Gold Price Crawler Service');

  const pipeline = new CrawlPipeline();
  const scheduler = new Scheduler(pipeline);
  const cacheSink = new ApiCacheSink();
  const dbSink = new SqliteSink();
  const bubbleService = getBubbleService();

  pipeline.registerSink(cacheSink);
  pipeline.registerSink(dbSink);

  const providers = createAllProviders();
  let tgjuProvider: TGJUProvider | null = null;

  for (const provider of providers) {
    pipeline.registerProvider(provider);
    // Store reference to TGJU provider for world price data
    if (provider.providerId === 'tgju') {
      tgjuProvider = provider as TGJUProvider;
    }
  }

  // Set up bubble service integration after each crawl
  cacheSink.setBubbleServiceIntegration(bubbleService, tgjuProvider);

  // Initialize trust system services
  const trustService = getTrustScoreService();
  trustService.initialize(dbSink);

  // Seed dummy data if no trust data exists
  const existingScores = trustService.getProviderRanking();
  if (existingScores.length === 0) {
    logger.info('No trust data found, seeding dummy data for demo...');
    trustService.seedDummyData();
  }

  const accuracyTracker = getPriceAccuracyTracker();
  accuracyTracker.initialize(dbSink);

  const reviewService = getReviewService();
  reviewService.initialize(dbSink);

  // Set up uptime tracking in pipeline
  pipeline.setUptimeTracker(dbSink);

  await pipeline.initialize();

  await startServer({
    pipeline,
    scheduler,
    cacheSink,
    dbSink,
  });

  scheduler.start();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    scheduler.stop();
    await pipeline.shutdown();

    logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  logger.info('Talafee Gold Price Crawler Service started successfully');
}

main().catch((error) => {
  logger.error('Failed to start service', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});
