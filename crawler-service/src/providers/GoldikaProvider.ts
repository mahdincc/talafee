import axios from 'axios';
import { BaseProvider } from '../core/BaseProvider.js';
import type { NormalizedPrice } from '../core/models/index.js';
import { NoAuthStrategy } from '../auth/index.js';

/**
 * Goldika provider.
 *
 * Goldika's true price API requires authentication, so we cannot hit it
 * directly. However, the public market page at https://goldika.ir/gold/18k
 * embeds a Next.js `__NEXT_DATA__` blob with the dehydrated React Query
 * cache, including a `chart-data` query containing daily OHLC candles up
 * to (and including) the current day. The most recent candle's `close`
 * value is the latest 18k gram price in Rials.
 *
 * Previous regex/HTML scraping approach was unreliable — it kept matching
 * stray digits ("2000", "30") near the page's textual mentions of 18k gold
 * and produced bogus prices (3 Toman, 20M Toman). Pulling the structured
 * Next.js data is exact.
 */

interface ChartCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface NextDataQuery {
  queryKey: unknown;
  state?: { data?: unknown };
}

const PAGE_URL_18K = 'https://goldika.ir/gold/18k';

export class GoldikaProvider extends BaseProvider {
  readonly providerId = 'goldika';
  readonly name = 'Goldika';

  constructor() {
    super('goldika');
    this.setAuthStrategy(new NoAuthStrategy());
  }

  protected async doFetch(correlationId: string): Promise<NormalizedPrice[]> {
    const prices: NormalizedPrice[] = [];

    try {
      const response = await axios.get<string>(PAGE_URL_18K, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
          'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8',
        },
        timeout: this.providerConfig.timeout,
        responseType: 'text',
      });

      const html = response.data;
      const candle = this.extractLatestCandleFromNextData(html);

      if (!candle) {
        this.logger.warn('Goldika: no chart-data candle found in page', {
          correlationId,
          page: PAGE_URL_18K,
        });
        return prices;
      }

      // The candle's `close` is the most recent intraday price in Rials.
      // Goldika displays a single market price (no buy/sell spread on the
      // public chart), so we report it on both sides.
      const priceRials = candle.close;

      prices.push(
        this.createNormalizedPrice({
          symbol: 'GOLD18',
          productId: '18k-gold',
          buyPrice: priceRials,
          sellPrice: priceRials,
          dailyHigh: candle.high,
          dailyLow: candle.low,
          providerUpdatedAt: this.parseDate(candle.date),
          correlationId,
        })
      );

      this.logger.info(`Fetched ${prices.length} prices from Goldika`, {
        correlationId,
        date: candle.date,
        close: candle.close,
      });
    } catch (error) {
      this.logger.warn('Failed to fetch Goldika prices', {
        correlationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return prices;
  }

  /**
   * Pull the latest daily candle from the page's Next.js dehydrated cache.
   * Returns null if the page structure has changed and no candle was found.
   */
  private extractLatestCandleFromNextData(html: string): ChartCandle | null {
    const match = html.match(
      /<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/
    );
    if (!match || !match[1]) return null;

    let data: unknown;
    try {
      data = JSON.parse(match[1]);
    } catch {
      return null;
    }

    const queries = this.queriesFrom(data);
    const chartQuery = queries.find((q) => {
      const key = q.queryKey;
      return Array.isArray(key) && key[0] === 'chart-data';
    });

    if (!chartQuery) return null;

    const series = chartQuery.state?.data;
    if (!Array.isArray(series) || series.length === 0) return null;

    const last = series[series.length - 1];
    if (!this.isCandle(last)) return null;
    return last;
  }

  private queriesFrom(data: unknown): NextDataQuery[] {
    const obj = data as Record<string, unknown>;
    const props = obj?.['props'] as Record<string, unknown> | undefined;
    const pageProps = props?.['pageProps'] as Record<string, unknown> | undefined;
    const dehydrated = pageProps?.['dehydratedState'] as
      | Record<string, unknown>
      | undefined;
    const queries = dehydrated?.['queries'];
    return Array.isArray(queries) ? (queries as NextDataQuery[]) : [];
  }

  private isCandle(v: unknown): v is ChartCandle {
    if (!v || typeof v !== 'object') return false;
    const c = v as Record<string, unknown>;
    return (
      typeof c['date'] === 'string' &&
      typeof c['open'] === 'number' &&
      typeof c['high'] === 'number' &&
      typeof c['low'] === 'number' &&
      typeof c['close'] === 'number'
    );
  }

  private parseDate(yyyyMmDd: string): Date | undefined {
    // Candle dates are bare "YYYY-MM-DD". Treat them as the start of the
    // day in UTC; the actual sub-day update time isn't exposed.
    const parsed = new Date(yyyyMmDd + 'T00:00:00Z');
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
