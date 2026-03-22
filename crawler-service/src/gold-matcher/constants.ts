/**
 * Gold Product Matcher Constants
 * Canonical definitions and normalization mappings
 */

import type { ProductId } from '../core/models/index.js';
import type {
  CanonicalProduct,
  GoldPurity,
  ScoringConfig,
  ProviderSymbolMap,
} from './types.js';

/**
 * Canonical product definitions
 * These are the standard products that all providers map to
 */
export const CANONICAL_PRODUCTS: Record<ProductId, CanonicalProduct> = {
  '18k-gold': {
    id: '18k-gold',
    nameFa: 'طلای ۱۸ عیار',
    nameEn: '18K Gold',
    category: 'gold',
    purity: 750,
    weightGrams: 1,
    priceUnit: 'gram',
    aliases: [
      'طلا 18', 'طلای 18', '18 عیار', 'عیار 18',
      'gold18', 'gold 18', '18k', '18 karat',
      'طلای ۱۸', 'xau18', '750', 'gold 750', 'gold750',
      '18 ayar', 'ayar 18', 'طلای 18 عیار',
    ],
    distinctiveTokens: ['18', '750', '18k'],
  },
  '24k-gold': {
    id: '24k-gold',
    nameFa: 'طلای ۲۴ عیار',
    nameEn: '24K Gold',
    category: 'gold',
    purity: 999,
    weightGrams: 1,
    priceUnit: 'gram',
    aliases: [
      'طلا 24', 'طلای 24', '24 عیار', 'عیار 24',
      'gold24', 'gold 24', '24k', '24 karat',
      'طلای ۲۴', 'xau24', '999', 'gold 999', 'gold999',
      '24 ayar', 'ayar 24', 'طلای 24 عیار',
    ],
    distinctiveTokens: ['24', '999', '24k'],
  },
  'emami-coin': {
    id: 'emami-coin',
    nameFa: 'سکه امامی',
    nameEn: 'Emami Coin',
    category: 'coin',
    purity: 916,
    weightGrams: 8.133,
    priceUnit: 'piece',
    aliases: [
      'سکه امامی', 'امامی', 'سکه طرح جدید', 'طرح جدید',
      'imam coin', 'emami', 'new design', 'sekeh emami',
      'سکه بهار آزادی طرح جدید', 'طرح امام', 'سکه امام',
    ],
    distinctiveTokens: ['امامی', 'emami', 'imam', 'طرح جدید'],
  },
  'bahar-azadi': {
    id: 'bahar-azadi',
    nameFa: 'سکه بهار آزادی',
    nameEn: 'Bahar Azadi Coin',
    category: 'coin',
    purity: 916,
    weightGrams: 8.133,
    priceUnit: 'piece',
    aliases: [
      'سکه بهار آزادی', 'بهار آزادی', 'سکه طرح قدیم', 'طرح قدیم',
      'bahar azadi', 'whole coin', 'old design', 'sekeh bahar',
      'سکه تمام', 'تمام سکه', 'یک سکه', 'سکه کامل',
    ],
    distinctiveTokens: ['بهار', 'آزادی', 'bahar', 'azadi', 'whole', 'تمام', 'قدیم'],
  },
  'half-coin': {
    id: 'half-coin',
    nameFa: 'نیم سکه',
    nameEn: 'Half Coin',
    category: 'coin',
    purity: 916,
    weightGrams: 4.066,
    priceUnit: 'piece',
    aliases: [
      'نیم سکه', 'نیم', 'نصف سکه',
      'half coin', 'nim sekeh', 'nim',
      'سکه نیم', '1/2 سکه',
    ],
    distinctiveTokens: ['نیم', 'half', 'nim'],
  },
  'quarter-coin': {
    id: 'quarter-coin',
    nameFa: 'ربع سکه',
    nameEn: 'Quarter Coin',
    category: 'coin',
    purity: 916,
    weightGrams: 2.033,
    priceUnit: 'piece',
    aliases: [
      'ربع سکه', 'ربع', 'چهارم سکه',
      'quarter coin', 'rob sekeh', 'rob',
      'سکه ربع', '1/4 سکه',
    ],
    distinctiveTokens: ['ربع', 'quarter', 'rob'],
  },
  'gram-coin': {
    id: 'gram-coin',
    nameFa: 'سکه گرمی',
    nameEn: 'Gram Coin',
    category: 'coin',
    purity: 916,
    weightGrams: 1,
    priceUnit: 'piece',
    aliases: [
      'سکه گرمی', 'گرمی', 'سکه یک گرمی',
      'gram coin', 'gerami', '1 gram coin',
      'سکه 1 گرم',
    ],
    distinctiveTokens: ['گرمی', 'gram', 'gerami'],
  },
  'gold-bar': {
    id: 'gold-bar',
    nameFa: 'شمش طلا',
    nameEn: 'Gold Bar',
    category: 'gold',
    purity: 999,
    weightGrams: null, // Variable weight
    priceUnit: 'gram',
    aliases: [
      'شمش طلا', 'شمش', 'gold bar', 'bar',
      'شمش 24 عیار', 'شمش طلای 24',
    ],
    distinctiveTokens: ['شمش', 'bar'],
  },
  'mesghal': {
    id: 'mesghal',
    nameFa: 'مثقال طلا',
    nameEn: 'Mesghal',
    category: 'gold',
    purity: 750,
    weightGrams: 4.6083,
    priceUnit: 'mesghal',
    aliases: [
      'مثقال', 'مثقال طلا', 'سکه مثقال',
      'mesghal', 'mithqal', 'shekel',
      'مثقال 18 عیار',
    ],
    distinctiveTokens: ['مثقال', 'mesghal', 'mithqal', 'shekel'],
  },
  'gold-ounce': {
    id: 'gold-ounce',
    nameFa: 'اونس طلا',
    nameEn: 'Gold Ounce',
    category: 'gold',
    purity: 999,
    weightGrams: 31.1035,
    priceUnit: 'ounce',
    aliases: [
      'اونس', 'اونس طلا', 'انس طلا',
      'gold ounce', 'ounce', 'ons',
      'انس جهانی', 'اونس جهانی',
    ],
    distinctiveTokens: ['اونس', 'انس', 'ounce', 'ons'],
  },
  'silver-999': {
    id: 'silver-999',
    nameFa: 'نقره ۹۹۹',
    nameEn: 'Silver 999',
    category: 'silver',
    purity: 999,
    weightGrams: 1,
    priceUnit: 'gram',
    aliases: [
      'نقره', 'نقره 999', 'نقره خالص',
      'silver', 'silver 999', 'pure silver',
      'نقره ۹۹۹',
    ],
    distinctiveTokens: ['نقره', 'silver'],
  },
};

