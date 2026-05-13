import type { ProductId } from '../core/models/index.js';

/**
 * Expected price ranges in **Rials** for each product.
 *
 * Providers report prices in inconsistent units (Tomans, Rials, Tomans-per-soot,
 * Tomans-per-mesghal, etc.). To stay resilient against per-provider unit drift,
 * we sanity-check every price against a wide-but-reasonable range and, if it
 * lands outside, attempt to rescale by powers of 10 until it fits. Anything
 * still out of range after that is treated as garbage and dropped.
 *
 * The bounds intentionally cover several years of price drift in either
 * direction so this layer doesn't need touching every quarter.
 */
interface PriceBounds {
  minRials: number;
  maxRials: number;
}

// NB: bounds are deliberately tight enough that for any garbled raw price,
// at most ONE 10^n scale lands inside the window. Loosening them lets
// e.g. a 1.7M-Toman value masquerade as plausible 18k gold per gram.

const PER_GRAM_BOUNDS: PriceBounds = {
  // 1g 18k gold ≈ 17M Toman (170M Rials) at the time of writing.
  // Window: 5M..100M Toman/g (50M..1B Rials).
  minRials: 50_000_000,
  maxRials: 1_000_000_000,
};

const PER_MESGHAL_BOUNDS: PriceBounds = {
  // 1 mesghal ≈ 4.6g, so ~78M Toman ≈ 780M Rials.
  // Window: 20M..500M Toman/mesghal.
  minRials: 200_000_000,
  maxRials: 5_000_000_000,
};

const FULL_COIN_BOUNDS: PriceBounds = {
  // Emami / Bahar ≈ 200M-300M Toman = 2B-3B Rials.
  // Window: 50M..5B Toman.
  minRials: 500_000_000,
  maxRials: 50_000_000_000,
};

const HALF_COIN_BOUNDS: PriceBounds = {
  minRials: 250_000_000,
  maxRials: 25_000_000_000,
};

const QUARTER_COIN_BOUNDS: PriceBounds = {
  minRials: 100_000_000,
  maxRials: 15_000_000_000,
};

const GRAM_COIN_BOUNDS: PriceBounds = {
  // Gram coin ~ 25M-50M Toman = 250M-500M Rials.
  minRials: 50_000_000,
  maxRials: 5_000_000_000,
};

const OUNCE_BOUNDS: PriceBounds = {
  // World gold ounce in USD: ~$2k-$10k. Stored as USD, not Rials.
  // Skip rescaling for USD-priced product. Returned via SKIP_PRODUCTS.
  minRials: 0,
  maxRials: Number.POSITIVE_INFINITY,
};

const SILVER_BOUNDS: PriceBounds = {
  // 1g silver ~50k Toman = 500k Rials. Allow 100k..50M.
  minRials: 100_000,
  maxRials: 50_000_000,
};

const PRODUCT_BOUNDS: Record<ProductId, PriceBounds> = {
  '18k-gold': PER_GRAM_BOUNDS,
  '24k-gold': PER_GRAM_BOUNDS,
  'gold-bar': PER_GRAM_BOUNDS,
  mesghal: PER_MESGHAL_BOUNDS,
  'emami-coin': FULL_COIN_BOUNDS,
  'bahar-azadi': FULL_COIN_BOUNDS,
  'half-coin': HALF_COIN_BOUNDS,
  'quarter-coin': QUARTER_COIN_BOUNDS,
  'gram-coin': GRAM_COIN_BOUNDS,
  'gold-ounce': OUNCE_BOUNDS,
  'silver-999': SILVER_BOUNDS,
};

/** Products whose prices are NOT in Rials (e.g. world ounce in USD). */
const SKIP_PRODUCTS: Set<ProductId> = new Set(['gold-ounce']);

export interface PriceNormalizeResult {
  /** Rescaled price in Rials, or null if value is unrecoverable garbage. */
  rials: number | null;
  /** The 10^n factor applied (e.g. 10 means × 10, 0.1 means ÷ 10). 1 = unchanged. */
  scaleFactor: number;
}

/**
 * Normalize a provider price into Rials.
 *
 * If the raw value is within range, returns it unchanged. Otherwise tries
 * scaling by 10, 100, 1000, 10000 (and the inverse) until it lands inside
 * the expected window. Returns null if no scale fits — that signals the
 * source is broken (e.g. regex captured a single stray digit).
 */
export function normalizePriceToRials(
  productId: string,
  rawPrice: number
): PriceNormalizeResult {
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
    return { rials: null, scaleFactor: 1 };
  }

  const bounds = PRODUCT_BOUNDS[productId as ProductId];
  if (!bounds || SKIP_PRODUCTS.has(productId as ProductId)) {
    return { rials: rawPrice, scaleFactor: 1 };
  }

  if (rawPrice >= bounds.minRials && rawPrice <= bounds.maxRials) {
    return { rials: rawPrice, scaleFactor: 1 };
  }

  // Try scaling up (raw was in smaller unit, e.g. Tomans, Tomans-per-soot)
  const upScales = [10, 100, 1000, 10_000, 100_000];
  for (const factor of upScales) {
    const scaled = rawPrice * factor;
    if (scaled >= bounds.minRials && scaled <= bounds.maxRials) {
      return { rials: scaled, scaleFactor: factor };
    }
  }

  // Try scaling down (raw was in larger unit, e.g. accidental Rials × 10)
  const downScales = [0.1, 0.01, 0.001, 0.0001];
  for (const factor of downScales) {
    const scaled = rawPrice * factor;
    if (scaled >= bounds.minRials && scaled <= bounds.maxRials) {
      return { rials: scaled, scaleFactor: factor };
    }
  }

  return { rials: null, scaleFactor: 1 };
}

/**
 * Validate-only variant: returns true if the price is plausibly in range
 * after any 10^n rescale. Useful for quick guards.
 */
export function isPriceRecoverable(productId: string, rawPrice: number): boolean {
  return normalizePriceToRials(productId, rawPrice).rials !== null;
}
