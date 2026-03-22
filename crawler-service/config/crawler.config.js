"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config = {
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
    },
};
exports.default = config;
//# sourceMappingURL=crawler.config.js.map