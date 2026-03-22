/**
 * Gold Product Matcher
 * Main orchestrator for matching provider products to canonical products
 */

import type { ProductId } from '../core/models/index.js';
import type {
  TokenResult,
  MatchScore,
  ProductMatch,
  ProviderProductEntry,
  ScoringConfig,
  CanonicalProduct,
} from './types.js';
import { CANONICAL_PRODUCTS, PROVIDER_SYMBOL_MAPS, DEFAULT_SCORING_CONFIG } from './constants.js';
import { tokenize, getCanonicalProduct } from './tokenizer.js';
import { scoreMatch, findBestMatch } from './scorer.js';
import { normalizePriceToRialsPerGram } from './normalizer.js';

/**
 * Gold Product Matcher class
 * Matches provider products to canonical products for price comparison
 */
export class GoldProductMatcher {
  private config: ScoringConfig;
  private productIndex: Map<ProductId, ProviderProductEntry[]>;

  constructor(config: ScoringConfig = DEFAULT_SCORING_CONFIG) {
    this.config = config;
    this.productIndex = new Map();
  }

  /**
   * Register a provider product and match it to a canonical product
   */
  registerProduct(
    providerId: string,
    symbol: string,
    persianName?: string,
    englishName?: string
  ): ProductMatch | null {
    // Tokenize the product
    const tokens = tokenize(symbol, providerId);

    // Also tokenize names if provided
    if (persianName) {
      const nameTokens = tokenize(persianName);
      for (const t of nameTokens.tokens) {
        tokens.tokens.add(t);
      }
      for (const dt of nameTokens.distinctiveTokens) {
        tokens.distinctiveTokens.add(dt);
      }
    }

    if (englishName) {
      const nameTokens = tokenize(englishName);
      for (const t of nameTokens.tokens) {
        tokens.tokens.add(t);
      }
    }

    // Find best match
    const match = findBestMatch(tokens, this.config);
    if (!match) {
      return null;
    }

    // Create provider product entry
    const entry: ProviderProductEntry = {
      providerId,
      symbol,
      productId: match.productId,
      tokens,
      persianName,
      englishName,
    };

    // Add to index
    if (!this.productIndex.has(match.productId)) {
      this.productIndex.set(match.productId, []);
    }
    this.productIndex.get(match.productId)!.push(entry);

    // Find related providers
    const relatedProviders = this.productIndex
      .get(match.productId)!
      .map(e => e.providerId)
      .filter(p => p !== providerId);

    return {
      source: entry,
      canonicalProductId: match.productId,
      score: match.score,
      relatedProviders,
    };
  }

  /**
   * Get all providers offering a specific product
   */
  getProvidersForProduct(productId: ProductId): ProviderProductEntry[] {
    return this.productIndex.get(productId) || [];
  }

  /**
   * Get all products offered by a specific provider
   */
  getProductsForProvider(providerId: string): ProviderProductEntry[] {
    const products: ProviderProductEntry[] = [];
    for (const entries of this.productIndex.values()) {
      for (const entry of entries) {
        if (entry.providerId === providerId) {
          products.push(entry);
        }
      }
    }
    return products;
  }

  /**
   * Get canonical product info
   */
  getCanonicalProduct(productId: ProductId): CanonicalProduct | null {
    return getCanonicalProduct(productId);
  }

  /**
   * Get all canonical products
   */
  getAllCanonicalProducts(): CanonicalProduct[] {
    return Object.values(CANONICAL_PRODUCTS);
  }

  /**
   * Get comparison data for a product across all providers
   */
  getProductComparison(productId: ProductId): {
    product: CanonicalProduct;
    providers: Array<{
      providerId: string;
      symbol: string;
      confidence: string;
    }>;
  } | null {
    const product = CANONICAL_PRODUCTS[productId];
    if (!product) {
      return null;
    }

    const entries = this.productIndex.get(productId) || [];
    const providers = entries.map(e => ({
      providerId: e.providerId,
      symbol: e.symbol,
      confidence: this.getMatchConfidence(e, productId),
    }));

    return { product, providers };
  }

  /**
   * Get match confidence for a provider entry
   */
  private getMatchConfidence(entry: ProviderProductEntry, productId: ProductId): string {
    const score = scoreMatch(entry.tokens, productId, this.config);
    return score.confidence;
  }

  /**
   * Clear the product index
   */
  clear(): void {
    this.productIndex.clear();
  }

  /**
   * Get statistics about registered products
   */
  getStats(): {
    totalProducts: number;
    productsByCanonical: Record<string, number>;
    productsByProvider: Record<string, number>;
  } {
    const productsByCanonical: Record<string, number> = {};
    const productsByProvider: Record<string, number> = {};
    let totalProducts = 0;

    for (const [productId, entries] of this.productIndex) {
      productsByCanonical[productId] = entries.length;
      totalProducts += entries.length;

      for (const entry of entries) {
        productsByProvider[entry.providerId] = (productsByProvider[entry.providerId] || 0) + 1;
      }
    }

    return { totalProducts, productsByCanonical, productsByProvider };
  }
}

/**
 * Get provider symbol mapping
 */
export function getProviderSymbolMapping(providerId: string, symbol: string): {
  productId: ProductId;
  priceMultiplier: number;
} | null {
  const providerMap = PROVIDER_SYMBOL_MAPS.find(p => p.providerId === providerId);
  if (!providerMap) {
    return null;
  }

  const normalizedSymbol = symbol.toUpperCase().replace(/[-_\s]+/g, '_');

  for (const mapping of providerMap.mappings) {
    const mappingSymbol = mapping.symbol.toUpperCase().replace(/[-_\s]+/g, '_');
    if (normalizedSymbol === mappingSymbol || normalizedSymbol.includes(mappingSymbol)) {
      return {
        productId: mapping.productId,
        priceMultiplier: mapping.priceMultiplier,
      };
    }
  }

  return null;
}

/**
 * Normalize a price from provider format to standard Rials per gram
 */
export function normalizePrice(
  price: number,
  providerId: string,
  symbol: string
): { normalizedPrice: number; productId: ProductId } | null {
  const mapping = getProviderSymbolMapping(providerId, symbol);
  if (!mapping) {
    return null;
  }

  const canonical = CANONICAL_PRODUCTS[mapping.productId];
  if (!canonical) {
    return null;
  }

  const normalizedPrice = normalizePriceToRialsPerGram(
    price * mapping.priceMultiplier,
    canonical.priceUnit,
    canonical.weightGrams
  );

  return {
    normalizedPrice,
    productId: mapping.productId,
  };
}

/**
 * Create a singleton matcher instance
 */
let matcherInstance: GoldProductMatcher | null = null;

export function getGoldMatcher(): GoldProductMatcher {
  if (!matcherInstance) {
    matcherInstance = new GoldProductMatcher();
  }
  return matcherInstance;
}

/**
 * Initialize the matcher with provider symbol mappings
 */
export function initializeGoldMatcher(): GoldProductMatcher {
  const matcher = getGoldMatcher();
  matcher.clear();

  // Register all known provider symbols
  for (const providerMap of PROVIDER_SYMBOL_MAPS) {
    for (const mapping of providerMap.mappings) {
      const canonical = CANONICAL_PRODUCTS[mapping.productId];
      if (canonical) {
        matcher.registerProduct(
          providerMap.providerId,
          mapping.symbol,
          canonical.nameFa,
          canonical.nameEn
        );
      }
    }
  }

  return matcher;
}