/**
 * Purity mappings (various representations → standard purity)
 */
export const PURITY_ALIASES: Record<string, GoldPurity> = {
  // 18K (750)
  '18': 750,
  '18k': 750,
  '750': 750,
  '۱۸': 750,
  '18عیار': 750,
  '18 عیار': 750,
  'عیار 18': 750,
  'عیار18': 750,
  'xau18': 750,
  'gold18': 750,
  'gold 18': 750,
  'gold750': 750,
  'gold 750': 750,

  // 18K lower purity (740)
  '740': 740,
  'gold740': 740,
  'gold 740': 740,

  // 22K (916)
  '22': 916,
  '22k': 916,
  '916': 916,
  '۲۲': 916,
  '22عیار': 916,

  // 24K (999)
  '24': 999,
  '24k': 999,
  '999': 999,
  '۲۴': 999,
  '24عیار': 999,
  '24 عیار': 999,
  'عیار 24': 999,
  'عیار24': 999,
  'xau24': 999,
  'gold24': 999,
  'gold 24': 999,
  'gold999': 999,
  'gold 999': 999,
};

/**
 * Category keywords
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  gold: [
    'طلا', 'gold', 'xau', 'طلای', 'گرم طلا',
    'شمش', 'bar', 'مثقال', 'mesghal',
  ],
  coin: [
    'سکه', 'coin', 'sekeh', 'sekke',
    'امامی', 'emami', 'بهار', 'bahar', 'نیم', 'ربع',
    'تمام', 'whole', 'half', 'quarter', 'گرمی',
  ],
  silver: [
    'نقره', 'silver', 'ag', 'نقره‌ای',
  ],
};

/**
 * Noise tokens to ignore during matching
 */
export const NOISE_TOKENS = new Set([
  // Generic
  'price', 'قیمت', 'نرخ', 'rate',
  // Units (handled separately)
  'gram', 'گرم', 'ounce', 'اونس',
  // Common words
  'the', 'of', 'and', 'و', 'از', 'در',
  // Persian articles
  'ی', 'ها', 'های',
  // Numbers alone (without context)
  'یک', 'one', '1',
]);

/**
 * Provider-specific symbol mappings
 * Maps each provider's symbols to canonical product IDs
 */
