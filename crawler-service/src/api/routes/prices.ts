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
        grouped[productId]!.sort((a, b) => a.buyPrice - b.buyPrice);
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

      // Sort by buyPrice ascending: lowest dealer-ask = cheapest for the
      // user to BUY from. Sorting by sellPrice (dealer-bid) was wrong —
      // it would mark a provider with a wide spread as "best" even when
      // their ask is higher than competitors.
      const sorted = [...prices].sort((a, b) => a.buyPrice - b.buyPrice);

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

      // Sort by buyPrice ascending: lowest dealer-ask = cheapest for the
      // user to BUY from. Sorting by sellPrice (dealer-bid) was wrong —
      // it would mark a provider with a wide spread as "best" even when
      // their ask is higher than competitors.
      const sorted = [...prices].sort((a, b) => a.buyPrice - b.buyPrice);
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
        differenceFromBest: price.buyPrice - bestPrice.buyPrice,
        differencePercent:
          ((price.buyPrice - bestPrice.buyPrice) / bestPrice.buyPrice) * 100,
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
          buyPrice: bestPrice.buyPrice,
          sellPrice: bestPrice.sellPrice,
        },
        worst: {
          providerId: worstPrice.providerId,
          buyPrice: worstPrice.buyPrice,
          sellPrice: worstPrice.sellPrice,
        },
        priceRange: worstPrice.buyPrice - bestPrice.buyPrice,
        priceRangePercent:
          ((worstPrice.buyPrice - bestPrice.buyPrice) / bestPrice.buyPrice) * 100,
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
