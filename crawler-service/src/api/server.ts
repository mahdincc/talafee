import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { CrawlPipeline, Scheduler } from '../core/index.js';
import type { ApiCacheSink, SqliteSink } from '../sinks/index.js';
import { createPricesRouter, createHistoryRouter, createHealthRouter, createProductsRouter, bubbleRouter, guideRouter } from './routes/index.js';
import { logger } from '../utils/index.js';
import config from '../../config/crawler.config.js';

export interface ServerDependencies {
  pipeline: CrawlPipeline;
  scheduler: Scheduler;
  cacheSink: ApiCacheSink;
  dbSink: SqliteSink;
}

export function createServer(deps: ServerDependencies): Express {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS configuration - allow configured origins or all in development
  const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      // Check if origin is in allowed list
      if (config.api.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      // In development, allow localhost on any port
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        callback(null, true);
        return;
      }

      // Allow file:// protocol for local development
      if (origin === 'null') {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    credentials: true,
    maxAge: 86400,
  };

  app.use(cors(corsOptions));

  app.use(express.json());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    const start = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string ||
      `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    req.headers['x-correlation-id'] = correlationId;

    _res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path}`, {
        correlationId,
        status: _res.statusCode,
        durationMs: duration,
      });
    });

    next();
  });

  app.get('/', (_req: Request, res: Response) => {
    res.json({
      name: 'Talafee Gold Price Crawler API',
      version: '1.0.0',
      endpoints: {
        prices: '/api/v1/prices',
        pricesByProduct: '/api/v1/prices/:productId',
        priceComparison: '/api/v1/prices/compare/:productId',
        pricesByProvider: '/api/v1/prices/provider/:providerId',
        history: '/api/v1/history/:providerId/:productId',
        health: '/api/v1/health',
        providers: '/api/v1/health/providers',
        products: '/api/v1/products',
        productDetails: '/api/v1/products/:productId',
        productProviders: '/api/v1/products/:productId/providers',
        productMatch: '/api/v1/products/match (POST)',
        productMappings: '/api/v1/products/mappings/all',
        productStats: '/api/v1/products/stats',
        bubble: '/api/v1/bubble',
        bubbleSummary: '/api/v1/bubble/summary',
        bubbleWorldPrice: '/api/v1/bubble/world-price',
        guide: '/api/v1/guide',
        guideSignals: '/api/v1/guide/signals',
        guideIndicators: '/api/v1/guide/indicators',
        guideTips: '/api/v1/guide/tips',
        guideSummary: '/api/v1/guide/summary',
      },
      timestamp: new Date().toISOString(),
    });
  });

  const pricesRouter = createPricesRouter(deps.cacheSink, deps.dbSink);
  const historyRouter = createHistoryRouter(deps.cacheSink, deps.dbSink);
  const healthRouter = createHealthRouter(deps.pipeline, deps.scheduler);
  const productsRouter = createProductsRouter();

  app.use('/api/v1/prices', pricesRouter);
  app.use('/api/v1/history', historyRouter);
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/products', productsRouter);
  app.use('/api/v1/bubble', bubbleRouter);
  app.use('/api/v1/guide', guideRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      message: 'The requested endpoint does not exist',
    });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : err.message,
    });
  });

  return app;
}

export async function startServer(deps: ServerDependencies): Promise<void> {
  const app = createServer(deps);
  const port = config.api.port;

  return new Promise((resolve) => {
    app.listen(port, () => {
      logger.info(`API server started`, {
        port,
        corsOrigins: config.api.corsOrigins,
      });
      resolve();
    });
  });
}
