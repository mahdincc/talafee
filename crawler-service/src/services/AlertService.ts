import { v4 as uuidv4 } from 'uuid';
import webpush from 'web-push';
import type { SqliteSink, PushSubscriptionRecord, PriceAlertRecord } from '../sinks/SqliteSink.js';
import type { NormalizedPrice } from '../core/models/index.js';
import { logger } from '../utils/index.js';

const VAPID_SUBJECT = 'mailto:support@talafee.ir';

export type PushSender = (subscription: PushSubscriptionRecord, payload: string) => Promise<void>;

export class AlertValidationError extends Error {}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface CreateAlertInput {
  endpoint: string;
  productId: string;
  providerId?: string | null;
  priceField?: 'buy' | 'sell';
  lowBound?: number | null;
  highBound?: number | null;
}

export class AlertService {
  private dbSink: SqliteSink | null = null;
  private sendPush: PushSender | null = null;
  private vapidPublicKey = '';

  initialize(dbSink: SqliteSink, options: { sendPush?: PushSender } = {}): void {
    this.dbSink = dbSink;

    const vapid = this.ensureVapidKeys();
    this.vapidPublicKey = vapid.publicKey;

    this.sendPush = options.sendPush ?? (async (subscription, payload) => {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        payload,
        {
          vapidDetails: {
            subject: VAPID_SUBJECT,
            publicKey: vapid.publicKey,
            privateKey: vapid.privateKey,
          },
        }
      );
    });

    logger.info('AlertService initialized');
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  private ensureVapidKeys(): { publicKey: string; privateKey: string } {
    const publicKey = this.dbSink!.getAlertSetting('vapid_public_key');
    const privateKey = this.dbSink!.getAlertSetting('vapid_private_key');

    if (publicKey && privateKey) {
      return { publicKey, privateKey };
    }

    const generated = webpush.generateVAPIDKeys();
    this.dbSink!.setAlertSetting('vapid_public_key', generated.publicKey);
    this.dbSink!.setAlertSetting('vapid_private_key', generated.privateKey);
    logger.info('Generated and persisted new VAPID key pair');

    return generated;
  }

  subscribe(subscription: PushSubscriptionInput): void {
    this.dbSink!.upsertPushSubscription({
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });
  }

  createAlert(input: CreateAlertInput): PriceAlertRecord {
    const lowBound = input.lowBound ?? null;
    const highBound = input.highBound ?? null;

    if (lowBound === null && highBound === null) {
      throw new AlertValidationError('At least one bound is required');
    }
    for (const bound of [lowBound, highBound]) {
      if (bound !== null && (!Number.isFinite(bound) || bound <= 0)) {
        throw new AlertValidationError('Bounds must be positive numbers');
      }
    }
    if (lowBound !== null && highBound !== null && lowBound >= highBound) {
      throw new AlertValidationError('Low bound must be below high bound');
    }
    if (!this.dbSink!.getPushSubscription(input.endpoint)) {
      throw new AlertValidationError('Unknown push subscription');
    }

    const alert: PriceAlertRecord = {
      id: uuidv4(),
      endpoint: input.endpoint,
      productId: input.productId,
      providerId: input.providerId ?? null,
      priceField: input.priceField ?? 'buy',
      lowBound,
      highBound,
      enabled: true,
    };

    this.dbSink!.insertPriceAlert(alert);
    return alert;
  }

  listAlerts(endpoint: string): PriceAlertRecord[] {
    return this.dbSink!.getPriceAlertsByEndpoint(endpoint);
  }

  deleteAlert(id: string, endpoint: string): boolean {
    return this.dbSink!.deletePriceAlert(id, endpoint);
  }

  updateAlert(
    id: string,
    endpoint: string,
    patch: { enabled?: boolean; lowBound?: number | null; highBound?: number | null }
  ): PriceAlertRecord | null {
    return this.dbSink!.updatePriceAlert(id, endpoint, patch);
  }

  async checkAlerts(prices: NormalizedPrice[]): Promise<void> {
    const alerts = this.dbSink!.getEnabledPriceAlerts();

    for (const alert of alerts) {
      for (const price of prices) {
        if (price.productId !== alert.productId) continue;
        if (alert.providerId && price.providerId !== alert.providerId) continue;

        const value = alert.priceField === 'sell' ? price.sellPrice : price.buyPrice;

        if (alert.lowBound !== null && value <= alert.lowBound) {
          await this.fire(alert, price, value, 'low');
        } else if (alert.highBound !== null && value >= alert.highBound) {
          await this.fire(alert, price, value, 'high');
        }
      }
    }
  }

  private async fire(
    alert: PriceAlertRecord & { subscription: PushSubscriptionRecord },
    price: NormalizedPrice,
    value: number,
    bound: 'low' | 'high'
  ): Promise<void> {
    const payload = JSON.stringify({
      alertId: alert.id,
      providerId: price.providerId,
      productId: alert.productId,
      priceField: alert.priceField,
      price: value,
      bound,
      lowBound: alert.lowBound,
      highBound: alert.highBound,
    });

    try {
      await this.sendPush!(alert.subscription, payload);
      this.dbSink!.markPriceAlertFired(alert.id, new Date().toISOString());
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        this.dbSink!.deletePushSubscription(alert.endpoint);
        logger.info('Pruned dead push subscription', { endpoint: alert.endpoint });
      } else {
        logger.warn('Failed to send push notification', {
          endpoint: alert.endpoint,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

let alertServiceInstance: AlertService | null = null;

export function getAlertService(): AlertService {
  if (!alertServiceInstance) {
    alertServiceInstance = new AlertService();
  }
  return alertServiceInstance;
}
