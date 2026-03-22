/**
 * Gold Product Normalizer
 * Handles Persian text normalization and gold-specific value extraction
 */

import type { GoldPurity, GoldCategory, PriceUnit } from './types.js';
import {
  PERSIAN_DIGITS,
  ARABIC_CHAR_MAP,
  PURITY_ALIASES,
  CATEGORY_KEYWORDS,
} from './constants.js';

/**
 * Normalize Persian/Arabic text to standard form
 */
export function normalizePersianText(text: string): string {
  let normalized = text.toLowerCase();

  // Convert Persian digits to Western
  for (const [persian, western] of Object.entries(PERSIAN_DIGITS)) {
    normalized = normalized.replace(new RegExp(persian, 'g'), western);
  }

  // Normalize Arabic characters to Persian
  for (const [arabic, persian] of Object.entries(ARABIC_CHAR_MAP)) {
    normalized = normalized.replace(new RegExp(arabic, 'g'), persian);
  }

  // Remove zero-width non-joiners and other invisible characters
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extract purity from text
 */
export function extractPurity(text: string): GoldPurity {
  const normalized = normalizePersianText(text);

  // Check direct aliases
  for (const [alias, purity] of Object.entries(PURITY_ALIASES)) {
    if (normalized.includes(alias.toLowerCase())) {
      return purity;
    }
  }

  // Pattern-based extraction
  const patterns = [
    /(\d{2,3})\s*(?:k|karat|عیار)/i,
    /(?:عیار|karat|k)\s*(\d{2,3})/i,
    /gold\s*(\d{3})/i,
    /(\d{3})\s*gold/i,
    /xau(\d{2})/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = match[1];
      // Check if it maps to a known purity
      const purityKey = value.toLowerCase();
      if (PURITY_ALIASES[purityKey]) {
        return PURITY_ALIASES[purityKey];
      }
    }
  }

  return null;
}

/**
 * Extract category from text
 */
export function extractCategory(text: string): GoldCategory {
  const normalized = normalizePersianText(text);

  // Check coin keywords first (more specific)
  for (const keyword of CATEGORY_KEYWORDS.coin) {
    if (normalized.includes(keyword.toLowerCase())) {
      return 'coin';
    }
  }

  // Check silver keywords
  for (const keyword of CATEGORY_KEYWORDS.silver) {
    if (normalized.includes(keyword.toLowerCase())) {
      return 'silver';
    }
  }

  // Default to gold
  return 'gold';
}

/**
 * Extract weight in grams from text
 */
export function extractWeight(text: string): number | null {
  const normalized = normalizePersianText(text);

  // Weight patterns
  const patterns = [
    // "10 گرم", "10 gram", "10g"
    /(\d+(?:\.\d+)?)\s*(?:گرم|gram|g\b)/i,
    // "1 اونس", "1 ounce"
    /(\d+(?:\.\d+)?)\s*(?:اونس|انس|ounce|oz)/i,
    // "1 مثقال"
    /(\d+(?:\.\d+)?)\s*(?:مثقال|mesghal|mithqal)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);

      // Convert to grams if needed
      if (pattern.source.includes('اونس') || pattern.source.includes('ounce')) {
        return value * 31.1035; // Troy ounce to grams
      }
      if (pattern.source.includes('مثقال') || pattern.source.includes('mesghal')) {
        return value * 4.6083; // Mesghal to grams
      }

      return value;
    }
  }

  return null;
}

/**
 * Determine price unit from text or context
 */
export function extractPriceUnit(text: string, category: GoldCategory): PriceUnit {
  const normalized = normalizePersianText(text);

  // Coins are always per piece
  if (category === 'coin') {
    return 'piece';
  }

  // Check for explicit unit mentions
  if (normalized.includes('اونس') || normalized.includes('ounce') || normalized.includes('انس')) {
    return 'ounce';
  }

  if (normalized.includes('مثقال') || normalized.includes('mesghal') || normalized.includes('mithqal')) {
    return 'mesghal';
  }

  if (normalized.includes('10گرم') || normalized.includes('10 گرم') || normalized.includes('10gram')) {
    return '10gram';
  }

  // Default to gram for gold/silver
  return 'gram';
}

/**
 * Extract tokens from text
 * Returns normalized, meaningful tokens
 */
export function extractTokens(text: string): Set<string> {
  const normalized = normalizePersianText(text);
  const tokens = new Set<string>();

  // Extract English tokens
  const englishPattern = /[a-z][a-z0-9]*/gi;
  let match;
  while ((match = englishPattern.exec(normalized)) !== null) {
    const token = match[0].toLowerCase();
    if (token.length >= 2) {
      tokens.add(token);
    }
  }

  // Extract Persian tokens (words)
  const persianPattern = /[\u0600-\u06FF]+/g;
  while ((match = persianPattern.exec(normalized)) !== null) {
    const token = match[0];
    if (token.length >= 2) {
      tokens.add(token);
    }
  }

  // Extract numbers
  const numberPattern = /\d+/g;
  while ((match = numberPattern.exec(normalized)) !== null) {
    tokens.add(match[0]);
  }

  // Create compound tokens (e.g., "gold" + "18" = "gold18")
  const compoundPatterns = [
    { prefix: 'gold', suffixes: ['18', '24', '750', '999', '740'] },
    { prefix: 'xau', suffixes: ['18', '24'] },
    { prefix: 'طلا', suffixes: ['18', '24', '۱۸', '۲۴'] },
    { prefix: 'سکه', suffixes: ['امامی', 'بهار', 'نیم', 'ربع', 'گرمی'] },
  ];

  for (const { prefix, suffixes } of compoundPatterns) {
    if (tokens.has(prefix)) {
      for (const suffix of suffixes) {
        if (tokens.has(suffix)) {
          tokens.add(`${prefix}${suffix}`);
        }
      }
    }
  }

  return tokens;
}

/**
 * Calculate Jaccard similarity between two token sets
 */
export function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) {
    return 1;
  }

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Check if two token sets have matching distinctive tokens
 */
export function hasMatchingDistinctiveTokens(
  tokens1: Set<string>,
  tokens2: Set<string>,
  distinctiveTokens: Set<string>
): { matches: boolean; matchedTokens: string[]; missingTokens: string[] } {
  const matchedTokens: string[] = [];
  const missingTokens: string[] = [];

  for (const token of distinctiveTokens) {
    const inSet1 = tokens1.has(token);
    const inSet2 = tokens2.has(token);

    if (inSet1 && inSet2) {
      matchedTokens.push(token);
    } else if (inSet1 && !inSet2) {
      missingTokens.push(token);
    }
  }

  return {
    matches: missingTokens.length === 0,
    matchedTokens,
    missingTokens,
  };
}

/**
 * Normalize a provider symbol to standard format
 */
export function normalizeSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/[-_\s]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

/**
 * Convert price to standard unit (Rials per gram)
 */
export function normalizePriceToRialsPerGram(
  price: number,
  priceUnit: PriceUnit,
  weightGrams: number | null
): number {
  switch (priceUnit) {
    case 'gram':
      return price;
    case '10gram':
      return price / 10;
    case 'mesghal':
      return price / 4.6083;
    case 'ounce':
      return price / 31.1035;
    case 'piece':
      // For coins, we can optionally convert to per-gram if weight is known
      if (weightGrams && weightGrams > 0) {
        return price / weightGrams;
      }
      return price; // Keep as-is for piece pricing
    default:
      return price;
  }
}
