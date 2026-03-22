/**
 * Gold Product Matcher Types
 * Inspired by VWare Link Matcher architecture
 */

import type { ProductId } from '../core/models/index.js';

/**
 * Canonical gold product categories
 */
export type GoldCategory = 'gold' | 'coin' | 'silver' | 'currency';

/**
 * Purity levels for gold products
 */
export type GoldPurity = 750 | 740 | 916 | 999 | null;

/**
 * Unit types for pricing
 */
export type PriceUnit = 'gram' | 'mesghal' | 'ounce' | 'piece' | '10gram';

/**
 * Token extraction result from a product name/symbol
 */
export interface TokenResult {
  /** All extracted tokens (lowercase, normalized) */
  tokens: Set<string>;
  /** Detected gold purity (750=18k, 999=24k, etc.) */
  purity: GoldPurity;
  /** Detected category */
  category: GoldCategory;
  /** Weight in grams (if applicable) */
  weightGrams: number | null;
  /** Distinctive tokens that MUST match */
  distinctiveTokens: Set<string>;
  /** Whether this is a per-unit price (coins) or per-gram */
  priceUnit: PriceUnit;
  /** Raw symbol/name before normalization */
  rawName: string;
  /** Canonical product ID */
  productId: ProductId | null;
}

/**
 * Provider product entry for indexing
 */
export interface ProviderProductEntry {
  /** Provider ID (e.g., 'taline', 'technogold') */
  providerId: string;
  /** Provider's symbol for this product */
  symbol: string;
  /** Canonical product ID */
  productId: ProductId;
  /** Token extraction result */
  tokens: TokenResult;
  /** Persian display name */
  persianName?: string;
  /** English display name */
  englishName?: string;
}

/**
 * Match score result
 */
export interface MatchScore {
  /** Total score (0-100+) */
  score: number;
  /** Confidence level */
  confidence: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  /** Reasons for the score */
  reasons: string[];
  /** Whether this is a valid match */
  isMatch: boolean;
  /** Gate that rejected the match (if any) */
  rejectedBy?: string;
}

/**
 * Product match result
 */
export interface ProductMatch {
  /** Source product (from provider) */
  source: ProviderProductEntry;
  /** Matched canonical product */
  canonicalProductId: ProductId;
  /** Match score */
  score: MatchScore;
  /** Other providers with same product */
  relatedProviders: string[];
}

/**
 * Canonical product definition
 */
export interface CanonicalProduct {
  /** Unique product ID */
  id: ProductId;
  /** Persian name */
  nameFa: string;
  /** English name */
  nameEn: string;
  /** Product category */
  category: GoldCategory;
  /** Gold purity (null for silver/other) */
  purity: GoldPurity;
  /** Weight in grams (null for variable weight) */
  weightGrams: number | null;
  /** Price unit for this product */
  priceUnit: PriceUnit;
  /** Known aliases (Persian and English) */
  aliases: string[];
  /** Distinctive tokens that identify this product */
  distinctiveTokens: string[];
}

/**
 * Provider symbol mapping
 */
export interface ProviderSymbolMap {
  providerId: string;
  mappings: Array<{
    symbol: string;
    productId: ProductId;
    priceUnit: PriceUnit;
    /** Multiplier to convert to standard unit (Rials per gram) */
    priceMultiplier: number;
  }>;
}

/**
 * Scoring configuration
 */
export interface ScoringConfig {
  /** Minimum score for a match */
  minScoreForMatch: number;
  /** Threshold for high confidence */
  highConfidenceThreshold: number;
  /** Threshold for very high confidence */
  veryHighConfidenceThreshold: number;

  // Weights
  tokenOverlapWeight: number;
  purityMatchWeight: number;
  categoryMatchWeight: number;
  weightMatchWeight: number;
  distinctiveTokenWeight: number;

  // Penalties
  purityMismatchPenalty: number;
  categoryMismatchPenalty: number;
  weightMismatchPenalty: number;
  distinctiveTokenMismatchPenalty: number;

  // Boosts
  exactMatchBoost: number;
  highOverlapBoost: number;
}
