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

const config: CrawlerConfig = {
  schedule: {
    priceUpdateIntervalMs: 30000,
    healthCheckIntervalMs: 300000,
    priceUpdateCron: '*/30 * * * * *',
    healthCheckCron: '*/5 * * * *',
  },
  retry: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitterMs: 250,
  },
  storage: {
    dbPath: './data/prices.db',
    historyRetentionDays: 90,
  },
  api: {
    port: parseInt(process.env['PORT'] ?? '3001', 10),
    corsOrigins: [
      'https://talafee.ir',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
  },
  providers: {
    digigold: {
      id: 'digigold',
      name: 'DigiGold',
      enabled: true,
      apiUrl: 'https://api.digikala.com/non-inventory/v1/prices/',
      timeout: 10000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 1000,
      },
    },
    taline: {
      id: 'taline',
      name: 'Taline',
      enabled: true,
      apiUrl: 'https://my.tlyn.ir/api/v1/get-price',
      timeout: 10000,
      rateLimit: {
        maxConcurrent: 2,
        minDelayMs: 500,
      },
    },
    melligold: {
      id: 'melligold',
      name: 'MelliGold',
      enabled: true,
      apiUrl: 'https://melligold.com/api/v1/exchange/buy-sell-price/',
      timeout: 10000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 1000,
      },
    },
    miligold: {
      id: 'miligold',
      name: 'MiliGold',
      enabled: true,
      apiUrl: 'https://milli.gold/api/v1/public/milli-price/detail',
      timeout: 10000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 1000,
      },
    },
    talasea: {
      id: 'talasea',
      name: 'TalaSea',
      enabled: true,
      apiUrl: 'https://api.talasea.ir/api/market/getGoldPrice',
      timeout: 10000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 1000,
      },
    },
    technogold: {
      id: 'technogold',
      name: 'TechnoGold',
      enabled: true,
      apiUrl: 'https://api2.technogold.gold/customer/tradeables/prices',
      timeout: 10000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 500,
      },
    },
    bonbast: {
      id: 'bonbast',
      name: 'Bonbast',
      enabled: true,
      apiUrl: 'https://www.bonbast.com/json',
      timeout: 15000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 2000,
      },
    },
    alanchand: {
      id: 'alanchand',
      name: 'AlanChand',
      enabled: true,
      apiUrl: 'https://alanchand.com/',
      timeout: 15000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 2000,
      },
    },
    tgju: {
      id: 'tgju',
      name: 'TGJU',
      enabled: true,
      apiUrl: 'https://www.tgju.org/',
      timeout: 15000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 2000,
      },
    },
    goldika: {
      id: 'goldika',
      name: 'Goldika',
      enabled: true,
      apiUrl: 'https://goldika.ir/gold',
      timeout: 15000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 2000,
      },
    },
    daric: {
      id: 'daric',
      name: 'Daric',
      enabled: true,
      apiUrl: 'https://daric.gold/',
      timeout: 15000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 2000,
      },
    },
    goldis: {
      id: 'goldis',
      name: 'Goldis',
      enabled: true,
      apiUrl: 'https://goldis.ir/',
      timeout: 15000,
      rateLimit: {
        maxConcurrent: 1,
        minDelayMs: 2000,
      },
    },
  },
};

export default config;
