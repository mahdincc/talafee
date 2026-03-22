export interface NormalizedPrice {
  id: string;
  providerId: string;
  productId: string;
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  avgPrice: number;
  buyWage?: number | undefined;
  sellWage?: number | undefined;
  dailyHigh?: number | undefined;
  dailyLow?: number | undefined;
  priceChange24h?: number | undefined;
  priceChangePercent?: number | undefined;
  direction?: 'up' | 'down' | 'stable' | undefined;
  providerUpdatedAt: Date;
  fetchedAt: Date;
  correlationId: string;
}

export type ProductId =
  | '18k-gold'
  | '24k-gold'
  | 'emami-coin'
  | 'half-coin'
  | 'quarter-coin'
  | 'bahar-azadi'
  | 'gold-bar'
  | 'mesghal'
  | 'gold-ounce'
  | 'gram-coin'
  | 'silver-999';

export const PRODUCT_NAMES: Record<ProductId, { fa: string; en: string }> = {
  '18k-gold': { fa: 'طلای ۱۸ عیار', en: '18K Gold' },
  '24k-gold': { fa: 'طلای ۲۴ عیار', en: '24K Gold' },
  'emami-coin': { fa: 'سکه امامی', en: 'Emami Coin' },
  'half-coin': { fa: 'نیم سکه', en: 'Half Coin' },
  'quarter-coin': { fa: 'ربع سکه', en: 'Quarter Coin' },
  'bahar-azadi': { fa: 'سکه بهار آزادی', en: 'Bahar Azadi Coin' },
  'gold-bar': { fa: 'شمش طلا', en: 'Gold Bar' },
  mesghal: { fa: 'مثقال طلا', en: 'Mesghal' },
  'gold-ounce': { fa: 'اونس طلا', en: 'Gold Ounce' },
  'gram-coin': { fa: 'سکه گرمی', en: 'Gram Coin' },
  'silver-999': { fa: 'نقره ۹۹۹', en: 'Silver 999' },
};
