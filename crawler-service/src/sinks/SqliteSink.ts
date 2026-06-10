import Database, { type Database as DatabaseType } from 'better-sqlite3';
import type { IResultSink } from '../core/interfaces/index.js';
import type { NormalizedPrice, CrawlRunSummary } from '../core/models/index.js';
import { logger } from '../utils/index.js';
import config from '../../config/crawler.config.js';

export class SqliteSink implements IResultSink {
  readonly sinkName = 'SqliteSink';
  private db?: DatabaseType;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath ?? config.storage.dbPath;
  }

  async initialize(): Promise<void> {
    logger.info(`Initializing SQLite sink`, { dbPath: this.dbPath });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');

    this.createTables();
    this.scheduleCleanup();

    logger.info(`SQLite sink initialized successfully`);
  }

  private createTables(): void {
    this.createCoreTables();
    this.createTrustTables();
    this.createAlertTables();
  }

  private createAlertTables(): void {
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS price_alerts (
        id TEXT PRIMARY KEY,
        endpoint TEXT NOT NULL,
        product_id TEXT NOT NULL,
        provider_id TEXT,
        price_field TEXT NOT NULL DEFAULT 'buy' CHECK(price_field IN ('buy', 'sell')),
        low_bound REAL,
        high_bound REAL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_fired_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_price_alerts_endpoint
        ON price_alerts(endpoint);

      CREATE TABLE IF NOT EXISTS alert_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private createCoreTables(): void {
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

  private createTrustTables(): void {
    this.db!.exec(`
      -- Provider trust scores (calculated periodically)
      CREATE TABLE IF NOT EXISTS provider_trust_scores (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        overall_score REAL NOT NULL,
        price_accuracy_score REAL NOT NULL,
        uptime_score REAL NOT NULL,
        review_score REAL NOT NULL,
        freshness_score REAL NOT NULL,
        calculated_at TEXT NOT NULL,
        factors_json TEXT,
        UNIQUE(provider_id, calculated_at)
      );

      CREATE INDEX IF NOT EXISTS idx_trust_scores_provider
        ON provider_trust_scores(provider_id);

      CREATE INDEX IF NOT EXISTS idx_trust_scores_date
        ON provider_trust_scores(calculated_at);

      -- User reviews
      CREATE TABLE IF NOT EXISTS provider_reviews (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        user_id TEXT,
        user_fingerprint TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
        title TEXT,
        content TEXT,
        pros TEXT,
        cons TEXT,
        transaction_verified INTEGER DEFAULT 0,
        helpful_count INTEGER DEFAULT 0,
        report_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_reviews_provider
        ON provider_reviews(provider_id);

      CREATE INDEX IF NOT EXISTS idx_reviews_status
        ON provider_reviews(status);

      CREATE INDEX IF NOT EXISTS idx_reviews_created
        ON provider_reviews(created_at);

      -- Review votes
      CREATE TABLE IF NOT EXISTS review_votes (
        id TEXT PRIMARY KEY,
        review_id TEXT NOT NULL,
        user_fingerprint TEXT NOT NULL,
        vote_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(review_id, user_fingerprint)
      );

      CREATE INDEX IF NOT EXISTS idx_votes_review
        ON review_votes(review_id);

      -- Provider badges
      CREATE TABLE IF NOT EXISTS provider_badges (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        badge_type TEXT NOT NULL,
        badge_label TEXT NOT NULL,
        badge_label_fa TEXT NOT NULL,
        description TEXT,
        description_fa TEXT,
        awarded_at TEXT NOT NULL,
        expires_at TEXT,
        auto_generated INTEGER DEFAULT 1,
        UNIQUE(provider_id, badge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_badges_provider
        ON provider_badges(provider_id);

      -- Price accuracy log
      CREATE TABLE IF NOT EXISTS price_accuracy_log (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        provider_price REAL NOT NULL,
        market_average REAL NOT NULL,
        deviation_percent REAL NOT NULL,
        logged_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_accuracy_provider_date
        ON price_accuracy_log(provider_id, logged_at);

      CREATE INDEX IF NOT EXISTS idx_accuracy_product
        ON price_accuracy_log(product_id);

      -- Provider warnings
      CREATE TABLE IF NOT EXISTS provider_warnings (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        warning_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        message TEXT NOT NULL,
        message_fa TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_warnings_active
        ON provider_warnings(provider_id, active);

      -- Provider uptime tracking
      CREATE TABLE IF NOT EXISTS provider_uptime_log (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        check_time TEXT NOT NULL,
        is_online INTEGER NOT NULL,
        response_time_ms INTEGER,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_uptime_provider_time
        ON provider_uptime_log(provider_id, check_time);
    `);

    logger.info('Trust system tables initialized');
  }

  // ==================== Trust System Methods ====================

  // Price Accuracy Methods
  logPriceAccuracy(
    providerId: string,
    productId: string,
    providerPrice: number,
    marketAverage: number
  ): void {
    if (!this.db || marketAverage === 0) return;

    const deviation = ((providerPrice - marketAverage) / marketAverage) * 100;
    const id = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.db.prepare(`
      INSERT INTO price_accuracy_log (id, provider_id, product_id, provider_price, market_average, deviation_percent, logged_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, providerId, productId, providerPrice, marketAverage, deviation, new Date().toISOString());
  }

  getPriceAccuracyStats(providerId: string, days: number = 7): PriceAccuracyStats | undefined {
    if (!this.db) return undefined;

    const row = this.db.prepare(`
      SELECT
        COUNT(*) as sample_count,
        AVG(deviation_percent) as avg_deviation,
        AVG(ABS(deviation_percent)) as avg_abs_deviation,
        MIN(deviation_percent) as min_deviation,
        MAX(deviation_percent) as max_deviation
      FROM price_accuracy_log
      WHERE provider_id = ?
        AND logged_at > datetime('now', '-' || ? || ' days')
    `).get(providerId, days) as PriceAccuracyStatsRow | undefined;

    if (!row || row.sample_count === 0) return undefined;

    return {
      sampleCount: row.sample_count,
      avgDeviation: row.avg_deviation,
      avgAbsDeviation: row.avg_abs_deviation,
      minDeviation: row.min_deviation,
      maxDeviation: row.max_deviation,
    };
  }

  // Uptime Methods
  logUptimeCheck(
    providerId: string,
    isOnline: boolean,
    responseTimeMs?: number,
    errorMessage?: string
  ): void {
    if (!this.db) return;

    const id = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.db.prepare(`
      INSERT INTO provider_uptime_log (id, provider_id, check_time, is_online, response_time_ms, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, providerId, new Date().toISOString(), isOnline ? 1 : 0, responseTimeMs ?? null, errorMessage ?? null);
  }

  getUptimeStats(providerId: string, days: number = 30): UptimeStats | undefined {
    if (!this.db) return undefined;

    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total_checks,
        SUM(is_online) as online_checks,
        AVG(response_time_ms) as avg_response_time
      FROM provider_uptime_log
      WHERE provider_id = ?
        AND check_time > datetime('now', '-' || ? || ' days')
    `).get(providerId, days) as UptimeStatsRow | undefined;

    if (!row || row.total_checks === 0) return undefined;

    return {
      totalChecks: row.total_checks,
      onlineChecks: row.online_checks,
      uptimePercent: (row.online_checks / row.total_checks) * 100,
      avgResponseTimeMs: row.avg_response_time,
    };
  }

  // Trust Score Methods
  saveTrustScore(score: TrustScoreRecord): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT OR REPLACE INTO provider_trust_scores
        (id, provider_id, overall_score, price_accuracy_score, uptime_score, review_score, freshness_score, calculated_at, factors_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      score.id,
      score.providerId,
      score.overallScore,
      score.priceAccuracyScore,
      score.uptimeScore,
      score.reviewScore,
      score.freshnessScore,
      score.calculatedAt,
      score.factorsJson ?? null
    );
  }

  getLatestTrustScore(providerId: string): TrustScoreRecord | undefined {
    if (!this.db) return undefined;

    const row = this.db.prepare(`
      SELECT * FROM provider_trust_scores
      WHERE provider_id = ?
      ORDER BY calculated_at DESC
      LIMIT 1
    `).get(providerId) as TrustScoreRow | undefined;

    return row ? this.rowToTrustScore(row) : undefined;
  }

  getAllLatestTrustScores(): TrustScoreRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT t1.* FROM provider_trust_scores t1
      INNER JOIN (
        SELECT provider_id, MAX(calculated_at) as max_date
        FROM provider_trust_scores
        GROUP BY provider_id
      ) t2 ON t1.provider_id = t2.provider_id AND t1.calculated_at = t2.max_date
      ORDER BY t1.overall_score DESC
    `).all() as TrustScoreRow[];

    return rows.map(row => this.rowToTrustScore(row));
  }

  getTrustScoreHistory(providerId: string, days: number = 7): TrustScoreRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM provider_trust_scores
      WHERE provider_id = ?
        AND calculated_at > datetime('now', '-' || ? || ' days')
      ORDER BY calculated_at ASC
    `).all(providerId, days) as TrustScoreRow[];

    return rows.map(row => this.rowToTrustScore(row));
  }

  // Badge Methods
  saveBadge(badge: BadgeRecord): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT OR REPLACE INTO provider_badges
        (id, provider_id, badge_type, badge_label, badge_label_fa, description, description_fa, awarded_at, expires_at, auto_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      badge.id,
      badge.providerId,
      badge.badgeType,
      badge.badgeLabel,
      badge.badgeLabelFa,
      badge.description ?? null,
      badge.descriptionFa ?? null,
      badge.awardedAt,
      badge.expiresAt ?? null,
      badge.autoGenerated ? 1 : 0
    );
  }

  getProviderBadges(providerId: string): BadgeRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM provider_badges
      WHERE provider_id = ?
        AND (expires_at IS NULL OR expires_at > datetime('now'))
    `).all(providerId) as BadgeRow[];

    return rows.map(row => this.rowToBadge(row));
  }

  removeBadge(providerId: string, badgeType: string): void {
    if (!this.db) return;

    this.db.prepare(`
      DELETE FROM provider_badges
      WHERE provider_id = ? AND badge_type = ?
    `).run(providerId, badgeType);
  }

  // Warning Methods
  createWarning(warning: WarningRecord): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO provider_warnings
        (id, provider_id, warning_type, severity, message, message_fa, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      warning.id,
      warning.providerId,
      warning.warningType,
      warning.severity,
      warning.message,
      warning.messageFa,
      warning.createdAt
    );
  }

  getActiveWarnings(providerId?: string): WarningRecord[] {
    if (!this.db) return [];

    let query = `SELECT * FROM provider_warnings WHERE active = 1`;
    const params: string[] = [];

    if (providerId) {
      query += ` AND provider_id = ?`;
      params.push(providerId);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = this.db.prepare(query).all(...params) as WarningRow[];
    return rows.map(row => this.rowToWarning(row));
  }

  resolveWarning(warningId: string): void {
    if (!this.db) return;

    this.db.prepare(`
      UPDATE provider_warnings
      SET active = 0, resolved_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), warningId);
  }

  // Review Methods
  saveReview(review: ReviewRecord): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO provider_reviews
        (id, provider_id, user_id, user_fingerprint, rating, title, content, pros, cons, transaction_verified, helpful_count, report_count, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      review.id,
      review.providerId,
      review.userId ?? null,
      review.userFingerprint,
      review.rating,
      review.title ?? null,
      review.content ?? null,
      review.pros ?? null,
      review.cons ?? null,
      review.transactionVerified ? 1 : 0,
      review.helpfulCount,
      review.reportCount,
      review.status,
      review.createdAt,
      review.updatedAt ?? null
    );
  }

  getProviderReviews(providerId: string, limit: number = 50, offset: number = 0): ReviewRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM provider_reviews
      WHERE provider_id = ? AND status = 'active'
      ORDER BY helpful_count DESC, created_at DESC
      LIMIT ? OFFSET ?
    `).all(providerId, limit, offset) as ReviewRow[];

    return rows.map(row => this.rowToReview(row));
  }

  getReviewStats(providerId: string): ReviewStats | undefined {
    if (!this.db) return undefined;

    const row = this.db.prepare(`
      SELECT
        COUNT(*) as total_reviews,
        AVG(rating) as avg_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM provider_reviews
      WHERE provider_id = ? AND status = 'active'
    `).get(providerId) as ReviewStatsRow | undefined;

    if (!row || row.total_reviews === 0) return undefined;

    return {
      totalReviews: row.total_reviews,
      avgRating: row.avg_rating,
      distribution: {
        5: row.five_star,
        4: row.four_star,
        3: row.three_star,
        2: row.two_star,
        1: row.one_star,
      },
    };
  }

  incrementReviewHelpful(reviewId: string): void {
    if (!this.db) return;
    this.db.prepare(`UPDATE provider_reviews SET helpful_count = helpful_count + 1 WHERE id = ?`).run(reviewId);
  }

  incrementReviewReport(reviewId: string): void {
    if (!this.db) return;
    this.db.prepare(`UPDATE provider_reviews SET report_count = report_count + 1 WHERE id = ?`).run(reviewId);
  }

  checkReviewRateLimit(fingerprint: string, hours: number = 24): number {
    if (!this.db) return 0;

    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM provider_reviews
      WHERE user_fingerprint = ?
        AND created_at > datetime('now', '-' || ? || ' hours')
    `).get(fingerprint, hours) as { count: number };

    return row.count;
  }

  saveReviewVote(reviewId: string, fingerprint: string, voteType: string): boolean {
    if (!this.db) return false;

    try {
      const id = `vote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.db.prepare(`
        INSERT INTO review_votes (id, review_id, user_fingerprint, vote_type, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, reviewId, fingerprint, voteType, new Date().toISOString());
      return true;
    } catch {
      return false; // Duplicate vote
    }
  }

  // ==================== PRICE ALERTS ====================

  getAlertSetting(key: string): string | undefined {
    if (!this.db) return undefined;

    const row = this.db.prepare(`
      SELECT value FROM alert_settings WHERE key = ?
    `).get(key) as { value: string } | undefined;

    return row?.value;
  }

  setAlertSetting(key: string, value: string): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO alert_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  upsertPushSubscription(subscription: PushSubscriptionRecord): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO push_subscriptions (endpoint, p256dh, auth)
      VALUES (?, ?, ?)
      ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
    `).run(subscription.endpoint, subscription.p256dh, subscription.auth);
  }

  getPushSubscription(endpoint: string): PushSubscriptionRecord | undefined {
    if (!this.db) return undefined;

    return this.db.prepare(`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?
    `).get(endpoint) as PushSubscriptionRecord | undefined;
  }

  insertPriceAlert(alert: PriceAlertRecord): void {
    if (!this.db) return;

    this.db.prepare(`
      INSERT INTO price_alerts (id, endpoint, product_id, provider_id, price_field, low_bound, high_bound, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      alert.id,
      alert.endpoint,
      alert.productId,
      alert.providerId,
      alert.priceField,
      alert.lowBound,
      alert.highBound,
      alert.enabled ? 1 : 0
    );
  }

  getEnabledPriceAlerts(): EnabledPriceAlert[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT a.*, s.p256dh, s.auth
      FROM price_alerts a
      JOIN push_subscriptions s ON s.endpoint = a.endpoint
      WHERE a.enabled = 1
    `).all() as (PriceAlertRow & { p256dh: string; auth: string })[];

    return rows.map((row) => ({
      ...this.rowToPriceAlert(row),
      subscription: { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth },
    }));
  }

  deletePushSubscription(endpoint: string): void {
    if (!this.db) return;

    this.db.prepare(`DELETE FROM price_alerts WHERE endpoint = ?`).run(endpoint);
    this.db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).run(endpoint);
  }

  getPriceAlertsByEndpoint(endpoint: string): PriceAlertRecord[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT * FROM price_alerts WHERE endpoint = ? ORDER BY created_at DESC
    `).all(endpoint) as PriceAlertRow[];

    return rows.map((row) => this.rowToPriceAlert(row));
  }

  deletePriceAlert(id: string, endpoint: string): boolean {
    if (!this.db) return false;

    const result = this.db.prepare(`
      DELETE FROM price_alerts WHERE id = ? AND endpoint = ?
    `).run(id, endpoint);

    return result.changes > 0;
  }

  markPriceAlertFired(id: string, firedAt: string): void {
    if (!this.db) return;

    this.db.prepare(`
      UPDATE price_alerts SET last_fired_at = ? WHERE id = ?
    `).run(firedAt, id);
  }

  updatePriceAlert(
    id: string,
    endpoint: string,
    patch: { enabled?: boolean; lowBound?: number | null; highBound?: number | null }
  ): PriceAlertRecord | null {
    if (!this.db) return null;

    const row = this.db.prepare(`
      SELECT * FROM price_alerts WHERE id = ? AND endpoint = ?
    `).get(id, endpoint) as PriceAlertRow | undefined;

    if (!row) return null;

    const current = this.rowToPriceAlert(row);
    const next = {
      enabled: patch.enabled ?? current.enabled,
      lowBound: patch.lowBound !== undefined ? patch.lowBound : current.lowBound,
      highBound: patch.highBound !== undefined ? patch.highBound : current.highBound,
    };

    this.db.prepare(`
      UPDATE price_alerts SET enabled = ?, low_bound = ?, high_bound = ? WHERE id = ? AND endpoint = ?
    `).run(next.enabled ? 1 : 0, next.lowBound, next.highBound, id, endpoint);

    return { ...current, ...next };
  }

  private rowToPriceAlert(row: PriceAlertRow): PriceAlertRecord {
    return {
      id: row.id,
      endpoint: row.endpoint,
      productId: row.product_id,
      providerId: row.provider_id,
      priceField: row.price_field,
      lowBound: row.low_bound,
      highBound: row.high_bound,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      lastFiredAt: row.last_fired_at,
    };
  }

  // Helper methods for row conversion
  private rowToTrustScore(row: TrustScoreRow): TrustScoreRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      overallScore: row.overall_score,
      priceAccuracyScore: row.price_accuracy_score,
      uptimeScore: row.uptime_score,
      reviewScore: row.review_score,
      freshnessScore: row.freshness_score,
      calculatedAt: row.calculated_at,
      factorsJson: row.factors_json ?? undefined,
    };
  }

  private rowToBadge(row: BadgeRow): BadgeRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      badgeType: row.badge_type,
      badgeLabel: row.badge_label,
      badgeLabelFa: row.badge_label_fa,
      description: row.description ?? undefined,
      descriptionFa: row.description_fa ?? undefined,
      awardedAt: row.awarded_at,
      expiresAt: row.expires_at ?? undefined,
      autoGenerated: row.auto_generated === 1,
    };
  }

  private rowToWarning(row: WarningRow): WarningRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      warningType: row.warning_type,
      severity: row.severity as 'low' | 'medium' | 'high' | 'critical',
      message: row.message,
      messageFa: row.message_fa,
      active: row.active === 1,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at ?? undefined,
    };
  }

  private rowToReview(row: ReviewRow): ReviewRecord {
    return {
      id: row.id,
      providerId: row.provider_id,
      userId: row.user_id ?? undefined,
      userFingerprint: row.user_fingerprint,
      rating: row.rating,
      title: row.title ?? undefined,
      content: row.content ?? undefined,
      pros: row.pros ?? undefined,
      cons: row.cons ?? undefined,
      transactionVerified: row.transaction_verified === 1,
      helpfulCount: row.helpful_count,
      reportCount: row.report_count,
      status: row.status as 'active' | 'hidden' | 'flagged',
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined,
    };
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
    ).unref();
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

// Trust System Types
export interface PriceAccuracyStats {
  sampleCount: number;
  avgDeviation: number;
  avgAbsDeviation: number;
  minDeviation: number;
  maxDeviation: number;
}

interface PriceAccuracyStatsRow {
  sample_count: number;
  avg_deviation: number;
  avg_abs_deviation: number;
  min_deviation: number;
  max_deviation: number;
}

export interface UptimeStats {
  totalChecks: number;
  onlineChecks: number;
  uptimePercent: number;
  avgResponseTimeMs: number | null;
}

interface UptimeStatsRow {
  total_checks: number;
  online_checks: number;
  avg_response_time: number | null;
}

export interface TrustScoreRecord {
  id: string;
  providerId: string;
  overallScore: number;
  priceAccuracyScore: number;
  uptimeScore: number;
  reviewScore: number;
  freshnessScore: number;
  calculatedAt: string;
  factorsJson?: string;
}

interface TrustScoreRow {
  id: string;
  provider_id: string;
  overall_score: number;
  price_accuracy_score: number;
  uptime_score: number;
  review_score: number;
  freshness_score: number;
  calculated_at: string;
  factors_json: string | null;
}

export interface BadgeRecord {
  id: string;
  providerId: string;
  badgeType: string;
  badgeLabel: string;
  badgeLabelFa: string;
  description?: string;
  descriptionFa?: string;
  awardedAt: string;
  expiresAt?: string;
  autoGenerated: boolean;
}

interface BadgeRow {
  id: string;
  provider_id: string;
  badge_type: string;
  badge_label: string;
  badge_label_fa: string;
  description: string | null;
  description_fa: string | null;
  awarded_at: string;
  expires_at: string | null;
  auto_generated: number;
}

export interface WarningRecord {
  id: string;
  providerId: string;
  warningType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  messageFa: string;
  active: boolean;
  createdAt: string;
  resolvedAt?: string;
}

interface WarningRow {
  id: string;
  provider_id: string;
  warning_type: string;
  severity: string;
  message: string;
  message_fa: string;
  active: number;
  created_at: string;
  resolved_at: string | null;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PriceAlertRecord {
  id: string;
  endpoint: string;
  productId: string;
  providerId: string | null;
  priceField: 'buy' | 'sell';
  lowBound: number | null;
  highBound: number | null;
  enabled: boolean;
  createdAt?: string;
  lastFiredAt?: string | null;
}

export interface EnabledPriceAlert extends PriceAlertRecord {
  subscription: PushSubscriptionRecord;
}

interface PriceAlertRow {
  id: string;
  endpoint: string;
  product_id: string;
  provider_id: string | null;
  price_field: 'buy' | 'sell';
  low_bound: number | null;
  high_bound: number | null;
  enabled: number;
  created_at: string;
  last_fired_at: string | null;
}

export interface ReviewRecord {
  id: string;
  providerId: string;
  userId?: string;
  userFingerprint: string;
  rating: number;
  title?: string;
  content?: string;
  pros?: string;
  cons?: string;
  transactionVerified: boolean;
  helpfulCount: number;
  reportCount: number;
  status: 'active' | 'hidden' | 'flagged';
  createdAt: string;
  updatedAt?: string;
}

interface ReviewRow {
  id: string;
  provider_id: string;
  user_id: string | null;
  user_fingerprint: string;
  rating: number;
  title: string | null;
  content: string | null;
  pros: string | null;
  cons: string | null;
  transaction_verified: number;
  helpful_count: number;
  report_count: number;
  status: string;
  created_at: string;
  updated_at: string | null;
}

export interface ReviewStats {
  totalReviews: number;
  avgRating: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

interface ReviewStatsRow {
  total_reviews: number;
  avg_rating: number;
  five_star: number;
  four_star: number;
  three_star: number;
  two_star: number;
  one_star: number;
}
