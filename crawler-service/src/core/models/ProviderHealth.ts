export interface ProviderHealth {
  providerId: string;
  name: string;
  status: HealthStatus;
  lastSuccessAt?: Date | undefined;
  lastFailureAt?: Date | undefined;
  lastError?: string | undefined;
  consecutiveFailures: number;
  successRate24h: number;
  avgResponseTimeMs: number;
  lastCheckAt: Date;
  lastPriceCount?: number | undefined;
  statusReason?: string | undefined;
}

export enum HealthStatus {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Unhealthy = 'unhealthy',
  Unknown = 'unknown',
}

export interface SystemHealth {
  status: HealthStatus;
  uptime: number;
  providers: ProviderHealth[];
  lastCrawlAt?: Date | undefined;
  nextCrawlAt?: Date | undefined;
  totalPricesInCache: number;
  dbConnected: boolean;
}
