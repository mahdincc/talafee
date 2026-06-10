import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSink } from '../src/sinks/SqliteSink.js';
import { AlertService } from '../src/services/AlertService.js';
import type { NormalizedPrice } from '../src/core/models/index.js';

function price(overrides: Partial<NormalizedPrice> = {}): NormalizedPrice {
  return {
    id: 'price-1',
    providerId: 'taline',
    productId: '18k-gold',
    symbol: 'GOLD18',
    buyPrice: 150_000_000,
    sellPrice: 148_000_000,
    avgPrice: 149_000_000,
    providerUpdatedAt: new Date(),
    fetchedAt: new Date(),
    correlationId: 'test',
    ...overrides,
  };
}

const SUBSCRIPTION = {
  endpoint: 'https://push.example.com/sub-1',
  keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
};

describe('AlertService', () => {
  let dir: string;
  let sink: SqliteSink;
  let service: AlertService;
  let sent: Array<{ endpoint: string; payload: Record<string, unknown> }>;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'talafee-alerts-'));
    sink = new SqliteSink(join(dir, 'test.db'));
    await sink.initialize();
    sent = [];
    service = new AlertService();
    service.initialize(sink, {
      sendPush: async (subscription, payload) => {
        sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
      },
    });
  });

  afterEach(async () => {
    await sink.shutdown();
    rmSync(dir, { recursive: true, force: true });
  });

  it('fires a push when the provider buy price reaches the lower bound', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      providerId: 'taline',
      lowBound: 140_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 139_500_000 })]);

    expect(sent).toHaveLength(1);
    expect(sent[0].endpoint).toBe(SUBSCRIPTION.endpoint);
    expect(sent[0].payload).toMatchObject({
      providerId: 'taline',
      productId: '18k-gold',
      price: 139_500_000,
      bound: 'low',
    });
  });

  it('fires a push when the price reaches the upper bound', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      providerId: 'taline',
      lowBound: 140_000_000,
      highBound: 160_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 161_000_000 })]);

    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ price: 161_000_000, bound: 'high' });
  });

  it('stays silent while the price is inside the band', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      providerId: 'taline',
      lowBound: 140_000_000,
      highBound: 160_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 150_000_000 })]);

    expect(sent).toHaveLength(0);
  });

  it('keeps firing on every check while the condition holds', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      providerId: 'taline',
      lowBound: 140_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 139_000_000 })]);
    await service.checkAlerts([price({ buyPrice: 138_000_000 })]);

    expect(sent).toHaveLength(2);
  });

  it('stops firing after the alert is turned off', async () => {
    service.subscribe(SUBSCRIPTION);
    const alert = service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      providerId: 'taline',
      lowBound: 140_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 139_000_000 })]);
    service.updateAlert(alert.id, SUBSCRIPTION.endpoint, { enabled: false });
    await service.checkAlerts([price({ buyPrice: 138_000_000 })]);

    expect(sent).toHaveLength(1);
  });

  it('watches every provider when no provider is set, naming the one that matched', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      lowBound: 140_000_000,
    });

    await service.checkAlerts([
      price({ providerId: 'taline', buyPrice: 150_000_000 }),
      price({ providerId: 'miligold', buyPrice: 139_000_000 }),
    ]);

    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ providerId: 'miligold', bound: 'low' });
  });

  it('compares against the sell price when the alert asks for it', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      providerId: 'taline',
      priceField: 'sell',
      highBound: 149_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 200_000_000, sellPrice: 149_500_000 })]);

    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ priceField: 'sell', price: 149_500_000, bound: 'high' });
  });

  it('rejects an alert with no bounds', () => {
    service.subscribe(SUBSCRIPTION);

    expect(() =>
      service.createAlert({ endpoint: SUBSCRIPTION.endpoint, productId: '18k-gold' })
    ).toThrow(/bound/i);
  });

  it('rejects an alert whose bounds are inverted', () => {
    service.subscribe(SUBSCRIPTION);

    expect(() =>
      service.createAlert({
        endpoint: SUBSCRIPTION.endpoint,
        productId: '18k-gold',
        lowBound: 160_000_000,
        highBound: 140_000_000,
      })
    ).toThrow(/bound/i);
  });

  it('rejects an alert for an unknown subscription', () => {
    expect(() =>
      service.createAlert({
        endpoint: 'https://push.example.com/nobody',
        productId: '18k-gold',
        lowBound: 140_000_000,
      })
    ).toThrow(/subscription/i);
  });

  it('lists only the alerts of the requesting browser', () => {
    const other = { endpoint: 'https://push.example.com/sub-2', keys: SUBSCRIPTION.keys };
    service.subscribe(SUBSCRIPTION);
    service.subscribe(other);
    service.createAlert({ endpoint: SUBSCRIPTION.endpoint, productId: '18k-gold', lowBound: 1_000 });
    service.createAlert({ endpoint: other.endpoint, productId: 'emami-coin', highBound: 2_000 });

    const alerts = service.listAlerts(SUBSCRIPTION.endpoint);

    expect(alerts).toHaveLength(1);
    expect(alerts[0].productId).toBe('18k-gold');
  });

  it('no longer fires after an alert is deleted', async () => {
    service.subscribe(SUBSCRIPTION);
    const alert = service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      lowBound: 140_000_000,
    });

    const deleted = service.deleteAlert(alert.id, SUBSCRIPTION.endpoint);
    await service.checkAlerts([price({ buyPrice: 139_000_000 })]);

    expect(deleted).toBe(true);
    expect(service.listAlerts(SUBSCRIPTION.endpoint)).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('records when an alert last fired', async () => {
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      lowBound: 140_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 139_000_000 })]);

    expect(service.listAlerts(SUBSCRIPTION.endpoint)[0].lastFiredAt).toBeTruthy();
  });

  it('prunes a dead subscription after the push service reports it gone', async () => {
    let pushCalls = 0;
    service.initialize(sink, {
      sendPush: async () => {
        pushCalls++;
        const error = new Error('gone') as Error & { statusCode: number };
        error.statusCode = 410;
        throw error;
      },
    });
    service.subscribe(SUBSCRIPTION);
    service.createAlert({
      endpoint: SUBSCRIPTION.endpoint,
      productId: '18k-gold',
      lowBound: 140_000_000,
    });

    await service.checkAlerts([price({ buyPrice: 139_000_000 })]);
    await service.checkAlerts([price({ buyPrice: 138_000_000 })]);

    expect(pushCalls).toBe(1);
    expect(service.listAlerts(SUBSCRIPTION.endpoint)).toHaveLength(0);
  });

  it('keeps the same VAPID public key across service restarts', () => {
    const first = new AlertService();
    first.initialize(sink);
    const key = first.getVapidPublicKey();

    const second = new AlertService();
    second.initialize(sink);

    expect(key).toBeTruthy();
    expect(second.getVapidPublicKey()).toBe(key);
  });
});
