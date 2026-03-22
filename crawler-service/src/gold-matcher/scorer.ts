/**
 * Gold Product Scorer
 * Multi-gate scoring system for product matching
 * Inspired by VWare Link Matcher scorer
 */

import type { TokenResult, MatchScore, ScoringConfig } from './types.js';
import { CANONICAL_PRODUCTS, DEFAULT_SCORING_CONFIG, CATEGORY_INCOMPATIBLE } from './constants.js';
import { jaccardSimilarity, hasMatchingDistinctiveTokens } from './normalizer.js';
import type { ProductId } from '../core/models/index.js';

/**
 * Score a match between a token result and a canonical product
 */
export function scoreMatch(
  tokenResult: TokenResult,
  canonicalProductId: ProductId,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): MatchScore {
  const canonical = CANONICAL_PRODUCTS[canonicalProductId];
  if (!canonical) {
    return {
      score: 0,
      confidence: 'NONE',
      reasons: ['Unknown canonical product'],
      isMatch: false,
      rejectedBy: 'unknown_product',
    };
  }

  const reasons: string[] = [];
  let score = 0;

  // ========== GATE 1: Category Gate (Hard) ==========
  if (tokenResult.category !== canonical.category) {
    // Check if categories are incompatible
    const incompatible = CATEGORY_INCOMPATIBLE[tokenResult.category];
    if (incompatible && incompatible.includes(canonical.category)) {
      return {
        score: config.categoryMismatchPenalty,
        confidence: 'NONE',
        reasons: [`Category mismatch: ${tokenResult.category} vs ${canonical.category}`],
        isMatch: false,
        rejectedBy: 'category_gate',
      };
    }
  } else {
    score += config.categoryMatchWeight;
    reasons.push(`Category match: ${canonical.category} (+${config.categoryMatchWeight})`);
  }

  // ========== GATE 2: Purity Gate (Hard) ==========
  if (tokenResult.purity !== null && canonical.purity !== null) {
    if (tokenResult.purity !== canonical.purity) {
      return {
        score: config.purityMismatchPenalty,
        confidence: 'NONE',
        reasons: [`Purity mismatch: ${tokenResult.purity} vs ${canonical.purity}`],
        isMatch: false,
        rejectedBy: 'purity_gate',
      };
    } else {
      score += config.purityMatchWeight;
      reasons.push(`Purity match: ${canonical.purity} (+${config.purityMatchWeight})`);
    }
  }

  // ========== GATE 3: Weight Gate (Soft for gold, Hard for coins) ==========
  if (canonical.weightGrams !== null && tokenResult.weightGrams !== null) {
    const weightDiff = Math.abs(tokenResult.weightGrams - canonical.weightGrams);
    const tolerance = canonical.category === 'coin' ? 0.5 : 2; // Stricter for coins

    if (weightDiff <= tolerance) {
      score += config.weightMatchWeight;
      reasons.push(`Weight match: ${tokenResult.weightGrams}g ≈ ${canonical.weightGrams}g (+${config.weightMatchWeight})`);
    } else if (canonical.category === 'coin') {
      // Hard reject for coin weight mismatch
      return {
        score: config.weightMismatchPenalty,
        confidence: 'NONE',
        reasons: [`Weight mismatch for coin: ${tokenResult.weightGrams}g vs ${canonical.weightGrams}g`],
        isMatch: false,
        rejectedBy: 'weight_gate',
      };
    } else {
      score += config.weightMismatchPenalty;
      reasons.push(`Weight mismatch: ${tokenResult.weightGrams}g vs ${canonical.weightGrams}g (${config.weightMismatchPenalty})`);
    }
  }

  // ========== SCORING: Token Overlap ==========
  const canonicalTokens = new Set([
    ...canonical.aliases.map(a => a.toLowerCase()),
    ...canonical.distinctiveTokens.map(t => t.toLowerCase()),
    canonical.id,
    canonical.nameEn.toLowerCase(),
    canonical.nameFa,
  ]);

  const similarity = jaccardSimilarity(tokenResult.tokens, canonicalTokens);
  const tokenScore = similarity * config.tokenOverlapWeight;
  score += tokenScore;
  reasons.push(`Token overlap: ${(similarity * 100).toFixed(1)}% (+${tokenScore.toFixed(1)})`);

  // ========== SCORING: Distinctive Token Match ==========
  const distinctiveMatch = hasMatchingDistinctiveTokens(
    tokenResult.tokens,
    canonicalTokens,
    tokenResult.distinctiveTokens
  );

  if (distinctiveMatch.matchedTokens.length > 0) {
    const dtScore = distinctiveMatch.matchedTokens.length * config.distinctiveTokenWeight;
    score += dtScore;
    reasons.push(`Distinctive tokens: [${distinctiveMatch.matchedTokens.join(', ')}] (+${dtScore})`);
  }

  if (distinctiveMatch.missingTokens.length > 0) {
    const penalty = distinctiveMatch.missingTokens.length * config.distinctiveTokenMismatchPenalty;
    score += penalty;
    reasons.push(`Missing distinctive: [${distinctiveMatch.missingTokens.join(', ')}] (${penalty})`);
  }

  // ========== BOOST: Exact Match ==========
  if (tokenResult.productId === canonicalProductId) {
    score += config.exactMatchBoost;
    reasons.push(`Exact product ID match (+${config.exactMatchBoost})`);
  }

  // ========== BOOST: High Overlap ==========
  if (similarity > 0.8) {
    score += config.highOverlapBoost;
    reasons.push(`High token overlap bonus (+${config.highOverlapBoost})`);
  }

  // ========== DETERMINE CONFIDENCE ==========
  let confidence: MatchScore['confidence'];
  if (score >= config.veryHighConfidenceThreshold) {
    confidence = 'VERY_HIGH';
  } else if (score >= config.highConfidenceThreshold) {
    confidence = 'HIGH';
  } else if (score >= config.minScoreForMatch) {
    confidence = 'MEDIUM';
  } else if (score >= config.minScoreForMatch * 0.6) {
    confidence = 'LOW';
  } else {
    confidence = 'NONE';
  }

  const isMatch = score >= config.minScoreForMatch;

  return {
    score,
    confidence,
    reasons,
    isMatch,
  };
}

/**
 * Find the best matching canonical product for a token result
 */
export function findBestMatch(
  tokenResult: TokenResult,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): { productId: ProductId; score: MatchScore } | null {
  let bestMatch: { productId: ProductId; score: MatchScore } | null = null;

  for (const productId of Object.keys(CANONICAL_PRODUCTS) as ProductId[]) {
    const score = scoreMatch(tokenResult, productId, config);

    if (score.isMatch) {
      if (bestMatch === null || score.score > bestMatch.score.score) {
        bestMatch = { productId, score };
      }
    }
  }

  return bestMatch;
}

/**
 * Score multiple token results against canonical products
 */
export function scoreAll(
  tokenResults: TokenResult[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG
): Array<{ tokenResult: TokenResult; match: { productId: ProductId; score: MatchScore } | null }> {
  return tokenResults.map(tokenResult => ({
    tokenResult,
    match: findBestMatch(tokenResult, config),
  }));
}

/**
 * Get confidence level description
 */
export function getConfidenceDescription(confidence: MatchScore['confidence']): string {
  switch (confidence) {
    case 'VERY_HIGH':
      return 'Exact or near-exact match';
    case 'HIGH':
      return 'Strong match with high confidence';
    case 'MEDIUM':
      return 'Good match, review recommended';
    case 'LOW':
      return 'Possible match, manual verification needed';
    case 'NONE':
      return 'No match found';
  }
}