export const PROVIDER_SYMBOL_MAPS: ProviderSymbolMap[] = [
  {
    providerId: 'digigold',
    mappings: [
      { symbol: 'GOLD18', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'SILVER999', productId: 'silver-999', priceUnit: 'gram', priceMultiplier: 10 },
    ],
  },
  {
    providerId: 'taline',
    mappings: [
      { symbol: 'GOLD18', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'GOLD24', productId: '24k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'SEKEH_E', productId: 'emami-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'SEKEH_NIM', productId: 'half-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'SEKEH_ROB', productId: 'quarter-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'GOLD_BAR', productId: 'gold-bar', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'ONS', productId: 'gold-ounce', priceUnit: 'ounce', priceMultiplier: 10 },
      { symbol: 'GOLD_MITHQAL17', productId: 'mesghal', priceUnit: 'mesghal', priceMultiplier: 10 },
    ],
  },
  {
    providerId: 'miligold',
    mappings: [
      { symbol: 'GOLD18', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'GOLD24', productId: '24k-gold', priceUnit: 'gram', priceMultiplier: 10 },
    ],
  },
  {
    providerId: 'talasea',
    mappings: [
      { symbol: 'GOLD18', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
    ],
  },
  {
    providerId: 'melligold',
    mappings: [
      { symbol: 'XAU18', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'XAU24', productId: '24k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'SEKEH_EMAMI', productId: 'emami-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'SEKEH_NIM', productId: 'half-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'SEKEH_ROB', productId: 'quarter-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'SEKEH_BAHAR', productId: 'bahar-azadi', priceUnit: 'piece', priceMultiplier: 10 },
    ],
  },
  {
    providerId: 'technogold',
    mappings: [
      { symbol: 'GOLD_750', productId: '18k-gold', priceUnit: '10gram', priceMultiplier: 0.1 },
      { symbol: 'GOLD_740', productId: '18k-gold', priceUnit: '10gram', priceMultiplier: 0.1 },
      { symbol: 'GOLD_999', productId: '24k-gold', priceUnit: '10gram', priceMultiplier: 0.1 },
      { symbol: 'IMAM_COIN', productId: 'emami-coin', priceUnit: 'piece', priceMultiplier: 1 },
      { symbol: 'WHOLE_COIN', productId: 'bahar-azadi', priceUnit: 'piece', priceMultiplier: 1 },
      { symbol: 'HALF_COIN', productId: 'half-coin', priceUnit: 'piece', priceMultiplier: 1 },
      { symbol: 'QUARTER_COIN', productId: 'quarter-coin', priceUnit: 'piece', priceMultiplier: 1 },
      { symbol: 'GRAM_COIN', productId: 'gram-coin', priceUnit: 'piece', priceMultiplier: 1 },
      { symbol: 'SHEKEL', productId: 'mesghal', priceUnit: 'mesghal', priceMultiplier: 1 },
      { symbol: 'SILVER_999', productId: 'silver-999', priceUnit: '10gram', priceMultiplier: 0.1 },
    ],
  },
  {
    providerId: 'bonbast',
    mappings: [
      { symbol: 'GOL18', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'MITHQAL', productId: 'mesghal', priceUnit: 'mesghal', priceMultiplier: 10 },
      { symbol: 'EMAMI1', productId: 'emami-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'AZADI1', productId: 'bahar-azadi', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'AZADI1_2', productId: 'half-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'AZADI1_4', productId: 'quarter-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'AZADI1G', productId: 'gram-coin', priceUnit: 'piece', priceMultiplier: 10 },
    ],
  },
  {
    providerId: 'alanchand',
    mappings: [
      { symbol: '18K-GOLD', productId: '18k-gold', priceUnit: 'gram', priceMultiplier: 10 },
      { symbol: 'MESGHAL', productId: 'mesghal', priceUnit: 'mesghal', priceMultiplier: 10 },
      { symbol: 'EMAMI-COIN', productId: 'emami-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'HALF-COIN', productId: 'half-coin', priceUnit: 'piece', priceMultiplier: 10 },
      { symbol: 'QUARTER-COIN', productId: 'quarter-coin', priceUnit: 'piece', priceMultiplier: 10 },
    ],
  },
];

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  minScoreForMatch: 35,
  highConfidenceThreshold: 60,
  veryHighConfidenceThreshold: 80,

  // Weights
  tokenOverlapWeight: 30,
  purityMatchWeight: 25,
  categoryMatchWeight: 20,
  weightMatchWeight: 15,
  distinctiveTokenWeight: 10,

  // Penalties (hard rejects)
  purityMismatchPenalty: -100,
  categoryMismatchPenalty: -100,
  weightMismatchPenalty: -50,
  distinctiveTokenMismatchPenalty: -30,

  // Boosts
  exactMatchBoost: 20,
  highOverlapBoost: 10,
};

/**
 * Category incompatibilities (hard rejects)
 */
export const CATEGORY_INCOMPATIBLE: Record<string, string[]> = {
  gold: ['silver'],
  coin: ['silver'],
  silver: ['gold', 'coin'],
};

/**
 * Persian digit mapping
 */
export const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

/**
 * Arabic character normalization
 */
export const ARABIC_CHAR_MAP: Record<string, string> = {
  'ي': 'ی',
  'ك': 'ک',
  'ة': 'ه',
  'ؤ': 'و',
  'إ': 'ا',
  'أ': 'ا',
  'آ': 'ا',
};
