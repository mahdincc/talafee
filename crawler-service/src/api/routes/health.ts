import { Router, type Request, type Response } from 'express';
import type { CrawlPipeline } from '../../core/index.js';
import type { Scheduler } from '../../core/index.js';

export function createHealthRouter(
  pipeline: CrawlPipeline,
  scheduler: Scheduler
): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const systemHealth = await pipeline.getSystemHealth();
      const schedulerStatus = scheduler.getStatus();

      const statusCode =
        systemHealth.status === 'unhealthy'
          ? 503
          : systemHealth.status === 'degraded'
            ? 200
            : 200;

      res.status(statusCode).json({
        success: true,
        status: systemHealth.status,
        uptime: systemHealth.uptime,
        uptimeHuman: formatUptime(systemHealth.uptime),
        scheduler: {
          isRunning: schedulerStatus.isRunning,
          isCrawling: schedulerStatus.isCrawling,
          lastCrawlAt: schedulerStatus.lastCrawlAt?.toISOString(),
          nextCrawlAt: schedulerStatus.nextCrawlAt?.toISOString(),
        },
        cache: {
          totalPrices: systemHealth.totalPricesInCache,
        },
        database: {
          connected: systemHealth.dbConnected,
        },
        providers: systemHealth.providers.map((p) => ({
          id: p.providerId,
          name: p.name,
          status: p.status,
          statusReason: p.statusReason,
          lastSuccessAt: p.lastSuccessAt?.toISOString(),
          lastFailureAt: p.lastFailureAt?.toISOString(),
          consecutiveFailures: p.consecutiveFailures,
          successRate24h: p.successRate24h.toFixed(1) + '%',
          lastPriceCount: p.lastPriceCount,
          avgResponseTimeMs: Math.round(p.avgResponseTimeMs),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/providers', async (_req: Request, res: Response) => {
    try {
      const providerHealths = await pipeline.getProviderHealth();

      res.json({
        success: true,
        providers: providerHealths.map((p) => ({
          id: p.providerId,
          name: p.name,
          status: p.status,
          statusReason: p.statusReason,
          lastSuccessAt: p.lastSuccessAt?.toISOString(),
          lastFailureAt: p.lastFailureAt?.toISOString(),
          lastError: p.lastError,
          consecutiveFailures: p.consecutiveFailures,
          successRate24h: p.successRate24h,
          lastPriceCount: p.lastPriceCount,
          avgResponseTimeMs: p.avgResponseTimeMs,
          lastCheckAt: p.lastCheckAt.toISOString(),
        })),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/liveness', (_req: Request, res: Response) => {
    res.json({
      success: true,
      status: 'alive',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/readiness', async (_req: Request, res: Response) => {
    try {
      const systemHealth = await pipeline.getSystemHealth();

      if (systemHealth.status === 'unhealthy') {
        return res.status(503).json({
          success: false,
          status: 'not_ready',
          reason: 'All providers are unhealthy',
          timestamp: new Date().toISOString(),
        });
      }

      res.json({
        success: true,
        status: 'ready',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        status: 'not_ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.post('/crawl', async (_req: Request, res: Response) => {
    try {
      const schedulerStatus = scheduler.getStatus();

      if (schedulerStatus.isCrawling) {
        return res.status(409).json({
          success: false,
          error: 'Crawl already in progress',
        });
      }

      scheduler.triggerManualCrawl();

      res.json({
        success: true,
        message: 'Manual crawl triggered',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
