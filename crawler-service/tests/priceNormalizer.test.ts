import { describe, it, expect } from 'vitest';
import {
  normalizePriceToRials,
  isPriceRecoverable,
} from '../src/utils/priceNormalizer.js';

// The normalizer is the core data-quality layer: providers report prices in
// inconsistent units (Rials, Tomans, Tomans-per-100, …) and it rescales every
// quote by a power of 10 into a canonical Rial range, or drops it as garbage.
// Several cases below are taken verbatim from real crawl logs.

describe('normalizePriceToRials', () => {
  it('passes an in-range 18k-gold price through unchanged', () => {
    const r = normalizePriceToRials('18k-gold', 170_000_000);
    expect(r.rials).toBe(170_000_000);
    expect(r.scaleFactor).toBe(1);
  });

  it('rescales a Toman-per-gram quote up by ×10 (17.0M Toman → 170M Rials)', () => {
    const r = normalizePriceToRials('18k-gold', 17_000_000);
    expect(r.rials).toBe(170_000_000);
    expect(r.scaleFactor).toBe(10);
  });

  it('rescales DigiGold-style 18k raw ×100 (from crawl logs)', () => {
    // Real log line: rawBuy 1735970, buyScale 100 → 173,597,000 Rials
    const r = normalizePriceToRials('18k-gold', 1_735_970);
    expect(r.rials).toBe(173_597_000);
    expect(r.scaleFactor).toBe(100);
  });

  it('rescales silver-999 up by ×10 (from crawl logs)', () => {
    // Real log line: rawBuy 38050, silverScale 10 → 380,500 Rials
    const r = normalizePriceToRials('silver-999', 38_050);
    expect(r.rials).toBe(380_500);
    expect(r.scaleFactor).toBe(10);
  });

  it('drops an unrecoverable stray value (no 10^n scale fits)', () => {
    const r = normalizePriceToRials('18k-gold', 5);
    expect(r.rials).toBeNull();
  });

  it('drops zero and negative and non-finite values', () => {
    expect(normalizePriceToRials('18k-gold', 0).rials).toBeNull();
    expect(normalizePriceToRials('18k-gold', -170_000_000).rials).toBeNull();
    expect(normalizePriceToRials('18k-gold', Number.NaN).rials).toBeNull();
  });

  it('does not rescale USD-priced gold-ounce (skipped product)', () => {
    const r = normalizePriceToRials('gold-ounce', 4068);
    expect(r.rials).toBe(4068);
    expect(r.scaleFactor).toBe(1);
  });

  it('passes unknown products through untouched', () => {
    const r = normalizePriceToRials('not-a-product', 12345);
    expect(r.rials).toBe(12345);
    expect(r.scaleFactor).toBe(1);
  });

  it('keeps a full coin (emami) in its own, higher band', () => {
    const r = normalizePriceToRials('emami-coin', 1_999_900_000);
    expect(r.rials).toBe(1_999_900_000);
    expect(r.scaleFactor).toBe(1);
  });
});

describe('isPriceRecoverable', () => {
  it('is true for a rescalable Toman quote and false for garbage', () => {
    expect(isPriceRecoverable('18k-gold', 17_000_000)).toBe(true);
    expect(isPriceRecoverable('18k-gold', 5)).toBe(false);
  });
});
