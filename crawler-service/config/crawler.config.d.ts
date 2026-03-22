export interface RetryConfig {
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitterMs: number;
}
export interface ScheduleConfig {
    priceUpdateIntervalMs: number;
    healthCheckIntervalMs: number;
    priceUpdateCron: string;
    healthCheckCron: string;
}
export interface StorageConfig {
    dbPath: string;
    historyRetentionDays: number;
}
export interface ApiConfig {
    port: number;
    corsOrigins: string[];
}
export interface ProviderConfig {
    id: string;
    name: string;
    enabled: boolean;
    apiUrl: string;
    timeout: number;
    rateLimit: {
        maxConcurrent: number;
        minDelayMs: number;
    };
}
export interface CrawlerConfig {
    schedule: ScheduleConfig;
    retry: RetryConfig;
    storage: StorageConfig;
    api: ApiConfig;
    providers: Record<string, ProviderConfig>;
}
declare const config: CrawlerConfig;
export default config;
//# sourceMappingURL=crawler.config.d.ts.map