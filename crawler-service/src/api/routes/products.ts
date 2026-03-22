/**
 * Products API Router
 * Provides endpoints for canonical product information and matching
 */

import { Router, type Request, type Response } from 'express';
import type { ProductId } from '../../core/models/index.js';
import {
  initializeGoldMatcher,
  getGoldMatcher,
  CANONICAL_PRODUCTS,
  PROVIDER_SYMBOL_MAPS,
  tokenize,
  scoreMatch,
} from '../../gold-matcher/index.js';

export function createProductsRouter(): Router {
  const router = Router();

  // Initialize matcher on first load
  initializeGoldMatcher();

  /**
   * GET /api/v1/products
   * List all canonical gold products
   */
  router.get('/', (_req: Request, res: Response) => {
    const products = Object.values(CANONICAL_PRODUCTS).map(p => ({
      id: p.id,
      nameFa: p.nameFa,
      nameEn: p.nameEn,
      category: p.category,
      purity: p.purity,
      weightGrams: p.weightGrams,
      priceUnit: p.priceUnit,
    }));

    res.json({
      success: true,
      data: {
        products,
        count: products.length,
      },
    });
  });

  /**
   * GET /api/v1/products/:productId
   * Get details for a specific canonical product
   */
  router.get('/:productId', (req: Request, res: Response) => {
    const productId = req.params['productId'] as ProductId;
    const product = CANONICAL_PRODUCTS[productId];

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
        message: `No product found with ID: ${productId}`,
      });
      return;
    }

    // Get providers offering this product
    const matcher = getGoldMatcher();
    const providers = matcher.getProvidersForProduct(productId);

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          nameFa: product.nameFa,
          nameEn: product.nameEn,
          category: product.category,
          purity: product.purity,
          weightGrams: product.weightGrams,
          priceUnit: product.priceUnit,
          aliases: product.aliases,
          distinctiveTokens: product.distinctiveTokens,
        },
        providers: providers.map(p => ({
          providerId: p.providerId,
          symbol: p.symbol,
          persianName: p.persianName,
          englishName: p.englishName,
        })),
      },
    });
  });

  /**
   * GET /api/v1/products/:productId/providers
   * Get all providers offering a specific product
   */
  router.get('/:productId/providers', (req: Request, res: Response) => {
    const productId = req.params['productId'] as ProductId;
    const product = CANONICAL_PRODUCTS[productId];

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
        message: `No product found with ID: ${productId}`,
      });
      return;
    }

    const matcher = getGoldMatcher();
    const providers = matcher.getProvidersForProduct(productId);

    res.json({
      success: true,
      data: {
        productId,
        productName: {
          fa: product.nameFa,
          en: product.nameEn,
        },
        providers: providers.map(p => ({
          providerId: p.providerId,
          symbol: p.symbol,
        })),
        count: providers.length,
      },
    });
  });

  /**
   * GET /api/v1/products/provider/:providerId
   * Get all products offered by a specific provider
   */
  router.get('/provider/:providerId', (req: Request, res: Response) => {
    const providerId = req.params['providerId'] as string;

    const providerMap = PROVIDER_SYMBOL_MAPS.find(p => p.providerId === providerId);
    if (!providerMap) {
      res.status(404).json({
        success: false,
        error: 'Provider not found',
        message: `No provider found with ID: ${providerId}`,
      });
      return;
    }

    const products = providerMap.mappings.map(m => {
      const canonical = CANONICAL_PRODUCTS[m.productId];
      return {
        symbol: m.symbol,
        productId: m.productId,
        priceUnit: m.priceUnit,
        priceMultiplier: m.priceMultiplier,
        product: canonical
          ? {
              nameFa: canonical.nameFa,
              nameEn: canonical.nameEn,
              category: canonical.category,
              purity: canonical.purity,
            }
          : null,
      };
    });

    res.json({
      success: true,
      data: {
        providerId,
        products,
        count: products.length,
      },
    });
  });

  /**
   * POST /api/v1/products/match
   * Match a product name/symbol to canonical products
   */
  router.post('/match', (req: Request, res: Response) => {
    const { name, symbol, providerId } = req.body as {
      name?: string;
      symbol?: string;
      providerId?: string;
    };

    const input = name || symbol;
    if (!input) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Either "name" or "symbol" is required',
      });
      return;
    }

    // Tokenize the input
    const tokens = tokenize(input, providerId);

    // Score against all canonical products
    const scores = Object.keys(CANONICAL_PRODUCTS).map(productId => {
      const score = scoreMatch(tokens, productId as ProductId);
      return {
        productId,
        ...score,
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Filter to only matches
    const matches = scores.filter(s => s.isMatch);

    res.json({
      success: true,
      data: {
        input,
        providerId: providerId || null,
        tokens: {
          all: Array.from(tokens.tokens),
          distinctive: Array.from(tokens.distinctiveTokens),
          purity: tokens.purity,
          category: tokens.category,
          priceUnit: tokens.priceUnit,
        },
        matches: matches.slice(0, 5).map(m => ({
          productId: m.productId,
          product: CANONICAL_PRODUCTS[m.productId as ProductId],
          score: m.score,
          confidence: m.confidence,
          reasons: m.reasons,
        })),
        bestMatch: matches.length > 0 ? matches[0].productId : null,
      },
    });
  });

  /**
   * GET /api/v1/products/mappings
   * Get all provider-to-product mappings
   */
  router.get('/mappings/all', (_req: Request, res: Response) => {
    const mappings = PROVIDER_SYMBOL_MAPS.map(pm => ({
      providerId: pm.providerId,
      products: pm.mappings.map(m => ({
        symbol: m.symbol,
        productId: m.productId,
        priceUnit: m.priceUnit,
        priceMultiplier: m.priceMultiplier,
      })),
    }));

    res.json({
      success: true,
      data: {
        mappings,
        totalProviders: mappings.length,
        totalProducts: mappings.reduce((sum, pm) => sum + pm.products.length, 0),
      },
    });
  });

  /**
   * GET /api/v1/products/stats
   * Get statistics about product matching
   */
  router.get('/stats', (_req: Request, res: Response) => {
    const matcher = getGoldMatcher();
    const stats = matcher.getStats();

    res.json({
      success: true,
      data: stats,
    });
  });

  return router;
}
