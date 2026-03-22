import { Router, type Request, type Response } from 'express';
import type { SqliteSink } from '../../sinks/index.js';
import type { ApiCacheSink } from '../../sinks/index.js';

export function createHistoryRouter(
  cacheSink: ApiCacheSink,
  dbSink: SqliteSink
): Router {
  const router = Router();

  router.get('/:providerId/:productId', async (req: Request, res: Response) => {
    try {
      const { providerId, productId } = req.params;
      const hours = parseInt(req.query['hours'] as string, 10) || 24;

      if (hours < 1 || hours > 720) {
        return res.status(400).json({
          success: false,
          error: 'Hours must be between 1 and 720 (30 days)',
        });
      }

      const history = await dbSink.getPriceHistory(providerId!, productId!, hours);

      if (history.length === 0) {
        const cacheHistory = await cacheSink.getPriceHistory(
          providerId!,
          productId!,
          hours
        );

        if (cacheHistory.length > 0) {
          return res.json({
            success: true,
            providerId,
            productId,
            hours,
            source: 'cache',
            data: cacheHistory,
            count: cacheHistory.length,
            timestamp: new Date().toISOString(),
          });
        }

        return res.status(404).json({
          success: false,
          error: `No history found for ${providerId}/${productId}`,
        });
      }

      const stats = calculateStats(history.map((h) => h.avgPrice));

      res.json({
        success: true,
        providerId,
        productId,
        hours,
        source: 'database',
        data: history,
        count: history.length,
        stats: {
          min: stats.min,
          max: stats.max,
          avg: stats.avg,
          first: history[0]?.avgPrice,
          last: history[history.length - 1]?.avgPrice,
          change: history.length > 1
            ? history[history.length - 1]!.avgPrice - history[0]!.avgPrice
            : 0,
          changePercent: history.length > 1
            ? ((history[history.length - 1]!.avgPrice - history[0]!.avgPrice) /
                history[0]!.avgPrice) *
              100
            : 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/product/:productId', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const hours = parseInt(req.query['hours'] as string, 10) || 24;
      const providers = (req.query['providers'] as string)?.split(',') || [];

      if (hours < 1 || hours > 720) {
        return res.status(400).json({
          success: false,
          error: 'Hours must be between 1 and 720 (30 days)',
        });
      }

      const allProviders = cacheSink.getAllProviders();
      const targetProviders =
        providers.length > 0 ? providers : allProviders;

      const historyByProvider: Record<string, unknown[]> = {};

      for (const providerId of targetProviders) {
        const history = await dbSink.getPriceHistory(providerId, productId!, hours);
        if (history.length > 0) {
          historyByProvider[providerId] = history;
        }
      }

      if (Object.keys(historyByProvider).length === 0) {
        return res.status(404).json({
          success: false,
          error: `No history found for product: ${productId}`,
        });
      }

      res.json({
        success: true,
        productId,
        hours,
        providers: Object.keys(historyByProvider),
        data: historyByProvider,
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

function calculateStats(values: number[]): { min: number; max: number; avg: number } {
  if (values.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

  return { min, max, avg };
}
