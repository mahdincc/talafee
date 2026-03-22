/**
 * Gold Product Tokenizer
 * Extracts meaningful tokens from product names/symbols
 */

import type { ProductId } from '../core/models/index.js';
import type { TokenResult, GoldPurity, GoldCategory, PriceUnit } from './types.js';
import {
  CANONICAL_PRODUCTS,
  NOISE_TOKENS,
  PROVIDER_SYMBOL_MAPS,
} from './constants.js';
import {
  normalizePersianText,
  extractPurity,
  extractCategory,
  extractWeight,
  extractPriceUnit,
  extractTokens,
} from './normalizer.js';

/**
 * Tokenize a product name/symbol
 */
export function tokenize(
  nameOrSymbol: string,
  providerId?: string
): TokenResult {
  const normalized = normalizePersianText(nameOrSymbol);

  // First, try direct symbol mapping if providerId is given
  if (providerId) {
    const mapping = findSymbolMapping(nameOrSymbol, providerId);
    if (mapping) {
      const canonical = CANONICAL_PRODUCTS[mapping.productId];
      if (canonical) {
        return {
          tokens: new Set([...canonical.aliases.map(a => a.toLowerCase()), mapping.productId]),
          purity: canonical.purity,
          category: canonical.category,
          weightGrams: canonical.weightGrams,
          distinctiveTokens: new Set(canonical.distinctiveTokens),
          priceUnit: mapping.priceUnit,
          rawName: nameOrSymbol,
          productId: mapping.productId,
        };
      }
    }
  }

  // Extract all features
  const tokens = extractTokens(normalized);
  const purity = extractPurity(normalized);
  const category = extractCategory(normalized);
  const weight = extractWeight(normalized);
  const priceUnit = extractPriceUnit(normalized, category);

  // Filter out noise tokens
  const filteredTokens = new Set<string>();
  for (const token of tokens) {
    if (!NOISE_TOKENS.has(token)) {
      filteredTokens.add(token);
    }
  }

  // Find distinctive tokens
  const distinctiveTokens = new Set<string>();
  for (const [_, canonical] of Object.entries(CANONICAL_PRODUCTS)) {
    for (const dt of canonical.distinctiveTokens) {
      if (filteredTokens.has(dt.toLowerCase())) {
        distinctiveTokens.add(dt.toLowerCase());
      }
    }
  }

  // Try to match to a canonical product
  const productId = findCanonicalProduct(filteredTokens, purity, category, weight);

  return {
    tokens: filteredTokens,
    purity,
    category,
    weightGrams: weight,
    distinctiveTokens,
    priceUnit,
    rawName: nameOrSymbol,
    productId,
  };
}

/**
 * Find a symbol mapping for a provider
 */
function findSymbolMapping(
  symbol: string,
  providerId: string
): { productId: ProductId; priceUnit: PriceUnit; priceMultiplier: number } | null {
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
        priceUnit: mapping.priceUnit,
        priceMultiplier: mapping.priceMultiplier,
      };
    }
  }

  return null;
}

/**
 * Find the best matching canonical product
 */
function findCanonicalProduct(
  tokens: Set<string>,
  purity: GoldPurity,
  category: GoldCategory,
  weight: number | null
): ProductId | null {
  let bestMatch: { productId: ProductId; score: number } | null = null;

  for (const [productId, canonical] of Object.entries(CANONICAL_PRODUCTS)) {
    let score = 0;

    // Category must match
    if (canonical.category !== category) {
      continue;
    }

    // Purity match (if both specified)
    if (purity !== null && canonical.purity !== null) {
      if (purity === canonical.purity) {
        score += 30;
      } else {
        continue; // Hard reject for purity mismatch
      }
    }

    // Weight match (for coins)
    if (weight !== null && canonical.weightGrams !== null) {
      const weightDiff = Math.abs(weight - canonical.weightGrams);
      if (weightDiff < 0.5) {
        score += 20;
      } else if (weightDiff < 1) {
        score += 10;
      }
    }

    // Token overlap with aliases
    const aliasTokens = new Set(canonical.aliases.map(a => a.toLowerCase()));
    let tokenMatchCount = 0;
    for (const token of tokens) {
      if (aliasTokens.has(token)) {
        tokenMatchCount++;
      }
    }
    score += tokenMatchCount * 5;

    // Distinctive token match
    for (const dt of canonical.distinctiveTokens) {
      if (tokens.has(dt.toLowerCase())) {
        score += 15;
      }
    }

    if (bestMatch === null || score > bestMatch.score) {
      bestMatch = { productId: productId as ProductId, score };
    }
  }

  // Require minimum score
  if (bestMatch && bestMatch.score >= 15) {
    return bestMatch.productId;
  }

  return null;
}

/**
 * Batch tokenize multiple products
 */
export function tokenizeAll(
  items: Array<{ name: string; providerId?: string }>
): TokenResult[] {
  return items.map(item => tokenize(item.name, item.providerId));
}

/**
 * Get canonical product by ID
 */
export function getCanonicalProduct(productId: ProductId) {
  return CANONICAL_PRODUCTS[productId] || null;
}

/**
 * Check if a token result matches a canonical product
 */
export function matchesCanonicalProduct(
  tokenResult: TokenResult,
  productId: ProductId
): boolean {
  const canonical = CANONICAL_PRODUCTS[productId];
  if (!canonical) {
    return false;
  }

  // Category must match
  if (tokenResult.category !== canonical.category) {
    return false;
  }

  // Purity must match (if both specified)
  if (tokenResult.purity !== null && canonical.purity !== null) {
    if (tokenResult.purity !== canonical.purity) {
      return false;
    }
  }

  // Check for at least one distinctive token match
  for (const dt of canonical.distinctiveTokens) {
    if (tokenResult.tokens.has(dt.toLowerCase())) {
      return true;
    }
  }

  // Check for alias match
  for (const alias of canonical.aliases) {
    if (tokenResult.tokens.has(alias.toLowerCase())) {
      return true;
    }
  }

  return false;
}
