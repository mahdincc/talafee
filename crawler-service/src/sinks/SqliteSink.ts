import Database, { type Database as DatabaseType } from 'better-sqlite3';
import type { IResultSink } from '../core/interfaces/index.js';
import type { NormalizedPrice, CrawlRunSummary } from '../core/models/index.js';
import { logger } from '../utils/index.js';
import config from '../../config/crawler.config.js';

export class SqliteSink implements IResultSink {
  readonly sinkName = 'SqliteSink';
  private db?: DatabaseType;

  async initialize(): Promise<void> {
    logger.info(`Initializing SQLite sink`, { dbPath: config.storage.dbPath });

    this.db = new Database(config.storage.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    this.createTables();
    this.scheduleCleanup();

    logger.info(`SQLite sink initialized successfully`);
  }

  private createTables(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS prices (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        buy_price REAL NOT NULL,
        sell_price REAL NOT NULL,
        avg_price REAL NOT NULL,
        buy_wage REAL,
        sell_wage REAL,
        daily_high REAL,
        daily_low REAL,
        price_change_24h REAL,
        price_change_percent REAL,
        direction TEXT,
        provider_updated_at TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        correlation_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_prices_provider_product
        ON prices(provider_id, product_id);

      CREATE INDEX IF NOT EXISTS idx_prices_fetched_at
        ON prices(fetched_at);

      CREATE INDEX IF NOT EXISTS idx_prices_product_fetched
        ON prices(product_id, fetched_at);

      CREATE TABLE IF NOT EXISTS crawl_runs (
        run_id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        total_providers INTEGER NOT NULL,
        successful_providers INTEGER NOT NULL,
        failed_providers INTEGER NOT NULL,
        total_prices_collected INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS provider_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        success INTEGER NOT NULL,
        price_count INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        attempts INTEGER NOT NULL,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES crawl_runs(run_id)
      );

      CREATE INDEX IF NOT EXISTS idx_provider_runs_run_id
        ON provider_runs(run_id);
    `);
  }

  async onPricesFetched(
    providerId: string,
    prices: NormalizedPrice[],
    correlationId: string
  ): Promise<void> {
    if (!this.db || prices.length === 0) return;

    const insertStmt = this.db.prepare(`
      INSERT INTO prices (
        id, provider_id, product_id, symbol, buy_price, sell_price, avg_price,
        buy_wage, sell_wage, daily_high, daily_low, price_change_24h,
        price_change_percent, direction, provider_updated_at, fetched_at, correlation_id
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const insertMany = this.db.transaction((priceList: NormalizedPrice[]) => {
      for (const price of priceList) {
        insertStmt.run(
          price.id,
          price.providerId,
          price.productId,
          price.symbol,
          price.buyPrice,
          price.sellPrice,
          price.avgPrice,
          price.buyWage ?? null,
          price.sellWage ?? null,
          price.dailyHigh ?? null,
          price.dailyLow ?? null,
          price.priceChange24h ?? null,
          price.priceChangePercent ?? null,
          price.direction ?? null,
          price.providerUpdatedAt.toISOString(),
          price.fetchedAt.toISOString(),
          price.correlationId
        );
      }
    });

    insertMany(prices);

    logger.debug(`Stored ${prices.length} prices to SQLite`, {
      providerId,
      correlationId,
    });
  }

  async onCrawlRunComplete(summary: CrawlRunSummary): Promise<void> {
    if (!this.db) return;

    const insertRun = this.db.prepare(`
      INSERT INTO crawl_runs (
        run_id, started_at, completed_at, total_providers,
        successful_providers, failed_providers, total_prices_collected
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertProviderRun = this.db.prepare(`
      INSERT INTO provider_runs (
        run_id, provider_id, success, price_count, duration_ms, attempts, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const saveAll = this.db.transaction(() => {
      insertRun.run(
        summary.runId,
        summary.startedAt.toISOString(),
        summary.completedAt.toISOString(),
        summary.totalProviders,
        summary.successfulProviders,
        summary.failedProviders,
        summary.totalPricesCollected
      );

      for (const [providerId, result] of summary.providerResults) {
        insertProviderRun.run(
          summary.runId,
          providerId,
          result.success ? 1 : 0,
          result.priceCount,
          result.durationMs,
          result.attempts,
          result.error?.message ?? null
        );
      }
    });

    saveAll();

    logger.debug(`Saved crawl run summary`, { runId: summary.runId });
  }

  async getCurrentPrices(): Promise<Map<string, NormalizedPrice[]>> {
    if (!this.db) return new Map();

    const rows = this.db
      .prepare(
        `
      SELECT DISTINCT p.*
      FROM prices p
      INNER JOIN (
        SELECT provider_id, product_id, MAX(fetched_at) as max_fetched
        FROM prices
        WHERE fetched_at > datetime('now', '-5 minutes')
        GROUP BY provider_id, product_id
      ) latest
      ON p.provider_id = latest.provider_id
        AND p.product_id = latest.product_id
        AND p.fetched_at = latest.max_fetched
    `
      )
      .all() as PriceRow[];

    const priceMap = new Map<string, NormalizedPrice[]>();

    for (const row of rows) {
      const price = this.rowToPrice(row);
      const existing = priceMap.get(row.provider_id) ?? [];
      existing.push(price);
      priceMap.set(row.provider_id, existing);
    }

    return priceMap;
  }

  async getLatestPriceForProduct(productId: string): Promise<NormalizedPrice | undefined> {
    if (!this.db) return undefined;

    const row = this.db
      .prepare(
        `
      SELECT * FROM prices
      WHERE product_id = ?
      ORDER BY fetched_at DESC
      LIMIT 1
    `
      )
      .get(productId) as PriceRow | undefined;

    return row ? this.rowToPrice(row) : undefined;
  }

  async getPriceHistory(
    providerId: string,
    productId: string,
    hoursBack: number
  ): Promise<NormalizedPrice[]> {
    if (!this.db) return [];

    const rows = this.db
      .prepare(
        `
      SELECT * FROM prices
      WHERE provider_id = ?
        AND product_id = ?
        AND fetched_at > datetime('now', '-' || ? || ' hours')
      ORDER BY fetched_at ASC
    `
      )
      .all(providerId, productId, hoursBack) as PriceRow[];

    return rows.map((row) => this.rowToPrice(row));
  }

  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = undefined;
      logger.info(`SQLite sink shut down`);
    }
  }

  private scheduleCleanup(): void {
    const retentionDays = config.storage.historyRetentionDays;

    setInterval(
      () => {
        if (!this.db) return;

        try {
          const result = this.db
            .prepare(
              `
            DELETE FROM prices
            WHERE fetched_at < datetime('now', '-' || ? || ' days')
          `
            )
            .run(retentionDays);

          if (result.changes > 0) {
            logger.info(`Cleaned up ${result.changes} old price records`);
          }
        } catch (error) {
          logger.error(`Failed to cleanup old records`, {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      },
      24 * 60 * 60 * 1000
    );
  }

  private rowToPrice(row: PriceRow): NormalizedPrice {
    return {
      id: row.id,
      providerId: row.provider_id,
      productId: row.product_id,
      symbol: row.symbol,
      buyPrice: row.buy_price,
      sellPrice: row.sell_price,
      avgPrice: row.avg_price,
      buyWage: row.buy_wage ?? undefined,
      sellWage: row.sell_wage ?? undefined,
      dailyHigh: row.daily_high ?? undefined,
      dailyLow: row.daily_low ?? undefined,
      priceChange24h: row.price_change_24h ?? undefined,
      priceChangePercent: row.price_change_percent ?? undefined,
      direction: row.direction as 'up' | 'down' | 'stable' | undefined,
      providerUpdatedAt: new Date(row.provider_updated_at),
      fetchedAt: new Date(row.fetched_at),
      correlationId: row.correlation_id,
    };
  }
}

interface PriceRow {
  id: string;
  provider_id: string;
  product_id: string;
  symbol: string;
  buy_price: number;
  sell_price: number;
  avg_price: number;
  buy_wage: number | null;
  sell_wage: number | null;
  daily_high: number | null;
  daily_low: number | null;
  price_change_24h: number | null;
  price_change_percent: number | null;
  direction: string | null;
  provider_updated_at: string;
  fetched_at: string;
  correlation_id: string;
}
