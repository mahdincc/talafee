import { Router, type Request, type Response } from 'express';
import type { ApiCacheSink } from '../../sinks/index.js';
import type { SqliteSink } from '../../sinks/index.js';
import type { NormalizedPrice } from '../../core/models/index.js';

export function createPricesRouter(
  cacheSink: ApiCacheSink,
  dbSink: SqliteSink
): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const priceMap = await cacheSink.getCurrentPrices();
      const allPrices: NormalizedPrice[] = [];

      for (const prices of priceMap.values()) {
        allPrices.push(...prices);
      }

      res.json({
        success: true,
        data: allPrices,
        count: allPrices.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/by-provider', async (_req: Request, res: Response) => {
    try {
      const priceMap = await cacheSink.getCurrentPrices();
      const grouped: Record<string, NormalizedPrice[]> = {};

      for (const [providerId, prices] of priceMap) {
        grouped[providerId] = prices;
      }

      res.json({
        success: true,
        data: grouped,
        providers: Object.keys(grouped).length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/by-product', async (_req: Request, res: Response) => {
    try {
      const priceMap = await cacheSink.getCurrentPrices();
      const grouped: Record<string, NormalizedPrice[]> = {};

      for (const prices of priceMap.values()) {
        for (const price of prices) {
          if (!grouped[price.productId]) {
            grouped[price.productId] = [];
          }
          grouped[price.productId]!.push(price);
        }
      }

      for (const productId of Object.keys(grouped)) {
        grouped[productId]!.sort((a, b) => a.sellPrice - b.sellPrice);
      }

      res.json({
        success: true,
        data: grouped,
        products: Object.keys(grouped).length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/:productId', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const prices = cacheSink.getAllPricesForProduct(productId!);

      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No prices found for product: ${productId}`,
        });
      }

      const sorted = [...prices].sort((a, b) => a.sellPrice - b.sellPrice);

      res.json({
        success: true,
        data: sorted,
        count: sorted.length,
        best: sorted[0],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/compare/:productId', async (req: Request, res: Response) => {
    try {
      const { productId } = req.params;
      const prices = cacheSink.getAllPricesForProduct(productId!);

      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No prices found for product: ${productId}`,
        });
      }

      const sorted = [...prices].sort((a, b) => a.sellPrice - b.sellPrice);
      const bestPrice = sorted[0]!;
      const worstPrice = sorted[sorted.length - 1]!;

      const comparison = sorted.map((price) => ({
        providerId: price.providerId,
        symbol: price.symbol,
        buyPrice: price.buyPrice,
        sellPrice: price.sellPrice,
        avgPrice: price.avgPrice,
        spread: price.buyPrice - price.sellPrice,
        spreadPercent: ((price.buyPrice - price.sellPrice) / price.sellPrice) * 100,
        differenceFromBest: price.sellPrice - bestPrice.sellPrice,
        differencePercent:
          ((price.sellPrice - bestPrice.sellPrice) / bestPrice.sellPrice) * 100,
        dailyHigh: price.dailyHigh,
        dailyLow: price.dailyLow,
        priceChangePercent: price.priceChangePercent,
        direction: price.direction,
        fetchedAt: price.fetchedAt,
      }));

      res.json({
        success: true,
        productId,
        best: {
          providerId: bestPrice.providerId,
          sellPrice: bestPrice.sellPrice,
        },
        worst: {
          providerId: worstPrice.providerId,
          sellPrice: worstPrice.sellPrice,
        },
        priceRange: worstPrice.sellPrice - bestPrice.sellPrice,
        priceRangePercent:
          ((worstPrice.sellPrice - bestPrice.sellPrice) / bestPrice.sellPrice) * 100,
        comparison,
        count: comparison.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  router.get('/provider/:providerId', async (req: Request, res: Response) => {
    try {
      const { providerId } = req.params;
      const prices = cacheSink.getPricesByProvider(providerId!);

      if (prices.length === 0) {
        return res.status(404).json({
          success: false,
          error: `No prices found for provider: ${providerId}`,
        });
      }

      res.json({
        success: true,
        providerId,
        data: prices,
        count: prices.length,
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
