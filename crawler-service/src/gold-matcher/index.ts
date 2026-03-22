/**
 * Gold Product Matcher Module
 *
 * Provides token-based matching for gold products across multiple providers.
 * Inspired by VWare Link Matcher architecture.
 *
 * Key Features:
 * - Token extraction from Persian/English product names
 * - Purity and weight normalization
 * - Multi-gate scoring system with hard/soft rejects
 * - Canonical product mapping for cross-provider comparison
 * - Price normalization to standard units (Rials per gram)
 */

// Types
export type {
  GoldCategory,
  GoldPurity,
  PriceUnit,
  TokenResult,
  ProviderProductEntry,
  MatchScore,
  ProductMatch,
  CanonicalProduct,
  ProviderSymbolMap,
  ScoringConfig,
} from './types.js';

// Constants
export {
  CANONICAL_PRODUCTS,
  PURITY_ALIASES,
  CATEGORY_KEYWORDS,
  NOISE_TOKENS,
  PROVIDER_SYMBOL_MAPS,
  DEFAULT_SCORING_CONFIG,
  CATEGORY_INCOMPATIBLE,
  PERSIAN_DIGITS,
  ARABIC_CHAR_MAP,
} from './constants.js';

// Normalizer functions
export {
  normalizePersianText,
  extractPurity,
  extractCategory,
  extractWeight,
  extractPriceUnit,
  extractTokens,
  jaccardSimilarity,
  hasMatchingDistinctiveTokens,
  normalizeSymbol,
  normalizePriceToRialsPerGram,
} from './normalizer.js';

// Tokenizer functions
export {
  tokenize,
  tokenizeAll,
  getCanonicalProduct,
  matchesCanonicalProduct,
} from './tokenizer.js';

// Scorer functions
export {
  scoreMatch,
  findBestMatch,
  scoreAll,
  getConfidenceDescription,
} from './scorer.js';

// Matcher class and functions
export {
  GoldProductMatcher,
  getProviderSymbolMapping,
  normalizePrice,
  getGoldMatcher,
  initializeGoldMatcher,
} from './matcher.js';
